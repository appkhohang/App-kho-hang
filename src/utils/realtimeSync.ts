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
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { COLLECTION_MAP, isUserAdmin } from '../utils/syncService';

// Safely normalize user-facing semantic data for deep comparison, ignoring metadata keys
function cleanObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const copy = { ...obj };
  // Remove temporary sync/metadata tags to prevent comparison loop on raw document change
  delete copy.syncedAt;
  delete copy.updatedAt;

  // Key sorting to achieve stable stringify representations
  const sorted: any = {};
  Object.keys(copy).sort().forEach(k => {
    const val = copy[k];
    if (val === undefined) {
      // Ignore undefined keys as Firestore filters them out anyways
      return;
    }
    if (Array.isArray(val)) {
      sorted[k] = val.map(item => cleanObject(item));
    } else if (val && typeof val === 'object') {
      sorted[k] = cleanObject(val);
    } else {
      sorted[k] = val;
    }
  });
  return sorted;
}

function isUserDataEqual(item1: any, item2: any): boolean {
  if (!item1 && !item2) return true;
  if (!item1 || !item2) return false;
  return JSON.stringify(cleanObject(item1)) === JSON.stringify(cleanObject(item2));
}

// Fast deep equals for serializable data structures
function isArraysEqual(arr1: any[] | null | undefined, arr2: any[] | null | undefined): boolean {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;

  const map1 = new Map(arr1.filter(Boolean).map(item => [item?.id, item]));
  for (const item2 of arr2) {
    if (!item2 || !item2.id) return false;
    const item1 = map1.get(item2.id);
    if (!item1) return false;
    if (!isUserDataEqual(item1, item2)) return false;
  }
  return true;
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
  setLastSyncTime: (time: string) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'success' | 'error') => void;
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
  setLastSyncTime,
  setSyncStatus
}: RealtimeSyncProps) {
  
  // Keep track of the last cloud-synced datasets to prevent echo/update loops
  const lastCloudState = useRef<{ [colKey: string]: any[] }>({});
  const lastCloudSettings = useRef<any>(null);
  
  // Track listeners initialization state
  const listenersInitialized = useRef<{ [colKey: string]: boolean }>({});

  // Extremely critical: Skip syncing local hooks to cloud when the update came directly from the server.
  // This breaks the infinite loop where state -> cloud -> snapshot -> state -> cloud.
  const ignoreLocalSync = useRef<{ [colKey: string]: boolean }>({});
  const ignoreLocalSettingsSync = useRef<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated || !db) {
      return;
    }

    console.log("[Realtime Sync] Initializing Firestore live listeners with loop protection...");
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
        const colRef = collection(db, colName);
        const unsub = onSnapshot(colRef, (snapshot) => {
          const remoteList: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            remoteList.push({
              id: doc.id,
              ...data
            });
          });

          const isInitial = !listenersInitialized.current[key];
          listenersInitialized.current[key] = true;

          // Save last cloud state
          lastCloudState.current[key] = remoteList;

          setter((prevLocal: any[]) => {
            // Check if there is actual semantic user data differences
            if (!isArraysEqual(prevLocal, remoteList)) {
              console.log(`[Realtime Sync] Live update received for '${key}' (${remoteList.length} items)`);
              
              // Set the flag: This local update is purely from cloud, so do not write it back.
              ignoreLocalSync.current[key] = true;
              return remoteList;
            }
            return prevLocal;
          });

          // Update sync status indicator
          const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
          setLastSyncTime(nowStr);
          setSyncStatus('success');
        }, (error) => {
          console.warn(`[Realtime Sync] Listener error for ${colName}:`, error);
          setSyncStatus('error');
        });

        unsubscribeList.push(unsub);
      } catch (err) {
        console.error(`[Realtime Sync] Failed to register listener for ${colName}:`, err);
      }
    });

    // Setup listener for settings document
    try {
      const settingsDocRef = doc(db, 'settings', 'global_settings');
      const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const remoteSettings = docSnap.data();
          lastCloudSettings.current = remoteSettings;
          setSettings((prevSettings: any) => {
            // Compare without dynamic timestamp syncedAt
            const s1 = { ...prevSettings };
            const s2 = { ...remoteSettings };
            delete s1.syncedAt;
            delete s2.syncedAt;

            if (JSON.stringify(s1) !== JSON.stringify(s2)) {
              console.log("[Realtime Sync] Live settings update received from cloud");
              ignoreLocalSettingsSync.current = true;
              return remoteSettings;
            }
            return prevSettings;
          });
        }
      }, (error) => {
        console.warn("[Realtime Sync] Settings listener error:", error);
      });
      unsubscribeList.push(unsubSettings);
    } catch (err) {
      console.error("[Realtime Sync] Failed to register listener for settings:", err);
    }

    return () => {
      console.log("[Realtime Sync] Tearing down Firestore live listeners...");
      unsubscribeList.forEach(unsub => unsub());
    };
  }, [isAuthenticated, userEmail]);

  // Monitor and Auto-Push local changes value-by-value back to Cloud
  const syncLocalToCloud = async (key: string, colName: string, localList: any[]) => {
    if (!isAuthenticated || !isUserAdmin() || !db) return;
    
    // Skip if listeners are not initialized
    if (!listenersInitialized.current[key]) return;

    // Check loop-protection flag. If true, this change originated from Firestore, so we ignore it here.
    if (ignoreLocalSync.current[key]) {
      ignoreLocalSync.current[key] = false;
      return;
    }

    const cloudData = lastCloudState.current[key] || [];
    
    // Check if there are actual diffs between local state and cloud
    if (isArraysEqual(localList, cloudData)) {
      return;
    }

    console.log(`[Realtime Sync] Local differences detected on '${key}'. Auto-saving to cloud...`);

    // Map by ID
    const localMap = new Map(localList.filter(Boolean).map(item => [item.id, item]));
    const cloudMap = new Map(cloudData.filter(Boolean).map(item => [item.id, item]));

    // Find custom additions and updates
    for (const item of localList) {
      if (!item || !item.id) continue;
      const cloudItem = cloudMap.get(item.id);
      
      // If new, or holds modified attributes
      if (!cloudItem || !isUserDataEqual(item, cloudItem)) {
        try {
          const docRef = doc(db, colName, item.id);
          const cleaned = { ...item, syncedAt: Date.now() };
          await setDoc(docRef, cleaned);
          console.log(`[Realtime Sync] Auto-saved: ${colName}/${item.id}`);
        } catch (err) {
          console.warn(`[Realtime Sync] Auto-save error: ${colName}/${item.id}`, err);
        }
      }
    }

    // Find custom deletions
    for (const cloudItem of cloudData) {
      if (!cloudItem || !cloudItem.id) continue;
      if (!localMap.has(cloudItem.id)) {
        try {
          const docRef = doc(db, colName, cloudItem.id);
          await deleteDoc(docRef);
          console.log(`[Realtime Sync] Auto-deleted: ${colName}/${cloudItem.id}`);
        } catch (err) {
          console.warn(`[Realtime Sync] Auto-delete error: ${colName}/${cloudItem.id}`, err);
        }
      }
    }

    // Keep internal sync state updated
    lastCloudState.current[key] = [...localList];
  };

  // Individual triggers on state updates
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

  // Sync settings when they update locally (excluding echo)
  useEffect(() => {
    const syncSettingsLocalToCloud = async () => {
      if (!isAuthenticated || !isUserAdmin() || !db) return;
      
      if (ignoreLocalSettingsSync.current) {
        ignoreLocalSettingsSync.current = false;
        return;
      }

      const s1 = { ...settings };
      const s2 = { ...lastCloudSettings.current };
      delete s1.syncedAt;
      delete s2.syncedAt;

      if (JSON.stringify(s1) === JSON.stringify(s2)) return;

      try {
        const settingsDocRef = doc(db, 'settings', 'global_settings');
        const cleaned = { ...settings, syncedAt: Date.now() };
        await setDoc(settingsDocRef, cleaned);
        lastCloudSettings.current = cleaned;
        console.log("[Realtime Sync] Auto-saved system settings to cloud");
      } catch (err) {
        console.warn("[Realtime Sync] Settings auto-save error:", err);
      }
    };
    syncSettingsLocalToCloud();
  }, [settings]);
}
