/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImportItem, LaborPayment, Customer, Bill, PaymentRecord, AuthState, AppSettings, LoginNotification, TpDtShippingItem, ModelOperationBreakdown, Worker, WorkerJob, RawMaterial, ModelMaterialRecipe, ProductionBatch, MaterialReimport } from '../types';
import { getCurrentDateStr, getVietnameseWeekKey } from './dateUtils';

// Seed initial data starts empty to remove mock templates (Bỏ giới thiệu mẫu)
const INITIAL_IMPORT_ITEMS: ImportItem[] = [];

const INITIAL_CUSTOMERS: Customer[] = [];

const INITIAL_BILLS: Bill[] = [];

const INITIAL_PAYMENTS: PaymentRecord[] = [];

const INITIAL_LABOR_PAYMENTS: LaborPayment[] = [];

const INITIAL_NOTIFICATIONS: LoginNotification[] = [];

// Helper functions for safe LocalStorage execution
export function getSavedState<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading key: ${key}`, e);
    return defaultValue;
  }
}

export function saveState<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing key: ${key}`, e);
  }
}

// Initial storage set if empty
export function initLocalStorage(): void {
  if (!localStorage.getItem("xuongan_import_items")) {
    saveState("xuongan_import_items", INITIAL_IMPORT_ITEMS);
  }
  if (!localStorage.getItem("xuongan_customers")) {
    saveState("xuongan_customers", INITIAL_CUSTOMERS);
  }
  if (!localStorage.getItem("xuongan_bills")) {
    saveState("xuongan_bills", INITIAL_BILLS);
  }
  if (!localStorage.getItem("xuongan_payments")) {
    saveState("xuongan_payments", INITIAL_PAYMENTS);
  }
  if (!localStorage.getItem("xuongan_labor_payments")) {
    saveState("xuongan_labor_payments", INITIAL_LABOR_PAYMENTS);
  }
  if (!localStorage.getItem("xuongan_operation_breakdowns")) {
    saveState("xuongan_operation_breakdowns", []);
  }
  if (!localStorage.getItem("xuongan_workers")) {
    saveState("xuongan_workers", []);
  }
  if (!localStorage.getItem("xuongan_worker_jobs")) {
    saveState("xuongan_worker_jobs", []);
  }
  if (!localStorage.getItem("xuongan_raw_materials")) {
    saveState("xuongan_raw_materials", []);
  }
  if (!localStorage.getItem("xuongan_material_recipes")) {
    saveState("xuongan_material_recipes", []);
  }
  if (!localStorage.getItem("xuongan_production_batches")) {
    saveState("xuongan_production_batches", []);
  }
  if (!localStorage.getItem("xuongan_material_reimports")) {
    saveState("xuongan_material_reimports", []);
  }
  if (!localStorage.getItem("xuongan_auth")) {
    const initialAuth: AuthState = {
      isAuthenticated: false,
      email: null,
      displayName: null,
      twoFactorEnabled: false,
      twoFactorSetup: false,
      twoFactorSecret: null,
      verified2FA: false,
      loginNotifications: INITIAL_NOTIFICATIONS
    };
    saveState("xuongan_auth", initialAuth);
  }
  if (!localStorage.getItem("xuongan_settings")) {
    const initialSettings: AppSettings = {
      theme: 'light',
      currencySymbol: 'đ',
      exportFormat: 'xlsx'
    };
    saveState("xuongan_settings", initialSettings);
  }
}

// Full Database backup export
export interface DatabasePackage {
  importItems: ImportItem[];
  laborPayments?: LaborPayment[];
  tpDtShippings?: TpDtShippingItem[];
  customers: Customer[];
  bills: Bill[];
  payments: PaymentRecord[];
  operationBreakdowns?: ModelOperationBreakdown[];
  workers?: Worker[];
  workerJobs?: WorkerJob[];
  rawMaterials?: RawMaterial[];
  materialRecipes?: ModelMaterialRecipe[];
  productionBatches?: ProductionBatch[];
  materialReimports?: MaterialReimport[];
  materialLogs?: any[];
  settings: AppSettings;
  version: string;
  exportedAt: string;
}

export function exportDatabasePackage(): void {
  const data: DatabasePackage = {
    importItems: getSavedState("xuongan_import_items", []),
    laborPayments: getSavedState("xuongan_labor_payments", []),
    tpDtShippings: getSavedState("xuongan_tp_dt_shippings", []),
    customers: getSavedState("xuongan_customers", []),
    bills: getSavedState("xuongan_bills", []),
    payments: getSavedState("xuongan_payments", []),
    operationBreakdowns: getSavedState("xuongan_operation_breakdowns", []),
    workers: getSavedState("xuongan_workers", []),
    workerJobs: getSavedState("xuongan_worker_jobs", []),
    rawMaterials: getSavedState("xuongan_raw_materials", []),
    materialRecipes: getSavedState("xuongan_material_recipes", []),
    productionBatches: getSavedState("xuongan_production_batches", []),
    materialReimports: getSavedState("xuongan_material_reimports", []),
    materialLogs: getSavedState("xuongan_material_logs", []),
    settings: getSavedState("xuongan_settings", { theme: 'light', currencySymbol: 'đ', exportFormat: 'xlsx' }),
    version: "1.2",
    exportedAt: new Date().toISOString()
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const dateStr = getCurrentDateStr().replace(/-/g, "_");
  link.href = url;
  link.download = `XUONG_AN_DATABASE_BACKUP_${dateStr}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Restore Database from string
export function importDatabasePackage(jsonContent: string): boolean {
  try {
    const data = JSON.parse(jsonContent) as Partial<DatabasePackage>;
    if (data.importItems && Array.isArray(data.importItems)) {
      saveState("xuongan_import_items", data.importItems);
    }
    if (data.customers && Array.isArray(data.customers)) {
      saveState("xuongan_customers", data.customers);
    }
    if (data.bills && Array.isArray(data.bills)) {
      saveState("xuongan_bills", data.bills);
    }
    if (data.payments && Array.isArray(data.payments)) {
      saveState("xuongan_payments", data.payments);
    }
    if (data.laborPayments && Array.isArray(data.laborPayments)) {
      saveState("xuongan_labor_payments", data.laborPayments);
    } else {
      saveState("xuongan_labor_payments", []);
    }
    if (data.tpDtShippings && Array.isArray(data.tpDtShippings)) {
      saveState("xuongan_tp_dt_shippings", data.tpDtShippings);
    } else {
      saveState("xuongan_tp_dt_shippings", []);
    }
    
    // Process-specific backups
    saveState("xuongan_operation_breakdowns", data.operationBreakdowns || []);
    saveState("xuongan_workers", data.workers || []);
    saveState("xuongan_worker_jobs", data.workerJobs || []);
    saveState("xuongan_raw_materials", data.rawMaterials || []);
    saveState("xuongan_material_recipes", data.materialRecipes || []);
    saveState("xuongan_production_batches", data.productionBatches || []);
    saveState("xuongan_material_reimports", data.materialReimports || []);
    saveState("xuongan_material_logs", data.materialLogs || []);

    if (data.settings) {
      saveState("xuongan_settings", data.settings);
    }
    return true;
  } catch (e) {
    console.error("Database import failed", e);
    return false;
  }
}
