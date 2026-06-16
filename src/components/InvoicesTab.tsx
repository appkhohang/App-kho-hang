import React, { useState, useRef, useEffect, lazy, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, UserPlus, Receipt, DollarSign, Image, Save, Plus, 
  Trash2, Calendar, ChevronRight, Search, X, ArrowLeft, 
  TrendingUp, Activity, Download, Camera, Edit
} from 'lucide-react';
import { Customer, Bill, BillItem, PaymentRecord, ImportItem } from '../types';
import { getCurrentDateStr } from '../utils/dateUtils';

const InvoiceDetailModal = lazy(() => import('./InvoiceDetailModal'));
const PaymentReceiptModal = lazy(() => import('./PaymentReceiptModal'));
const CameraCapture = lazy(() => import('./CameraCapture'));

import { useAndroidBack } from '../hooks/useAndroidBack';
import { LazyImage } from './LazyImage';

interface InvoicesTabProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  payments: PaymentRecord[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  userRole?: 'admin' | 'staff' | 'viewer';
  resolvedTheme?: 'light' | 'dark';
  autoOpenCreateBill?: boolean;
  onAutoOpenCreateBillReset?: () => void;
  selectedCustomerId?: string;
  setSelectedCustomerId?: (id: string) => void;
  items?: ImportItem[];
}

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let res = str;
  res = res.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  res = res.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  res = res.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  res = res.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  res = res.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  res = res.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  res = res.replace(/đ/g, "d");
  res = res.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  res = res.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  res = res.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  res = res.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  res = res.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  res = res.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  res = res.replace(/Đ/g, "D");
  res = res.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, "");
  res = res.replace(/\u02C6|\u0306|\u031B/g, "");
  return res;
}

function cleansAndSortsWords(name: string): string {
  if (!name) return "";
  const noTones = removeVietnameseTones(name.trim().toLowerCase());
  const basic = noTones.replace(/[^a-z0-9\s]/gi, " ");
  return basic.split(/\s+/).filter(Boolean).sort().join(" ");
}

function isModelNameMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  return cleansAndSortsWords(nameA) === cleansAndSortsWords(nameB);
}

export default function InvoicesTab({
  customers,
  setCustomers,
  bills,
  setBills,
  payments,
  setPayments,
  userRole = 'viewer',
  resolvedTheme = 'light',
  autoOpenCreateBill = false,
  onAutoOpenCreateBillReset,
  selectedCustomerId: externalSelectedCustomerId,
  setSelectedCustomerId: externalSetSelectedCustomerId,
  items = []
}: InvoicesTabProps) {
  const isViewer = false;
  // Selected customer context
  const [localSelectedCustomerId, setLocalSelectedCustomerId] = useState<string>('');
  const selectedCustomerId = externalSelectedCustomerId !== undefined ? externalSelectedCustomerId : localSelectedCustomerId;
  const setSelectedCustomerId = externalSetSelectedCustomerId !== undefined ? externalSetSelectedCustomerId : setLocalSelectedCustomerId;
  
  // Search query for customers
  const [customerSearch, setCustomerSearch] = useState('');

  // Search query for bought models of selected customer
  const [modelSearch, setModelSearch] = useState('');
  
  // New Customer Form State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerInitialDebt, setNewCustomerInitialDebt] = useState<number | ''>('');
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<string | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  // Edit Customer Form State
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerInitialDebt, setEditCustomerInitialDebt] = useState<number | ''>('');
  const [editCustomerPhoto, setEditCustomerPhoto] = useState<string | null>(null);

  // Toggle invoice writer drawer & statistics overlay
  const [isWritingInvoice, setIsWritingInvoice] = useState(false);
  const [openedFromDirectory, setOpenedFromDirectory] = useState(false);
  const [statsCustomer, setStatsCustomer] = useState<Customer | null>(null);

  // High-fidelity modal states matching user's screenshot exactly
  const [modalDraftItems, setModalDraftItems] = useState<Omit<BillItem, 'id'>[]>([
    { mẫuMã: '', sốLượng: '', đơnGiá: '', thànhTiền: 0 } as any
  ]);
  const [billGhiChú, setBillGhiChú] = useState('');
  const [modalPaymentAmount, setModalPaymentAmount] = useState<number | ''>('');
  const [modalHasPaid, setModalHasPaid] = useState<boolean>(false);
  const [invoicePhoto, setInvoicePhoto] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  const [focusedItemIdx, setFocusedItemIdx] = useState<number | null>(null);

  // Load saved profit estimates for price mapping
  const savedEstimates = useMemo(() => {
    try {
      const saved = localStorage.getItem('xuongan_saved_profit_estimates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  // Compute warehouse catalog of items with their actual stock and default pricing
  const warehouseCatalog = useMemo(() => {
    // 1. Find all models from items (goods imports) & bills
    const modelsSet = new Set<string>();
    const safeItems = items || [];
    
    safeItems.forEach(it => {
      if (it.mẫu && it.mẫu.trim()) {
        modelsSet.add(it.mẫu.trim());
      }
    });

    bills.forEach(b => {
      if (b.items && Array.isArray(b.items)) {
        b.items.forEach(bi => {
          if (bi.mẫuMã && bi.mẫuMã.trim()) {
            modelsSet.add(bi.mẫuMã.trim());
          }
        });
      }
    });

    const uniqueModels = Array.from(modelsSet);

    // 2. Compute stock and default selling price for each
    return uniqueModels.map(modelName => {
      // Total imported
      const totalImported = safeItems
        .filter(it => it.mẫu && it.mẫu.trim().toLowerCase() === modelName.toLowerCase())
        .reduce((sum, curr) => sum + (curr.sốLượng || 0), 0);

      // Total sold
      const totalSold = bills
        .reduce((sum, b) => {
          const itemQty = b.items
            ?.filter(bi => bi.mẫuMã && bi.mẫuMã.trim().toLowerCase() === modelName.toLowerCase())
            .reduce((s, curr) => s + (curr.sốLượng || 0), 0) || 0;
          return sum + itemQty;
        }, 0);

      // Manual adjustments from localStorage
      let manualStockAdj = 0;
      try {
        const savedAdjs = localStorage.getItem('xuongan_inventory_manual_adjustments');
        if (savedAdjs) {
          const parsed = JSON.parse(savedAdjs);
          if (parsed[modelName] !== undefined) {
            manualStockAdj = parsed[modelName];
          }
        }
      } catch (e) {
        console.error(e);
      }

      const currentStock = Math.max(0, totalImported - totalSold + manualStockAdj);

      // Prices mapping
      const importPrices = safeItems
        .filter(it => it.mẫu && it.mẫu.trim().toLowerCase() === modelName.toLowerCase())
        .map(it => it.đơnGiáMay || 0)
        .filter(p => p > 0);
      const avgImportPrice = importPrices.length > 0 
        ? Math.round(importPrices.reduce((s, c) => s + c, 0) / importPrices.length)
        : 120000;

      const salePrices = bills
        .reduce((arr, b) => {
          b.items
            ?.filter(bi => bi.mẫuMã && bi.mẫuMã.trim().toLowerCase() === modelName.toLowerCase() && bi.đơnGiá > 0)
            .forEach(bi => arr.push(bi.đơnGiá));
          return arr;
        }, [] as number[]);

      let defaultSalePrice = salePrices.length > 0
        ? Math.round(salePrices.reduce((s, c) => s + c, 0) / salePrices.length)
        : Math.round(avgImportPrice * 1.35);

      // Match profit estimates from "Giá thành & lợi nhuận"
      const matchedEstimate = savedEstimates.find(
        (est: any) => est.modelName && isModelNameMatch(est.modelName, modelName)
      );
      if (matchedEstimate) {
        if (matchedEstimate.calcTargetSalePrice > 0) {
          defaultSalePrice = Math.round(matchedEstimate.calcTargetSalePrice);
        }
      }

      return {
        modelName,
        currentStock,
        defaultSalePrice
      };
    });
  }, [items, bills, savedEstimates]);

  const handleSelectModel = (idx: number, modelName: string) => {
    const matched = warehouseCatalog.find(w => w.modelName === modelName);
    const price = matched ? matched.defaultSalePrice : 125000;
    
    setModalDraftItems(prev => {
      const updated = [...prev];
      const qty = updated[idx].sốLượng;
      updated[idx] = {
        ...updated[idx],
        mẫuMã: modelName,
        đơnGiá: price,
        thànhTiền: price * Number(qty || 0)
      };
      return updated;
    });
  };

  const handleOpenNewInvoice = () => {
    setEditingBillId(null);
    setModalDraftItems([{ mẫuMã: '', sốLượng: '', đơnGiá: '', thànhTiền: 0 } as any]);
    setBillGhiChú('');
    setModalPaymentAmount('');
    setModalHasPaid(false);
    setInvoicePhoto(null);
    setIsWritingInvoice(true);
  };

  const handleCloseWritingInvoice = () => {
    setIsWritingInvoice(false);
    if (openedFromDirectory) {
      setSelectedCustomerId('');
      setOpenedFromDirectory(false);
    }
  };

  // Reset modelSearch when changing customer selection
  useEffect(() => {
    setModelSearch('');
  }, [selectedCustomerId]);

  // Auto open create bill if requested via floating action button from Home
  useEffect(() => {
    if (autoOpenCreateBill) {
      if (customers.length > 0) {
        setSelectedCustomerId(customers[0].id);
        handleOpenNewInvoice();
      } else {
        setIsAddingCustomer(true);
      }
      if (onAutoOpenCreateBillReset) {
        onAutoOpenCreateBillReset();
      }
    }
  }, [autoOpenCreateBill, customers, onAutoOpenCreateBillReset]);

  const handleOpenEditInvoice = (bill: Bill) => {
    setEditingBillId(bill.id);
    setModalDraftItems(bill.items.map(item => ({
      mẫuMã: item.mẫuMã,
      sốLượng: item.sốLượng,
      đơnGiá: item.đơnGiá,
      thànhTiền: item.thànhTiền,
      id: item.id
    } as any)));
    setBillGhiChú('');
    setModalPaymentAmount(bill.paymentAmount || '');
    setModalHasPaid(!!bill.hasPaid || (bill.paymentAmount > 0));
    setInvoicePhoto(bill.photo || null);
    setBillDate(bill.date);
    setIsWritingInvoice(true);
  };

  const calculateDebtForCustomerWithList = (custId: string, upToTime: number, customBills: Bill[]) => {
    const cust = customers.find(c => c.id === custId);
    if (!cust) return 0;

    const custBills = customBills
      .filter(b => b.customerId === custId && b.createdAt <= upToTime)
      .sort((a, b) => a.createdAt - b.createdAt);

    let runningBalance = cust.initialDebt;

    custBills.forEach(bill => {
      runningBalance += bill.subtotal - bill.paymentAmount;
    });

    const custPayments = payments
      .filter(p => p.customerId === custId && p.createdAt <= upToTime);
    
    custPayments.forEach(p => {
      runningBalance -= p.amount;
    });

    return runningBalance;
  };

  const recalculateCustomerBills = (custId: string, currentBills: Bill[]): Bill[] => {
    const cust = customers.find(c => c.id === custId);
    if (!cust) return currentBills;

    const customerBills = currentBills
      .filter(b => b.customerId === custId)
      .sort((a, b) => a.createdAt - b.createdAt);

    const otherBills = currentBills.filter(b => b.customerId !== custId);

    const updatedCustomerBills = customerBills.map(bill => {
      const prevDebt = calculateDebtForCustomerWithList(custId, bill.createdAt - 1, currentBills);
      const grandTotal = bill.subtotal + prevDebt - bill.paymentAmount;
      return {
        ...bill,
        previousDebt: prevDebt,
        grandTotal: grandTotal
      };
    });

    return [...otherBills, ...updatedCustomerBills];
  };

  // Specialized save logic for the high-fidelity modal
  const handleSaveModalBill = () => {
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền ghi sổ hóa đơn!");
      return;
    }
    if (!selectedCustomerId) {
      alert("Vui lòng chọn khách hàng trước khi lưu hóa đơn!");
      return;
    }

    // Filter valid items out of the list
    const activeItems = modalDraftItems.filter(item => 
      item.mẫuMã.trim() !== '' && 
      String(item.sốLượng) !== '' && Number(item.sốLượng) > 0
    );

    if (activeItems.length === 0) {
      alert("Hóa đơn phải chứa ít nhất 1 mặt hàng có mẫu mã và số lượng hợp lý!");
      return;
    }

    const subtotal = activeItems.reduce((sum, item) => sum + (Number(item.sốLượng || 0) * Number(item.đơnGiá || 0)), 0);
    const payment = modalHasPaid ? Number(modalPaymentAmount || 0) : 0;

    if (editingBillId) {
      const updated = bills.map(b => {
        if (b.id === editingBillId) {
          return {
            ...b,
            date: billDate,
            items: activeItems.map((item, i) => ({
              id: (item as any).id || `bi-${Date.now()}-${i}`,
              mẫuMã: item.mẫuMã.trim(),
              sốLượng: Number(item.sốLượng || 0),
              đơnGiá: Number(item.đơnGiá || 0),
              thànhTiền: Number(item.sốLượng || 0) * Number(item.đơnGiá || 0)
            })),
            subtotal,
            paymentAmount: payment,
            hasPaid: modalHasPaid,
            photo: invoicePhoto || undefined
          };
        }
        return b;
      });

      const finalBills = recalculateCustomerBills(selectedCustomerId, updated);
      setBills(finalBills);

      alert("Cập nhật hóa đơn thành công!");
    } else {
      const previousDebt = calculateCustomerCumulativeDebt(selectedCustomerId);
      const newBill: Bill = {
        id: "bill-" + Date.now(),
        customerId: selectedCustomerId,
        billNumber: "HD-" + (bills.filter(b => b.customerId === selectedCustomerId).length + 1).toString().padStart(3, '0'),
        date: billDate,
        items: activeItems.map((item, i) => ({
          id: `bi-${Date.now()}-${i}`,
          mẫuMã: item.mẫuMã.trim(),
          sốLượng: Number(item.sốLượng || 0),
          đơnGiá: Number(item.đơnGiá || 0),
          thànhTiền: Number(item.sốLượng || 0) * Number(item.đơnGiá || 0)
        })),
        subtotal,
        paymentAmount: payment,
        previousDebt,
        grandTotal: subtotal + previousDebt - payment,
        createdAt: Date.now(),
        hasPaid: modalHasPaid,
        photo: invoicePhoto || undefined
      };

      setBills(prev => [...prev, newBill]);
      alert("Ghi sổ hóa đơn thành công!");
    }

    // Reset draft
    setEditingBillId(null);
    setModalDraftItems([{ mẫuMã: '', sốLượng: '', đơnGiá: '', thànhTiền: 0 } as any]);
    setBillGhiChú('');
    setModalPaymentAmount('');
    setModalHasPaid(false);
    setInvoicePhoto(null);
    handleCloseWritingInvoice();
  };

  const handleAddModalDraftItem = () => {
    setModalDraftItems(prev => [
      ...prev,
      { mẫuMã: '', sốLượng: '', đơnGiá: '', thànhTiền: 0 } as any
    ]);
  };

  const handleUpdateModalDraftItem = (idx: number, field: keyof Omit<BillItem, 'id'>, value: any) => {
    setModalDraftItems(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        [field]: value
      };
      return updated;
    });
  };

  const handleRemoveModalDraftItem = (idx: number) => {
    setModalDraftItems(prev => prev.filter((_, i) => i !== idx));
  };

  // State for storing draft invoices per customer to isolate creation
  const [customerDraftItems, setCustomerDraftItems] = useState<Record<string, Omit<BillItem, 'id'>[]>>({});
  const [customerDraftPayments, setCustomerDraftPayments] = useState<Record<string, number | ''>>({});
  const [customerDraftDates, setCustomerDraftDates] = useState<Record<string, string>>({});

  // Helper getters/setters that route based on currently selectedCustomerId
  const billItems = selectedCustomerId ? (customerDraftItems[selectedCustomerId] || []) : [];
  const setBillItems = (updater: Omit<BillItem, 'id'>[] | ((prev: Omit<BillItem, 'id'>[]) => Omit<BillItem, 'id'>[])) => {
    if (!selectedCustomerId) return;
    setCustomerDraftItems(prev => {
      const current = prev[selectedCustomerId] || [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedCustomerId]: updated };
    });
  };

  const billPayment = selectedCustomerId ? (customerDraftPayments[selectedCustomerId] ?? '') : '';
  const setBillPayment = (value: number | '') => {
    if (!selectedCustomerId) return;
    setCustomerDraftPayments(prev => ({
      ...prev,
      [selectedCustomerId]: value
    }));
  };

  const billDate = selectedCustomerId ? (customerDraftDates[selectedCustomerId] || getCurrentDateStr()) : getCurrentDateStr();
  const setBillDate = (value: string) => {
    if (!selectedCustomerId) return;
    setCustomerDraftDates(prev => ({
      ...prev,
      [selectedCustomerId]: value
    }));
  };
  
  // Current item row template in the bill creation
  const [itemMẫuMã, setItemMẫuMã] = useState('');
  const [itemSốLượng, setItemSốLượng] = useState<number | ''>('');
  const [itemĐơnGiá, setItemĐơnGiá] = useState<number | ''>('');
  
  // Independent Quick Payment Form State
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPayCustomerId, setQuickPayCustomerId] = useState<string>('');
  const [quickPayAmount, setQuickPayAmount] = useState<number | ''>('');
  const [quickPayDate, setQuickPayDate] = useState(getCurrentDateStr());
  const [quickPayNote, setQuickPayNote] = useState('');

  // Selected Customer reference
  const currentCustomer = customers.find(c => c.id === selectedCustomerId);

  // State for showing modal with screen capture
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Bill | null>(null);
  const [selectedPaymentForModal, setSelectedPaymentForModal] = useState<PaymentRecord | null>(null);

  // Android Back button wiring for InvoicesTab Overlays
  useAndroidBack(isAddingCustomer, () => setIsAddingCustomer(false));
  useAndroidBack(isEditingCustomer, () => setIsEditingCustomer(false));
  useAndroidBack(isWritingInvoice, () => handleCloseWritingInvoice());
  useAndroidBack(isQuickPaymentOpen, () => setIsQuickPaymentOpen(false));
  useAndroidBack(selectedInvoiceForModal !== null, () => setSelectedInvoiceForModal(null));
  useAndroidBack(selectedPaymentForModal !== null, () => setSelectedPaymentForModal(null));

  // Clear current row builder inputs when switching customer
  useEffect(() => {
    setItemMẫuMã('');
    setItemSốLượng('');
    setItemĐơnGiá('');
  }, [selectedCustomerId]);

  // ADD NEW CUSTOMER
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền tạo đối tác mới!");
      return;
    }
    if (!newCustomerName) return;

    const newCust: Customer = {
      id: "cust-" + Date.now(),
      name: newCustomerName,
      phone: newCustomerPhone,
      initialDebt: Number(newCustomerInitialDebt || 0),
      createdAt: Date.now(),
      photo: newCustomerPhoto || undefined
    };

    setCustomers(prev => [...prev, newCust]);
    setSelectedCustomerId(newCust.id);
    
    // Reset inputs
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerInitialDebt('');
    setNewCustomerPhoto(null);
    setIsAddingCustomer(false);
  };

  // EDIT CUSTOMER
  const handleEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền chỉnh sửa đối tác!");
      return;
    }
    if (!editingCustomerId || !editCustomerName) return;

    const updatedCusts = customers.map(c => {
      if (c.id === editingCustomerId) {
        return {
          ...c,
          name: editCustomerName,
          phone: editCustomerPhone,
          initialDebt: Number(editCustomerInitialDebt || 0),
          photo: editCustomerPhoto || undefined
        };
      }
      return c;
    });

    setCustomers(updatedCusts);

    // If initialDebt changed, recalculate all bills for this customer and update bills state
    const originalCust = customers.find(c => c.id === editingCustomerId);
    if (originalCust && originalCust.initialDebt !== Number(editCustomerInitialDebt || 0)) {
      const calculateDebtWithCusts = (custId: string, upToTime: number, customBills: Bill[]) => {
        const cust = updatedCusts.find(c => c.id === custId);
        if (!cust) return 0;

        const custBills = customBills
          .filter(b => b.customerId === custId && b.createdAt <= upToTime)
          .sort((a, b) => a.createdAt - b.createdAt);

        let runningBalance = cust.initialDebt;

        custBills.forEach(bill => {
          runningBalance += bill.subtotal - bill.paymentAmount;
        });

        const custPayments = payments
          .filter(p => p.customerId === custId && p.createdAt <= upToTime);
        
        custPayments.forEach(p => {
          runningBalance -= p.amount;
        });

        return runningBalance;
      };

      const customerBills = bills
        .filter(b => b.customerId === editingCustomerId)
        .sort((a, b) => a.createdAt - b.createdAt);

      const otherBills = bills.filter(b => b.customerId !== editingCustomerId);

      const updatedCustomerBills = customerBills.map(bill => {
        const prevDebt = calculateDebtWithCusts(editingCustomerId, bill.createdAt - 1, bills);
        const grandTotal = bill.subtotal + prevDebt - bill.paymentAmount;
        return {
          ...bill,
          previousDebt: prevDebt,
          grandTotal: grandTotal
        };
      });

      setBills([...otherBills, ...updatedCustomerBills]);
    }

    setIsEditingCustomer(false);
    setEditingCustomerId(null);
    alert("Cập nhật thông tin khách hàng thành công!");
  };

  // CALCULATE STANDING DEBT FOR CUSTOMER
  const calculateCustomerCumulativeDebt = (custId: string, upToTime: number = Date.now()): number => {
    const cust = customers.find(c => c.id === custId);
    if (!cust) return 0;

    const custBills = bills
      .filter(b => b.customerId === custId && b.createdAt <= upToTime)
      .sort((a, b) => a.createdAt - b.createdAt);

    let runningBalance = cust.initialDebt;

    custBills.forEach(bill => {
      runningBalance += bill.subtotal - bill.paymentAmount;
    });

    const custPayments = payments
      .filter(p => p.customerId === custId && p.createdAt <= upToTime);
    
    custPayments.forEach(p => {
      runningBalance -= p.amount;
    });

    return runningBalance;
  };

  const getCustomerTotalCharges = (custId: string): number => {
    const cust = customers.find(c => c.id === custId);
    if (!cust) return 0;
    const billSum = bills.filter(b => b.customerId === custId).reduce((s, b) => s + b.subtotal, 0);
    return cust.initialDebt + billSum;
  };

  const getCustomerTotalPaid = (custId: string): number => {
    const billPaySum = bills.filter(b => b.customerId === custId).reduce((s, b) => s + b.paymentAmount, 0);
    const paySum = payments.filter(p => p.customerId === custId).reduce((s, p) => s + p.amount, 0);
    return billPaySum + paySum;
  };

  const deleteCustomer = (custId: string) => {
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền xóa dữ liệu đối tác!");
      return;
    }
    const cust = customers.find(c => c.id === custId);
    if (!cust) return;
    if (confirm(`CẢNH BÁO NGUY HIỂM! Bạn có chắc chắn muốn xoá khách hàng "${cust.name}"? Hành động này sẽ xoá TRỌN BỘ ${bills.filter(b => b.customerId === custId).length} hoá đơn và lịch sử thanh toán liên quan. Dữ liệu nợ lũy kế sẽ biến mất vĩnh viễn!`)) {
      setCustomers(prev => prev.filter(c => c.id !== custId));
      setBills(prev => prev.filter(b => b.customerId !== custId));
      setPayments(prev => prev.filter(p => p.customerId !== custId));
      if (selectedCustomerId === custId) {
        setSelectedCustomerId('');
      }
      alert("Đã xoá khách hàng thành công!");
    }
  };

  const deleteBill = (billId: string) => {
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền xóa hóa đơn!");
      return;
    }
    if (confirm("Bạn có chắc muốn xoá hoá đơn này? Dư nợ lũy kế sẽ tính toán lại tịnh tiến.")) {
      setBills(prev => prev.filter(b => b.id !== billId));
      alert("Đã xoá hoá đơn thành công!");
    }
  };

  // ADD ITEM TO COMPONENT ACTIVE DRAFT
  const handleAddBillItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemMẫuMã || !itemSốLượng || !itemĐơnGiá) return;

    const itemTotal = Number(itemSốLượng) * Number(itemĐơnGiá);
    setBillItems([
      ...billItems,
      {
        mẫuMã: itemMẫuMã,
        sốLượng: Number(itemSốLượng),
        đơnGiá: Number(itemĐơnGiá),
        thànhTiền: itemTotal
      }
    ]);

    setItemMẫuMã('');
    setItemSốLượng('');
    setItemĐơnGiá('');
  };

  const removeBillItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  // SAVE FINALIZED INVOICE TO LEDGER
  const handleSaveBill = () => {
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền ghi sổ hóa đơn mới!");
      return;
    }
    if (!selectedCustomerId) {
      alert("Vui lòng chọn khách hàng trước khi lưu hóa đơn!");
      return;
    }
    if (billItems.length === 0) {
      alert("Hóa đơn phải chứa ít nhất 1 dòng sản phẩm!");
      return;
    }

    const subtotal = billItems.reduce((sum, item) => sum + item.thànhTiền, 0);
    const payment = Number(billPayment || 0);
    const previousDebt = calculateCustomerCumulativeDebt(selectedCustomerId);

    const newBill: Bill = {
      id: "bill-" + Date.now(),
      customerId: selectedCustomerId,
      billNumber: "HD-" + (bills.filter(b => b.customerId === selectedCustomerId).length + 1).toString().padStart(3, '0'),
      date: billDate,
      items: billItems.map((item, i) => ({ ...item, id: `bi-${Date.now()}-${i}` })),
      subtotal,
      paymentAmount: payment,
      previousDebt,
      grandTotal: subtotal + previousDebt - payment,
      createdAt: Date.now()
    };

    setBills(prev => [...prev, newBill]);

    setBillItems([]);
    setBillPayment('');
    setBillDate(getCurrentDateStr());
    alert("Ghi sổ hóa đơn cho khách sỉ thành công!");
  };

  // SUBMIT PAYMENT FOR CUSTOMER
  const handleQuickPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Tài khoản của bạn là CHỈ XEM, không có quyền ghi sớ thanh toán nợ!");
      return;
    }
    if (!quickPayCustomerId || !quickPayAmount) return;

    const newPay: PaymentRecord = {
      id: "pay-" + Date.now(),
      customerId: quickPayCustomerId,
      amount: Number(quickPayAmount),
      date: quickPayDate,
      note: quickPayNote || "Thanh toán dồn công nợ sỉ",
      createdAt: Date.now()
    };

    setPayments(prev => [...prev, newPay]);
    
    setQuickPayAmount('');
    setQuickPayNote('');
    setIsQuickPaymentOpen(false);
    
    // Automatically open the beautiful Receipt Modal for this newly created payment!
    setSelectedPaymentForModal(newPay);
  };

  // Compute draft summaries
  const draftSubtotal = billItems.reduce((sum, item) => sum + item.thànhTiền, 0);
  const draftPreviousDebt = selectedCustomerId ? calculateCustomerCumulativeDebt(selectedCustomerId) : 0;
  const draftGrandTotal = draftSubtotal + draftPreviousDebt - Number(billPayment || 0);

  // Filtered customer listing based on user search query
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const isDark = resolvedTheme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  return (
    <div className={`font-sans min-h-[600px] p-2 md:p-6 rounded-3xl border shadow-xl relative flex flex-col justify-between overflow-hidden transition-all duration-300 bg-white dark:bg-[#070b09] text-slate-800 dark:text-[#e2e8f0] border-slate-200 dark:border-[#14231d] ${isDark ? 'shadow-2xl' : ''}`}>
      {isViewer && (
        <div className="z-10 p-3 mx-2 bg-[#d97706]/15 hover:bg-[#d97706]/20 border border-[#d97706]/35 rounded-xl text-xs text-[#fbbf24] font-semibold flex items-center gap-2">
          <span>⚠️ Giao diện đang ở chế độ <strong>CHỈ XEM (VIEWER)</strong>. Thao tác ghi sổ hóa đơn nợ lũy kế hay thêm mới khách hàng đang tạm thời bị khóa.</span>
        </div>
      )}
      
      {/* Decorative premium glows */}
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* ---------------------------------------------------- */}
      {/* SCREEN A: CUSTOMER DIRECTORY & OVERALL DEBT STATS    */}
      {/* ---------------------------------------------------- */}
      {!selectedCustomerId || (isWritingInvoice && openedFromDirectory) ? (
        <div className="space-y-5 flex-grow pb-24">
          
          {/* Synchronized status header (Image 2 style) */}
          <div className="flex items-center justify-between text-[11px] px-2 font-mono border-b pb-3 text-slate-450 dark:text-[#657f76] border-slate-150 dark:border-[#14231d]">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse inline-block" />
              <span>Đã đồng bộ · {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <span className="cursor-pointer transition text-slate-400 hover:text-slate-800 dark:text-[#657f76] dark:hover:text-white">Hủy</span>
          </div>

          {/* Title Header with XƯỞNG AN pill & Orange letter avatar */}
          <div className="flex items-start justify-between px-2 pt-1">
            <div className="space-y-1">
              <span className="inline-flex items-center text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono border bg-emerald-50 dark:bg-[#132a20] border-emerald-250 dark:border-[#234d3b] text-emerald-700 dark:text-[#10b981]">
                ✦ XƯỞNG AN
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Kế toán Hoá Đơn</h2>
              <p className="text-[11px] text-slate-500 dark:text-[#657f76]">Quản lý công nợ gối đầu, viết sớ giao nhận mẫu mã</p>
            </div>
            
            {/* Removed upper-right buttons as per user request */}
          </div>

          {/* Simulated tabs matching Image 2 */}
          <div className="flex border-b font-semibold text-xs border-slate-150 dark:border-[#14231d] text-slate-450 dark:text-[#657f76]">
            <button className="w-full py-2.5 text-center flex items-center justify-center gap-2 text-emerald-450 border-b-2 border-emerald-500 font-extrabold transition">
              <span>📄 Hoá Đơn</span>
            </button>
          </div>

          {/* Quick overall statistical cards row */}
          <div className="flex md:grid md:grid-cols-5 overflow-x-auto md:overflow-x-visible gap-3 px-1 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            
            {/* Metric 1: Tổng nợ phải thu */}
            <div className="p-3 rounded-2xl flex items-center gap-3 flex-shrink-0 w-56 md:w-auto snap-start border transition bg-slate-50/80 dark:bg-[#101915] border-slate-200 dark:border-[#15261f] shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-500/20 animate-pulse">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider block font-mono truncate text-slate-450 dark:text-[#657f76]">1. Tổng nợ phải thu</span>
                <p className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400 font-mono truncate">
                  {customers.reduce((sum, c) => sum + calculateCustomerCumulativeDebt(c.id), 0).toLocaleString()}đ
                </p>
              </div>
            </div>

            {/* Metric 2: Tổng lợi nhuận */}
            <div className="p-3 rounded-2xl flex items-center gap-3 flex-shrink-0 w-56 md:w-auto snap-start border transition bg-slate-50/80 dark:bg-[#101915] border-slate-200 dark:border-[#15261f] shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider block font-mono truncate text-slate-450 dark:text-[#657f76]">2. Tổng lợi nhuận</span>
                <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                  {customers.reduce((sum, c) => sum + getCustomerTotalCharges(c.id), 0).toLocaleString()}đ
                </p>
              </div>
            </div>

            {/* Metric 3: Đã bán luỹ kế */}
            <div className="p-3 rounded-2xl flex items-center gap-3 flex-shrink-0 w-56 md:w-auto snap-start border transition bg-slate-50/80 dark:bg-[#101915] border-slate-200 dark:border-[#15261f] shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-450 border border-indigo-500/20">
                <Receipt className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider block font-mono truncate text-slate-450 dark:text-[#657f76]">3. Đã bán luỹ kế</span>
                <p className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-300 font-mono truncate">
                  {bills.reduce((sum, b) => sum + b.subtotal, 0).toLocaleString()}đ
                </p>
              </div>
            </div>

            {/* Metric 4: Đã thu cash sỉ */}
            <div className="p-3 rounded-2xl flex items-center gap-3 flex-shrink-0 w-56 md:w-auto snap-start border transition bg-slate-50/80 dark:bg-[#101915] border-slate-200 dark:border-[#15261f] shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-[#10b981] dark:text-teal-400 border border-teal-500/20">
                <Activity className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider block font-mono truncate text-slate-450 dark:text-[#657f76]">4. Đã thu cash sỉ</span>
                <p className="text-xs sm:text-sm font-black text-emerald-650 dark:text-[#10b981] font-mono truncate">
                  {(bills.reduce((sum, b) => sum + b.paymentAmount, 0) + payments.reduce((sum, p) => sum + p.amount, 0)).toLocaleString()}đ
                </p>
              </div>
            </div>

            {/* Metric 5: Số đối tác sỉ */}
            <div className="p-3 rounded-2xl flex items-center gap-3 flex-shrink-0 w-56 md:w-auto snap-start border transition bg-slate-50/80 dark:bg-[#101915] border-slate-200 dark:border-[#15261f] shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-500/20">
                <UserPlus className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider block font-mono truncate text-slate-450 dark:text-[#657f76]">5. Số đối tác sỉ</span>
                <p className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 font-mono truncate">
                  {customers.length} khách hàng
                </p>
              </div>
            </div>
            
          </div>

          {/* Search box styled as beautiful pill */}
          <div className="px-1">
            <div className="relative rounded-xl flex items-center px-3.5 py-1.5 transition border bg-slate-50 dark:bg-[#101915] border-slate-200 dark:border-[#1a2d25] focus-within:border-emerald-500 dark:focus-within:border-emerald-600">
              <Search className="w-4 h-4 mr-2 text-slate-400 dark:text-[#657f76]" />
              <input
                type="text"
                placeholder="Tìm tên đối tác sỉ hoặc số điện thoại..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full text-xs bg-transparent py-1.5 border-none outline-none font-sans text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#657f76]"
              />
              {customerSearch && (
                <button onClick={() => setCustomerSearch('')} className="p-1 transition text-slate-400 hover:text-slate-700 dark:text-[#657f76] dark:hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Customer list heading section */}
          <div className="flex justify-between items-center px-2 text-[10.5px] font-extrabold tracking-wider uppercase font-mono text-slate-400 dark:text-[#657f76]">
            <span>KHÁCH HÀNG</span>
            <span>{filteredCustomers.length} KHÁCH</span>
          </div>

          {/* Main customer cards feed matching Image 2 exactly */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full text-center py-16 rounded-2xl p-6 border border-dashed bg-slate-50 dark:bg-[#101915] border-slate-200 dark:border-[#1a2d25]">
                <p className="text-xs italic text-slate-450 dark:text-[#657f76]">Chưa ghi nhận đối tác sỉ nào khớp tìm kiếm.</p>
              </div>
            ) : (
              filteredCustomers.map(cust => {
                const cDebt = calculateCustomerCumulativeDebt(cust.id);
                const totalCharges = getCustomerTotalCharges(cust.id);
                const totalPaid = getCustomerTotalPaid(cust.id);
                const invoiceCount = bills.filter(b => b.customerId === cust.id).length;
                const initials = cust.name.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "KH";

                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="rounded-2xl shadow-lg hover:shadow-md transition duration-200 cursor-pointer overflow-hidden flex flex-col justify-between border bg-slate-50/70 dark:bg-[#121c18] border-slate-200 dark:border-[#1c2d27] hover:border-emerald-500/40 dark:hover:border-emerald-700/60 hover:bg-slate-100 dark:hover:bg-[#152720]/30"
                  >
                    {/* Top block (matching Image 2 row structure) */}
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {cust.photo ? (
                          <img 
                            src={cust.photo} 
                            alt={cust.name} 
                            className="w-10 h-10 rounded-full object-cover border border-emerald-500/20" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#6c5ce7] text-white flex items-center justify-center font-extrabold text-xs border border-indigo-400/20">
                            {initials}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black leading-tight text-slate-900 dark:text-white">
                              {cust.name}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatsCustomer(cust);
                              }}
                              className="p-1 rounded text-emerald-450 hover:text-emerald-305 transition hover:bg-slate-100 dark:hover:bg-[#152720]"
                              title="Xem thống kê chi tiết khách hàng"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] block mt-0.5 text-slate-450 dark:text-[#657f76]">{invoiceCount} hoá đơn</span>
                        </div>
                      </div>

                      {/* Debt/Completed status badge matching Image 2 */}
                      <div className="flex items-center gap-1.5">
                        {cDebt > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black text-[#f87171] bg-[#7f1d1d]/15 border border-[#7f1d1d]/30 uppercase font-sans">
                            Còn nợ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black text-[#34d399] bg-[#064e3b]/15 border border-[#064e3b]/30 uppercase font-sans">
                            Hoàn tất
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                             e.stopPropagation();
                             setOpenedFromDirectory(true);
                             setSelectedCustomerId(cust.id);
                             handleOpenNewInvoice();
                          }}
                          className="mr-0.5 p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center transition shadow-md active:scale-90 cursor-pointer"
                          title="Tạo nhanh hoá đơn"
                        >
                          <Plus className="w-3 h-3 font-extrabold" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#657f76]" />
                      </div>
                    </div>

                    {/* 3-column Grid balance board matching Image 2 exactly */}
                    <div className="grid grid-cols-3 text-center border-t text-[11px] border-slate-150 dark:border-[#1a2a24]">
                      {/* Sub-block TỔNG */}
                      <div className="py-2.5 flex flex-col justify-center border-r border-slate-150 dark:border-[#1a2a24]">
                        <span className="text-[8px] font-black uppercase font-sans tracking-tight text-slate-450 dark:text-[#556b62]">TỔNG</span>
                        <span className="text-[10px] font-extrabold mt-0.5 font-mono text-slate-750 dark:text-white">
                          {totalCharges.toLocaleString()}đ
                        </span>
                      </div>
                      
                      {/* Sub-block ĐÃ TRẢ */}
                      <div className="py-2.5 flex flex-col justify-center border-r bg-emerald-500/5 dark:bg-[#10b981]/5 border-slate-150 dark:border-[#1a2a24]">
                        <span className="text-[8px] text-[#10b981] font-black uppercase font-sans tracking-tight">ĐÃ TRẢ</span>
                        <span className="text-[10px] font-black text-[#10b981] mt-0.5 font-mono">
                          {totalPaid.toLocaleString()}đ
                        </span>
                      </div>

                      {/* Sub-block CÒN NỢ */}
                      <div className="py-2.5 flex flex-col justify-center bg-red-500/5 dark:bg-[#ef4444]/5">
                        <span className="text-[8px] text-[#f87171] font-black uppercase font-sans tracking-tight">CÒN NỢ</span>
                        <span className="text-[10px] font-black text-[#ef4444] mt-0.5 font-mono">
                          {cDebt.toLocaleString()}đ
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Add Customer Dialog Overlay */}
          <AnimatePresence>
            {isAddingCustomer && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
                <div className="absolute inset-0" onClick={() => setIsAddingCustomer(false)} />
                <motion.form
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleAddCustomer}
                  className="max-w-md w-full p-5 shadow-2xl rounded-2xl z-10 space-y-4 border bg-white dark:bg-[#0e1613] border-slate-200 dark:border-[#1b2f27]"
                >
                  <div className="pb-3 flex justify-between items-center border-b border-slate-150 dark:border-[#1b2f27]">
                    <div>
                      <h3 className="text-xs font-bold tracking-widest uppercase font-mono text-slate-900 dark:text-white">Đăng ký đối tác sỉ mới</h3>
                      <p className="text-[10px] mt-0.5 text-slate-450 dark:text-[#657f76]">Khai lịch sử công nợ đầu sỉ vào sổ theo dõi</p>
                    </div>
                    <button type="button" onClick={() => setIsAddingCustomer(false)} className="transition p-1 text-slate-400 hover:text-slate-700 dark:text-[#657f76] dark:hover:text-white">
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[9.5px] uppercase font-extrabold tracking-wide mb-1.5 font-mono text-slate-500 dark:text-[#657f76]">Họ tên khách lấy sỉ *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nhà xe Chị A, Huỳnh Mai Đồng Tháp..."
                        value={newCustomerName}
                        onChange={e => setNewCustomerName(e.target.value)}
                        className="w-full border rounded-xl py-2 px-3 outline-none focus:border-emerald-600 transition font-sans bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#657f76]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] uppercase font-extrabold tracking-wide mb-1.5 font-mono text-slate-500 dark:text-[#657f76]">Số điện thoại liên hệ</label>
                      <input
                        type="text"
                        placeholder="VD: 0914.xxx.xxx"
                        value={newCustomerPhone}
                        onChange={e => setNewCustomerPhone(e.target.value)}
                        className="w-full border rounded-xl py-2 px-3 outline-none focus:border-emerald-600 transition font-mono bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#657f76]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] uppercase font-extrabold tracking-wide mb-1.5 font-mono text-slate-500 dark:text-[#657f76]">Tổng nợ cũ gối đầu gạt lại (đ)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Nhập số nợ cũ còn tồn dồn ban đầu từ trước..."
                        value={newCustomerInitialDebt}
                        onChange={e => setNewCustomerInitialDebt(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border rounded-xl py-2 px-3 outline-none focus:border-emerald-600 transition font-mono bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#657f76]"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] uppercase font-extrabold tracking-wide mb-1.5 font-mono text-slate-500 dark:text-[#657f76]">Ảnh đại diện / Hình ảnh khách hàng</label>
                      <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-slate-400 font-mono">Đang khởi tạo máy ảnh...</div>}>
                        <CameraCapture
                          onCapture={setNewCustomerPhoto}
                          initialValue={newCustomerPhoto}
                          resolvedTheme={isDark ? 'dark' : 'light'}
                        />
                      </Suspense>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomer(false)}
                      className="w-1/2 py-2.5 border rounded-xl font-medium cursor-pointer transition text-center border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 dark:border-[#1c2d27] dark:text-[#657f76] dark:hover:text-white"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 bg-[#6366f1] text-white py-2.5 rounded-xl font-bold hover:bg-[#5053e1] transition active:scale-[0.98] cursor-pointer"
                    >
                      Ghi Sổ Khách
                    </button>
                  </div>
                </motion.form>
              </div>
            )}
          </AnimatePresence>



          {/* Elegant speed dial backdrop */}
          {isSpeedDialOpen && (
            <div 
              className="fixed inset-0 z-45 bg-slate-950/40 backdrop-blur-[2px] transition-opacity" 
              onClick={() => setIsSpeedDialOpen(false)}
            />
          )}

          {/* Floating plus button speed-dial menu at bottom-right of Screen A */}
          <div className="fixed bottom-24 right-5 md:right-8 z-50 flex flex-col items-end gap-3 font-sans">
            <AnimatePresence>
              {isSpeedDialOpen && (
                <div className="flex flex-col items-end gap-3.5 pb-1">
                  {/* Option 1: Tạo hoá đơn sỉ mới */}
                  <motion.button
                    initial={{ opacity: 0, y: 15, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.92 }}
                    onClick={() => {
                      setIsSpeedDialOpen(false);
                      if (customers.length > 0) {
                        setOpenedFromDirectory(true);
                        setSelectedCustomerId(customers[0].id);
                        handleOpenNewInvoice();
                      } else {
                        setIsAddingCustomer(true);
                      }
                    }}
                    className="flex items-center gap-2 px-4.5 py-3 rounded-2xl bg-[#6366f1] hover:bg-[#5053e1] text-white text-xs font-bold shadow-2xl border border-indigo-500/20 active:scale-95 transition cursor-pointer select-none"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>Tạo hoá đơn sỉ mới</span>
                  </motion.button>

                  {/* Option 2: Thêm đối tác sỉ */}
                  <motion.button
                    initial={{ opacity: 0, y: 15, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.92 }}
                    onClick={() => {
                      setIsSpeedDialOpen(false);
                      setIsAddingCustomer(true);
                    }}
                    className="flex items-center gap-2 px-4.5 py-3 rounded-2xl bg-[#101915]/95 border border-[#1b2f27] hover:bg-[#15231e] text-white text-xs font-bold shadow-2xl active:scale-95 transition cursor-pointer select-none"
                  >
                    <UserPlus className="w-4 h-4 text-[#10b981]" />
                    <span>Thêm khách hàng sỉ</span>
                  </motion.button>
                </div>
              )}
            </AnimatePresence>

            {/* Main Floating Trigger Button with premium animations */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/50 border border-emerald-500/25 cursor-pointer active:scale-95 transition relative group"
              title="Menu Phác Thảo Hoá Đơn"
            >
              {/* Outer pulsing ring effect to attract focus */}
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping pointer-events-none group-hover:bg-emerald-500/25" />
              <motion.div
                animate={{ rotate: isSpeedDialOpen ? 135 : 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <Plus className="w-7 h-7 font-black" />
              </motion.div>
            </motion.button>
          </div>

        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* SCREEN B: DETAILED SEPARATE CUSTOMER PROFILE FEED */
        <motion.div
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -25 }}
          className="space-y-5 pb-28"
        >
          {/* Top header navigation with Back button matching Image 1 */}
          <div className="flex justify-between items-center bg-transparent py-1 select-none">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCustomerId('')}
                className={`p-2 border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer active:scale-95 ${isDark ? 'bg-[#0f1715]/40 border-[#1a2d26] text-white hover:bg-[#121f1b]' : 'bg-white border-slate-250 text-slate-800'}`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              
              {/* Interactive customer profile edit trigger block - matching self account edit style */}
              <div
                onClick={() => {
                  if (currentCustomer) {
                    setEditingCustomerId(currentCustomer.id);
                    setEditCustomerName(currentCustomer.name);
                    setEditCustomerPhone(currentCustomer.phone || '');
                    setEditCustomerInitialDebt(currentCustomer.initialDebt || 0);
                    setEditCustomerPhoto(currentCustomer.photo || null);
                    setIsEditingCustomer(true);
                  }
                }}
                className="flex items-center gap-2 cursor-pointer group active:scale-98 transition select-none"
                title="Nhấp để chỉnh sửa thông tin & ảnh khách sỉ 📷"
              >
                {/* Circle blue background avatar letter or customer photo */}
                {currentCustomer?.photo ? (
                  <img
                    src={currentCustomer.photo}
                    alt={currentCustomer.name}
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#10b981]/20 group-hover:border-[#10b981]/60 transition shrink-0 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#3b82f6] border-2 border-blue-400/20 text-white flex items-center justify-center font-black text-xs group-hover:border-blue-500 transition shrink-0 shadow-sm">
                    {currentCustomer?.name ? currentCustomer.name.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 1) : "?"}
                  </div>
                )}
                
                <span className="text-xs sm:text-sm font-black tracking-tight uppercase leading-none group-hover:underline text-slate-800 dark:text-emerald-400 group-hover:text-indigo-600 dark:group-hover:text-emerald-300">
                  {currentCustomer?.name}
                </span>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-mono text-slate-400 ml-0.5">Sửa ✏️</span>
              </div>
            </div>

            {/* Excel export matching Image 1 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  alert("Tính năng xuất dữ liệu sỉ Excel/CSV đang được xử lý sòng phẳng!");
                }}
                className="px-2.5 py-1.5 border rounded-xl transition flex items-center gap-1.5 font-bold cursor-pointer text-xs border-slate-200 dark:border-[#1a2d26] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0e1613] hover:text-slate-800 dark:hover:text-white hover:bg-slate-50"
              >
                <span className="text-[#10b981] font-mono font-black text-[9px] bg-[#10b981]/15 px-1 rounded">XLS</span>
                <span>Excel</span>
              </button>

              {currentCustomer && (
                <button
                  onClick={() => {
                    setEditingCustomerId(currentCustomer.id);
                    setEditCustomerName(currentCustomer.name);
                    setEditCustomerPhone(currentCustomer.phone || '');
                    setEditCustomerInitialDebt(currentCustomer.initialDebt || 0);
                    setEditCustomerPhoto(currentCustomer.photo || null);
                    setIsEditingCustomer(true);
                  }}
                  className="p-1.5 border border-indigo-500/20 rounded-xl text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer bg-white dark:bg-[#0e1613]"
                  title="Chỉnh sửa thông tin khách"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}
              
              <button
                onClick={() => {
                  if (confirm(`Xoá khách sỉ "${currentCustomer?.name}" và toàn bộ lịch sử hóa đơn?`)) {
                    deleteCustomer(currentCustomer!.id);
                  }
                }}
                className="p-1.5 border border-red-500/20 rounded-xl text-rose-450 hover:bg-red-500/20 transition cursor-pointer bg-white dark:bg-[#0e1613]"
                title="Xóa khách hàng"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Master CÔNG NỢ TÍCH LUỸ Box Card matching Image 1 perfectly */}
          {currentCustomer && (
            <div className="p-4 rounded-2xl shadow-lg space-y-4 border transition-all bg-slate-50 dark:bg-[#121c18] border-slate-200 dark:border-[#1c2d27] shadow-sm dark:shadow-xl">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#10b981]" />
                <h3 className="text-[9.5px] font-extrabold uppercase tracking-widest font-mono text-slate-450 dark:text-[#657f76]">CÔNG NỢ TÍCH LUỸ</h3>
              </div>

              {/* 3 columns metrics layout */}
              <div className="grid grid-cols-3 text-center border-b pb-4 border-slate-200 dark:border-[#1c2d27]/40">
                <div>
                  <span className="text-[8px] block font-black uppercase font-sans tracking-tight text-slate-450 dark:text-[#657f76]">TỔNG LỢI NHUẬN</span>
                  <span className="text-xs sm:text-sm font-black block mt-1 font-mono leading-none text-slate-800 dark:text-white">
                    {getCustomerTotalCharges(currentCustomer.id).toLocaleString()}đ
                  </span>
                </div>
                
                <div className="border-l border-r px-1 border-slate-200 dark:border-[#1c2d27]/40">
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 block font-black uppercase font-sans tracking-tight">ĐÃ TRẢ</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-[#10b981] block mt-1 font-mono leading-none">
                    {getCustomerTotalPaid(currentCustomer.id).toLocaleString()}đ
                  </span>
                </div>

                <div>
                  <span className="text-[8px] text-rose-500 dark:text-rose-450 block font-black uppercase font-sans tracking-tight">CÒN NỢ</span>
                  <span className="text-xs sm:text-sm font-black text-red-600 dark:text-rose-400 block mt-1 font-mono leading-none">
                    {calculateCustomerCumulativeDebt(currentCustomer.id).toLocaleString()}đ
                  </span>
                </div>
              </div>

              {/* Teal button for payment */}
              <button
                onClick={() => {
                  setQuickPayCustomerId(currentCustomer.id);
                  setQuickPayAmount(calculateCustomerCumulativeDebt(currentCustomer.id));
                  setQuickPayDate(getCurrentDateStr());
                  setQuickPayNote("Trả bớt tiền sỉ dồn nợ");
                  setIsQuickPaymentOpen(true);
                }}
                className="w-full bg-[#14b8a6] hover:bg-[#0ea5e9] text-white text-xs font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] transition"
              >
                <span>💳 Thanh toán ngay</span>
              </button>
            </div>
          )}



          {/* Heading under cumulative debts: HOÁ ĐƠN list & Model Search */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1 pt-1 text-[10.5px] font-extrabold tracking-wider uppercase font-mono text-slate-400 dark:text-[#657f76]">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                DANH SÁCH HOÁ ĐƠN
              </span>
              <span>{bills.filter(b => b.customerId === selectedCustomerId).length} HOÁ ĐƠN</span>
            </div>

            {/* Model Search Filter for this Customer */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300 bg-white dark:bg-[#0f1224] border-slate-205 dark:border-[#1c2d27] text-slate-800 dark:text-white shadow-2xs dark:shadow-inner">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Tìm mã / mẫu mã sản phẩm của riêng khách này..."
                value={modelSearch}
                onChange={e => setModelSearch(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder-slate-400 dark:placeholder-slate-500 font-medium text-slate-850 dark:text-slate-200"
              />
              {modelSearch && (
                <button 
                  onClick={() => setModelSearch('')} 
                  className="p-1 hover:bg-slate-205 dark:hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-650 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Detailed listing of past bills matching Image 1 exactly */}
          <div className="space-y-5">
            {(() => {
              const customerBills = bills
                .filter(b => b.customerId === selectedCustomerId)
                .filter(b => {
                  if (!modelSearch.trim()) return true;
                  const query = modelSearch.toLowerCase().trim();
                  return b.items && b.items.some(item => item.mẫuMã && item.mẫuMã.toLowerCase().includes(query));
                })
                .sort((a, b) => b.createdAt - a.createdAt);

              if (customerBills.length === 0) {
                return (
                  <div className="text-center py-12 border border-dashed rounded-xl p-6 bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]">
                    <p className="text-xs italic text-slate-450 dark:text-[#657f76]">
                      {modelSearch.trim() ? "Không tìm thấy hoá đơn nào chứa mẫu mã này." : "Chưa có hoá đơn nào cho khách sỉ này. Bấm [+ Tạo hoá đơn] ở góc dưới để lập phiếu!"}
                    </p>
                  </div>
                );
              }

               return customerBills.map((bill, index) => {
                const billNum = customerBills.length - index;
                const grandTotalLeft = bill.grandTotal;

                // Chronological billing period payment isolation logic requested by user
                const prevBillItem = index + 1 < customerBills.length ? customerBills[index + 1] : null;
                const cyclePayments = payments.filter(p => {
                  if (p.customerId !== selectedCustomerId) return false;
                  if (prevBillItem) {
                    return p.createdAt > prevBillItem.createdAt && p.createdAt <= bill.createdAt;
                  } else {
                    return p.createdAt <= bill.createdAt;
                  }
                });

                return (
                  <div
                    key={bill.id}
                    className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:border-emerald-500/35 hover:shadow-lg border bg-slate-50 dark:bg-[#111c17] border-slate-200 dark:border-[#1c2d27] hover:bg-slate-100/70 dark:hover:bg-[#13231e] hover:shadow-slate-200/50 dark:hover:shadow-emerald-950/20 text-slate-800 dark:text-white"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Left representation: Bill abbreviation */}
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center select-none shrink-0">
                        <span className="text-[7.5px] uppercase text-indigo-400 font-extrabold tracking-wider font-mono">Bill</span>
                        <span className="text-xs font-black font-mono leading-none text-indigo-600 dark:text-white">#{billNum}</span>
                      </div>
                      
                      {/* Middle: Label / Date details */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold font-mono text-slate-800 dark:text-white">{bill.billNumber || `HD-${billNum}`}</span>
                          
                          {/* Nợ/Completed pill */}
                          {grandTotalLeft > 0 ? (
                            <span className="px-1.5 py-0.2 rounded text-[7.5px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/25 uppercase font-mono">
                              CÒN NỢ
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[7.5px] font-bold text-[#10b981] bg-[#10b981]/15 border border-[#10b981]/30 uppercase font-mono">
                              ĐÃ TT
                            </span>
                          )}

                          {/* Captured receipt photo indicator */}
                          {bill.photo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingPhotoUrl(bill.photo || null);
                              }}
                              className="px-1.5 py-0.5 rounded text-[7.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-550/10 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/35 uppercase font-mono flex items-center gap-1 cursor-pointer transition select-none"
                              title="Xem ảnh chụp đính kèm của hóa đơn sỉ này"
                            >
                              <Camera className="w-2.5 h-2.5" />
                              <span>Ảnh đơn</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-450 dark:text-[#657f76]">
                          <Calendar className="w-3.5 h-3.5 text-rose-500/80" />
                          <span>{bill.date}</span>
                        </div>

                        {/* Direct Listing of bought item model codes (mẫu mã) with matching highlight */}
                        {bill.items && bill.items.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-2">
                            {bill.items.map((it, idx) => {
                              const isMatch = modelSearch.trim() && it.mẫuMã && it.mẫuMã.toLowerCase().includes(modelSearch.toLowerCase().trim());
                              return (
                                <span
                                  key={idx}
                                  className={`text-[9px] px-2 py-0.5 rounded-md font-medium transition-all ${
                                    isMatch 
                                      ? 'bg-yellow-500/25 border border-yellow-500 text-amber-600 dark:text-yellow-450 font-black scale-105 shadow-2xs' 
                                      : 'bg-indigo-50 dark:bg-[#121c19] border border-indigo-100/70 dark:border-[#1c2d27] text-indigo-650 dark:text-[#10b981]'
                                  }`}
                                >
                                  {it.mẫuMã || "mẫu sỉ"} {it.sốLượng ? `(x${it.sốLượng})` : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Revenue total + instant triggers */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-2 sm:pt-0 shrink-0">
                      {/* Total bill price */}
                      <div className="text-left sm:text-right">
                        <span className="text-[9px] block uppercase tracking-wider font-extrabold font-mono text-slate-400 dark:text-[#657f76]">TỔNG BILL</span>
                        <span className="text-xs sm:text-sm font-black font-mono text-emerald-650 dark:text-emerald-400 font-bold">
                          {bill.subtotal.toLocaleString()}đ
                        </span>
                      </div>

                      {/* Clean micro-triggers wrap */}
                      <div className="flex items-center gap-1.5">
                        {/* Detail Trigger */}
                        <button
                          onClick={() => setSelectedInvoiceForModal(bill)}
                          className="p-2 bg-[#10b981]/15 text-[#10b981] hover:text-white hover:bg-emerald-600 rounded-lg border border-emerald-500/10 transition cursor-pointer active:scale-90"
                          title="Xem chi tiết & chụp ảnh hoá đơn"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {/* Edit Trigger */}
                        <button
                          onClick={() => handleOpenEditInvoice(bill)}
                          className="p-2 bg-indigo-500/10 text-indigo-550 hover:text-white hover:bg-indigo-600 rounded-lg border border-indigo-500/10 transition cursor-pointer active:scale-90"
                          title="Chỉnh sửa hóa đơn này"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => deleteBill(bill.id)}
                          className="p-2 bg-red-500/10 text-rose-500 hover:text-white hover:bg-red-600 rounded-lg border border-rose-500/10 transition cursor-pointer active:scale-90"
                          title="Xoá hóa đơn này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Quick Payment modal */}
          <AnimatePresence>
            {isQuickPaymentOpen && (
              <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
                <div className="absolute inset-0" onClick={() => setIsQuickPaymentOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md p-5 rounded-2xl shadow-xl z-20 space-y-4 font-sans border transition bg-white dark:bg-[#0e1613] border-slate-200 dark:border-[#1c2d27]"
                >
                  <div className="pb-3 flex justify-between items-center text-xs border-b border-slate-150 dark:border-[#1c2d27]">
                    <div>
                      <h4 className="font-extrabold uppercase font-mono tracking-wider text-slate-900 dark:text-white">Xác nhận thu nợ / Ghi sổ thanh toán</h4>
                      <p className="text-[10px] mt-0.5 text-slate-450 dark:text-[#657f76]">Trừ nợ tích lũy cho dồn nợ sỉ của khách</p>
                    </div>
                    <button onClick={() => setIsQuickPaymentOpen(false)} className="p-1 transition text-slate-400 hover:text-slate-700 dark:text-[#657f76] dark:hover:text-white">
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <form onSubmit={handleQuickPaymentSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[9px] uppercase font-extrabold mb-1 font-mono text-slate-500 dark:text-[#657f76]">Khách hàng</label>
                      <input
                        type="text"
                        disabled
                        value={currentCustomer?.name || ""}
                        className="w-full border rounded-xl py-2 px-3 font-bold cursor-not-allowed outline-none bg-slate-100 dark:bg-[#111c18]/50 border-slate-200 dark:border-[#1c2d27]/45 text-slate-500 dark:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] uppercase font-extrabold mb-1 font-mono text-slate-500 dark:text-[#657f76]">Số tiền thu về (đ) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="VD: 5500000"
                        value={quickPayAmount}
                        onChange={e => setQuickPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border rounded-xl py-2 px-3 font-mono text-sm font-extrabold focus:border-emerald-600 outline-none bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-emerald-600 dark:text-[#10b981]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase font-extrabold mb-1 font-mono text-slate-500 dark:text-[#657f76]">Ngày trả *</label>
                        <input
                          type="date"
                          required
                          value={quickPayDate}
                          onChange={e => setQuickPayDate(e.target.value)}
                          className="w-full border rounded-xl py-2 px-3 outline-none focus:border-emerald-600 font-mono bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-extrabold mb-1 font-mono text-slate-500 dark:text-[#657f76]">Ghi chú</label>
                        <input
                          type="text"
                          placeholder="VD: Nhận tiền mặt dồn sòng"
                          value={quickPayNote}
                          onChange={e => setQuickPayNote(e.target.value)}
                          className="w-full border rounded-xl py-2 px-3 outline-none focus:border-emerald-600 bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#657f76]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-lg transition duration-200 mt-2 cursor-pointer active:scale-[0.98]"
                    >
                      Xác nhận trừ công nợ ngay
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>



          {/* Floating plus button at bottom-right corner of detailed customer view */}
          <div className="fixed bottom-24 right-5 md:right-8 z-40">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenNewInvoice}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/50 border border-emerald-500/25 cursor-pointer active:scale-95 transition relative group"
              title="Tạo hoá đơn mới cho khách hàng này"
            >
              {/* Outer pulsing ring effect to draw attention */}
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping pointer-events-none group-hover:bg-emerald-500/30" />
              <Plus className="w-7 h-7 font-black" />
            </motion.button>
          </div>

          {/* Bottom Persistent Action Bar matching Image 1 */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t p-3.5 backdrop-blur-md max-w-7xl mx-auto flex items-center justify-between gap-4 bg-white/95 dark:bg-[#070b09]/95 border-slate-200 dark:border-[#14231d] shadow-lg">
            <button
              onClick={() => setSelectedCustomerId('')}
              className="w-1/2 py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg cursor-pointer text-xs font-extrabold border bg-slate-50 dark:bg-[#101915] border-slate-200 dark:border-[#1b2f27] hover:bg-slate-100 dark:hover:bg-[#15231e] text-slate-700 dark:text-white"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>‹ Quay lại</span>
            </button>

            <button
              onClick={handleOpenNewInvoice}
              className="w-1/2 bg-[#6366f1] hover:bg-[#5053e1] text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-indigo-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tạo hoá đơn</span>
            </button>
          </div>

        </motion.div>
      )}



      {/* Individual Customer Statistics Modal */}
      <AnimatePresence>
        {statsCustomer && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setStatsCustomer(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md p-5 rounded-2xl shadow-2xl z-20 space-y-4 text-xs border transition bg-white dark:bg-[#0e1613] border-slate-200 dark:border-[#1c2d27]"
            >
              <div className="pb-3 flex justify-between items-center border-b border-slate-150 dark:border-[#1c2d27]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-[#10b981]" />
                  <div>
                    <h3 className="font-extrabold uppercase tracking-wider font-mono text-slate-900 dark:text-white">Báo Cáo Thống Kê Sỉ</h3>
                    <p className="text-[9.5px] text-slate-450 dark:text-[#657f76]">Phân tích dữ liệu: {statsCustomer.name}</p>
                  </div>
                </div>
                <button onClick={() => setStatsCustomer(null)} className="p-1 transition text-slate-400 dark:text-[#657f76] hover:text-slate-700 dark:hover:text-white">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Statistical Board & Insights Card */}
              <div className="space-y-3.5">
                {/* 3 columns top overview */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="py-2.5 rounded-xl border bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]/70">
                    <span className="font-mono uppercase block text-[8px] tracking-wider text-slate-400 dark:text-[#657f76]">Số Đợt Sỉ</span>
                    <span className="text-sm font-black font-mono mt-0.5 block text-slate-800 dark:text-white">
                      {bills.filter(b => b.customerId === statsCustomer.id).length}
                    </span>
                  </div>
                  <div className="py-2.5 rounded-xl border bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]/70">
                    <span className="font-mono uppercase block text-[8px] tracking-wider text-slate-450 dark:text-[#657f76]">Tổng Đã Trả</span>
                    <span className="text-sm font-black text-[#10b981] font-mono mt-0.5 block">
                      {getCustomerTotalPaid(statsCustomer.id).toLocaleString()}đ
                    </span>
                  </div>
                  <div className="py-2.5 rounded-xl border bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]/70">
                    <span className="font-mono uppercase block text-[8px] tracking-wider text-slate-400 dark:text-[#657f76]">Công Nợ Hiện Tại</span>
                    <span className={`text-sm font-black font-mono mt-0.5 block ${calculateCustomerCumulativeDebt(statsCustomer.id) > 0 ? 'text-[#ef4444]' : 'text-emerald-500'}`}>
                      {calculateCustomerCumulativeDebt(statsCustomer.id).toLocaleString()}đ
                    </span>
                  </div>
                </div>

                {/* Sub-card of full revenue value */}
                <div className="p-3.5 rounded-xl flex justify-between items-center border bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]/80 text-slate-800 dark:text-white">
                  <div>
                    <span className="text-[8.5px] uppercase tracking-wider font-extrabold block font-mono text-slate-450 dark:text-[#657f76]">TỔNG LỢI NHUẬN TÍCH LUỸ</span>
                    <p className="font-mono font-black text-sm mt-0.5 text-slate-900 dark:text-white">
                      {getCustomerTotalCharges(statsCustomer.id).toLocaleString()}đ
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-4.5 h-4.5" />
                  </div>
                </div>

                {/* Product/Design Model Breakdown sales breakdown */}
                <div className="space-y-2">
                  <span className="text-[9.5px] uppercase tracking-wider font-extrabold block font-mono text-slate-400 dark:text-[#657f76]">Tỷ Trọng Mẫu Mã Ưa Chuộng (Sản lượng)</span>
                  {(() => {
                    const custInvoices = bills.filter(b => b.customerId === statsCustomer.id);
                    const itemSalesMap: Record<string, number> = {};
                    custInvoices.forEach(bill => {
                      bill.items.forEach(item => {
                        const key = item.mẫuMã || "Khác";
                        const qty = Number(item.sốLượng || 0);
                        itemSalesMap[key] = (itemSalesMap[key] || 0) + qty;
                      });
                    });
                    const sortedItemSales = Object.entries(itemSalesMap)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5);

                    if (sortedItemSales.length === 0) {
                      return (
                        <p className="text-center py-4 italic border border-dashed rounded-xl text-slate-400 dark:text-[#556b62] bg-slate-50 dark:bg-[#111c18]/45 border-slate-205 dark:border-[#1c2d27]/45">
                          Chưa có ghi nhận mẫu mã sản phẩm nào.
                        </p>
                      );
                    }

                    const maxQty = Math.max(...sortedItemSales.map(s => s[1]), 1);

                    return (
                      <div className="space-y-2.5 p-3.5 rounded-xl border bg-slate-50 dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27]/60">
                        {sortedItemSales.map(([mẫu, qty]) => {
                          const barWidthPercentage = Math.max(10, Math.round((qty/maxQty) * 100));
                          return (
                            <div key={mẫu} className="space-y-1">
                              <div className="flex justify-between items-center text-[10.5px]">
                                <span className="font-extrabold font-mono p-0.5 px-1.5 rounded text-amber-700 dark:text-[#f39c12] bg-amber-50 dark:bg-amber-500/15 border border-amber-250 dark:border-amber-500/20">{mẫu}</span>
                                <span className="font-mono font-bold text-slate-650 dark:text-slate-300">{qty.toLocaleString()} cái</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden bg-slate-150 dark:bg-[#1b2b24]">
                                <div 
                                  className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full rounded-full" 
                                  style={{ width: `${barWidthPercentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="text-[10px] items-center leading-relaxed font-mono flex gap-1.5 bg-[#10b981]/5 p-2.5 rounded-lg border border-[#10b981]/15 text-slate-500 dark:text-[#657f76]">
                  <span className="text-[#10b981]">💡</span>
                  <span>Gợi ý kinh doanh: Khách sỉ {statsCustomer.name} có sản lượng tốt ở phân khúc sỉ đợt may, cần giới thiệu các mẫu mới.</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Detail Modal with screen snapshot export */}
      <AnimatePresence>
        {selectedInvoiceForModal && currentCustomer && (
          <Suspense fallback={null}>
            <InvoiceDetailModal
              bill={selectedInvoiceForModal}
              customer={currentCustomer}
              payments={payments}
              bills={bills}
              onClose={() => setSelectedInvoiceForModal(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Payment Receipt Modal with screen snapshot export */}
      <AnimatePresence>
        {selectedPaymentForModal && (
          <Suspense fallback={null}>
            <PaymentReceiptModal
              payment={selectedPaymentForModal}
              customer={customers.find(c => c.id === selectedPaymentForModal.customerId) || currentCustomer!}
              calculateDebtBefore={(upToTime) => calculateCustomerCumulativeDebt(selectedPaymentForModal.customerId, upToTime - 1)}
              onClose={() => setSelectedPaymentForModal(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Lightbox photo viewer for Invoice */}
      <AnimatePresence>
        {viewingPhotoUrl && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setViewingPhotoUrl(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl w-full p-5 rounded-2xl shadow-2xl z-10 flex flex-col border relative uppercase font-mono bg-white dark:bg-[#0e1613] border-slate-200 dark:border-[#1c2d27]"
            >
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                title="Đóng xem ảnh"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="pb-3 border-b border-slate-105 dark:border-slate-800/60 w-full flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-555" />
                <span className="text-[11px] font-bold tracking-wider text-slate-800 dark:text-white">Ảnh chụp mặt hàng sỉ / Biên nhận sỉ đính kèm</span>
              </div>
              
              <div className="mt-4 w-full aspect-[4/3] max-h-[60vh] bg-black/5 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-805/40">
                <LazyImage
                  src={viewingPhotoUrl || ''}
                  alt="Ảnh phóng to hoá đơn"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Customer Dialog Overlay (Matches design and behavior of Account profile update) */}
      <AnimatePresence>
        {isEditingCustomer && currentCustomer && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsEditingCustomer(false)} />
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleEditCustomer}
              className="max-w-md w-full p-6 shadow-2xl rounded-2xl z-20 space-y-4 border bg-white dark:bg-[#0e1613] border-slate-200 dark:border-[#1b2f27] text-slate-800 dark:text-white"
            >
              <div className="pb-3 flex justify-between items-center border-b border-slate-150 dark:border-[#1b2f27]">
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase font-mono text-emerald-600 dark:text-[#10b981]">Chỉnh sửa đối tác sỉ</h3>
                  <p className="text-[10px] text-slate-400 dark:text-[#657f76] mt-0.5">Cập nhật họ tên, số điện thoại, nợ đầu kỳ và ảnh đại diện</p>
                </div>
                <button type="button" onClick={() => setIsEditingCustomer(false)} className="text-slate-400 hover:text-slate-650 dark:text-[#657f76] dark:hover:text-white transition p-1 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-[#657f76] mb-1.5 tracking-wider">Họ tên khách lấy sỉ *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nhà xe Chị A, Huỳnh Mai Đồng Tháp..."
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    className="w-full border rounded-xl py-2.5 px-3.5 outline-none focus:border-indigo-500 transition font-sans bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-[#657f76] mb-1.5 tracking-wider">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    placeholder="VD: 0914.xxx.xxx"
                    value={editCustomerPhone}
                    onChange={e => setEditCustomerPhone(e.target.value)}
                    className="w-full border rounded-xl py-2.5 px-3.5 outline-none focus:border-indigo-500 transition font-sans bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-[#657f76] mb-1.5 tracking-wider">Tổng nợ cũ gối đầu gạt lại (đ)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Nhập số nợ cũ còn tồn dồn..."
                    value={editCustomerInitialDebt}
                    onChange={e => setEditCustomerInitialDebt(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border rounded-xl py-2.5 px-3.5 outline-none focus:border-indigo-500 transition font-sans bg-white dark:bg-[#111c18] border-slate-200 dark:border-[#1c2d27] text-slate-805 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-[#657f76] mb-1.5 tracking-wider">Ảnh đại diện khách sỉ</label>
                  <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-slate-400 font-mono">Đang khởi tạo máy ảnh...</div>}>
                    <CameraCapture
                      onCapture={setEditCustomerPhoto}
                      initialValue={editCustomerPhoto}
                      resolvedTheme={isDark ? 'dark' : 'light'}
                    />
                  </Suspense>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditingCustomer(false)}
                  className="w-1/2 py-2.5 border rounded-xl font-medium cursor-pointer transition text-center border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 dark:border-[#1c2d27] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#111c18]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#6366f1] hover:bg-[#5053e1] text-white py-2.5 rounded-xl font-bold transition active:scale-[0.98] cursor-pointer"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Decoupled persistent write invoice drawer/overlay */}
      <AnimatePresence>
        {isWritingInvoice && (() => {
          const modalSubtotal = modalDraftItems.reduce((sum, item) => sum + (Number(item.sốLượng || 0) * Number(item.đơnGiá || 0)), 0);
          const modalPrevDebt = selectedCustomerId ? calculateCustomerCumulativeDebt(selectedCustomerId) : 0;
          const modalPaymentValue = modalHasPaid ? Number(modalPaymentAmount || 0) : 0;
          const modalGrandTotal = modalSubtotal + modalPrevDebt - modalPaymentValue;

          return (
            <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
              <div className="absolute inset-0" onClick={handleCloseWritingInvoice} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full max-w-lg p-6 rounded-3xl shadow-2xl z-20 space-y-4.5 max-h-[92vh] overflow-y-auto font-sans border transition-colors duration-250 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100`}
              >
                {/* Header Row */}
                <div className={`pb-3 flex justify-between items-center text-xs border-b border-slate-200 dark:border-slate-800`}>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
                      {editingBillId ? '✏️ Chỉnh sửa hoá đơn' : '📄 Tạo hoá đơn sỉ mới'}
                    </span>
                  </div>
                  <button 
                    onClick={handleCloseWritingInvoice} 
                    className={`p-1.5 rounded-full transition cursor-pointer text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-805 dark:hover:text-slate-200`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="space-y-4.5">
                  {/* Select Customer Dropdown */}
                  {editingBillId === null && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 tracking-wider">
                        👤 Chọn khách sỉ nhận đơn *
                      </label>
                      <div className="rounded-2xl px-4 py-3 flex items-center transition border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-within:border-emerald-500">
                        <select
                          value={selectedCustomerId}
                          onChange={(e) => {
                            setSelectedCustomerId(e.target.value);
                          }}
                          className="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-850 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="" disabled className="dark:bg-slate-900">-- Vui lòng chọn khách sỉ --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id} className="dark:bg-slate-900 text-slate-850 dark:text-slate-200">
                              {c.name} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Date Block */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 tracking-wider">
                      📆 NGÀY GHI SỔ
                    </label>
                    <div className="rounded-2xl px-4 py-3 flex items-center focus-within:border-emerald-500 transition border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                      <input
                        type="date"
                        value={billDate}
                        onChange={e => setBillDate(e.target.value)}
                        className="w-full bg-transparent border-none font-mono outline-none text-sm cursor-pointer text-slate-850 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Note Block */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 tracking-wider">
                      📝 GHI CHÚ ĐƠN HÀNG
                    </label>
                    <div className="rounded-2xl px-4 py-3 border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                      <input
                        type="text"
                        placeholder="Nhập ghi chú vận chuyển, hàng tặng..."
                        value={billGhiChú}
                        onChange={e => setBillGhiChú(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-850 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Camera Capture Block */}
                  <div className={`border p-4 rounded-2xl shadow-xs bg-white dark:bg-slate-950 border-slate-200/50 dark:border-slate-800`}>
                    <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-slate-400 font-mono">Đang khởi tạo máy ảnh...</div>}>
                      <CameraCapture
                        onCapture={setInvoicePhoto}
                        initialValue={invoicePhoto}
                        resolvedTheme={isDark ? 'dark' : 'light'}
                      />
                    </Suspense>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4" id="modalDraftItems">
                    <label className="block text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-400 mb-2 tracking-wider">
                      📦 DANH SÁCH MẶT HÀNG SỈ
                    </label>

                    {modalDraftItems.map((item, idx) => {
                      const sub = Number(item.sốLượng || 0) * Number(item.đơnGiá || 0);

                      return (
                        <div 
                          key={idx} 
                          className="border rounded-2xl p-5 space-y-4.5 relative transition-all duration-200 shadow-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        >
                          {/* Inner Header Row */}
                          <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 capitalize flex items-center gap-1">
                              🧥 Mặt hàng {idx + 1}
                            </span>
                            {modalDraftItems.length > 1 && (
                              <button
                                    type="button"
                                    onClick={() => handleRemoveModalDraftItem(idx)}
                                    className="font-black text-xs transition px-2.5 py-1 rounded-lg cursor-pointer text-rose-500 hover:text-red-500 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-red-400 dark:hover:bg-rose-950/30"
                              >
                                    ✕ Gỡ mặt hàng
                              </button>
                            )}
                          </div>

                          {/* Section 1: MẪU MÃ */}
                          <div className="space-y-1.5 relative">
                            <label className="block text-[9.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                              👗 Tên mẫu mã thiết kế May sỉ *
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Nhập tên mẫu hoặc chọn từ kho..."
                                value={item.mẫuMã}
                                onChange={e => {
                                  handleUpdateModalDraftItem(idx, 'mẫuMã', e.target.value);
                                  setFocusedItemIdx(idx);
                                }}
                                onFocus={() => setFocusedItemIdx(idx)}
                                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-500 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                              />
                              <div className="absolute right-3 top-3.5 flex items-center gap-1 text-slate-400 pointer-events-none">
                                <Search className="w-4 h-4" />
                              </div>
                            </div>

                            {/* Autocomplete Panel */}
                            {focusedItemIdx === idx && (
                              <>
                                {/* Click outside backdrop container */}
                                <div 
                                  className="fixed inset-0 z-30" 
                                  onClick={() => setFocusedItemIdx(null)} 
                                />
                                <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 shadow-xl z-40 p-1 divide-y divide-slate-100 dark:divide-slate-900/40">
                                  <div className="px-3 py-1.5 text-[9.5px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                    📦 DANH SÁCH KHO HÀNG ({warehouseCatalog.length})
                                  </div>
                                  
                                  {(() => {
                                    const searchQuery = (item.mẫuMã || '').trim().toLowerCase();
                                    const filtered = warehouseCatalog.filter(w => 
                                      !searchQuery || 
                                      w.modelName.toLowerCase().includes(searchQuery)
                                    );

                                    if (filtered.length === 0) {
                                      return (
                                        <div className="p-3 text-xs text-slate-400 font-medium text-center">
                                          Không tìm thấy mẫu nào khớp trong kho.
                                        </div>
                                      );
                                    }

                                    return filtered.map((w, wIdx) => (
                                      <button
                                        key={wIdx}
                                        type="button"
                                        onClick={() => {
                                          handleSelectModel(idx, w.modelName);
                                          setFocusedItemIdx(null);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg flex items-center justify-between text-xs transition cursor-pointer"
                                      >
                                        <div className="font-semibold text-slate-850 dark:text-slate-100">
                                          👕 {w.modelName}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                                            w.currentStock > 0 
                                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450'
                                          }`}>
                                            Tồn: {w.currentStock.toLocaleString()}
                                          </span>
                                          <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                                            {w.defaultSalePrice.toLocaleString()}đ
                                          </span>
                                        </div>
                                      </button>
                                    ));
                                  })()}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Section 2: SL & ĐƠN GIÁ inside split touch container */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-[9.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                                📦 Số lượng đại sỉ (SL) *
                              </label>
                              <input
                                type="number"
                                placeholder="0"
                                value={item.sốLượng === 0 ? '' : item.sốLượng}
                                onChange={e => handleUpdateModalDraftItem(idx, 'sốLượng', e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full rounded-2xl px-4 py-3 font-mono text-sm font-bold outline-none transition focus:border-indigo-500 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-[9.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                                💵 Đơn giá May sỉ (đ) *
                              </label>
                              <input
                                type="number"
                                placeholder="0"
                                value={item.đơnGiá === 0 ? '' : item.đơnGiá}
                                onChange={e => handleUpdateModalDraftItem(idx, 'đơnGiá', e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full rounded-2xl px-4 py-3 font-mono text-sm font-bold outline-none text-right transition focus:border-indigo-500 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Section 3: Calculated Item Subtotal Styled Box */}
                          <div className="border h-12 rounded-2xl flex items-center justify-between px-4 font-mono font-black text-xs shadow-inner bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400">
                            <span className="uppercase text-[9.5px] font-bold tracking-wider font-sans text-slate-500 dark:text-slate-400">Thành tiền dòng này:</span>
                            <span className="text-[13px]">{sub.toLocaleString()}đ</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Item Trigger Block with responsive touches */}
                    <button
                      type="button"
                      onClick={handleAddModalDraftItem}
                      className="w-full border-2 border-dashed h-12 font-bold rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer transition select-none text-xs border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-indigo-600 dark:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-700"
                    >
                      <span>+ Thêm mặt hàng</span>
                    </button>
                  </div>

                  {/* Payment Amount Direct Box */}
                  <div className="space-y-3 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center focus-within:ring-0">
                      <label className="text-[10px] uppercase font-bold text-[#10b981] tracking-wider flex items-center gap-1.5 selection:bg-transparent">
                        💳 Khách hàng đã thanh toán
                      </label>
                      {/* Premium iOS-Style Switch Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !modalHasPaid;
                          setModalHasPaid(nextVal);
                          if (!nextVal) {
                              setModalPaymentAmount('');
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          modalHasPaid ? 'bg-[#10b981]' : 'bg-slate-300 dark:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            modalHasPaid ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {modalHasPaid && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border rounded-2xl px-4 py-3 flex items-center focus-within:ring-2 focus-within:ring-emerald-100/20 transition duration-150 mt-1 bg-white dark:bg-slate-900 border-emerald-500/30 dark:border-emerald-900/50">
                            <input
                              type="number"
                              placeholder="Nhập số tiền khách thanh toán liền..."
                              value={modalPaymentAmount === '' ? '' : modalPaymentAmount}
                              onChange={e => setModalPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-transparent border-none font-mono font-bold text-sm outline-none text-emerald-600 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-500"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Customer Recent Pay & Bills Timeline feed in-place inside dialog */}
                  {selectedCustomerId && (() => {
                    const recentTxs = [
                      ...(bills.filter(b => b.customerId === selectedCustomerId).map(b => ({
                        type: 'bill',
                        date: b.date,
                        amount: b.subtotal,
                        label: `Hoá đơn ${b.billNumber}`,
                        createdAt: b.createdAt
                      }))),
                      ...(payments.filter(p => p.customerId === selectedCustomerId).map(p => ({
                        type: 'payment',
                        date: p.date,
                        amount: p.amount,
                        label: `Thanh toán (${p.note})`,
                        createdAt: p.createdAt
                      })))
                    ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);

                    if (recentTxs.length === 0) return null;

                    return (
                      <div className={`border rounded-2xl p-4.5 space-y-2 font-sans bg-slate-50/50 dark:bg-slate-950/30 border-slate-150 dark:border-slate-850`}>
                        <span className="block text-[9.5px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                          📜 Lịch sử thanh toán & giao dịch gần đây của khách sỉ
                        </span>
                        <div className={`space-y-2 divide-y font-sans divide-slate-200/50 dark:divide-slate-800`}>
                          {recentTxs.map((tx, tIdx) => (
                            <div key={tIdx} className="flex justify-between items-center text-xs pt-2 first:pt-0">
                              <div className="flex flex-col">
                                <span className={`font-bold text-slate-700 dark:text-slate-300`}>
                                  {tx.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  📅 {tx.date}
                                </span>
                              </div>
                              <span className={`font-mono font-bold text-xs ${tx.type === 'payment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500'}`}>
                                {tx.type === 'payment' ? `+${tx.amount.toLocaleString()}` : `-${tx.amount.toLocaleString()}`}đ
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary statistics inside custom container */}
                  <div className={`border p-5 space-y-3 text-xs font-semibold shadow-inner rounded-2xl bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-300`}>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>💰 Tổng bill hàng sỉ mới này:</span>
                      <span className={`font-mono font-extrabold text-sm text-[#10b981] dark:text-emerald-400`}>
                        {modalSubtotal.toLocaleString()}đ
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span>📋 Nợ cũ luỹ kế trước đây dồn qua:</span>
                      <span className="font-mono font-extrabold text-[#f87171] text-sm">
                        +{modalPrevDebt.toLocaleString()}đ
                      </span>
                    </div>

                    {modalHasPaid && Number(modalPaymentAmount || 0) > 0 && (
                      <div className="flex justify-between items-center text-[#10b981]">
                        <span>💳 Khách thanh toán kèm hoá đơn này:</span>
                        <span className="font-mono font-black text-sm text-[#10b981]">
                          -{Number(modalPaymentAmount || 0).toLocaleString()}đ
                        </span>
                      </div>
                    )}

                    <div className={`flex justify-between items-center border-t pt-3 border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200`}>
                      <span className="font-bold">📊 CÒN PHẢI TRẢ (NỢ LUỸ KẾ CHỐT SỔ):</span>
                      <span className="font-mono font-black text-rose-500 text-sm sm:text-base">
                        {modalGrandTotal.toLocaleString()}đ
                      </span>
                    </div>
                  </div>

                  {/* Bottom controls */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseWritingInvoice}
                      className={`w-1/4 transition rounded-2xl py-3.5 text-xs font-bold cursor-pointer border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 border-slate-250 dark:border-slate-700 text-slate-550 dark:text-slate-300`}
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveModalBill}
                      className="flex-1 bg-[#5033e1] hover:bg-[#3f21cc] text-white rounded-2xl text-xs font-black py-3.5 flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg shadow-indigo-950/40 cursor-pointer"
                    >
                      <span>💾 Lưu hoá đơn</span>
                    </button>
                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
