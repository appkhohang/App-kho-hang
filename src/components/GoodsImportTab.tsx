/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Table, Trash2, Edit2, Check, X, FileSpreadsheet, Settings, Sun, Moon, Database, BarChart3, HelpCircle, Download, Upload, AlertCircle, ShoppingBag } from 'lucide-react';
import { ImportItem, LaborPayment, AppSettings, TpDtShippingItem } from '../types';
import { getCurrentDateStr, getVietnameseWeekKey, formatVietnameseDate, getVietnameseMonthKey } from '../utils/dateUtils';
import { exportDatabasePackage } from '../utils/storage';
import LaborPaymentReceiptModal from './LaborPaymentReceiptModal';
import * as XLSX from 'xlsx';

interface GoodsImportTabProps {
  items: ImportItem[];
  setItems: React.Dispatch<React.SetStateAction<ImportItem[]>>;
  laborPayments: LaborPayment[];
  setLaborPayments: React.Dispatch<React.SetStateAction<LaborPayment[]>>;
  tpDtShippings: TpDtShippingItem[];
  setTpDtShippings: React.Dispatch<React.SetStateAction<TpDtShippingItem[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onImportBackup: (content: string) => void;
  selectedWeekFilter?: string;
  setSelectedWeekFilter?: (week: string) => void;
  userRole?: 'admin' | 'staff' | 'viewer';
}

export default function GoodsImportTab({ 
  items, 
  setItems, 
  laborPayments = [], 
  setLaborPayments, 
  tpDtShippings = [],
  setTpDtShippings,
  settings, 
  setSettings, 
  onImportBackup,
  selectedWeekFilter: externalWeekFilter,
  setSelectedWeekFilter: setExternalWeekFilter,
  userRole = 'viewer'
}: GoodsImportTabProps) {
  const isViewer = false;
  // Input fields state
  const [mẫu, setMẫu] = useState('');
  const [sốLượng, setSốLượng] = useState<number | ''>('');
  const [đơnGiáMay, setĐơnGiáMay] = useState<number | ''>('');
  const [shipĐT_TP, setShipĐT_TP] = useState<number | ''>('');
  const [shipTP_ĐT, setShipTP_ĐT] = useState<number | ''>('');
  const [ngàyNhập, setNgàyNhập] = useState(getCurrentDateStr());
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  // Form toggle state for adding either sewn items or separate cargo shipments
  const [activeFormType, setActiveFormType] = useState<'goods' | 'shipping'>('goods');
  
  // Independent Shipping TP -> ĐT fields
  const [shipNộiDung, setShipNộiDung] = useState('');
  const [shipSốTiền, setShipSốTiền] = useState<number | ''>('');
  const [shipNgày, setShipNgày] = useState(getCurrentDateStr());

  // Inline editing state for items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMẫu, setEditMẫu] = useState('');
  const [editSốLượng, setEditSốLượng] = useState<number>(0);
  const [editĐơnGiá, setEditĐơnGiá] = useState<number>(0);
  const [editĐT_TP, setEditĐT_TP] = useState<number>(0);
  const [editTP_ĐT, setEditTP_ĐT] = useState<number>(0);

  // Inline editing state for independent shippings
  const [editingShipId, setEditingShipId] = useState<string | null>(null);
  const [editShipNộiDung, setEditShipNộiDung] = useState('');
  const [editShipSốTiền, setEditShipSốTiền] = useState<number>(0);
  const [editShipNgày, setEditShipNgày] = useState('');

  // Labor payment states
  const [activeWeekForLaborPay, setActiveWeekForLaborPay] = useState<string | null>(null);
  const [laborPayAmount, setLaborPayAmount] = useState<number | ''>('');
  const [laborPayDate, setLaborPayDate] = useState(getCurrentDateStr());
  const [laborPayNote, setLaborPayNote] = useState('');
  const [selectedLaborPaymentForModal, setSelectedLaborPaymentForModal] = useState<LaborPayment | null>(null);

  // Selected week filter ('all' or a specific weekKey string) - Controlled with fallback
  const [localWeekFilter, setLocalWeekFilter] = useState<string>('all');
  const selectedWeekFilter = externalWeekFilter !== undefined ? externalWeekFilter : localWeekFilter;
  const setSelectedWeekFilter = setExternalWeekFilter !== undefined ? setExternalWeekFilter : setLocalWeekFilter;

  // Filter mode & month selection states
  const [filterMode, setFilterMode] = useState<'week' | 'month'>('week');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  // Submit labor payment
  const handleAddLaborPayment = (e: React.FormEvent, weekKey: string) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền thêm phiếu thanh toán!");
      return;
    }
    if (!laborPayAmount) {
      alert("Vui lòng nhập số tiền thanh toán!");
      return;
    }

    const newPayment: LaborPayment = {
      id: "lab-" + Date.now(),
      weekKey,
      amount: Number(laborPayAmount),
      date: laborPayDate,
      note: laborPayNote || "Thanh toán tiền công thợ",
      createdAt: Date.now()
    };

    setLaborPayments(prev => [newPayment, ...prev]);

    // Reset labor pay state
    setLaborPayAmount('');
    setLaborPayNote('');
    setLaborPayDate(getCurrentDateStr());
    setActiveWeekForLaborPay(null);

    // Launch beautiful receipt modal automatically
    setSelectedLaborPaymentForModal(newPayment);
  };

  // Delete labor payment
  const deleteLaborPayment = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền xóa phiếu thanh toán thợ!");
      return;
    }
    if (confirm("Bạn có chắc chắn muốn xóa phiếu thanh toán công thợ này không?")) {
      setLaborPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  // File Upload Ref for Restoration
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Add Item Submit
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền nhập hàng mới!");
      return;
    }
    if (!mẫu || !sốLượng || !đơnGiáMay) {
      alert("Vui lòng nhập đầy đủ Tên mẫu, Số lượng và Đơn giá may!");
      return;
    }

    const newItem: ImportItem = {
      id: "imp-" + Date.now(),
      mẫu,
      sốLượng: Number(sốLượng),
      đơnGiáMay: Number(đơnGiáMay),
      vậnChuyểnĐT_TP: Number(shipĐT_TP || 0),
      vậnChuyểnTP_ĐT: Number(shipTP_ĐT || 0),
      ngày: ngàyNhập,
      weekKey: getVietnameseWeekKey(ngàyNhập),
      createdAt: Date.now()
    };

    setItems(prev => [newItem, ...prev]);

    // Reset Form
    setMẫu('');
    setSốLượng('');
    setĐơnGiáMay('');
    setShipĐT_TP('');
    setShipTP_ĐT('');
    setNgàyNhập(getCurrentDateStr());
  };

  // Start Inline Edit
  const startEdit = (item: ImportItem) => {
    setEditingId(item.id);
    setEditMẫu(item.mẫu);
    setEditSốLượng(item.sốLượng);
    setEditĐơnGiá(item.đơnGiáMay);
    setEditĐT_TP(item.vậnChuyểnĐT_TP);
    setEditTP_ĐT(item.vậnChuyểnTP_ĐT);
  };

  // Save Inline Edit
  const saveEdit = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền chỉnh sửa dòng hàng!");
      return;
    }
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          mẫu: editMẫu,
          sốLượng: editSốLượng,
          đơnGiáMay: editĐơnGiá,
          vậnChuyểnĐT_TP: editĐT_TP,
          vậnChuyểnTP_ĐT: editTP_ĐT
        };
      }
      return item;
    }));
    setEditingId(null);
  };

  // Delete Item
  const deleteItem = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền xóa dòng hàng!");
      return;
    }
    if (confirm("Bạn có chắc chắn muốn xoá dòng nhập hàng này không?")) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // Submit custom shipping TP -> ĐT
  const handleAddTpDtShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền thêm dòng vận chuyển!");
      return;
    }
    if (!shipNộiDung || !shipSốTiền) {
      alert("Vui lòng nhập đầy đủ Nội dung (mẫu/vải) và Số tiền ship!");
      return;
    }

    const newShip: TpDtShippingItem = {
      id: "ship-" + Date.now(),
      nộiDung: shipNộiDung,
      ngày: shipNgày,
      sốTiền: Number(shipSốTiền),
      weekKey: getVietnameseWeekKey(shipNgày),
      createdAt: Date.now()
    };

    setTpDtShippings(prev => [newShip, ...prev]);

    // Reset Form
    setShipNộiDung('');
    setShipSốTiền('');
    setShipNgày(getCurrentDateStr());
  };

  // Start Inline Edit shipping
  const startEditShip = (ship: TpDtShippingItem) => {
    setEditingShipId(ship.id);
    setEditShipNộiDung(ship.nộiDung);
    setEditShipSốTiền(ship.sốTiền);
    setEditShipNgày(ship.ngày);
  };

  // Save Inline Edit shipping
  const saveEditShip = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền chỉnh sửa thông tin vận chuyển!");
      return;
    }
    setTpDtShippings(prev => prev.map(ship => {
      if (ship.id === id) {
        return {
          ...ship,
          nộiDung: editShipNộiDung,
          sốTiền: editShipSốTiền,
          ngày: editShipNgày,
          weekKey: getVietnameseWeekKey(editShipNgày)
        };
      }
      return ship;
    }));
    setEditingShipId(null);
  };

  // Delete shipping
  const deleteShip = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền xóa dòng vận chuyển!");
      return;
    }
    if (confirm("Bạn có chắc chắn muốn xoá dòng vận chuyển này không?")) {
      setTpDtShippings(prev => prev.filter(ship => ship.id !== id));
    }
  };

  // Import JSON handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onImportBackup(content);
    };
    reader.readAsText(file);
  };

  // Group items by Week for table processing
  const itemsByWeek: { [weekLabel: string]: ImportItem[] } = {};
  items.forEach(item => {
    const week = item.weekKey;
    if (!itemsByWeek[week]) {
      itemsByWeek[week] = [];
    }
    itemsByWeek[week].push(item);
  });

  // Group items by Month for table processing
  const itemsByMonth: { [monthLabel: string]: ImportItem[] } = {};
  items.forEach(item => {
    const month = getVietnameseMonthKey(item.ngày);
    if (!itemsByMonth[month]) {
      itemsByMonth[month] = [];
    }
    itemsByMonth[month].push(item);
  });

  // Group independent shippings by Week
  const shippingsByWeek: { [weekLabel: string]: TpDtShippingItem[] } = {};
  tpDtShippings.forEach(ship => {
    const week = ship.weekKey;
    if (!shippingsByWeek[week]) {
      shippingsByWeek[week] = [];
    }
    shippingsByWeek[week].push(ship);
  });

  // Group independent shippings by Month
  const shippingsByMonth: { [monthLabel: string]: TpDtShippingItem[] } = {};
  tpDtShippings.forEach(ship => {
    const month = getVietnameseMonthKey(ship.ngày);
    if (!shippingsByMonth[month]) {
      shippingsByMonth[month] = [];
    }
    shippingsByMonth[month].push(ship);
  });

  // EXCEL GENERATION LOGIC - STRICT COMPLIANCE TO USER REQUEST FORMAT:
  const exportWeekToExcel = (weekLabel: string, weekItems: ImportItem[]) => {
    const workbook = XLSX.utils.book_new();
    const sheetData: any[] = [];
    const isWeek = weekLabel.toLowerCase().includes("tuần");
    const weekShips = isWeek ? (shippingsByWeek[weekLabel] || []) : (shippingsByMonth[weekLabel] || []);

    // Title Row
    sheetData.push(["XƯỞNG AN - BÁO CÁO NHẬP HÀNG CHI TIẾT"]);
    sheetData.push([weekLabel]);
    sheetData.push([]); // blank

    // Traverse items and output exactly the specified structure
    weekItems.forEach((item, index) => {
      const itemSTT = index + 1;
      const amount = item.sốLượng * item.đơnGiáMay;
      const netShip = (item.vậnChuyểnTP_ĐT || 0) - item.vậnChuyểnĐT_TP;

      sheetData.push(["--------------------------------------------------"]);
      sheetData.push(["SỐ THỨ TỰ (STT)", itemSTT]);
      sheetData.push(["NGÀY NHẬP HÀNG", formatVietnameseDate(item.ngày)]);
      sheetData.push(["THÔNG TIN MẪU", `Tên mẫu: ${item.mẫu}`, `Số lượng: ${item.sốLượng}`, `Đơn giá may: ${item.đơnGiáMay} đ`, `Thành tiền: ${amount} đ`]);
      sheetData.push(["TIỀN VẬN CHUYỂN (ĐỒNG THÁP LÊN TP)", `${item.vậnChuyểnĐT_TP} đ`]);
      sheetData.push(["TIỀN VẬN CHUYỂN TRÊN DÒNG (TP VỀ ĐỒNG THÁP)", `${item.vậnChuyểnTP_ĐT || 0} đ`]);
      sheetData.push(["THỐNG KÊ CHI TIẾT DÒNG", `1. Tiền hàng (SL x Đơn giá): ${amount} đ`, `2. Chênh lệch Ship trên dòng: ${netShip} đ`]);
    });

    if (weekShips.length > 0) {
      sheetData.push([]);
      sheetData.push(["=================================================="]);
      sheetData.push(["CÁC KHOẢN VẬN CHUYỂN TP ➔ ĐT TÁCH RIÊNG (MẪU / VẢI...)"]);
      weekShips.forEach((ship, index) => {
        sheetData.push([`STT: ${index + 1}`, `Ngày: ${formatVietnameseDate(ship.ngày)}`, `Nội dung: ${ship.nộiDung}`, `Số tiền: ${ship.sốTiền.toLocaleString()} đ`]);
      });
    }

    // Week Total Summary section
    const wTotalQty = weekItems.reduce((acc, curr) => acc + curr.sốLượng, 0);
    const wTotalAmount = weekItems.reduce((acc, curr) => acc + (curr.sốLượng * curr.đơnGiáMay), 0);
    const wTotalShipDT_TP = weekItems.reduce((acc, curr) => acc + curr.vậnChuyểnĐT_TP, 0);
    
    // Total TP->ĐT combines legacy row-level ship and new separate shippings
    const wTotalLegacyShipTP_DT = weekItems.reduce((acc, curr) => acc + (curr.vậnChuyểnTP_ĐT || 0), 0);
    const wTotalSeparateShipTP_DT = weekShips.reduce((acc, curr) => acc + curr.sốTiền, 0);
    const wTotalShipTP_DT = wTotalLegacyShipTP_DT + wTotalSeparateShipTP_DT;
    const wNetBackShip = wTotalShipTP_DT - wTotalShipDT_TP;

    sheetData.push([]);
    sheetData.push(["=================================================="]);
    sheetData.push([isWeek ? "TỔNG KẾT TUẦN" : "TỔNG KẾT THÁNG"]);
    sheetData.push(["TỔNG SỐ LƯỢNG MAY", wTotalQty]);
    sheetData.push(["LOẠI 1: TỔNG TIỀN HÀNG (SL x ĐƠN GIÁ)", `${wTotalAmount} đ`]);
    sheetData.push(["TỔNG VẬN CHUYỂN ĐT -> TP", `${wTotalShipDT_TP} đ`]);
    sheetData.push(["TỔNG VẬN CHUYỂN TP -> ĐT (GỒM CẢ TÁCH RIÊNG)", `${wTotalShipTP_DT} đ`]);
    sheetData.push(["LOẠI 2: CHÊNH LỆCH SHIP (TP->ĐT TRỪ ĐT->TP)", `${wNetBackShip} đ`]);
    sheetData.push(["=================================================="]);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Apply basic column widths for readability
    worksheet['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

    XLSX.utils.book_append_sheet(workbook, worksheet, isWeek ? "Nhập Hàng Tuần" : "Nhập Hàng Tháng");
    const safeWeekName = weekLabel.replace(/[\/\\?*:[\]]/g, "_");
    XLSX.writeFile(workbook, `XUONG_AN_NHAP_HANG_${safeWeekName}.xlsx`);
  };

  // Helper values for Chart rendering
  const weekStatsForChart = Object.keys(itemsByWeek).map(weekKey => {
    const list = itemsByWeek[weekKey];
    const qty = list.reduce((a, b) => a + b.sốLượng, 0);
    const val = list.reduce((a, b) => a + (b.sốLượng * b.đơnGiáMay), 0);
    return { name: weekKey.split(" ")[1] || "W", qty, val };
  }).reverse().slice(0, 5); // Limit 5 weeks

  return (
    <div className="space-y-6">
      {isViewer && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-2">
          <span>⚠️ Sếp đang xem trong chế độ <strong>CHỈ XEM (VIEWER)</strong>. Thao tác thêm, sửa hoặc xóa sổ sách nhập hàng tạm thời không khả dụng.</span>
        </div>
      )}

      {/* Collapsible Input Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-850/40 transition cursor-pointer font-sans"
        >
          <div className="flex items-center gap-2 text-slate-705 dark:text-slate-200 font-bold text-xs uppercase tracking-wider font-mono">
            <Plus className={`w-4 h-4 text-indigo-500 transition-transform duration-300 ${isFormExpanded ? 'rotate-45' : ''}`} />
            <span>Thêm dữ liệu nhập hàng mới</span>
          </div>
          <span className="text-[10px] text-indigo-650 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg font-bold">
            {isFormExpanded ? 'Thu gọn ▲' : 'Click để nhập mới ▼'}
          </span>
        </button>

        {isFormExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-800/80">
            {/* Form Toggle Segment */}
            <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-550 uppercase tracking-widest font-mono">CHỌN LOẠI DỮ LIỆU NHẬP</span>
              <div className="flex bg-slate-200/40 dark:bg-slate-950 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveFormType('goods')}
                  className={`flex-1 sm:flex-none py-1.5 px-4 rounded-lg text-xs font-semibold select-none transition cursor-pointer text-center ${
                    activeFormType === 'goods' 
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                >
                  📦 Nhập Mẫu Sản Xuất
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormType('shipping')}
                  className={`flex-1 sm:flex-none py-1.5 px-4 rounded-lg text-xs font-semibold select-none transition cursor-pointer text-center ${
                    activeFormType === 'shipping' 
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                >
                  🚚 Tách Riêng Ship TP ➔ ĐT (Vải, Mẫu...)
                </button>
              </div>
            </div>

            {activeFormType === 'goods' ? (
              /* FORM 1: STANDARD GOODS IMPORT */
              <form onSubmit={handleAddItem} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">Mẫu mã sản phẩm</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Đầm Hoa Vintage"
                      value={mẫu}
                      onChange={e => setMẫu(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-sans shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">Số lượng may (chiếc)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="VD: 500"
                      value={sốLượng}
                      onChange={e => setSốLượng(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs bg-white dark:bg-black border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">Đơn giá may (đ / chiếc)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="VD: 15000"
                      value={đơnGiáMay}
                      onChange={e => setĐơnGiáMay(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs bg-white dark:bg-black border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">ĐT ➔ TP Ship sản lượng (đ)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Vận chuyển lên TP (ĐT -> TP)"
                      value={shipĐT_TP}
                      onChange={e => setShipĐT_TP(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs bg-white dark:bg-black border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center pt-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Ngày nhập hàng:</span>
                    <input
                      type="date"
                      value={ngàyNhập}
                      onChange={e => setNgàyNhập(e.target.value)}
                      className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-3 rounded-lg text-slate-700 dark:text-slate-350 font-mono outline-none shadow-2xs"
                    />
                  </div>
                  
                  <button
                    id="add_import_item_btn"
                    type="submit"
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Xác nhận nhập kho</span>
                  </button>
                </div>
              </form>
            ) : (
              /* FORM 2: SEPARATE TP -> DT SHIPPING LOGICAL TRACKER */
              <form onSubmit={handleAddTpDtShipping} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">Nội dung chuyến hàng (Vải, mốc mẫu, phụ liệu...)</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nhập 4 cây vải, hàng mẫu thử"
                      value={shipNộiDung}
                      onChange={e => setShipNộiDung(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-sans shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-450 dark:text-slate-400 mb-1.5">Số tiền thanh toán ship TP ➔ ĐT (đ)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="VD: 250000"
                      value={shipSốTiền}
                      onChange={e => setShipSốTiền(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs bg-white dark:bg-black border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center pt-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Ngày ghi nhận:</span>
                    <input
                      type="date"
                      value={shipNgày}
                      onChange={e => setShipNgày(e.target.value)}
                      className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-3 rounded-lg text-slate-700 dark:text-slate-350 font-mono outline-none shadow-2xs"
                    />
                  </div>
                  
                  <button
                    id="add_tp_dt_ship_btn"
                    type="submit"
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Xác nhận nhập tiền ship</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block animate-pulse" />
              <span className="text-xs font-bold text-slate-755 dark:text-slate-300 uppercase tracking-wider font-sans">
                Chọn chế độ xem báo cáo nhập hàng:
              </span>
            </div>
            
            {/* Filter mode dynamic selector */}
            <div className="flex bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg text-xs font-semibold gap-0.5 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterMode('week')}
                className={`flex-1 sm:flex-initial py-1 px-3 rounded-md transition cursor-pointer font-sans ${filterMode === 'week' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 font-extrabold shadow-sm border border-slate-200/50 dark:border-slate-700' : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-250'}`}
              >
                Tuần 📅
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                className={`flex-1 sm:flex-initial py-1 px-3 rounded-md transition cursor-pointer font-sans ${filterMode === 'month' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 font-extrabold shadow-sm border border-slate-200/50 dark:border-slate-700' : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-250'}`}
              >
                Tháng 🗓️
              </button>
            </div>
          </div>

          <div className="relative w-full">
            {filterMode === 'week' ? (
              <select
                value={selectedWeekFilter}
                onChange={(e) => setSelectedWeekFilter(e.target.value)}
                className="w-full text-xs font-medium bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-250 dark:border-slate-800 py-2.5 px-3 pr-8 rounded-xl text-slate-855 dark:text-slate-150 outline-none focus:border-indigo-500 font-sans cursor-pointer transition appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%234f46e5' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.6rem center',
                  backgroundSize: '1.25rem 1.25rem',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <option value="all">📅 Hiện tất cả các tuần ({Object.keys(itemsByWeek).length} tuần)</option>
                {Object.keys(itemsByWeek)
                  .sort((a, b) => b.localeCompare(a))
                  .map((weekKey) => {
                    const qty = itemsByWeek[weekKey].reduce((sum, item) => sum + item.sốLượng, 0);
                    const itemsCount = itemsByWeek[weekKey].length;
                    return (
                      <option key={weekKey} value={weekKey}>
                        {weekKey} ({itemsCount} lô - {qty.toLocaleString()} cái)
                      </option>
                    );
                  })}
              </select>
            ) : (
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="w-full text-xs font-medium bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-905 border border-slate-250 dark:border-slate-800 py-2.5 px-3 pr-8 rounded-xl text-slate-855 dark:text-slate-150 outline-none focus:border-indigo-500 font-sans cursor-pointer transition appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%234f46e5' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.6rem center',
                  backgroundSize: '1.25rem 1.25rem',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <option value="all">🗓️ Hiện tất cả các tháng ({Object.keys(itemsByMonth).length} tháng)</option>
                {Object.keys(itemsByMonth)
                  .sort((a, b) => b.localeCompare(a))
                  .map((monthKey) => {
                    const qty = itemsByMonth[monthKey].reduce((sum, item) => sum + item.sốLượng, 0);
                    const itemsCount = itemsByMonth[monthKey].length;
                    return (
                      <option key={monthKey} value={monthKey}>
                        {monthKey} ({itemsCount} lô - {qty.toLocaleString()} cái)
                      </option>
                    );
                  })}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Week grouped tables display */}
      <div className="space-y-8">
        {items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Table className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Chưa có dữ liệu nhập hàng nào.</p>
            <p className="text-xs text-slate-400 mt-1">Sử dụng bảng điền thông tin phía trên để bắt đầu thêm dữ liệu nhập hàng.</p>
          </div>
        ) : (
          (() => {
            const isWeekMode = filterMode === 'week';
            const groupData = isWeekMode ? itemsByWeek : itemsByMonth;
            const currentFilterValue = isWeekMode ? selectedWeekFilter : selectedMonthFilter;
            const setCurrentFilterValue = isWeekMode ? setSelectedWeekFilter : setSelectedMonthFilter;

            const filteredGroupKeys = Object.keys(groupData)
              .sort((a, b) => b.localeCompare(a))
              .filter(label => currentFilterValue === 'all' || label === currentFilterValue);

            if (filteredGroupKeys.length === 0) {
              return (
                <div className="text-center py-12 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">Không còn dữ liệu cho bộ lọc đã chọn.</p>
                  <button
                    onClick={() => setCurrentFilterValue('all')}
                    className="mt-2 text-xs font-bold text-indigo-650 dark:text-indigo-400 underline cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                </div>
              );
            }

            return filteredGroupKeys.map(weekLabel => {
              const weekItems = groupData[weekLabel];
              const weekShippings = isWeekMode 
                ? (shippingsByWeek[weekLabel] || [])
                : (shippingsByMonth[weekLabel] || []);
              
              // Computations
              const totalQty = weekItems.reduce((acc, curr) => acc + curr.sốLượng, 0);
              const totalAmount = weekItems.reduce((acc, curr) => acc + (curr.sốLượng * curr.đơnGiáMay), 0);
              const cleanTotalAmount = totalAmount;
              const totalShipĐT_TP = weekItems.reduce((acc, curr) => acc + curr.vậnChuyểnĐT_TP, 0);
              
              // Sum legacy row ship + separate ship logs
              const legacyShipTP_ĐT = weekItems.reduce((acc, curr) => acc + (curr.vậnChuyểnTP_ĐT || 0), 0);
              const separateShipTP_ĐT = weekShippings.reduce((acc, curr) => acc + curr.sốTiền, 0);
              const totalShipTP_ĐT = legacyShipTP_ĐT + separateShipTP_ĐT;
              const netBackShipValue = totalShipTP_ĐT - totalShipĐT_TP;

              // Labor computations
              const weekLaborPayments = isWeekMode 
                ? laborPayments.filter(p => p.weekKey === weekLabel)
                : laborPayments.filter(p => getVietnameseMonthKey(p.date) === weekLabel || p.weekKey === weekLabel);

              const totalLaborPaid = weekLaborPayments.reduce((acc, p) => acc + p.amount, 0);
              const remainingLaborDebt = cleanTotalAmount - totalLaborPaid;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={weekLabel}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Week Header */}
                  <div className="bg-slate-50 dark:bg-zinc-950 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 font-sans tracking-tight">{weekLabel}</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Tổng cộng {weekItems.length} dòng dữ liệu</p>
                    </div>

                    <button
                      id={`export_btn_${weekLabel}`}
                      onClick={() => exportWeekToExcel(weekLabel, weekItems)}
                      className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs py-1.5 px-4 rounded-lg font-medium flex items-center gap-1.5 border border-emerald-250 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Xuất Excel Tuần</span>
                    </button>
                  </div>

                {/* Week Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#111827] text-slate-505 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold font-mono text-[10px] sm:text-[11px]">STT</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">Ngày Nhập</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">Mẫu</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">Số Lượng</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">Đơn Giá May</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">Thành Tiền (đ)</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">ĐT {"->"} TP</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-[10px] sm:text-[11px]">TP {"->"} ĐT</th>
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 text-right font-semibold text-[10px] sm:text-[11px]">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-105 dark:divide-slate-800">
                      {weekItems.map((item, index) => {
                        const isEditing = editingId === item.id;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition">
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-slate-400 text-[10px] sm:text-xs">{index + 1}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-slate-550 dark:text-slate-450 text-[10px] sm:text-xs">{formatVietnameseDate(item.ngày)}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-slate-850 dark:text-slate-100 text-[10px] sm:text-xs">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editMẫu}
                                  onChange={e => setEditMẫu(e.target.value)}
                                  className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-xs w-full min-w-[70px]"
                                />
                              ) : (
                                item.mẫu
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-[10px] sm:text-xs">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editSốLượng}
                                  onChange={e => setEditSốLượng(Number(e.target.value))}
                                  className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-xs w-16 sm:w-24 font-mono"
                                />
                              ) : (
                                item.sốLượng.toLocaleString()
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-[10px] sm:text-xs">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editĐơnGiá}
                                  onChange={e => setEditĐơnGiá(Number(e.target.value))}
                                  className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-xs w-16 sm:w-24 font-mono"
                                />
                              ) : (
                                `${item.đơnGiáMay.toLocaleString()} đ`
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs">
                              {(isEditing ? editSốLượng * editĐơnGiá : item.sốLượng * item.đơnGiáMay).toLocaleString()}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-slate-500 text-[10px] sm:text-xs">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editĐT_TP}
                                  onChange={e => setEditĐT_TP(Number(e.target.value))}
                                  className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-xs w-16 sm:w-24 font-mono"
                                />
                              ) : (
                                item.vậnChuyểnĐT_TP ? `${item.vậnChuyểnĐT_TP.toLocaleString()} đ` : '0 đ'
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-slate-500 text-[10px] sm:text-xs">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editTP_ĐT}
                                  onChange={e => setEditTP_ĐT(Number(e.target.value))}
                                  className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-xs w-16 sm:w-24 font-mono"
                                />
                              ) : (
                                item.vậnChuyểnTP_ĐT ? `${item.vậnChuyểnTP_ĐT.toLocaleString()} đ` : '0 đ'
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => saveEdit(item.id)}
                                    className="p-1 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer transition text-[9px] sm:text-[10px]"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 px-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-705 text-slate-650 dark:text-slate-350 rounded cursor-pointer transition text-[9px] sm:text-[10px]"
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2 text-slate-400">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="hover:text-blue-500 transition p-1 cursor-pointer"
                                    title="Sửa hàng này"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    className="hover:text-red-500 transition p-1 cursor-pointer"
                                    title="Xoá hàng này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Independent TP -> DT Shippings Table */}
                <div className="border-t border-slate-150 dark:border-slate-850 bg-slate-50/10 dark:bg-slate-950/5 px-5 py-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 uppercase font-mono block">
                      🚚 Chi phí Ship TP ➔ ĐT tách riêng (vải, mẫu)
                    </span>
                    {weekShippings.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        Tổng cộng: {separateShipTP_ĐT.toLocaleString()} đ
                      </span>
                    )}
                  </div>

                  {weekShippings.length === 0 ? (
                    <div className="text-center py-4 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Chưa ghi nhận phí ship TP ➔ ĐT tách riêng cho {isWeekMode ? 'tuần' : 'tháng'} này.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFormExpanded(true);
                          setActiveFormType('shipping');
                          setShipNgày(weekItems[0]?.ngày || getCurrentDateStr());
                        }}
                        className="mt-1 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        + Thêm chi phí ship mới
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-150 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-[#111827] text-slate-505 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-1.5 sm:py-2.5 px-2 sm:px-3 font-semibold font-mono text-[9px] sm:text-[10px] w-8 sm:w-12">STT</th>
                            <th className="py-1.5 sm:py-2.5 px-2 sm:px-3 font-semibold text-[9px] sm:text-[10px] w-20 sm:w-28">Ngày ghi nhận</th>
                            <th className="py-1.5 sm:py-2.5 px-2 sm:px-3 font-semibold text-[9px] sm:text-[10px]">Nội dung chuyến hàng (mẫu/vải...)</th>
                            <th className="py-1.5 sm:py-2.5 px-2 sm:px-3 font-semibold text-[9px] sm:text-[10px] w-24 sm:w-32">Số tiền ship (đ)</th>
                            <th className="py-1.5 sm:py-2.5 px-2 sm:px-3 text-right font-semibold text-[9px] sm:text-[10px] w-16 sm:w-24">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {weekShippings.map((ship, idx) => {
                            const isEditingShip = editingShipId === ship.id;
                            return (
                              <tr key={ship.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/10 transition">
                                <td className="py-1.5 sm:py-2 px-2 sm:px-3 font-mono text-slate-400 text-[10px] sm:text-xs">{idx + 1}</td>
                                <td className="py-1.5 sm:py-2 px-2 sm:px-3 font-mono text-[10px] sm:text-xs">
                                  {isEditingShip ? (
                                    <input
                                      type="date"
                                      value={editShipNgày}
                                      onChange={e => setEditShipNgày(e.target.value)}
                                      className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-[11px] font-mono w-full min-w-[70px]"
                                    />
                                  ) : (
                                    formatVietnameseDate(ship.ngày)
                                  )}
                                </td>
                                <td className="py-1.5 sm:py-2 px-2 sm:px-3 font-medium text-slate-700 dark:text-slate-350 text-[10px] sm:text-xs">
                                  {isEditingShip ? (
                                    <input
                                      type="text"
                                      value={editShipNộiDung}
                                      onChange={e => setEditShipNộiDung(e.target.value)}
                                      className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-[11px] w-full min-w-[80px]"
                                    />
                                  ) : (
                                    ship.nộiDung
                                  )}
                                </td>
                                <td className="py-1.5 sm:py-2 px-2 sm:px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[10px] sm:text-xs">
                                  {isEditingShip ? (
                                    <input
                                      type="number"
                                      value={editShipSốTiền}
                                      onChange={e => setEditShipSốTiền(Number(e.target.value))}
                                      className="bg-white dark:bg-slate-950 py-0.5 px-1 border rounded border-indigo-400 outline-none text-[10px] sm:text-[11px] font-mono w-full min-w-[60px]"
                                    />
                                  ) : (
                                    `${ship.sốTiền.toLocaleString()} đ`
                                  )}
                                </td>
                                <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-right">
                                  {isEditingShip ? (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => saveEditShip(ship.id)}
                                        className="py-0.5 px-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded text-[9px] sm:text-[10px] cursor-pointer font-medium"
                                      >
                                        Lưu
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingShipId(null)}
                                        className="py-0.5 px-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[9px] sm:text-[10px] cursor-pointer font-medium"
                                      >
                                        Huỷ
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-2 text-slate-400">
                                      <button
                                        type="button"
                                        onClick={() => startEditShip(ship)}
                                        className="hover:text-blue-500 transition p-0.5 cursor-pointer"
                                        title="Sửa chuyến ship"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteShip(ship.id)}
                                        className="hover:text-red-500 transition p-0.5 cursor-pointer"
                                        title="Xoá chuyến ship"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Calculations Summary at the Bottom */}
                <div className="bg-slate-50/40 dark:bg-slate-950/20 px-5 py-4 border-t border-slate-150 dark:border-slate-850">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 font-medium uppercase font-mono">TỔNG SỐ LƯỢNG MAY</span>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">{totalQty.toLocaleString()} chiếc</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 font-medium uppercase font-mono">LOẠI 1: TỔNG TIỀN HÀNG (SL x Đơn Giá)</span>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">{totalAmount.toLocaleString()} đ</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 font-medium uppercase font-mono">VẬN CHUYỂN (ĐT ➔ TP / TP ➔ ĐT)</span>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-350 font-mono">
                        {totalShipĐT_TP.toLocaleString()} đ ➔ {totalShipTP_ĐT.toLocaleString()} đ
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 font-medium uppercase font-mono">LOẠI 2: CHÊNH LỆCH SHIP (TP➔ĐT TRỪ ĐT➔TP)</span>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {netBackShipValue >= 0 ? '+' : ''}{netBackShipValue.toLocaleString()} đ
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section Theo dõi và Thanh toán nhân công */}
                <div className="border-t border-slate-150 dark:border-slate-850 bg-indigo-50/15 dark:bg-indigo-950/20 px-5 py-4">
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    {/* Sổ quỹ nhân công */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 uppercase font-mono">
                          💸 Theo dõi & Thanh toán nhân công (Thợ)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 sm:p-3 rounded-xl shadow-xs">
                        <div>
                          <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase block tracking-wider leading-tight">Tiền công thợ</span>
                          <span className="text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                            {totalAmount.toLocaleString()}đ
                          </span>
                        </div>
                        <div className="border-l border-slate-150 dark:border-slate-800 pl-2 sm:pl-3">
                          <span className="text-[8px] sm:text-[9px] text-emerald-500 font-bold uppercase block tracking-wider leading-tight">Đã trả thợ</span>
                          <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {totalLaborPaid.toLocaleString()}đ
                          </span>
                        </div>
                        <div className="border-l border-slate-150 dark:border-slate-800 pl-2 sm:pl-3">
                          <span className="text-[8px] sm:text-[9px] text-rose-500 font-bold uppercase block tracking-wider leading-tight">Còn nợ thợ</span>
                          <span className={`text-[10px] sm:text-xs font-bold font-mono ${remainingLaborDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {remainingLaborDebt.toLocaleString()}đ
                          </span>
                        </div>
                      </div>

                      <div>
                        {activeWeekForLaborPay === weekLabel ? (
                          <form 
                            onSubmit={(e) => handleAddLaborPayment(e, weekLabel)}
                            className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 p-3.5 rounded-xl space-y-2.5 shadow-md mt-2"
                          >
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block font-mono">Chi tiết phiếu thanh toán công thợ</span>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Số tiền trả thợ (đ)</label>
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  placeholder="Nhập số tiền"
                                  value={laborPayAmount}
                                  onChange={e => setLaborPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-2 rounded-lg text-slate-800 dark:text-slate-200 outline-none font-mono focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Ghi chú thanh toán</label>
                                <input
                                  type="text"
                                  placeholder="VD: Trả nợ công hoặc tạm ứng"
                                  value={laborPayNote}
                                  onChange={e => setLaborPayNote(e.target.value)}
                                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-2 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveWeekForLaborPay(null)}
                                className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-1 px-3 rounded text-slate-600 dark:text-slate-400 cursor-pointer"
                              >
                                Thoát
                              </button>
                              <button
                                type="submit"
                                className="text-[10px] bg-indigo-650 hover:bg-indigo-700 text-white font-semibold py-1 px-3.5 rounded shadow cursor-pointer transition"
                              >
                                Xác nhận thanh toán
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWeekForLaborPay(weekLabel);
                              setLaborPayAmount(remainingLaborDebt > 0 ? remainingLaborDebt : '');
                              setLaborPayNote('Thanh toán tiền công thợ');
                            }}
                            className="bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition shadow-sm active:scale-95 cursor-pointer"
                          >
                            + Ghi nhận thanh toán công thợ
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lịch sử thanh toán thợ */}
                    <div className="flex-1 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-200/60 dark:border-slate-850 pt-3 lg:pt-0 lg:pl-6">
                      <span className="text-[10px] font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase font-mono block">
                        📅 Phiếu thanh toán công thợ {isWeekMode ? 'tuần này' : 'tháng này'}
                      </span>

                      {weekLaborPayments.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-1">
                          Chưa có phiếu thanh toán nào cho thợ {isWeekMode ? 'tuần này' : 'tháng này'}.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-45 overflow-y-auto pr-1">
                          {weekLaborPayments.map((p) => (
                            <div 
                              key={p.id} 
                              className="flex justify-between items-center text-[11px] bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-2xs hover:border-indigo-300 transition"
                            >
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-[#4f46e5] dark:text-indigo-400 font-mono">
                                  -{p.amount.toLocaleString()}đ
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                  📅 {formatVietnameseDate(p.date)} - {p.note}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 pl-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLaborPaymentForModal(p)}
                                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-455 dark:hover:text-indigo-305 hover:bg-indigo-50 dark:hover:bg-slate-800/60 rounded px-1.5 py-0.5 text-[9px] font-bold cursor-pointer transition select-none border border-indigo-100 dark:border-indigo-900/30"
                                >
                                  Xem phiếu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteLaborPayment(p.id)}
                                  className="text-slate-450 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition p-1 cursor-pointer"
                                  title="Xoá phiếu này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          });
        })()
      )}
      </div>

      {/* Labor payment receipt modal for snapshot/custom share */}
      <AnimatePresence>
        {selectedLaborPaymentForModal && (
          <LaborPaymentReceiptModal
            payment={selectedLaborPaymentForModal}
            weekItems={items.filter(item => item.weekKey === selectedLaborPaymentForModal.weekKey)}
            allLaborPayments={laborPayments}
            onClose={() => setSelectedLaborPaymentForModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
