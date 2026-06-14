/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db, getNamespaceCollection, getSettingsDocId, sanitizeDataForFirestore } from './firebase';
import { COLLECTION_MAP, isUserAdmin } from './syncService';

// Safely normalize user-facing semantic data for deep comparison, ignoring dynamic metadata keys
function cleanAndSort(val: any): any {
  if (val === undefined || val === null) {
    return null;
  }
  if (Array.isArray(val)) {
    return val.map(cleanAndSort);
  }
  if (typeof val === 'object') {
    // Check if it's a Firestore Timestamp or custom Date object
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    const sorted: any = {};
    Object.keys(val).sort().forEach(k => {
      if (k === 'syncedAt' || k === 'updatedAt') {
        return; // ignore dynamic timestamps
      }
      const v = val[k];
      if (v !== undefined && v !== null) {
        sorted[k] = cleanAndSort(v);
      }
    });
    return sorted;
  }
  return val;
}

// Full stable canonical serialization of list elements for fast and bulletproof comparison
function serializeAndClean(arr: any[]): string {
  if (!Array.isArray(arr)) return '';
  const cleaned = arr.filter(Boolean).map(item => cleanAndSort(item));
  
  // Sort items by unique ID so order shifts do not affect string equivalence
  cleaned.sort((a, b) => {
    const idA = String(a?.id || '');
    const idB = String(b?.id || '');
    return idA.localeCompare(idB);
  });
  
  return JSON.stringify(cleaned);
}

// Compare individual items
function isItemEqual(item1: any, item2: any): boolean {
  if (!item1 && !item2) return true;
  if (!item1 || !item2) return false;
  return JSON.stringify(cleanAndSort(item1)) === JSON.stringify(cleanAndSort(item2));
}

// Bidirectional merge helper to reconcile local offline items and remote cloud items
function mergeLocalAndCloud(localList: any[], remoteList: any[]): any[] {
  if (!Array.isArray(localList) || localList.length === 0) return remoteList || [];
  if (!Array.isArray(remoteList) || remoteList.length === 0) return localList || [];

  const mergedMap = new Map();
  
  // First, populate with local items
  localList.forEach(item => {
    if (item && item.id) {
      mergedMap.set(item.id, item);
    }
  });
  
  // Combine with remote items using timestamp/creation reconciliation
  remoteList.forEach(remoteItem => {
    if (remoteItem && remoteItem.id) {
      const localItem = mergedMap.get(remoteItem.id);
      if (!localItem) {
        mergedMap.set(remoteItem.id, remoteItem);
      } else {
        const localCreated = localItem.createdAt || 0;
        const remoteCreated = remoteItem.createdAt || 0;
        const localUpdated = localItem.updatedAt || 0;
        const remoteUpdated = remoteItem.updatedAt || 0;
        
        const localTime = Math.max(localCreated, localUpdated);
        const remoteTime = Math.max(remoteCreated, remoteUpdated);
        
        if (remoteTime >= localTime) {
          mergedMap.set(remoteItem.id, remoteItem);
        } else {
          mergedMap.set(remoteItem.id, localItem);
        }
      }
    }
  });
  
  return Array.from(mergedMap.values());
}

export interface RealtimeSyncProps {
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  
  laborPayments: any[];
  setLaborPayments: React.Dispatch<React.SetStateAction<any[]>>;
  
  tpDtShippings: any[];
  setTpDtShippings: React.Dispatch<React.SetStateAction<any[]>>;
  
  customers: any[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  
  bills: any[];
  setBills: React.Dispatch<React.SetStateAction<any[]>>;
  
  payments: any[];
  setPayments: React.Dispatch<React.SetStateAction<any[]>>;
  
  operationBreakdowns: any[];
  setOperationBreakdowns: React.Dispatch<React.SetStateAction<any[]>>;
  
  workers: any[];
  setWorkers: React.Dispatch<React.SetStateAction<any[]>>;
  
  workerJobs: any[];
  setWorkerJobs: React.Dispatch<React.SetStateAction<any[]>>;
  
  rawMaterials: any[];
  setRawMaterials: React.Dispatch<React.SetStateAction<any[]>>;
  
  materialRecipes: any[];
  setMaterialRecipes: React.Dispatch<React.SetStateAction<any[]>>;
  
  productionBatches: any[];
  setProductionBatches: React.Dispatch<React.SetStateAction<any[]>>;
  
  materialReimports: any[];
  setMaterialReimports: React.Dispatch<React.SetStateAction<any[]>>;
  
  tasks: any[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  
  userProfiles: any[];
  setUserProfiles: React.Dispatch<React.SetStateAction<any[]>>;

  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;

  isAuthenticated: boolean;
  userEmail: string | null;
  fbAuthLoading: boolean;
  setLastSyncTime: (time: string) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'success' | 'error') => void;
  setSyncError?: (error: string | null) => void;
  setAuthState?: React.Dispatch<React.SetStateAction<any>>;
}

export function useRealtimeSync({
  items, setItems,
  laborPayments, setLaborPayments,
  tpDtShippings, setTpDtShippings,
  customers, setCustomers,
  bills, setBills,
  payments, setPayments,
  operationBreakdowns, setOperationBreakdowns,
  workers, setWorkers,
  workerJobs, setWorkerJobs,
  rawMaterials, setRawMaterials,
  materialRecipes, setMaterialRecipes,
  productionBatches, setProductionBatches,
  materialReimports, setMaterialReimports,
  tasks, setTasks,
  userProfiles, setUserProfiles,
  settings, setSettings,
  isAuthenticated,
  userEmail,
  fbAuthLoading,
  setLastSyncTime,
  setSyncStatus,
  setSyncError,
  setAuthState
}: RealtimeSyncProps) {
  
  // Store up-to-date refs of state arrays to solve closure issues in the snapshot listeners
  const latestStates = useRef<Record<string, any[]>>({});
  
  latestStates.current = {
    importItems: items,
    laborPayments: laborPayments,
    tpDtShippings: tpDtShippings,
    customers: customers,
    bills: bills,
    payments: payments,
    operationBreakdowns: operationBreakdowns,
    workers: workers,
    workerJobs: workerJobs,
    rawMaterials: rawMaterials,
    materialRecipes: materialRecipes,
    productionBatches: productionBatches,
    materialReimports: materialReimports,
    tasks: tasks,
    userProfiles: userProfiles
  };

  // Track listeners initialization state to prevent auto-pushing local data before initial cloud load
  const listenersInitialized = useRef<{ [colKey: string]: boolean }>({});
  const settingsListenerInitialized = useRef<boolean>(false);

  // Keep track of stable canonical stringified key representations to filter out echo updates
  const lastSyncedString = useRef<{ [colKey: string]: string }>({});
  const lastSyncedSettingsString = useRef<string>('');

  // Keep track of the last known cloud state array to calculate key-based updates/deletions accurately
  const lastCloudState = useRef<{ [colKey: string]: any[] }>({});

  // Keep track of pending timeout IDs for debounced local pushes
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout | number>>({});

  useEffect(() => {
    if (fbAuthLoading || !isAuthenticated || !db || (db as any)._isMock) {
      return;
    }

    console.log("[Realtime Sync] Initializing Firestore live listeners with canonical serialization protection...");
    setSyncStatus('syncing');

    const unsubscribeList: (() => void)[] = [];

    // Define collection setups
    const collectionsToSync = [
      { key: 'importItems', colName: COLLECTION_MAP.importItems, setter: setItems },
      { key: 'laborPayments', colName: COLLECTION_MAP.laborPayments, setter: setLaborPayments },
      { key: 'tpDtShippings', colName: COLLECTION_MAP.tpDtShippings, setter: setTpDtShippings },
      { key: 'customers', colName: COLLECTION_MAP.customers, setter: setCustomers },
      { key: 'bills', colName: COLLECTION_MAP.bills, setter: setBills },
      { key: 'payments', colName: COLLECTION_MAP.payments, setter: setPayments },
      { key: 'operationBreakdowns', colName: COLLECTION_MAP.operationBreakdowns, setter: setOperationBreakdowns },
      { key: 'workers', colName: COLLECTION_MAP.workers, setter: setWorkers },
      { key: 'workerJobs', colName: COLLECTION_MAP.workerJobs, setter: setWorkerJobs },
      { key: 'rawMaterials', colName: COLLECTION_MAP.rawMaterials, setter: setRawMaterials },
      { key: 'materialRecipes', colName: COLLECTION_MAP.materialRecipes, setter: setMaterialRecipes },
      { key: 'productionBatches', colName: COLLECTION_MAP.productionBatches, setter: setProductionBatches },
      { key: 'materialReimports', colName: COLLECTION_MAP.materialReimports, setter: setMaterialReimports },
      { key: 'tasks', colName: COLLECTION_MAP.tasks, setter: setTasks },
      { key: 'userProfiles', colName: COLLECTION_MAP.userProfiles, setter: setUserProfiles }
    ];

    // Setup listener for each collection
    collectionsToSync.forEach(({ key, colName, setter }) => {
      try {
        const colRef = collection(db, getNamespaceCollection(colName));
        const unsub = onSnapshot(colRef, (snapshot) => {
          try {
            const remoteList: any[] = [];
            snapshot.forEach((doc) => {
              remoteList.push({
                id: doc.id,
                ...doc.data()
              });
            });

            const remoteStr = serializeAndClean(remoteList);
            const activeStr = lastSyncedString.current[key] || '';

            const isFirstLoad = !listenersInitialized.current[key];

            if (isFirstLoad) {
              const localList = latestStates.current[key] || [];
              const mergedList = mergeLocalAndCloud(localList, remoteList);
              console.log(`[Realtime Sync] Reconciled initial load for '${key}': ${localList.length} local / ${remoteList.length} remote -> ${mergedList.length} merged`);
              
              // Set listeners initialized FIRST to allow the upcoming setter-triggered hooks to auto-upload additions
              listenersInitialized.current[key] = true;

              // Record the remote database representation in cache so delta-sync uploader identifies newly added local items
              lastSyncedString.current[key] = remoteStr;
              lastCloudState.current[key] = remoteList;

              setter(mergedList);
            } else if (remoteStr !== activeStr) {
              console.log(`[Realtime Sync] Live cloud update received for '${key}' (${remoteList.length} items)`);
              
              if (!isFirstLoad && setAuthState) {
                const previousList = lastCloudState.current[key] || [];
                const previousMap = new Map(previousList.map(item => [item.id, item]));
                
                const addedOrModified = remoteList.filter(item => {
                  const prevItem = previousMap.get(item.id);
                  if (!prevItem) return true;
                  return !isItemEqual(item, prevItem);
                });

                const otherUserUpdates = addedOrModified.filter(item => 
                  item.updatedBy && item.updatedBy !== userEmail
                );

                if (otherUserUpdates.length > 0 && ['importItems', 'bills', 'rawMaterials'].includes(key)) {
                  otherUserUpdates.forEach(item => {
                    const id = "sync-update-" + Date.now() + "-" + item.id;
                    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString('vi-VN');
                    
                    let targetType: 'import' | 'invoice' | 'material' = 'import';
                    let title = '';
                    let targetExtra = '';

                    if (key === 'importItems') {
                      targetType = 'import';
                      title = `Tài khoản ${item.updatedBy || 'khác'} vừa cập nhật lô hàng mẫu "${item.mẫu || item.mau || ''}" (số lượng: ${item.sốLượng || item.soLuong || 0}) trong tuần ${item.weekKey || ''}.`;
                      targetExtra = item.weekKey || '';
                    } else if (key === 'bills') {
                      targetType = 'invoice';
                      title = `Tài khoản ${item.updatedBy || 'khác'} vừa viết Hoá đơn "${item.billNumber || 'Mới'}" trị giá ${(item.subtotal || 0).toLocaleString()}đ.`;
                      targetExtra = item.customerId || '';
                    } else if (key === 'rawMaterials') {
                      targetType = 'material';
                      title = `Tài khoản ${item.updatedBy || 'khác'} vừa cập nhật Định mức kho vật tư "${item.name || ''}" (Tồn kho: ${item.currentStock || 0} ${item.unit || ''}).`;
                    }

                    const newNotif = {
                      id,
                      time,
                      ip: "Firestore đám mây",
                      location: "Hệ thống liên kết đồng bộ",
                      device: title,
                      isRead: false,
                      targetType,
                      targetId: item.id,
                      targetExtra
                    };

                    setAuthState(prev => ({
                      ...prev,
                      loginNotifications: [newNotif, ...(prev?.loginNotifications || [])].slice(0, 40)
                    }));
                  });
                }
              }

              // Record current synced representation to prevent local triggers from re-uploading
              lastSyncedString.current[key] = remoteStr;
              lastCloudState.current[key] = remoteList;

              setter(remoteList);
            }

            // Mark as initialized
            listenersInitialized.current[key] = true;

            // Update sync status indicators
            const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
            setLastSyncTime(nowStr);
            setSyncStatus('success');
            if (setSyncError) setSyncError(null);
          } catch (snapErr) {
            console.error(`[Realtime Sync] Error inside snapshot processor for ${colName}:`, snapErr);
          }
        }, (error) => {
          console.warn(`[Realtime Sync] Listener error for ${colName}:`, error);
          setSyncStatus('error');
          if (setSyncError) {
            setSyncError(error?.message || String(error));
          }
        });

        unsubscribeList.push(unsub);
      } catch (err) {
        console.error(`[Realtime Sync] Failed to register listener for ${colName}:`, err);
      }
    });

    // Setup listener for settings document
    try {
      const settingsDocRef = doc(db, 'settings', getSettingsDocId());
      const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
        try {
          if (docSnap.exists()) {
            const remoteSettings = docSnap.data();
            const remoteStr = JSON.stringify(cleanAndSort(remoteSettings));
            const activeStr = lastSyncedSettingsString.current;

            if (remoteStr !== activeStr) {
              console.log("[Realtime Sync] Live settings update received from cloud");
              lastSyncedSettingsString.current = remoteStr;
              setSettings(remoteSettings);
            }
          }
          settingsListenerInitialized.current = true;
          if (setSyncError) setSyncError(null);
        } catch (settingsErr) {
          console.error("[Realtime Sync] Error inside settings snapshot processor:", settingsErr);
        }
      }, (error) => {
        console.warn("[Realtime Sync] Settings listener error:", error);
        setSyncStatus('error');
        if (setSyncError) {
          setSyncError(error?.message || String(error));
        }
      });
      unsubscribeList.push(unsubSettings);
    } catch (err) {
      console.error("[Realtime Sync] Failed to register listener for settings:", err);
    }

    return () => {
      console.log("[Realtime Sync] Tearing down Firestore live listeners...");
      unsubscribeList.forEach(unsub => unsub());

      // Clear any pending debounced sync timers to prevent memory leaks or stale background updates
      Object.values(debounceTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout as any);
      });
    };
  }, [fbAuthLoading, isAuthenticated, userEmail]);

  // Monitor and Auto-Push local changes value-by-value back to Cloud securely
  const syncLocalToCloud = (key: string, colName: string, localList: any[]) => {
    if (!isAuthenticated || !isUserAdmin() || !db || (db as any)._isMock) return;
    
    // Safety check: Skip pushing local list data before the collection's initial cloud load has initialized
    if (!listenersInitialized.current[key]) return;

    const localStr = serializeAndClean(localList);
    const activeStr = lastSyncedString.current[key] || '';

    // Loop protection: If the local list string matches our last known cloud/sync string, do nothing
    if (localStr === activeStr) {
      return;
    }

    // Clear any previous pending debounced sync for this specific collection
    if (debounceTimeouts.current[key]) {
      clearTimeout(debounceTimeouts.current[key] as any);
    }

    // Execute the actual Firebase write instantly (0ms delay) to guarantee the fastest transmission speed
    debounceTimeouts.current[key] = setTimeout(async () => {
      try {
        console.log(`[Realtime Sync] Performing instant batch save for '${key}' to Firestore...`);
        
        // Save state representation locally first to prevent incoming snapshot loops
        lastSyncedString.current[key] = localStr;

        const cloudData = lastCloudState.current[key] || [];
        
        // Keep internal cloud state cache updated
        lastCloudState.current[key] = [...localList];

        // Compute maps of local and cloud collections by unique key ID
        const localMap = new Map(localList.filter(Boolean).map(item => [item.id, item]));
        const cloudMap = new Map(cloudData.filter(Boolean).map(item => [item.id, item]));

        let operationsCount = 0;
        const batch = writeBatch(db);

        // 1. Identify additions and updates
        for (const item of localList) {
          if (!item || !item.id) continue;
          const cloudItem = cloudMap.get(item.id);
          
          if (!cloudItem || !isItemEqual(item, cloudItem)) {
            const docRef = doc(db, getNamespaceCollection(colName), item.id);
            const cleaned = sanitizeDataForFirestore({ 
              ...item,
              updatedBy: userEmail || 'vukuli.123@gmail.com',
              syncedAt: Date.now() 
            });
            batch.set(docRef, cleaned);
            operationsCount++;
            console.log(`[Realtime Sync] Queued save in batch: ${colName}/${item.id}`);
          }
        }

        // 2. Identify deletions
        for (const cloudItem of cloudData) {
          if (!cloudItem || !cloudItem.id) continue;
          if (!localMap.has(cloudItem.id)) {
            const docRef = doc(db, getNamespaceCollection(colName), cloudItem.id);
            batch.delete(docRef);
            operationsCount++;
            console.log(`[Realtime Sync] Queued delete in batch: ${colName}/${cloudItem.id}`);
          }
        }

        if (operationsCount > 0) {
          setSyncStatus('syncing');
          await batch.commit();
          console.log(`[Realtime Sync] Committed atomic batch of ${operationsCount} changes for '${key}' successfully.`);
          setSyncStatus('success');
          if (setSyncError) setSyncError(null);
        }
      } catch (err: any) {
        console.warn(`[Realtime Sync] Error committing batch for '${key}':`, err);
        setSyncStatus('error');
        if (setSyncError) {
          setSyncError(err?.message || String(err));
        }
      }
    }, 0);
  };

  // Assign individual useEffect hooks for each local list state update
  useEffect(() => { syncLocalToCloud('importItems', COLLECTION_MAP.importItems, items); }, [items]);
  useEffect(() => { syncLocalToCloud('laborPayments', COLLECTION_MAP.laborPayments, laborPayments); }, [laborPayments]);
  useEffect(() => { syncLocalToCloud('tpDtShippings', COLLECTION_MAP.tpDtShippings, tpDtShippings); }, [tpDtShippings]);
  useEffect(() => { syncLocalToCloud('customers', COLLECTION_MAP.customers, customers); }, [customers]);
  useEffect(() => { syncLocalToCloud('bills', COLLECTION_MAP.bills, bills); }, [bills]);
  useEffect(() => { syncLocalToCloud('payments', COLLECTION_MAP.payments, payments); }, [payments]);
  useEffect(() => { syncLocalToCloud('operationBreakdowns', COLLECTION_MAP.operationBreakdowns, operationBreakdowns); }, [operationBreakdowns]);
  useEffect(() => { syncLocalToCloud('workers', COLLECTION_MAP.workers, workers); }, [workers]);
  useEffect(() => { syncLocalToCloud('workerJobs', COLLECTION_MAP.workerJobs, workerJobs); }, [workerJobs]);
  useEffect(() => { syncLocalToCloud('rawMaterials', COLLECTION_MAP.rawMaterials, rawMaterials); }, [rawMaterials]);
  useEffect(() => { syncLocalToCloud('materialRecipes', COLLECTION_MAP.materialRecipes, materialRecipes); }, [materialRecipes]);
  useEffect(() => { syncLocalToCloud('productionBatches', COLLECTION_MAP.productionBatches, productionBatches); }, [productionBatches]);
  useEffect(() => { syncLocalToCloud('materialReimports', COLLECTION_MAP.materialReimports, materialReimports); }, [materialReimports]);
  useEffect(() => { syncLocalToCloud('tasks', COLLECTION_MAP.tasks, tasks); }, [tasks]);
  useEffect(() => { syncLocalToCloud('userProfiles', COLLECTION_MAP.userProfiles, userProfiles); }, [userProfiles]);

  // Sync settings when they update locally (excluding echoes)
  useEffect(() => {
    const syncSettingsLocalToCloud = async () => {
      if (!isAuthenticated || !isUserAdmin() || !db || (db as any)._isMock) return;
      if (!settingsListenerInitialized.current) return;

      const localStr = JSON.stringify(cleanAndSort(settings));
      const activeStr = lastSyncedSettingsString.current;

      if (localStr === activeStr) return;

      lastSyncedSettingsString.current = localStr;

      try {
        const settingsDocRef = doc(db, 'settings', getSettingsDocId());
        const cleaned = sanitizeDataForFirestore({ ...settings, syncedAt: Date.now() });
        await setDoc(settingsDocRef, cleaned);
        console.log("[Realtime Sync] Auto-saved system settings to cloud");
      } catch (err) {
        console.warn("[Realtime Sync] Settings auto-save error:", err);
      }
    };
    syncSettingsLocalToCloud();
  }, [settings]);
}
