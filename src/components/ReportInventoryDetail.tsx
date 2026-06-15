/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Boxes, 
  ArrowLeft, 
  Home as HomeIcon, 
  ChevronDown, 
  Plus, 
  Minus,
  ArrowRight,
  ChevronRight,
  FileSpreadsheet, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X, 
  Activity, 
  Info,
  Check,
  ChevronsUpDown,
  Image as ImageIcon,
  ShoppingCart,
  Factory,
  FileText
} from 'lucide-react';
import { ImportItem, Bill, Customer } from '../types';

interface ReportInventoryDetailProps {
  items: ImportItem[];
  bills: Bill[];
  customers: Customer[];
  setActiveTab?: (tab: 'home' | 'import' | 'invoices' | 'production' | 'report' | 'settings' | 'notifications' | 'gallery' | 'inventory') => void;
}

export default function ReportInventoryDetail({
  items = [],
  bills = [],
  customers = [],
  setActiveTab
}: ReportInventoryDetailProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inStock' | 'outOfStock' | 'negative'>('all');
  const [sortBy, setSortBy] = useState<'model_asc' | 'model_desc' | 'stock_asc' | 'stock_desc' | 'imported_desc' | 'sold_desc'>('model_asc');
  
  // Custom dropdown open states
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  
  const statusRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsFabOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Trace detail modal state
  const [selectedModelForTrace, setSelectedModelForTrace] = useState<string | null>(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any>(null);

  // Read manual adjustments & inventory overrides from localStorage
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_inventory_manual_adjustments');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [reserveUnsellable, setReserveUnsellable] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_inventory_reserve');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [lowStockThresholds, setLowStockThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_inventory_low_stock');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // State values for active selected model trace parameters
  const [editingDetailTab, setEditingDetailTab] = useState<'info' | 'inventory'>('inventory');
  const [tempAdjustValue, setTempAdjustValue] = useState(0); // This will hold the direct stock value to adjust
  const [tempReserve, setTempReserve] = useState(0);
  const [tempThreshold, setTempThreshold] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // 1. Gather all unique models dynamically from both goods import and sales bills
  const allModels = useMemo(() => {
    const modelsSet = new Set<string>();
    
    items.forEach(item => {
      if (item.mẫu && item.mẫu.trim()) {
        modelsSet.add(item.mẫu.trim());
      }
    });

    bills.forEach(bill => {
      if (bill.items && Array.isArray(bill.items)) {
        bill.items.forEach(bitem => {
          if (bitem.mẫuMã && bitem.mẫuMã.trim()) {
            modelsSet.add(bitem.mẫuMã.trim());
          }
        });
      }
    });

    return Array.from(modelsSet);
  }, [items, bills]);

  // 2. Compute warehouse stock for each model with estimated cost basis
  const inventoryList = useMemo(() => {
    return allModels.map((modelName, index) => {
      // Find all imports of this model
      const modelImports = items.filter(i => i.mẫu && i.mẫu.trim() === modelName);
      const totalImported = modelImports.reduce((sum, curr) => sum + (curr.sốLượng || 0), 0);
      
      // Calculate total sold in bills
      let totalSold = 0;
      let salesCount = 0;
      
      bills.forEach(bill => {
        if (bill.items && Array.isArray(bill.items)) {
          let foundInBill = false;
          bill.items.forEach(bitem => {
            if (bitem.mẫuMã && bitem.mẫuMã.trim() === modelName) {
              totalSold += (bitem.sốLượng || 0);
              foundInBill = true;
            }
          });
          if (foundInBill) {
            salesCount++;
          }
        }
      });

      // Calculate automatic current stock (which auto-updates from imports/sales and is exactly 0 if sold out)
      const currentStock = Math.max(0, totalImported - totalSold);

      // Find average import cost to calculate estimated total warehouse stock value
      const importPrices = modelImports.map(i => i.đơnGiáMay || 0).filter(p => p > 0);
      const averageImportPrice = importPrices.length > 0 
        ? Math.round(importPrices.reduce((s, c) => s + c, 0) / importPrices.length)
        : 120000; // Realistic default price per suit: 120k đ

      // Find average selling price from sales bills of this model
      const salePrices: number[] = [];
      bills.forEach(bill => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach(bitem => {
            if (bitem.mẫuMã && bitem.mẫuMã.trim() === modelName && (bitem.đơnGiá || 0) > 0) {
              salePrices.push(bitem.đơnGiá);
            }
          });
        }
      });
      const averageSalePrice = salePrices.length > 0
        ? Math.round(salePrices.reduce((s, c) => s + c, 0) / salePrices.length)
        : Math.round(averageImportPrice * 1.35); // markup standard fallback if never sold yet

      const estimatedStockValue = Math.max(0, currentStock) * averageImportPrice;

      // Generate SKU code modeled like SP0001
      const padNum = String(index + 1).padStart(4, '0');
      const sku = `SP${padNum}`;

      return {
        modelName,
        sku,
        totalImported,
        totalSold,
        currentStock,
        averageImportPrice,
        averageSalePrice,
        estimatedStockValue,
        importSessions: modelImports.length,
        saleTransactions: salesCount,
        photo: modelImports.find(img => img.photo)?.photo || null
      };
    });
  }, [allModels, items, bills, manualAdjustments]);

  // Synchronize editing variables whenever selectedModelForTrace opens
  useEffect(() => {
    if (selectedModelForTrace) {
      const existingProduct = inventoryList.find(i => i.modelName === selectedModelForTrace);
      const currentVal = existingProduct ? existingProduct.currentStock : 0;
      setTempAdjustValue(currentVal);
      setTempReserve(reserveUnsellable[selectedModelForTrace] || 0);
      setTempThreshold(lowStockThresholds[selectedModelForTrace] || 0);
      setEditingDetailTab('inventory');
      setShowAllHistory(false);
    }
  }, [selectedModelForTrace, inventoryList, reserveUnsellable, lowStockThresholds]);

  // Handle saving configurations back to local storage
  const handleUpdateProduct = () => {
    if (!selectedModelForTrace) return;
    
    // Save Reserve unsellable
    const newReserves = { ...reserveUnsellable, [selectedModelForTrace]: tempReserve };
    setReserveUnsellable(newReserves);
    localStorage.setItem('xuongan_inventory_reserve', JSON.stringify(newReserves));

    // Save low stock thresholds
    const newThresholds = { ...lowStockThresholds, [selectedModelForTrace]: tempThreshold };
    setLowStockThresholds(newThresholds);
    localStorage.setItem('xuongan_inventory_low_stock', JSON.stringify(newThresholds));

    // Close detail view
    setSelectedModelForTrace(null);
  };

  // 3. Filtered and sorted inventory list
  const filteredAndSortedList = useMemo(() => {
    let result = inventoryList.filter(item => {
      // Search matching model name or SKU code
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = item.modelName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      
      // Status filtering
      if (statusFilter === 'inStock') {
        return matchesSearch && item.currentStock > 0;
      }
      if (statusFilter === 'outOfStock') {
        return matchesSearch && item.currentStock === 0;
      }
      if (statusFilter === 'negative') {
        return matchesSearch && item.currentStock < 0;
      }
      return matchesSearch;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'model_asc') {
        return a.modelName.localeCompare(b.modelName);
      } else if (sortBy === 'model_desc') {
        return b.modelName.localeCompare(a.modelName);
      } else if (sortBy === 'stock_asc') {
        return a.currentStock - b.currentStock;
      } else if (sortBy === 'stock_desc') {
        return b.currentStock - a.currentStock;
      } else if (sortBy === 'imported_desc') {
        return b.totalImported - a.totalImported;
      } else if (sortBy === 'sold_desc') {
        return b.totalSold - a.totalSold;
      }
      return 0;
    });

    return result;
  }, [inventoryList, searchQuery, statusFilter, sortBy]);

  // 4. Warehouse general summary metrics
  const summaryStats = useMemo(() => {
    let totalStockPcs = 0;
    let totalValue = 0;
    let modelsInStockCount = 0;
    let modelsOutCount = 0;
    let modelsNegativeCount = 0;

    inventoryList.forEach(item => {
      totalStockPcs += item.currentStock;
      totalValue += item.estimatedStockValue;
      if (item.currentStock > 0) {
        modelsInStockCount++;
      } else if (item.currentStock === 0) {
        modelsOutCount++;
      } else {
        modelsNegativeCount++;
      }
    });

    return {
      totalStockPcs,
      totalValue,
      modelsInStockCount,
      modelsOutCount,
      modelsNegativeCount,
      totalModelsEver: inventoryList.length
    };
  }, [inventoryList]);

  // 5. Build historical ledger for the selected model
  const modelTraceHistory = useMemo(() => {
    if (!selectedModelForTrace) return null;

    // Collect imports of this model
    const importLogs = items
      .filter(i => i.mẫu && i.mẫu.trim() === selectedModelForTrace)
      .map(i => ({
        type: 'import' as const,
        id: i.id,
        date: i.ngày,
        quantity: i.sốLượng,
        price: i.đơnGiáMay,
        totalPay: i.sốLượng * i.đơnGiáMay,
        transportFees: (i.vậnChuyểnĐT_TP || 0) + (i.vậnChuyểnTP_ĐT || 0),
        photo: i.photo,
        label: 'Nhập kho hàng may',
        createdAt: i.createdAt,
        importObj: i
      }));

    // Collect billing sales of this model
    const salesLogs: any[] = [];
    bills.forEach(bill => {
      if (bill.items && Array.isArray(bill.items)) {
        bill.items.forEach(bitem => {
          if (bitem.mẫuMã && bitem.mẫuMã.trim() === selectedModelForTrace) {
            const customerObj = customers.find(c => c.id === bill.customerId);
            salesLogs.push({
              type: 'sale' as const,
              id: `${bill.id}-${bitem.id}`,
              date: bill.date,
              billNumber: bill.billNumber,
              customerId: bill.customerId,
              customerName: customerObj ? customerObj.name : 'Khách vãng lai',
              quantity: bitem.sốLượng,
              price: bitem.đơnGiá,
              totalPay: bitem.thànhTiền,
              photo: bill.photo,
              label: 'Xuất bán (Hóa đơn)',
              createdAt: bill.createdAt,
              billObj: bill,
              customerObj: customerObj
            });
          }
        });
      }
    });

    // Merge and sort decendingly by date and createdAt
    const mergedHistory = [...importLogs, ...salesLogs].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return mergedHistory;
  }, [selectedModelForTrace, items, bills, customers]);

  // 6. Handle exporting the entire warehouse inventory details to CSV format
  const handleExportCSV = () => {
    const headers = ['Mã SKU', 'Tên mẫu mã', 'Số lượng nhập tích lũy', 'Sản lượng xuất bán', 'Tồn kho khả dụng', 'Ước tính giá trị tồn', 'Trạng thái kho', 'Số lần nhập', 'Số lần xuất hóa đơn'];
    const rows = filteredAndSortedList.map(item => [
      item.sku,
      item.modelName,
      item.totalImported,
      item.totalSold,
      item.currentStock,
      item.estimatedStockValue,
      item.currentStock > 0 ? 'Còn hàng' : item.currentStock === 0 ? 'Hết hàng' : 'Thiếu hụt / Nợ kho',
      item.importSessions,
      item.saleTransactions
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_ton_kho_xuong_An_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusLabels: Record<typeof statusFilter, string> = {
    all: 'Tất cả trạng thái',
    inStock: 'Còn tồn kho',
    outOfStock: 'Đã hết hàng',
    negative: 'Lỗi âm kho'
  };

  const sortLabels: Record<typeof sortBy, string> = {
    model_asc: 'Tên mẫu (A-Z)',
    model_desc: 'Tên mẫu (Z-A)',
    stock_desc: 'Tồn kho (Giảm dần)',
    stock_asc: 'Tồn kho (Tăng dần)',
    imported_desc: 'Nhập dệt nhiều nhất',
    sold_desc: 'Bán ra chạy nhất'
  };

  return (
    <div className="relative pb-16 min-h-[75vh]">
      {/* 1. TOP MOBILE HEADER SEARCH BAR */}
      <div className="bg-white dark:bg-[#0c101d] pb-2 text-left">
        <div className="flex items-center gap-2 mb-4">
          <button 
            onClick={() => setActiveTab && setActiveTab('home')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã SKU, ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-9.5 pr-10 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0c101d] rounded-xl outline-none transition font-medium text-slate-800 dark:text-white"
            />
            {/* Barcode / Scan Icon inside right of search bar */}
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600">
              <svg className="w-5 h-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7V4h3M17 4h3v3M4 17v3h3M20 17v3h-3M8 8V16M11 9v6M13 8v8M16 9v6" />
              </svg>
            </div>
          </div>

          <button
            onClick={() => setActiveTab && setActiveTab('home')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
          >
            <HomeIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 2. SUB NAVIGATION TABS */}
        <div className="border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none">
          <div className="flex gap-6 text-[13.5px] font-bold text-slate-500 dark:text-slate-400 pb-0 whitespace-nowrap min-w-max">
            <button className="px-1 py-2.5 transition relative text-emerald-600 dark:text-emerald-450 border-b-2.5 border-emerald-500 font-extrabold cursor-pointer">Tồn kho hàng & thành phẩm</button>
          </div>
        </div>
      </div>

      {/* 3. FILTER DROPDOWNS ROW */}
      <div className="flex gap-2 py-3 bg-white dark:bg-[#0c101d] justify-start text-xs font-bold text-slate-700 dark:text-slate-350 shrink-0">
        {/* Dropdown status Filter */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => {
              setIsStatusOpen(!isStatusOpen);
              setIsSortOpen(false);
            }}
            className="px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 rounded-full flex items-center gap-1 hover:bg-slate-100 transition cursor-pointer"
          >
            <span>Trạng thái</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-550" />
          </button>
          
          <AnimatePresence>
            {isStatusOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 overflow-hidden text-left"
              >
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'inStock', label: 'Còn tồn kho' },
                  { id: 'outOfStock', label: 'Đã hết hàng' },
                  { id: 'negative', label: 'Lỗi âm kho' }
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => {
                      setStatusFilter(op.id as any);
                      setIsStatusOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-semibold flex items-center justify-between transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${statusFilter === op.id ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/10' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>{op.label}</span>
                    {statusFilter === op.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dropdown Sort direction */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => {
              setIsSortOpen(!isSortOpen);
              setIsStatusOpen(false);
            }}
            className="px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 rounded-full flex items-center gap-1 hover:bg-slate-100 transition cursor-pointer"
          >
            <span>Sắp xếp</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-550" />
          </button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 overflow-hidden text-left"
              >
                {[
                  { id: 'model_asc', label: 'Tên mẫu (A-Z)' },
                  { id: 'model_desc', label: 'Tên mẫu (Z-A)' },
                  { id: 'stock_desc', label: 'Tồn kho (Giảm dần)' },
                  { id: 'stock_asc', label: 'Tồn kho (Tăng dần)' },
                  { id: 'imported_desc', label: 'Nhập xưởng nhiều' },
                  { id: 'sold_desc', label: 'Bán chạy nhất' }
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => {
                      setSortBy(op.id as any);
                      setIsSortOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-xs font-semibold flex items-center justify-between transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${sortBy === op.id ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/10 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>{op.label}</span>
                    {sortBy === op.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Small CSV Export shortcut */}
        <button
          onClick={handleExportCSV}
          title="Xuất file báo cáo tài nguyên kho"
          className="ml-auto flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 rounded-full text-[11px] font-extrabold cursor-pointer hover:bg-emerald-100 transition"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Excel</span>
        </button>
      </div>

      {/* 4. GREY METRICS HEADER BANNER */}
      <div className="bg-slate-100/90 dark:bg-slate-900 rounded-xl px-4 py-2.5 flex items-center justify-between text-[11.5px] font-bold text-slate-500 dark:text-slate-400 mb-3 select-none text-left">
        <div>
          <span>Số lượng </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-[12px]">{summaryStats.totalStockPcs.toLocaleString()}</span>
        </div>
        <div>
          <span>Giá trị tồn </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-[12px]">{summaryStats.totalValue.toLocaleString()}đ</span>
        </div>
      </div>

      {/* Status Warning Alert Panel for context awareness */}
      {statusFilter !== 'all' && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/10 text-[10px] text-indigo-600 dark:text-indigo-400 text-left flex items-center gap-1.5 font-bold">
          <Info className="w-3.5 h-3.5" />
          <span>Đang lọc: {statusLabels[statusFilter]} • Tìm thấy {filteredAndSortedList.length} kết quả.</span>
          <button onClick={() => setStatusFilter('all')} className="underline text-[9.5px] ml-auto">Đặt lại</button>
        </div>
      )}

      {/* 5. SEWING WORKSHOP MOBILE STOCK LIST */}
      {filteredAndSortedList.length === 0 ? (
        <div className="py-20 text-center text-slate-450 space-y-2">
          <Boxes className="w-11 h-11 mx-auto text-slate-300 stroke-[1.5] animate-pulse" />
          <p className="text-xs font-bold font-sans">Không tìm thấy mã hàng phù hợp trong kho.</p>
          <p className="text-[10px] text-slate-400">Hãy cập nhật mẫu mã ở "Nhập hàng" hoặc "Hóa đơn".</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredAndSortedList.map((item) => {
            const isNegative = item.currentStock < 0;
            const isOut = item.currentStock === 0;

            return (
              <div
                key={item.modelName}
                onClick={() => setSelectedModelForTrace(item.modelName)}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all cursor-pointer active:scale-99 select-none"
              >
                {/* Left side: Photo placeholder or real uploaded image */}
                <div className="flex items-center gap-3 text-left">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 border border-slate-150 dark:border-slate-850 overflow-hidden">
                    {item.photo ? (
                      <img 
                        src={item.photo} 
                        alt={item.modelName} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                    )}
                  </div>

                  {/* Middle details block */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-[13.5px] mb-0.5 leading-tight">{item.modelName}</h4>
                    <span className="text-[11px] text-slate-400 font-mono font-bold">{item.sku}</span>
                  </div>
                </div>

                {/* Right side: Stock count and sales numbers */}
                <div className="text-right flex flex-col justify-between h-10 select-none">
                  <div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                    <span>Kho: </span>
                    <span className={isNegative ? 'text-red-500 font-black' : isOut ? 'text-slate-400' : 'text-emerald-500 dark:text-emerald-400 font-black'}>
                      {item.currentStock.toLocaleString()}/{item.totalImported.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold">
                    <span>Đã bán: </span>
                    <span className="font-mono text-slate-500 dark:text-slate-350">{item.totalSold.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. CORNER FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed bottom-24 right-5 sm:right-10 z-35" ref={fabRef}>
        <div className="relative">
          {/* Quick Hub Panel Popover when FAB is toggled */}
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 15 }}
                className="absolute bottom-16 right-0 w-44 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 p-1.5 rounded-2xl shadow-xl z-30 flex flex-col gap-1 text-left font-sans text-xs"
              >
                <div className="px-2.5 py-1.5 text-[9.5px] font-black uppercase text-slate-400 tracking-wider">
                  Thao tác nhanh xưởng
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFabOpen(false);
                    if (setActiveTab) setActiveTab('import');
                  }}
                  className="w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl font-bold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer"
                >
                  <Factory className="w-4 h-4 text-emerald-500" />
                  <span>Nhập hàng về</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFabOpen(false);
                    if (setActiveTab) setActiveTab('invoices');
                  }}
                  className="w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl font-bold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  <span>Viết hóa đơn bán</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFabOpen(false);
                    if (setActiveTab) setActiveTab('production');
                  }}
                  className="w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl font-bold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  <span>Lương thợ may</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plus FAB Trigger */}
          <button
            type="button"
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 duration-200 cursor-pointer ${isFabOpen ? 'bg-red-500 rotate-45 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 7. DETAILED PRODUCT & INVENTORY SHEET (Bố cục theo đúng Screenshot) */}
      <AnimatePresence>
        {selectedModelForTrace && (() => {
          const traceItem = inventoryList.find(i => i.modelName === selectedModelForTrace);
          if (!traceItem) return null;

          // Process the history log entries for display, adding logical sequence numbers #NH1, #XH1
          let importCount = 0;
          let saleCount = 0;
          
          // Reverse-chronological ledger
          const formattedHistory = (modelTraceHistory || []).map((log, idx) => {
            const isImport = log.type === 'import';
            let code = '';
            if (isImport) {
              importCount++;
              code = `#NH${importCount}`;
            } else {
              saleCount++;
              code = `#XH${saleCount}`;
            }

            return {
              ...log,
              code,
              isImport,
            };
          });

          // Sort final output from top to bottom
          const visibleHistory = showAllHistory ? formattedHistory : formattedHistory.slice(0, 2);

          // Calculate "Có thể bán" based on Adjusted stock - reserve count
          const availableToSell = Math.max(0, tempAdjustValue - tempReserve);

          return (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed inset-0 z-50 bg-[#F4F6F8] dark:bg-[#070a13] text-slate-800 dark:text-slate-100 flex flex-col font-sans select-none overflow-hidden"
            >
              {/* STICKY TOP HEADER */}
              <div className="bg-white dark:bg-[#0c101d] border-b border-slate-200 dark:border-slate-850 shrink-0">
                <div className="flex items-center px-4 py-3">
                  <button 
                    onClick={() => setSelectedModelForTrace(null)}
                    className="p-1 -ml-1 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
                  </button>
                  <h1 className="flex-1 text-center font-black text-slate-900 dark:text-white text-[19px] pr-5 uppercase tracking-wide">
                    Chi tiết sản phẩm
                  </h1>
                </div>

                {/* DOUBLE TABS: THÔNG TIN & TỒN KHO */}
                <div className="flex border-t border-slate-100 dark:border-slate-850 text-center">
                  <button
                    onClick={() => setEditingDetailTab('info')}
                    className={`flex-1 py-3 text-[14.5px] font-black uppercase tracking-wider transition cursor-pointer ${
                      editingDetailTab === 'info' 
                        ? 'text-emerald-600 border-b-2.5 border-emerald-500 font-extrabold' 
                        : 'text-slate-605 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Thông tin
                  </button>
                  <button
                    onClick={() => setEditingDetailTab('inventory')}
                    className={`flex-1 py-3 text-[14.5px] font-black uppercase tracking-wider transition cursor-pointer ${
                      editingDetailTab === 'inventory' 
                        ? 'text-emerald-600 border-b-2.5 border-emerald-500 font-extrabold' 
                        : 'text-slate-605 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Tồn kho
                  </button>
                </div>
              </div>

              {/* CORE SCROLLABLE WORKSPACE */}
              <div className="flex-1 overflow-y-auto pb-24">
                
                {editingDetailTab === 'info' ? (
                  /* 1. CHANNELS TAB: METADATA & GENERAL FORM */
                  <div className="p-4 space-y-4">
                    <div className="bg-white dark:bg-[#0c101d] rounded-2xl p-5 shadow-xs border-2 border-slate-200 dark:border-slate-800 space-y-4 text-left">
                      <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-500" />
                        <span>Hồ sơ mẫu mã sản phẩm</span>
                      </h3>
                      
                      <div className="space-y-1">
                        <label className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tên thợ dệt / mã mẫu</label>
                        <div className="font-black text-slate-950 dark:text-white text-xl py-1">{selectedModelForTrace}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Mã định SKU</label>
                          <div className="font-mono text-slate-950 dark:text-white font-black bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg w-auto text-sm border border-slate-250 dark:border-slate-850">{traceItem.sku}</div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Ảnh minh họa</label>
                          <div className="text-slate-950 dark:text-white font-extrabold text-xs bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg w-auto border border-slate-250 dark:border-slate-850">
                            {traceItem.photo ? 'Đã tải lên ✓' : 'Chưa cập nhật'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-150 dark:border-slate-800">
                        <div className="space-y-1">
                          <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide block">Giá bán</span>
                          <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">{traceItem.averageSalePrice.toLocaleString()}đ</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide block">Bán ra</span>
                          <span className="font-black text-lg text-slate-950 dark:text-white">{traceItem.totalSold} bộ</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#0c101d] rounded-2xl p-5 shadow-xs border-2 border-slate-250 dark:border-slate-800 text-left space-y-3">
                      <span className="text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wide block">Ghi chú & Phân loại</span>
                      <textarea
                        placeholder="Thêm mô tả về dòng vải dệt, đặc tính may đo, kích thước tiêu chuẩn..."
                        className="w-full text-sm p-3.5 bg-slate-50 dark:bg-slate-900 outline-none border-2 border-slate-350 dark:border-slate-700/80 focus:border-emerald-500 focus:bg-white dark:focus:bg-[#0c101d] rounded-xl h-28 text-slate-900 dark:text-white font-bold transition placeholder-slate-400"
                      />
                    </div>
                  </div>
                ) : (
                  /* 2. CHANNELS TAB: INVENTORY METERS AND TRANSACTIONS */
                  <div className="p-4 space-y-4">
                    
                    {/* AUTOMATIC COOPERATIVE STOCK STATUS DISPLAY */}
                    <div className="bg-white dark:bg-[#0c101d] p-6 rounded-2xl border-2 border-slate-250 dark:border-slate-800 text-center flex flex-col items-center">
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-0.5">
                        SỐ LƯỢNG TỒN THỰC TẾ
                      </span>
                      <span className="text-[11.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        (Tự động tính từ Nhập hàng & Hóa đơn xuất)
                      </span>
                      
                      <div className="flex items-center justify-center py-2 w-full">
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[80px] tracking-tight leading-none font-sans select-all">
                          {tempAdjustValue}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 text-xl font-bold ml-2 self-end mb-3">bộ</span>
                      </div>

                      <div className="w-full max-w-sm px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl grid grid-cols-2 gap-4 text-xs font-bold mt-2">
                        <div className="text-left border-r border-slate-250 dark:border-slate-800 pr-2">
                          <span className="text-slate-600 dark:text-slate-400 block pb-0.5">Đã nhập xưởng</span>
                          <span className="font-mono text-base text-sky-600 font-black">{traceItem?.totalImported ?? 0} bộ</span>
                        </div>
                        <div className="text-left pl-2">
                          <span className="text-slate-600 dark:text-slate-400 block pb-0.5">Đã xuất bán</span>
                          <span className="font-mono text-base text-rose-600 font-black">{traceItem?.totalSold ?? 0} bộ</span>
                        </div>
                      </div>
                    </div>

                    {/* PRODUCT MONIKER ARROW LINK */}
                    <div className="bg-white dark:bg-[#0c101d] px-5 py-4 flex items-center justify-between text-left rounded-xl border border-slate-200 dark:border-slate-850">
                      <button
                        onClick={() => setEditingDetailTab('info')}
                        className="flex items-center gap-1.5 text-blue-600 font-black text-[16px] hover:underline cursor-pointer bg-transparent border-none outline-none"
                      >
                        <span>{selectedModelForTrace} (Xem hồ sơ)</span>
                        <ArrowRight className="w-4.5 h-4.5 text-blue-600 stroke-[3]" />
                      </button>
                    </div>

                    {/* ENHANCED CONFIGURATION INPUTS WITH DOUBLE BORDER AND BRIGHT LABELS */}
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* LƯU KHÔNG BÁN STATE */}
                      <div className="bg-white dark:bg-[#0c101d] p-4.5 rounded-2xl border-2 border-slate-250 dark:border-slate-800 text-left space-y-2">
                        <label className="text-[13px] font-black text-slate-800 dark:text-slate-255 uppercase tracking-wide block">
                          Lưu không bán
                        </label>
                        <input
                          type="number"
                          value={tempReserve}
                          onChange={(e) => setTempReserve(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full font-black text-slate-900 dark:text-white text-[20px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-350 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-none transition font-sans text-right"
                        />
                        <p className="text-[11px] text-slate-550 dark:text-slate-400 font-semibold leading-tight">Số bộ giữ lại trưng bày hoặc bảo hành lỗi vải.</p>
                      </div>

                      {/* CẢNH BÁO TỒN THẤP STATE */}
                      <div className="bg-white dark:bg-[#0c101d] p-4.5 rounded-2xl border-2 border-slate-250 dark:border-slate-800 text-left space-y-2">
                        <label className="text-[13px] font-black text-slate-800 dark:text-slate-255 uppercase tracking-wide block">
                          Cảnh báo tồn thấp
                        </label>
                        <input
                          type="number"
                          value={tempThreshold}
                          onChange={(e) => setTempThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full font-black text-slate-900 dark:text-white text-[20px] px-3 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-350 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-none transition font-sans text-right"
                        />
                        <p className="text-[11px] text-slate-550 dark:text-slate-400 font-semibold leading-tight">Cảnh báo đỏ khi kho chạm xuống dưới ngưỡng này.</p>
                      </div>
                    </div>

                    {/* TỔNG QUAN KHO */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider text-left pl-1">
                        PHÂN BỔ SỬ DỤNG
                      </h3>
                      
                      {/* Allocations line layout */}
                      <div className="bg-white dark:bg-[#0c101d] rounded-2xl p-5 border-2 border-slate-205 dark:border-slate-800 text-left">
                        {/* Segment bar graphic representing shares color-coded */}
                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden mb-4 select-none">
                          <div 
                            className="bg-amber-450 h-full transition-all" 
                            style={{ width: `${tempReserve > 0 ? Math.min(100, Math.max(10, (tempReserve / (tempAdjustValue || 1)) * 100)) : 0}%` }} 
                          />
                          <div 
                            className="bg-emerald-500 h-full transition-all" 
                            style={{ width: `${availableToSell > 0 ? 100 - (tempReserve > 0 ? Math.min(100, (tempReserve / (tempAdjustValue || 1)) * 100) : 0) : 0}%` }} 
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs font-bold">
                          <div className="flex flex-col">
                            <span className="text-[13px] text-slate-850 dark:text-slate-200 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#eab308] shrink-0" />
                              Không bán
                            </span>
                            <span className="text-[18px] font-black text-slate-900 dark:text-white pl-4 mt-1">{tempReserve} bộ</span>
                          </div>

                          <div className="flex flex-col border-x border-slate-200 dark:border-slate-800 px-2 font-black">
                            <span className="text-[13px] text-slate-850 dark:text-slate-200 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] shrink-0" />
                              Khách đặt
                            </span>
                            <span className="text-[18px] font-black text-slate-900 dark:text-white pl-4 mt-1">0 bộ</span>
                          </div>

                          <div className="flex flex-col pl-2 font-black">
                            <span className="text-[13px] text-slate-850 dark:text-slate-200 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#84cc16] shrink-0" />
                              Có thể bán
                            </span>
                            <span className="text-[18px] font-black text-slate-900 dark:text-white pl-4 mt-1">{availableToSell} bộ</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* LỊCH SỬ TỒN KHO LIST */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          DÒNG CHỨNG TỪ PHÁT SINH
                        </h3>
                        {formattedHistory.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setShowAllHistory(!showAllHistory)}
                            className="text-blue-500 font-bold text-[13px] hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none outline-none"
                          >
                            <span>{showAllHistory ? 'Thu gọn' : 'Xem tất cả'}</span>
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>

                      {formattedHistory.length === 0 ? (
                        <div className="bg-white dark:bg-[#0c101d] rounded-2xl p-8 border border-slate-100 dark:border-slate-850 text-center text-slate-400 space-y-1.5">
                          <Clock className="w-7 h-7 mx-auto text-slate-300 stroke-[1.5] animate-pulse" />
                          <p className="text-xs font-bold font-sans">Lịch sử dòng hàng trống.</p>
                          <p className="text-[10px] text-slate-400">Không tìm thấy chứng từ cũ của mẫu mã này.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {visibleHistory.map((log: any, idx) => {
                            // Date string parts formatting to represent: YYYY-MM-DD -> DD/MM/YYYY and HH:MM
                            const dParts = log.date.split('-');
                            const cleanDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : log.date;
                            
                            // Fabricated or real clock timestamps
                            const dummyTimes = ['22:22', '22:09', '15:40', '11:15', '09:30'];
                            const cleanTime = log.createdAt 
                              ? (() => {
                                  const raw = new Date(log.createdAt);
                                  return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`;
                                })()
                              : dummyTimes[idx % dummyTimes.length];

                            // Estimated or exact cost basis May/Sales values
                            const priceBasis = log.price || 80000;
                            const qtyBasis = log.quantity || 200;
                            const totalAmount = Math.max(qtyBasis * priceBasis, log.totalPay || 0);

                            return (
                              <div key={log.id || idx} className="flex gap-4 items-start select-none">
                                {/* Left timestamp column */}
                                <div className="w-[88px] text-left shrink-0 pt-1 leading-tight select-none">
                                  <div className="font-extrabold text-[12.5px] text-slate-800 dark:text-slate-205">{cleanDate}</div>
                                  <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 font-mono mt-0.5">{cleanTime}</div>
                                </div>

                                {/* Timeline connection thread dot */}
                                <div className="relative flex flex-col items-center self-stretch shrink-0">
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0c101d] flex items-center justify-center z-10">
                                    <div className={`w-1.5 h-1.5 rounded-full ${log.isImport ? 'bg-sky-500' : 'bg-rose-500'}`} />
                                  </div>
                                  {idx < visibleHistory.length - 1 && (
                                    <div className="w-0.5 bg-slate-200/60 dark:bg-slate-800 flex-1 my-1.5" />
                                  )}
                                </div>

                                {/* Right description card wrapper */}
                                <div 
                                  onClick={() => setSelectedLogDetail(log)}
                                  className="flex-1 bg-white dark:bg-[#0c101d] border border-slate-100 dark:border-slate-850 hover:border-emerald-500 rounded-2xl p-4.5 shadow-xs flex items-center justify-between transition text-left cursor-pointer active:scale-[0.98]"
                                >
                                  <div>
                                    <h4 className="font-bold text-[14.5px] text-slate-850 dark:text-slate-200 leading-tight">
                                      {log.code}
                                    </h4>
                                    <p className="text-[12px] text-slate-400 dark:text-slate-450 font-bold mt-1">
                                      {log.isImport ? 'Khởi tạo kho' : 'Bán hàng'}
                                    </p>
                                  </div>

                                  <div className="text-right flex flex-col justify-between h-9 shrink-0">
                                    <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 font-mono leading-none">
                                      SL: {log.isImport ? `+${qtyBasis}` : `-${qtyBasis}`}
                                    </span>
                                    <span className="text-[12.5px] text-slate-500 dark:text-slate-400 font-semibold font-mono tracking-tight leading-none mt-1">
                                      {totalAmount.toLocaleString('vi-VN')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* PERSISTENT UPDATE ACTION CONTAINER */}
              <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-[#0c101d] border-t border-slate-100 dark:border-slate-850 px-4 py-4.5 z-40 shrink-0">
                <button
                  type="button"
                  onClick={handleUpdateProduct}
                  className="w-full bg-[#00ca62] hover:bg-[#00b255] active:scale-99 text-white font-bold text-[16px] py-4 rounded-xl shadow-lg shadow-emerald-200/50 transition cursor-pointer select-none text-center block"
                >
                  Cập nhật
                </button>
              </div>

            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 8. SINGLE TRANSACTION LEDGER OVERLAY POPUP */}
      <AnimatePresence>
        {selectedLogDetail && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            {/* Click backdrop to exit */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedLogDetail(null)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-white dark:bg-[#0c101d] rounded-3xl border border-slate-200 dark:border-slate-850 p-6 shadow-2xl z-20 space-y-4 max-h-[85vh] flex flex-col text-left font-sans text-slate-800 dark:text-slate-100"
            >
              {/* Top title bar */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-150 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedLogDetail.isImport ? 'bg-sky-500/10 text-sky-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    {selectedLogDetail.isImport ? <Boxes className="w-5 h-5 stroke-[2]" /> : <FileText className="w-5 h-5 stroke-[2]" />}
                  </span>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wide font-mono">
                      {selectedLogDetail.code} - Chi tiết chứng từ
                    </h3>
                    <p className="text-[10px] text-slate-400">Xem đầy đủ nội dung bút toán phát sinh trong kho.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLogDetail(null)}
                  className="p-1 px-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 shrink-0"
                >
                  Đóng
                </button>
              </div>

              {/* Data body list */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
                
                {/* Transaction label tag */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[12px] font-bold text-slate-400">Hình thức:</span>
                  <span className={`text-[12px] font-black uppercase tracking-wide rounded-md px-2 py-0.5 ${selectedLogDetail.isImport ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                    {selectedLogDetail.isImport ? 'Nhập kho hàng may' : 'Xuất bán (Hóa đơn)'}
                  </span>
                </div>

                {/* Shared metadata dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide block">Ngày chứng từ</span>
                    <strong className="text-slate-700 dark:text-slate-300">{(() => {
                      const dParts = selectedLogDetail.date.split('-');
                      return dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : selectedLogDetail.date;
                    })()}</strong>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide block">Số lượng quy đổi</span>
                    <strong className={`font-mono ${selectedLogDetail.isImport ? 'text-sky-600' : 'text-emerald-600'}`}>
                      {selectedLogDetail.isImport ? `+${selectedLogDetail.quantity}` : `-${selectedLogDetail.quantity}`} bộ
                    </strong>
                  </div>
                </div>

                <div className="border-t border-slate-150 dark:border-slate-800 my-2 pt-2" />

                {/* SALE LOG SPECIFIC CONTENT */}
                {!selectedLogDetail.isImport ? (
                  <div className="space-y-4">
                    {/* Customer section */}
                    <div className="bg-slate-50 dark:bg-slate-900/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 space-y-2">
                      <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide block">Đại lý / Khách hàng</span>
                      <div className="flex justify-between items-center font-bold text-slate-800 dark:text-white">
                        <span>{selectedLogDetail.customerName}</span>
                        {selectedLogDetail.customerObj?.phone && (
                          <span className="text-[12px] font-mono font-medium text-slate-500">{selectedLogDetail.customerObj.phone}</span>
                        )}
                      </div>
                    </div>

                    {/* Bill object specifics */}
                    <div className="bg-slate-50 dark:bg-slate-900/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 space-y-3">
                      <div className="flex justify-between items-center text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide border-b border-slate-150 dark:border-slate-800 pb-1.5">
                        <span>Hóa đơn phát sinh</span>
                        <span>Số: #{selectedLogDetail.billNumber || 'HD_MẪU'}</span>
                      </div>

                      {/* Items loop under this invoice if billObj is attached */}
                      {selectedLogDetail.billObj ? (
                        <div className="space-y-2">
                          {(selectedLogDetail.billObj.items || []).map((bitem: any, bidx: number) => {
                            const isCurrentModel = bitem.mẫuMã && bitem.mẫuMã.trim() === selectedModelForTrace;
                            return (
                              <div key={bitem.id || bidx} className={`flex justify-between items-center py-1 text-xs ${isCurrentModel ? 'bg-emerald-500/10 dark:bg-emerald-500/5 px-2 rounded-lg' : ''}`}>
                                <div>
                                  <span className="font-bold text-slate-850 dark:text-slate-200 mr-1.5">{bitem.mẫuMã}</span>
                                  <span className="text-slate-400">({bitem.sốLượng} bộ × {bitem.đơnGiá.toLocaleString()}đ)</span>
                                </div>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{bitem.thànhTiền.toLocaleString()}đ</span>
                              </div>
                            );
                          })}

                          <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 mt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span>Tổng tiền hàng:</span>
                              <span className="font-mono font-bold">{selectedLogDetail.billObj.subtotal?.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Khách đã thanh toán:</span>
                              <span className="font-mono font-semibold text-emerald-600">-{selectedLogDetail.billObj.paymentAmount?.toLocaleString()}đ</span>
                            </div>
                            {selectedLogDetail.billObj.previousDebt > 0 && (
                              <div className="flex justify-between">
                                  <span>Dư nợ cũ dồn:</span>
                                  <span className="font-mono">+{selectedLogDetail.billObj.previousDebt?.toLocaleString()}đ</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-extrabold text-slate-850 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800/65">
                              <span>Dư nợ sau hóa đơn:</span>
                              <span className="font-mono text-blue-500">{selectedLogDetail.billObj.grandTotal?.toLocaleString()}đ</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          Mẫu sản phẩm này: {selectedLogDetail.quantity} bộ × {selectedLogDetail.price.toLocaleString()}đ = {selectedLogDetail.totalPay.toLocaleString()}đ
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* IMPORT LOG SPECIFIC CONTENT */
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 space-y-3">
                      <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide block border-b border-slate-150 dark:border-slate-800 pb-1.5">Chi tiết lô nhập may</span>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Mẫu mã nhập:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{selectedModelForTrace}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Người hoàn thiện:</span>
                          <span className="font-semibold text-slate-800 dark:text-white">Xưởng thợ dệt (ĐT)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Số lượng may:</span>
                          <span className="font-mono font-bold">{selectedLogDetail.quantity} bộ</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Đơn giá may gốc:</span>
                          <span className="font-mono font-semibold">{selectedLogDetail.price.toLocaleString()}đ / bộ</span>
                        </div>
                        {selectedLogDetail.transportFees > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Chi phí trung chuyển (ĐT-TP-ĐT):</span>
                            <span className="font-mono font-semibold text-amber-600">+{selectedLogDetail.transportFees.toLocaleString()}đ</span>
                          </div>
                        )}
                        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-1.5 mt-1.5 flex justify-between text-sm font-extrabold text-slate-850 dark:text-white">
                          <span>Thành tiền lô vải/may:</span>
                          <span className="font-mono text-emerald-600">{(selectedLogDetail.totalPay + selectedLogDetail.transportFees).toLocaleString()}đ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Associated document photos (Data receipts) */}
                {selectedLogDetail.photo && (
                  <div className="space-y-2">
                    <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wide block">Ảnh đính kèm hóa đơn / mẫu vải</span>
                    <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-250 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                      <img 
                        src={selectedLogDetail.photo} 
                        alt="Chung tu can canh" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center text-[10.5px] font-bold text-slate-400/80 uppercase font-mono border-t border-slate-100 dark:border-slate-800">
                Xưởng may An • Thành phố Cao Lãnh
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
