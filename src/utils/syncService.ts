/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError, getNamespaceCollection, getSettingsDocId, sanitizeDataForFirestore } from './firebase';
import { 
  ImportItem, 
  LaborPayment, 
  Customer, 
  Bill, 
  PaymentRecord, 
  TpDtShippingItem, 
  ModelOperationBreakdown, 
  Worker, 
  WorkerJob, 
  RawMaterial, 
  ModelMaterialRecipe, 
  ProductionBatch, 
  MaterialReimport, 
  LoginNotification, 
  AppSettings,
  TaskType,
  UserProfile
} from '../types';

// Map of local keys to remote collections
export const COLLECTION_MAP = {
  importItems: 'import_items',
  laborPayments: 'labor_payments',
  tpDtShippings: 'tp_dt_shippings',
  customers: 'customers',
  bills: 'bills',
  payments: 'payments',
  operationBreakdowns: 'operation_breakdowns',
  workers: 'workers',
  workerJobs: 'worker_jobs',
  rawMaterials: 'raw_materials',
  materialRecipes: 'material_recipes',
  productionBatches: 'production_batches',
  materialReimports: 'material_reimports',
  materialLogs: 'material_logs',
  loginNotifications: 'login_notifications',
  tasks: 'tasks',
  userProfiles: 'user_profiles'
};

/**
 * Checks if current logged in user is the administrator vukuli.123@gmail.com
 * or possesses an active "admin" role.
 */
export function isUserAdmin(): boolean {
  let email = auth.currentUser?.email?.toLowerCase();
  
  if (!email) {
    try {
      const savedAuth = localStorage.getItem("xuongan_auth");
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed && parsed.isAuthenticated) {
          email = parsed.email?.toLowerCase();
        }
      }
    } catch (e) {
      console.warn("isUserAdmin: failed to parse local auth", e);
    }
  }

  if (!email) return false;
  
  // To completely remove dynamic permission restrictions/limits (Bỏ chế độ phân quyền),
  // all authenticated users are granted full Administrator level privileges.
  return true;
}

/**
 * Checks if the current session is authenticated either inside Firebase Auth or via Saved Local Session fallback.
 */
export function isUserAuthenticated(): boolean {
  if (auth.currentUser) return true;
  try {
    const savedAuth = localStorage.getItem("xuongan_auth");
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth);
      return !!(parsed && parsed.isAuthenticated && parsed.email);
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Save a single document to the cloud
 */
export async function saveDocumentToCloud(collectionName: string, id: string, data: any) {
  if (!isUserAdmin()) return;
  try {
    const docRef = doc(db, getNamespaceCollection(collectionName), id);
    const sanitized = sanitizeDataForFirestore({
      ...data,
      syncedAt: Date.now()
    });
    await setDoc(docRef, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${id}`);
  }
}

/**
 * Delete a single document from the cloud
 */
export async function deleteDocumentFromCloud(collectionName: string, id: string) {
  if (!isUserAdmin()) return;
  try {
    const docRef = doc(db, getNamespaceCollection(collectionName), id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

/**
 * Sync entire local collection to Cloud via batch writes (efficient, up to 500 actions per batch)
 */
export async function uploadCollectionToCloud(collectionName: string, items: any[]) {
  if (!isUserAdmin()) return;
  try {
    const chunks = [];
    // Firestore batch limit is 500 operations
    for (let i = 0; i < items.length; i += 400) {
      chunks.push(items.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (!item.id) continue;
        const docRef = doc(db, getNamespaceCollection(collectionName), item.id);
        const sanitized = sanitizeDataForFirestore({
          ...item,
          syncedAt: Date.now()
        });
        batch.set(docRef, sanitized);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
}

/**
 * Downloads a complete collection from Cloud
 */
export async function downloadCollectionFromCloud<T>(collectionName: string): Promise<T[]> {
  if (!isUserAuthenticated()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, getNamespaceCollection(collectionName)));
    const results: T[] = [];
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data()
      } as unknown as T);
    });
    return results;
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

/**
 * Pull all data layers from Cloud and compile into a standard sync package
 */
export async function downloadAllFromCloud() {
  if (!isUserAuthenticated()) {
    throw new Error("Người dùng chưa được xác thực trên đám mây.");
  }
  
  try {
    const isMasterOrAdmin = isUserAdmin();
    const [
      importItems,
      laborPayments,
      tpDtShippings,
      customers,
      bills,
      payments,
      operationBreakdowns,
      workers,
      workerJobs,
      rawMaterials,
      materialRecipes,
      productionBatches,
      materialReimports,
      materialLogs,
      loginNotifications,
      tasks,
      userProfiles
    ] = await Promise.all([
      downloadCollectionFromCloud<ImportItem>('import_items'),
      downloadCollectionFromCloud<LaborPayment>('labor_payments'),
      downloadCollectionFromCloud<TpDtShippingItem>('tp_dt_shippings'),
      downloadCollectionFromCloud<Customer>('customers'),
      downloadCollectionFromCloud<Bill>('bills'),
      downloadCollectionFromCloud<PaymentRecord>('payments'),
      downloadCollectionFromCloud<ModelOperationBreakdown>('operation_breakdowns'),
      downloadCollectionFromCloud<Worker>('workers'),
      downloadCollectionFromCloud<WorkerJob>('worker_jobs'),
      downloadCollectionFromCloud<RawMaterial>('raw_materials'),
      downloadCollectionFromCloud<ModelMaterialRecipe>('material_recipes'),
      downloadCollectionFromCloud<ProductionBatch>('production_batches'),
      downloadCollectionFromCloud<MaterialReimport>('material_reimports'),
      downloadCollectionFromCloud<any>('material_logs'),
      downloadCollectionFromCloud<LoginNotification>('login_notifications'),
      downloadCollectionFromCloud<TaskType>('tasks'),
      isMasterOrAdmin
        ? downloadCollectionFromCloud<UserProfile>('user_profiles')
        : Promise.resolve([])
    ]);

    // Pull settings if exist
    let appSettings: any = null;
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', getSettingsDocId()));
      if (settingsDoc.exists()) {
        appSettings = settingsDoc.data();
      }
    } catch (e) {
      console.warn("Failed to fetch settings from cloud, falling back to local settings", e);
    }

    return {
      importItems,
      laborPayments,
      tpDtShippings,
      customers,
      bills,
      payments,
      operationBreakdowns,
      workers,
      workerJobs,
      rawMaterials,
      materialRecipes,
      productionBatches,
      materialReimports,
      materialLogs,
      loginNotifications,
      tasks,
      userProfiles,
      settings: appSettings,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Full bulk sync (push all local state to cloud)
 */
export async function pushAllLocalStateToCloud(localData: {
  importItems: ImportItem[];
  laborPayments: LaborPayment[];
  tpDtShippings: TpDtShippingItem[];
  customers: Customer[];
  bills: Bill[];
  payments: PaymentRecord[];
  operationBreakdowns: ModelOperationBreakdown[];
  workers: Worker[];
  workerJobs: WorkerJob[];
  rawMaterials: RawMaterial[];
  materialRecipes: ModelMaterialRecipe[];
  productionBatches: ProductionBatch[];
  materialReimports: MaterialReimport[];
  materialLogs: any[];
  loginNotifications: LoginNotification[];
  tasks: TaskType[];
  userProfiles: UserProfile[];
  settings: AppSettings;
}) {
  if (!isUserAdmin()) {
    throw new Error("Không có quyền tải lên cấu hình hệ thống hoặc chưa đăng nhập.");
  }

  try {
    // Save settings
    const sanitizedSettings = sanitizeDataForFirestore({
      ...localData.settings,
      syncedAt: Date.now()
    });
    await setDoc(doc(db, 'settings', getSettingsDocId()), sanitizedSettings);

    // Run parallel collection updates
    await Promise.all([
      uploadCollectionToCloud('import_items', localData.importItems),
      uploadCollectionToCloud('labor_payments', localData.laborPayments),
      uploadCollectionToCloud('tp_dt_shippings', localData.tpDtShippings),
      uploadCollectionToCloud('customers', localData.customers),
      uploadCollectionToCloud('bills', localData.bills),
      uploadCollectionToCloud('payments', localData.payments),
      uploadCollectionToCloud('operation_breakdowns', localData.operationBreakdowns),
      uploadCollectionToCloud('workers', localData.workers),
      uploadCollectionToCloud('worker_jobs', localData.workerJobs),
      uploadCollectionToCloud('raw_materials', localData.rawMaterials),
      uploadCollectionToCloud('material_recipes', localData.materialRecipes),
      uploadCollectionToCloud('production_batches', localData.productionBatches),
      uploadCollectionToCloud('material_reimports', localData.materialReimports),
      uploadCollectionToCloud('material_logs', localData.materialLogs || []),
      uploadCollectionToCloud('login_notifications', localData.loginNotifications.slice(0, 100)), // cap to prevent write spikes
      uploadCollectionToCloud('tasks', localData.tasks),
      uploadCollectionToCloud('user_profiles', localData.userProfiles)
    ]);
  } catch (error) {
    throw error;
  }
}
