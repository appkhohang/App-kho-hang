/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ImportItem {
  id: string;
  mẫu: string;
  sốLượng: number;
  đơnGiáMay: number;
  vậnChuyểnĐT_TP: number; // Đồng Tháp -> TP HCM
  vậnChuyểnTP_ĐT: number; // TP HCM -> Đồng Tháp
  ngày: string; // YYYY-MM-DD format
  weekKey: string; // e.g., "Tuần 22 - Tháng 05"
  createdAt: number;
}

export interface TpDtShippingItem {
  id: string;
  ngày: string; // YYYY-MM-DD
  nộiDung: string; // "vải", "mẫu", "nhập vải thun", etc.
  sốTiền: number;
  weekKey: string;
  createdAt: number;
}

export interface LaborPayment {
  id: string;
  weekKey: string; // Attribute to which week
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: number;
}

export interface BillItem {
  id: string;
  mẫuMã: string;
  sốLượng: number;
  đơnGiá: number;
  thànhTiền: number;
}

export interface Bill {
  id: string;
  customerId: string;
  billNumber: string; // Auto STT by model/customer
  date: string; // YYYY-MM-DD
  items: BillItem[];
  subtotal: number; // Tổng các hàng theo thành tiền
  paymentAmount: number; // Số tiền khách hàng thanh toán cho bill này
  previousDebt: number; // Số tiền nợ dồn cũ
  grandTotal: number; // Tổng cộng = subtotal + previousDebt - paymentAmount
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  initialDebt: number; // Số nợ ban đầu
  createdAt: number;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  note: string;
  createdAt: number;
}

export interface LoginNotification {
  id: string;
  time: string;
  ip: string;
  location: string;
  device: string;
  isRead: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  displayName: string | null;
  twoFactorEnabled: boolean;
  twoFactorSetup: boolean;
  twoFactorSecret: string | null;
  verified2FA: boolean;
  loginNotifications: LoginNotification[];
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  currencySymbol: string;
  exportFormat: 'xlsx' | 'csv';
  primaryColor?: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'cyan';
}

export interface ProcessOperation {
  id: string;
  name: string;
  price: number;
  multiplier?: number; // Hệ số nhân định mức cấu hình sẵn (ví dụ: ráp tay x2, may cổ x1)
  defaultWorkerId?: string; // ID thợ may mặc định phụ trách công đoạn này
}

export interface ModelOperationBreakdown {
  id: string;
  modelName: string;
  operations: ProcessOperation[];
  createdAt: number;
}

export interface Worker {
  id: string;
  name: string;
  phone?: string;
  createdAt: number;
  taskIds?: string[]; // IDs of tasks (skills) this worker is assigned/capable of
}

export interface TaskType {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorkerJob {
  id: string;
  workerId: string;
  workerName: string;
  modelName: string;
  quantity: number;
  selectedOperationIds: string[];
  unitPrice: number;
  totalAmount: number;
  date: string;
  createdAt: number;
  customPrices?: Record<string, number>;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minAlertLevel: number;
  createdAt: number;
}

export interface MaterialRecipeItem {
  materialId: string;
  consumptionRate: number;
}

export interface ModelMaterialRecipe {
  id: string;
  modelName: string;
  items: MaterialRecipeItem[];
  createdAt: number;
}

export interface ProductionBatch {
  id: string;
  modelName: string;
  targetQuantity: number;
  date: string;
  materialsUsed: {
    materialId: string;
    materialName: string;
    materialUnit: string;
    amountUsed: number;
    insufficient: boolean;
  }[];
  createdAt: number;
}

export interface MaterialReimport {
  id: string;
  materialId: string;
  materialName: string;
  quantityAdded: number;
  date: string;
  note?: string;
  createdAt: number;
}

export interface UserProfile {
  id: string; // Document ID (typically user email or generated)
  email: string;
  displayName: string;
  role: 'admin' | 'staff' | 'viewer'; // 'admin' = Quản trị viên, 'staff' = Nhập liệu/Thợ may, 'viewer' = Xem báo cáo
  createdAt: number;
  active: boolean;
  allowedTabs?: string[];
}


