/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Table, Trash2, Edit2, Check, X, FileSpreadsheet, Settings, Sun, Moon, Database, BarChart3, HelpCircle, Download, Upload, AlertCircle, ShoppingBag, Sparkles, Truck, Wallet, Filter, SlidersHorizontal, Camera, ChevronRight, Info, Calendar } from 'lucide-react';
import { ImportItem, LaborPayment, AppSettings, TpDtShippingItem } from '../types';
import { getCurrentDateStr, getVietnameseWeekKey, formatVietnameseDate, getVietnameseMonthKey } from '../utils/dateUtils';
import { exportDatabasePackage } from '../utils/storage';
import LaborPaymentReceiptModal from './LaborPaymentReceiptModal';
import CameraCapture from './CameraCapture';
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

  // Get unique recent import items for Quick Action shortcuts
  const recentUniqueItems = React.useMemo(() => {
    const uniques: ImportItem[] = [];
    const seen = new Set<string>();
    // Iterate from newest to oldest
    for (const item of items) {
      if (!seen.has(item.mẫu)) {
        seen.add(item.mẫu);
        uniques.push(item);
        if (uniques.length >= 5) break;
      }
    }
    return uniques;
  }, [items]);

  // Column selector visibility and column options
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('xuongan_import_visible_columns');
      return saved ? JSON.parse(saved) : {
        ngay: true,
        mau: true,
        soLuong: true,
        donGia: true,
        thanhTien: true,
        dtTp: true,
        tpDt: true,
      };
    } catch {
      return {
        ngay: true,
        mau: true,
        soLuong: true,
        donGia: true,
        thanhTien: true,
        dtTp: true,
        tpDt: true,
      };
    }
  });

  const toggleColumn = (key: 'ngay' | 'mau' | 'soLuong' | 'donGia' | 'thanhTien' | 'dtTp' | 'tpDt') => {
    const updated = { ...visibleColumns, [key]: !visibleColumns[key] };
    setVisibleColumns(updated);
    try {
      localStorage.setItem('xuongan_import_visible_columns', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Input fields state
  const [mẫu, setMẫu] = useState('');
  const [sốLượng, setSốLượng] = useState<number | ''>('');
  const [đơnGiáMay, setĐơnGiáMay] = useState<number | ''>('');
  const [shipĐT_TP, setShipĐT_TP] = useState<number | ''>('');
  const [shipTP_ĐT, setShipTP_ĐT] = useState<number | ''>('');
  const [ngàyNhập, setNgàyNhập] = useState(getCurrentDateStr());
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [importPhoto, setImportPhoto] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

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

  // Track which weeks' labor details panels are expanded
  const [openLaborPanelWeeks, setOpenLaborPanelWeeks] = useState<{ [key: string]: boolean }>({});

  const toggleLaborPanel = (weekLabel: string) => {
    setOpenLaborPanelWeeks(prev => ({
      ...prev,
      [weekLabel]: !prev[weekLabel]
    }));
  };

  // State variables for the compact details view modal
  const [selectedItemForModal, setSelectedItemForModal] = useState<ImportItem | null>(null);
  const [isDetailEditing, setIsDetailEditing] = useState<boolean>(false);
  const [modalEditMẫu, setModalEditMẫu] = useState('');
  const [modalEditSốLượng, setModalEditSốLượng] = useState<number>(0);
  const [modalEditĐơnGiá, setModalEditĐơnGiá] = useState<number>(0);
  const [modalEditĐT_TP, setModalEditĐT_TP] = useState<number>(0);
  const [modalEditTP_ĐT, setModalEditTP_ĐT] = useState<number>(0);
  const [modalEditNgày, setModalEditNgày] = useState('');

  const startModalEdit = (item: ImportItem) => {
    setIsDetailEditing(true);
    setModalEditMẫu(item.mẫu);
    setModalEditSốLượng(item.sốLượng);
    setModalEditĐơnGiá(item.đơnGiáMay);
    setModalEditĐT_TP(item.vậnChuyểnĐT_TP);
    setModalEditTP_ĐT(item.vậnChuyểnTP_ĐT);
    setModalEditNgày(item.ngày);
  };

  const saveModalEdit = (id: string) => {
    if (isViewer) {
      alert("⚠️ Bạn đang đăng nhập với vai trò CHỈ XEM, không có quyền chỉnh sửa dòng hàng!");
      return;
    }
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = {
          ...item,
          mẫu: modalEditMẫu,
          sốLượng: Number(modalEditSốLượng || 0),
          đơnGiáMay: Number(modalEditĐơnGiá || 0),
          vậnChuyểnĐT_TP: Number(modalEditĐT_TP || 0),
          vậnChuyểnTP_ĐT: Number(modalEditTP_ĐT || 0),
          ngày: modalEditNgày,
          weekKey: getVietnameseWeekKey(modalEditNgày)
        };
        setSelectedItemForModal(updated);
        return updated;
      }
      return item;
    }));
    setIsDetailEditing(false);
  };

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
      createdAt: Date.now(),
      photo: importPhoto || undefined
    };

    setItems(prev => [newItem, ...prev]);

    // Reset Form
    setMẫu('');
    setSốLượng('');
    setĐơnGiáMay('');
    setShipĐT_TP('');
    setShipTP_ĐT('');
    setNgàyNhập(getCurrentDateStr());
    setImportPhoto(null);
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

  // Calculate totals for currently displayed items
  const displayedTotals = React.useMemo(() => {
    const isWeekMode = filterMode === 'week';
    const groupData = isWeekMode ? itemsByWeek : itemsByMonth;
    const currentFilterValue = isWeekMode ? selectedWeekFilter : selectedMonthFilter;

    const filteredGroupKeys = Object.keys(groupData)
      .sort((a, b) => b.localeCompare(a))
      .filter(label => currentFilterValue === 'all' || label === currentFilterValue);

    let totalQty = 0;
    let totalGoodsAmount = 0;
    let totalShip = 0;

    filteredGroupKeys.forEach(label => {
      const weekItems = groupData[label] || [];
      const weekShippings = isWeekMode 
        ? (shippingsByWeek[label] || [])
        : (shippingsByMonth[label] || []);

      // Total Qty
      const q = weekItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
      totalQty += q;

      // Total Goods Amount
      const a = weekItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0);
      totalGoodsAmount += a;

      // Total Ship on item level
      const dtTp = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
      const legacyTpDt = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
      // Separate shipping
      const separateTpDt = weekShippings.reduce((acc, curr) => acc + curr.sốTiền, 0);

      totalShip += (dtTp + legacyTpDt + separateTpDt);
    });

    return {
      totalQty,
      totalGoodsAmount,
      totalShip,
      totalCost: totalGoodsAmount + totalShip
    };
  }, [items, tpDtShippings, filterMode, selectedWeekFilter, selectedMonthFilter, itemsByWeek, itemsByMonth, shippingsByWeek, shippingsByMonth]);

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
    const wTotalQty = weekItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
    const wTotalAmount = weekItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0);
    const wTotalShipDT_TP = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
    
    // Total TP->ĐT combines legacy row-level ship and new separate shippings
    const wTotalLegacyShipTP_DT = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
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

      {/* Floating Action Button (FAB) for adding new record */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40">
        <motion.button
          id="fab_add_import"
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsFormExpanded(true);
            // Default to 'goods' form
            setActiveFormType('goods');
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg cursor-pointer flex items-center justify-center border border-indigo-400/20 active:scale-95 transition"
          title="Thêm dữ liệu nhập hàng mới"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Floating Input Modal */}
      <AnimatePresence>
        {isFormExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormExpanded(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden relative border border-slate-150 dark:border-slate-800 z-10 flex flex-col max-h-[85vh]"
            >
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-705 dark:text-slate-200 uppercase tracking-wider font-mono">
                    Nhập thông tin kho hàng mới
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormExpanded(false)}
                  className="p-1 px-1.5 rounded-lg hover:bg-slate-205 dark:hover:bg-slate-800 text-slate-450 hover:text-slate-705 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-1">
                {/* Form Toggle Segment */}
                <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
                  <span className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest font-mono">CHỌN LOẠI DỮ LIỆU NHẬP</span>
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
                  <form onSubmit={(e) => { handleAddItem(e); setIsFormExpanded(false); }} className="p-5 space-y-4">
                    {/* Quick Action Shortcuts for Recent Items */}
                    {recentUniqueItems.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider font-mono">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                          <span>Phím tắt nhanh (Bản ghi gần đây):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recentUniqueItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setMẫu(item.mẫu);
                                setĐơnGiáMay(item.đơnGiáMay);
                                setShipĐT_TP(item.vậnChuyểnĐT_TP || '');
                                setShipTP_ĐT(item.vậnChuyểnTP_ĐT || '');
                              }}
                              className="flex items-center gap-1.5 py-1 px-2 bg-white dark:bg-slate-900 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 border border-slate-200 dark:border-slate-850 hover:border-indigo-400 dark:hover:border-indigo-850 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-450 transition cursor-pointer text-left shadow-2xs"
                              title={`Click để tự động nhập Mẫu ${item.mẫu} với đơn giá ${item.đơnGiáMay.toLocaleString()} đ`}
                            >
                              <span className="font-semibold">{item.mẫu}</span>
                              <span className="text-slate-350 dark:text-slate-650">|</span>
                              <span className="font-mono text-[9px] bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded text-indigo-650 dark:text-indigo-400 font-bold">
                                {item.đơnGiáMay.toLocaleString()}đ
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 font-sans">Đơn giá may (đ / chiếc)</label>
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
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 font-sans">ĐT ➔ TP Ship sản lượng (đ)</label>
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

                    {/* Camera Capture for Goods Item */}
                    <div className="border-t border-slate-100 dark:border-slate-805/40 pt-2 pb-1">
                      <CameraCapture
                        onCapture={setImportPhoto}
                        initialValue={importPhoto}
                        resolvedTheme={settings.theme === 'dark' ? 'dark' : 'light'}
                      />
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
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsFormExpanded(false)}
                          className="flex-1 sm:flex-none border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium py-2 px-4 rounded-lg cursor-pointer transition text-center"
                        >
                          Đóng
                        </button>
                        <button
                          id="add_import_item_btn"
                          type="submit"
                          className="flex-1 sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-[0.98]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Xác nhận nhập kho</span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* FORM 2: SEPARATE TP -> DT SHIPPING LOGICAL TRACKER */
                  <form onSubmit={(e) => { handleAddTpDtShipping(e); setIsFormExpanded(false); }} className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 font-sans">Nội dung chuyến hàng (Vải, mốc mẫu, phụ liệu...)</label>
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
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 font-sans">Số tiền thanh toán ship TP ➔ ĐT (đ)</label>
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
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsFormExpanded(false)}
                          className="flex-1 sm:flex-none border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium py-2 px-4 rounded-lg cursor-pointer transition text-center"
                        >
                          Đóng
                        </button>
                        <button
                          id="add_tp_dt_ship_btn"
                          type="submit"
                          className="flex-1 sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-[0.98]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Xác nhận nhập tiền ship</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs gap-3">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold font-mono">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Danh sách lô nhập kho</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  Chế độ xem: {filterMode === 'week' ? `Lọc theo Tuần (${selectedWeekFilter === 'all' ? 'Tất cả' : selectedWeekFilter})` : `Lọc theo Tháng (${selectedMonthFilter === 'all' ? 'Tất cả' : selectedMonthFilter})`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shadow-md shadow-indigo-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Nhấn để mở Bộ lọc và Cấu hình bảng số liệu"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Bộ Lọc & Báo Cáo</span>
            </button>
          </div>

          {/* Real-time sum panel for displayed items */}
          <div className="bg-gradient-to-r from-indigo-500/5 to-emerald-500/5 dark:from-indigo-950/20 dark:to-emerald-950/20 border border-indigo-100 dark:border-indigo-950/60 p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase font-sans">
                  Tổng kết nhanh của danh sách đang hiển thị
                </span>
              </div>
              <span className="text-[10px] font-mono font-extrabold text-[#31574a] dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {displayedTotals.totalQty.toLocaleString()} sản phẩm
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Tiền hàng */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl shadow-2xs">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                  Tổng tiền hàng / thợ
                </span>
                <div className="text-base font-black font-mono text-indigo-650 dark:text-indigo-400 mt-2">
                  {displayedTotals.totalGoodsAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">đ</span>
                </div>
              </div>

              {/* Tiền ship */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl shadow-2xs">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                  Tổng tiền ship (vận chuyển)
                </span>
                <div className="text-base font-black font-mono text-rose-500 dark:text-rose-400 mt-2">
                  {displayedTotals.totalShip.toLocaleString()} <span className="text-xs font-normal text-slate-400">đ</span>
                </div>
              </div>

              {/* Tổng chi phí */}
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/25 dark:border-emerald-500/20 rounded-xl shadow-2xs">
                <span className="text-[9px] uppercase font-extrabold text-emerald-600 dark:text-emerald-400 block tracking-wider leading-none">
                  TỔNG CHI PHÍ THỰC TẾ
                </span>
                <div className="text-base font-black font-mono text-emerald-650 dark:text-emerald-300 mt-2 flex items-baseline gap-1">
                  <span>{displayedTotals.totalCost.toLocaleString()}</span>
                  <span className="text-xs font-bold text-emerald-550/80">đ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and column config Modal Page */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative border border-slate-150 dark:border-slate-800 z-10 flex flex-col max-h-[85vh]"
            >
              <div className="p-5 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-slate-850 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <SlidersHorizontal className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">
                      Bộ Lọc & Cấu Hình Cột
                    </h3>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium">Chọn chế độ xem báo cáo phù hợp cho bảng nhập kho</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-1 px-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-6">
                {/* 1. Filter Mode Select */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    1. Đơn vị lọc báo cáo:
                  </label>
                  <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFilterMode('week')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-sans ${filterMode === 'week' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700' : 'text-slate-550 hover:text-slate-800'}`}
                    >
                      Báo Cáo Theo Tuần 📅
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('month')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-sans ${filterMode === 'month' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-xs border border-slate-200/50 dark:border-slate-700' : 'text-slate-550 hover:text-slate-800'}`}
                    >
                      Báo Cáo Theo Tháng 🗓️
                    </button>
                  </div>
                </div>

                {/* 2. Select Week/Month Dropdown */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    2. Chọn mốc thời gian chi tiết:
                  </label>
                  <div className="relative w-full">
                    {filterMode === 'week' ? (
                      <select
                        value={selectedWeekFilter}
                        onChange={(e) => setSelectedWeekFilter(e.target.value)}
                        className="w-full text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-250 dark:border-slate-800 py-3 px-3 pr-8 rounded-xl text-slate-800 dark:text-slate-150 outline-none focus:border-indigo-500 font-sans cursor-pointer transition appearance-none"
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
                        className="w-full text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-905 border border-slate-250 dark:border-slate-800 py-3 px-3 pr-8 rounded-xl text-slate-800 dark:text-slate-150 outline-none focus:border-indigo-505 font-sans cursor-pointer transition appearance-none"
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

                {/* 3. Column Visibility Customizer inside Report drawer page */}
                <div className="space-y-3 pt-3 border-t border-slate-150 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-500" />
                    <span>3. Hiện/ẩn cột dữ liệu chi tiết:</span>
                  </label>
                  
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-2">
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal mb-2">
                      Chọn các cột bạn muốn hiển thị ở bảng nhập hàng. Thay đổi sẽ tự động ghi nhớ:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleColumn('ngay')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.ngay 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.ngay ? '✓' : '✗'}</span>
                        <span>Mốc ngày nhập</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('mau')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.mau 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.mau ? '✓' : '✗'}</span>
                        <span>Tên mẫu mã</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('soLuong')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.soLuong 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.soLuong ? '✓' : '✗'}</span>
                        <span>Sản lượng (SL)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('donGia')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.donGia 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.donGia ? '✓' : '✗'}</span>
                        <span>Đơn giá may</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('thanhTien')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.thanhTien 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.thanhTien ? '✓' : '✗'}</span>
                        <span>Thành tiền</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('dtTp')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.dtTp 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.dtTp ? '✓' : '✗'}</span>
                        <span>Ship ĐT➔TP</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleColumn('tpDt')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold text-center transition cursor-pointer font-sans border flex items-center justify-center gap-1.5 ${
                          visibleColumns.tpDt 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/60 dark:text-indigo-400' 
                            : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-600'
                        }`}
                      >
                        <span>{visibleColumns.tpDt ? '✓' : '✗'}</span>
                        <span>Ship TP➔ĐT</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-205 dark:border-slate-850 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 px-6 rounded-xl shadow-md transition active:scale-98 cursor-pointer"
                >
                  Áp Dụng bộ lọc & Xem
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              const totalQty = weekItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
              const totalAmount = weekItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0);
              const cleanTotalAmount = totalAmount;
              const totalShipĐT_TP = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
              
              // Sum legacy row ship + separate ship logs
              const legacyShipTP_ĐT = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
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

                  {/* Bento Square summaries at the top */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/50 dark:bg-slate-950/25 border-b border-slate-150 dark:border-slate-850">
                    {/* Box 1: Tổng số lượng may */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Số lượng may</span>
                        <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono tracking-tight pt-1">
                          {totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">chiếc</span>
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Box 2: Tổng tiền hàng */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Tổng tiền hàng</span>
                        <p className="text-sm sm:text-base font-extrabold text-indigo-650 dark:text-indigo-455 font-mono tracking-tight pt-1">
                          {totalAmount.toLocaleString()} <span className="text-xs font-normal">đ</span>
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Box 3: Tổng tiền ship */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Tổng tiền ship</span>
                        <p className="text-sm sm:text-base font-extrabold text-slate-705 dark:text-slate-200 font-mono tracking-tight pt-1">
                          {(totalShipĐT_TP + totalShipTP_ĐT).toLocaleString()} <span className="text-xs font-normal">đ</span>
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-400 font-mono pt-1 leading-none">
                          ĐT➔TP: {totalShipĐT_TP.toLocaleString()}đ | TP➔ĐT: {totalShipTP_ĐT.toLocaleString()}đ
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Box 4: Nhân công & Thanh toán */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-xs relative overflow-hidden">
                      <div className="space-y-0.5 pr-8">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider leading-none">Thanh toán công thợ</span>
                        <p className={`text-sm sm:text-base font-extrabold font-mono tracking-tight pt-1 ${remainingLaborDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {remainingLaborDebt.toLocaleString()} <span className="text-xs font-normal">đ</span>
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-400 font-mono pt-1 leading-none">
                          Còn nợ (Tổng thợ: {totalAmount.toLocaleString()}đ)
                        </p>
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                        <button
                          type="button"
                          onClick={() => toggleLaborPanel(weekLabel)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-all duration-300 ${
                            openLaborPanelWeeks[weekLabel]
                              ? 'bg-indigo-650 text-white shadow-md scale-105'
                              : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100'
                          }`}
                          title="Quản lý / Thanh toán nhân công"
                        >
                          <Wallet className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                {/* Week Items Compact List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[500px] overflow-y-auto scroll-smooth border-t border-b border-slate-150 dark:border-slate-800/80">
                  {weekItems.map((item, index) => {
                    const totalShip = (item.vậnChuyểnĐT_TP || 0) + (item.vậnChuyểnTP_ĐT || 0);
                    const itemTotal = ((item.sốLượng || 0) * (item.đơnGiáMay || 0));
                    const overallTotal = itemTotal + totalShip;
                    
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          setSelectedItemForModal(item);
                          setIsDetailEditing(false);
                        }}
                        className="group flex items-center justify-between p-3.5 sm:p-4 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 cursor-pointer transition active:bg-indigo-50/40"
                      >
                        {/* Left: STT + Item Model + Date */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/45 text-indigo-800 dark:text-indigo-200 flex items-center justify-center font-mono font-black text-xs border border-indigo-200 dark:border-indigo-800/50 shrink-0 shadow-xs">
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base tracking-tight leading-snug">
                                {item.mẫu}
                              </span>
                              {item.photo && (
                                <span className="p-0.5 px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md text-[9px] font-extrabold flex items-center gap-1 tracking-wider uppercase border border-emerald-500/20">
                                  <Camera className="w-2.5 h-2.5" />
                                  <span>Ảnh</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-350 font-bold font-sans flex items-center gap-1.5 mt-1">
                              <Calendar className="w-3.5 h-3.5 text-rose-500" />
                              <span>{formatVietnameseDate(item.ngày)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Right: Quantity + Value + Chevron */}
                        <div className="flex items-center gap-4 sm:gap-6">
                          {/* Qty */}
                          <div className="text-right">
                            <span className="text-[9px] block uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider font-sans leading-none mb-1">Số Lượng</span>
                            <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {(item.sốLượng || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">cái</span>
                            </span>
                          </div>

                          {/* Price or Total */}
                          <div className="text-right">
                            <span className="text-[9px] block uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider font-sans leading-none mb-1">Thành Tiền</span>
                            <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-100/40 dark:border-emerald-900/30">
                              {overallTotal.toLocaleString()} đ
                            </span>
                          </div>

                          {/* Quick arrow */}
                          <div className="p-1 sm:p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

                {/* Section Theo dõi và Thanh toán nhân công (Collapsible dropdown) */}
                <AnimatePresence>
                  {openLaborPanelWeeks[weekLabel] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="border-t border-slate-150 dark:border-slate-850 bg-indigo-50/15 dark:bg-indigo-950/20 px-5 py-4 overflow-hidden"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
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

      {/* Lightbox photo viewer */}
      <AnimatePresence>
        {viewingPhotoUrl && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setViewingPhotoUrl(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-2xl w-full p-5 rounded-2xl shadow-2xl z-10 flex flex-col border relative uppercase font-mono ${settings.theme === 'dark' ? 'bg-[#0e1613] border-[#1c2d27]' : 'bg-white border-slate-200'}`}
            >
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className={`absolute top-4 right-4 p-1.5 rounded-full transition cursor-pointer ${settings.theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}
                title="Đóng xem ảnh"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="pb-3 border-b border-slate-105 dark:border-slate-800/60 w-full flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-555" />
                <span className={`text-[11px] font-bold tracking-wider ${settings.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Ảnh chụp mặt hàng / Biên nhận đính kèm</span>
              </div>
              
              <div className="mt-4 w-full aspect-[4/3] max-h-[60vh] bg-black/5 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-800/40">
                <img
                  src={viewingPhotoUrl}
                  alt="Ảnh phóng to chi tiết"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Item Detail Modal */}
      <AnimatePresence>
        {selectedItemForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedItemForModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`max-w-md w-full rounded-2xl shadow-2xl z-10 flex flex-col border overflow-hidden relative ${
                settings.theme === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-slate-100' 
                  : 'bg-white border-slate-150 text-slate-800'
              }`}
            >
              {/* Header Title */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-bold font-mono text-[10px] rounded uppercase tracking-wider">
                    {isDetailEditing ? 'Sửa chi tiết' : 'Chi tiết dòng'}
                  </div>
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-slate-800 dark:text-slate-100">
                    PHIẾU NHẬP HÀNG CHI TIẾT
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemForModal(null)}
                  className={`p-1.5 rounded-full transition cursor-pointer ${
                    settings.theme === 'dark' 
                      ? 'hover:bg-slate-800 text-slate-400 hover:text-white' 
                      : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">
                {!isDetailEditing ? (
                  /* VIEW MODE */
                  <div className="space-y-4 font-sans">
                    {/* Model Banner */}
                    <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/30 dark:border-indigo-955/45 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">Tên mặt hàng/Mẫu mã</span>
                        <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">{selectedItemForModal.mẫu}</span>
                      </div>
                      
                      {selectedItemForModal.photo && (
                        <button
                          type="button"
                          onClick={() => setViewingPhotoUrl(selectedItemForModal.photo!)}
                          className="p-1.5 px-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 hover:dark:bg-emerald-900/30 border border-emerald-100/50 dark:border-emerald-800/20 text-[10px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition select-none"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Xem ảnh sản phẩm</span>
                        </button>
                      )}
                    </div>

                    {/* Columns structure */}
                    <div className="space-y-3">
                      {/* Row 1: Date */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Ngày nhập hàng</span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">{formatVietnameseDate(selectedItemForModal.ngày || '')}</span>
                      </div>

                      {/* Row 2: Week Category */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Ghi nhận vào tuần</span>
                        <span className="text-xs sm:text-sm font-extrabold text-indigo-700 dark:text-indigo-400 font-mono bg-indigo-500/10 px-2.5 py-1 rounded-md leading-none">{selectedItemForModal.weekKey || 'N/A'}</span>
                      </div>

                      {/* Row 3: Quantity */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Số lượng may</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-md">{(selectedItemForModal.sốLượng || 0).toLocaleString()} cái</span>
                      </div>

                      {/* Row 4: Sew unit price */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Đơn giá may</span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white font-mono">{(selectedItemForModal.đơnGiáMay || 0).toLocaleString()} đ</span>
                      </div>

                      {/* Row 5: Total Sew Cost */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Thành tiền công may</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{((selectedItemForModal.sốLượng || 0) * (selectedItemForModal.đơnGiáMay || 0)).toLocaleString()} đ</span>
                      </div>

                      {/* Row 6: ĐT -> TP Shipping */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Ship Đồng Tháp ➔ Sài Gòn</span>
                        <span className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-455 font-mono">{(selectedItemForModal.vậnChuyểnĐT_TP || 0) > 0 ? `${(selectedItemForModal.vậnChuyểnĐT_TP || 0).toLocaleString()} đ` : '0 đ'}</span>
                      </div>

                      {/* Row 7: TP -> ĐT Shipping */}
                      <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Ship Sài Gòn ➔ Đồng Tháp</span>
                        <span className="text-xs sm:text-sm font-extrabold text-rose-600 dark:text-rose-455 font-mono">{(selectedItemForModal.vậnChuyểnTP_ĐT || 0) > 0 ? `${(selectedItemForModal.vậnChuyểnTP_ĐT || 0).toLocaleString()} đ` : '0 đ'}</span>
                      </div>

                      {/* Row 8: Cumulative Total Cost */}
                      <div className="flex justify-between items-center pt-4 mt-2 py-1.5">
                        <span className="text-xs sm:text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">TỔNG TOÀN BỘ CHI PHÍ</span>
                        <span className="text-sm sm:text-base font-black text-indigo-650 dark:text-indigo-300 font-mono bg-indigo-50 dark:bg-indigo-950/50 px-3.5 py-1.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/35 shadow-xs">
                          {(((selectedItemForModal.sốLượng || 0) * (selectedItemForModal.đơnGiáMay || 0)) + (selectedItemForModal.vậnChuyểnĐT_TP || 0) + (selectedItemForModal.vậnChuyểnTP_ĐT || 0)).toLocaleString()} đ
                        </span>
                      </div>
                    </div>

                    {/* Notice bar */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal">
                        Bản ghi này tự động đồng bộ hóa vào tổng công nợ, chi phí vận chuyển, và thống kê báo cáo của tab Nhập Hàng. Mọi hành động chỉnh sửa sẽ tự động phân loại lại tuần/tháng dựa trên ngày đã chọn.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Bạn có chắc chắn muốn xoá dòng nhập hàng này?")) {
                            setItems(prev => prev.filter(item => item.id !== selectedItemForModal.id));
                            setSelectedItemForModal(null);
                          }
                        }}
                        className="py-2.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-[#201012] hover:dark:bg-[#2e1518] dark:border-[#381a1d] text-red-650 dark:text-red-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border border-transparent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa bỏ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startModalEdit(selectedItemForModal)}
                        className="py-2.5 px-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Chỉnh sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedItemForModal(null)}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-705 text-slate-650 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div className="space-y-4 font-sans text-left">
                    {/* Tên Mẫu */}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Tên mặt hàng/Mẫu mã</label>
                      <input
                        type="text"
                        value={modalEditMẫu}
                        onChange={e => setModalEditMẫu(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505"
                        placeholder="VD: Đầm xòe, Áo thun..."
                        required
                      />
                    </div>

                    {/* Hàng 2 cột: Ngày và Số lượng */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Ngày nhập</label>
                        <input
                          type="date"
                          value={modalEditNgày}
                          onChange={e => setModalEditNgày(e.target.value)}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Số lượng may</label>
                        <input
                          type="number"
                          value={modalEditSốLượng}
                          onChange={e => setModalEditSốLượng(Number(e.target.value))}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505 font-mono"
                          placeholder="0"
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    {/* Hàng 2 cột: Đơn giá may và Vận chuyển ĐT->TP */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Đơn giá may (đ)</label>
                        <input
                          type="number"
                          value={modalEditĐơnGiá}
                          onChange={e => setModalEditĐơnGiá(Number(e.target.value))}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505 font-mono"
                          placeholder="0"
                          min="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Ship ĐT➔TP (đ)</label>
                        <input
                          type="number"
                          value={modalEditĐT_TP}
                          onChange={e => setModalEditĐT_TP(Number(e.target.value))}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505 font-mono"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Vận chuyển TP->ĐT */}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1 font-mono">Ship Sài Gòn ➔ Đồng Tháp (đ)</label>
                      <input
                        type="number"
                        value={modalEditTP_ĐT}
                        onChange={e => setModalEditTP_ĐT(Number(e.target.value))}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2.5 px-3 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-505 font-mono"
                        placeholder="0"
                        min="0"
                      />
                    </div>

                    {/* Dynamic previews */}
                    <div className="p-3.5 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/20 dark:border-indigo-950/30 rounded-xl space-y-1.5 font-mono">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-450 dark:text-slate-400 font-sans">Thành tiền may:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-355">{(modalEditSốLượng * modalEditĐơnGiá).toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-450 dark:text-slate-400 font-sans">Phí ship vận chuyển:</span>
                        <span className="font-bold text-slate-705 dark:text-slate-355">{(modalEditĐT_TP + modalEditTP_ĐT).toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold border-t border-slate-150 dark:border-slate-850 pt-1.5 mt-0.5">
                        <span className="text-indigo-600 dark:text-indigo-400 font-sans uppercase">Dự toán tổng chi phí:</span>
                        <span className="text-indigo-650 dark:text-indigo-400">{(modalEditSốLượng * modalEditĐơnGiá + modalEditĐT_TP + modalEditTP_ĐT).toLocaleString()}đ</span>
                      </div>
                    </div>

                    {/* Save or Cancel */}
                    <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsDetailEditing(false)}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-805 dark:hover:bg-slate-705 text-slate-650 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer select-none transition"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        onClick={() => saveModalEdit(selectedItemForModal.id)}
                        className="py-2.5 px-5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition select-none cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Lưu thay đổi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
