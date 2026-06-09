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

// Fast deep equals for serializable data structures
function isArraysEqual(arr1: any[] | null | undefined, arr2: any[] | null | undefined): boolean {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;

  const map1 = new Map(arr1.map(item => [item?.id, item]));
  for (const item2 of arr2) {
    if (!item2 || !item2.id) return false;
    const item1 = map1.get(item2.id);
    if (!item1) return false;
    if (JSON.stringify(item1) !== JSON.stringify(item2)) return false;
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

  useEffect(() => {
    if (!isAuthenticated || !db) {
      // If not authenticated, do not start real-time listeners
      return;
    }

    console.log("[Realtime Sync] Initializing Firestore live listeners for all collections...");
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
            remoteList.push({
              id: doc.id,
              ...doc.data()
            });
          });

          // Check if this is the initial snapshot and remote is empty but local is populated
          const isInitial = !listenersInitialized.current[key];
          listenersInitialized.current[key] = true;

          // Save last cloud state so local sync changes won't re-upload
          lastCloudState.current[key] = remoteList;

          setter((prevLocal: any[]) => {
            // If remote is empty, but local has items on INITIAL load:
            // This is a new account or a fresh sync, so we auto-upload local items to cloud
            if (isInitial && remoteList.length === 0 && prevLocal && prevLocal.length > 0 && isUserAdmin()) {
              console.log(`[Realtime Sync] Local '${key}' is populated but Firestore is empty. Initializing cloud from local state...`);
              // Let the local sync useEffect handle pushing these items to cloud
              return prevLocal;
            }

            // Sync down if cloud data differs
            if (!isArraysEqual(prevLocal, remoteList)) {
              console.log(`[Realtime Sync] Live update received for '${key}' (${remoteList.length} items from cloud)`);
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
            if (JSON.stringify(prevSettings) !== JSON.stringify(remoteSettings)) {
              console.log("[Realtime Sync] Live settings update received from cloud");
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
  // We setup auto-saving effects for each individual state
  const syncLocalToCloud = async (key: string, colName: string, localList: any[]) => {
    if (!isAuthenticated || !isUserAdmin() || !db) return;
    
    // Skip if listeners are not initialized to prevent early overrides
    if (!listenersInitialized.current[key]) return;

    const cloudData = lastCloudState.current[key] || [];
    
    // Check if there are actual diffs between local state and cloud
    if (isArraysEqual(localList, cloudData)) {
      return; // Already in-sync
    }

    console.log(`[Realtime Sync] Local differences detected on '${key}'. Auto-calculating changes...`);

    // Map by ID
    const localMap = new Map(localList.filter(Boolean).map(item => [item.id, item]));
    const cloudMap = new Map(cloudData.filter(Boolean).map(item => [item.id, item]));

    // Find custom additions and updates
    for (const item of localList) {
      if (!item || !item.id) continue;
      const cloudItem = cloudMap.get(item.id);
      
      // If new, or holds modified attributes
      if (!cloudItem || JSON.stringify(item) !== JSON.stringify(cloudItem)) {
        try {
          const docRef = doc(db, colName, item.id);
          await setDoc(docRef, { ...item, syncedAt: Date.now() });
          console.log(`[Realtime Sync] Auto-saved new/modified document to Firestore: ${colName}/${item.id}`);
        } catch (err) {
          console.warn(`[Realtime Sync] Auto-save error for document: ${colName}/${item.id}`, err);
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
          console.log(`[Realtime Sync] Auto-deleted document from Firestore: ${colName}/${cloudItem.id}`);
        } catch (err) {
          console.warn(`[Realtime Sync] Auto-delete error for document: ${colName}/${cloudItem.id}`, err);
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

  // Sync settings when they update locally
  useEffect(() => {
    const syncSettingsLocalToCloud = async () => {
      if (!isAuthenticated || !isUserAdmin() || !db) return;
      if (JSON.stringify(settings) === JSON.stringify(lastCloudSettings.current)) return;

      try {
        const settingsDocRef = doc(db, 'settings', 'global_settings');
        await setDoc(settingsDocRef, { ...settings, syncedAt: Date.now() });
        lastCloudSettings.current = settings;
        console.log("[Realtime Sync] Auto-saved system settings to cloud");
      } catch (err) {
        console.warn("[Realtime Sync] Settings auto-save error:", err);
      }
    };
    syncSettingsLocalToCloud();
  }, [settings]);
}
