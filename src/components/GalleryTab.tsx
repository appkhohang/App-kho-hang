/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, Search, Filter, Calendar, Tag, ChevronRight, X, 
  ShoppingBag, User, Receipt, Download, RefreshCw, ZoomIn, ArrowRight, BookOpen, Clock, Layers, Trash2, Maximize2, Minimize2, CheckCircle2, CheckSquare, Check, RotateCw, Zap, Sparkles, Share2
} from 'lucide-react';
import { ImportItem, Bill, Customer } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import { LazyImage } from './LazyImage';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { compressBase64Image, shareImageFile } from '../utils/imageUtils';

interface GalleryTabProps {
  items: ImportItem[];
  setItems: React.Dispatch<React.SetStateAction<ImportItem[]>>;
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  customers: Customer[];
  setActiveTab: (tab: 'home' | 'import' | 'invoices' | 'production' | 'report' | 'settings' | 'notifications' | 'gallery') => void;
  resolvedTheme?: 'light' | 'dark';
}

interface GalleryMediaItem {
  id: string;
  type: 'import' | 'bill';
  photo: string;
  title: string;
  subtitle: string;
  date: string;
  timestamp: number;
  label: string;
  secondaryLabel?: string;
  
  // Back references
  importData?: ImportItem;
  billData?: Bill;
}

export default function GalleryTab({
  items,
  setItems,
  bills,
  setBills,
  customers,
  setActiveTab,
  resolvedTheme = 'light'
}: GalleryTabProps) {
  const isDark = resolvedTheme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'import' | 'bill'>('all');
  const [selectedMedia, setSelectedMedia] = useState<GalleryMediaItem | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isImmersiveFS, setIsImmersiveFS] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setRotation(0);
  }, [selectedMedia, isImmersiveFS]);

  // States for mass multi-selection of photos
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useAndroidBack(selectedMedia !== null, () => setSelectedMedia(null));
  useAndroidBack(isZoomed, () => setIsZoomed(false));
  useAndroidBack(isImmersiveFS, () => setIsImmersiveFS(false));
  useAndroidBack(isSelectMode, () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  });

  const [compressingId, setCompressingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const handleCompressPhoto = async (media: GalleryMediaItem) => {
    try {
      setCompressingId(media.id);
      
      const compressedBase64 = await compressBase64Image(media.photo, 900, 900, 0.70);
      
      // Update local states
      if (media.type === 'import' && media.importData) {
        setItems(prev => prev.map(item => {
          if (item.id === media.importData?.id) {
            return { ...item, photo: compressedBase64 };
          }
          return item;
        }));
      } else if (media.type === 'bill' && media.billData) {
        setBills(prev => prev.map(bill => {
          if (bill.id === media.billData?.id) {
            return { ...bill, photo: compressedBase64 };
          }
          return bill;
        }));
      }

      // Update the active selectedMedia copy as well so user sees the change immediately in the lightbox!
      setSelectedMedia(prev => prev ? { ...prev, photo: compressedBase64 } : null);
      
      alert("⚡ Đã nén ảnh thành công! Dung lượng ảnh giảm đáng kể giúp tối ưu bộ nhớ Android.");
    } catch (error) {
      console.error(error);
      alert("⚠️ Không thể nén ảnh.");
    } finally {
      setCompressingId(null);
    }
  };

  const handleSharePhoto = async (media: GalleryMediaItem) => {
    try {
      setSharingId(media.id);
      
      let blob: Blob | null = null;
      if (media.photo.startsWith('data:')) {
        const res = await fetch(media.photo);
        blob = await res.blob();
      } else {
        throw new Error("Không hỗ trợ định dạng ảnh này");
      }
      
      if (!blob) throw new Error("Chuyển đổi Blob thất bại");
      
      const fileName = `${media.type}_${media.id}.jpg`;
      const shared = await shareImageFile(
        blob,
        fileName,
        media.title,
        `Chia sẻ ảnh từ kho lưu trữ: ${media.title} (${media.label})`
      );
      
      if (!shared) {
        alert("⚠️ Trình duyệt/Android của bạn không hỗ trợ tính năng chia sẻ trực tiếp. Bạn hãy bấm Tải ảnh về máy và tự gửi qua Zalo.");
      }
    } catch (error) {
      console.error(error);
      alert("⚠️ Lỗi chia sẻ hình ảnh.");
    } finally {
      setSharingId(null);
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredGallery.map(m => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleCardClick = (media: GalleryMediaItem) => {
    if (isSelectMode) {
      setSelectedIds(prev => 
        prev.includes(media.id)
          ? prev.filter(id => id !== media.id)
          : [...prev, media.id]
      );
    } else {
      setSelectedMedia(media);
      setIsZoomed(false);
    }
  };

  const handleDeleteBatch = () => {
    if (selectedIds.length === 0) return;
    
    const confirmDelete = window.confirm(
      `❓ Bạn có chắc chắn muốn xoá vĩnh viễn ${selectedIds.length} hình ảnh đã chọn khỏi hệ thống không?\nHành động này không thể hoàn tác.`
    );
    
    if (confirmDelete) {
      const itemsToDelete = galleryItems.filter(m => selectedIds.includes(m.id));
      
      const importIdsToClear = itemsToDelete
        .filter(m => m.type === 'import' && m.importData)
        .map(m => m.importData!.id);
        
      const billIdsToClear = itemsToDelete
        .filter(m => m.type === 'bill' && m.billData)
        .map(m => m.billData!.id);

      if (importIdsToClear.length > 0) {
        setItems(prev => prev.map(item => {
          if (importIdsToClear.includes(item.id)) {
            const clone = { ...item };
            delete clone.photo;
            return clone;
          }
          return item;
        }));
      }

      if (billIdsToClear.length > 0) {
        setBills(prev => prev.map(bill => {
          if (billIdsToClear.includes(bill.id)) {
            const clone = { ...bill };
            delete clone.photo;
            return clone;
          }
          return bill;
        }));
      }

      // Refresh selection state
      setSelectedIds([]);
      setIsSelectMode(false);
      if (selectedMedia && selectedIds.includes(selectedMedia.id)) {
        setSelectedMedia(null);
      }
    }
  };

  // Map customers by id for rapid lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Aggregate all items & bills that have photos captured
  const galleryItems = useMemo(() => {
    const list: GalleryMediaItem[] = [];

    // 1. Process Import items with photos
    items.forEach(item => {
      if (item.photo) {
        list.push({
          id: `import-${item.id}`,
          type: 'import',
          photo: item.photo,
          title: `Nhập mẫu: ${item.mẫu}`,
          subtitle: `Lô hàng ngày ${formatVietnameseDate(item.ngày)} • ${item.weekKey}`,
          date: item.ngày,
          timestamp: item.createdAt || Date.now(),
          label: `Số lượng: ${item.sốLượng.toLocaleString()} cái`,
          secondaryLabel: `Đơn giá: ${item.đơnGiáMay.toLocaleString()}đ`,
          importData: item
        });
      }
    });

    // 2. Process Bills with photos
    bills.forEach(bill => {
      if (bill.photo) {
        const custName = customerMap.get(bill.customerId)?.name || "Khách sỉ không rõ";
        list.push({
          id: `bill-${bill.id}`,
          type: 'bill',
          photo: bill.photo,
          title: `HĐ #${bill.billNumber} • ${custName}`,
          subtitle: `Hóa đơn ngày ${formatVietnameseDate(bill.date)}`,
          date: bill.date,
          timestamp: bill.createdAt || Date.now(),
          label: `Tổng tiền: ${bill.grandTotal.toLocaleString()}đ`,
          secondaryLabel: `Đã trả: ${bill.paymentAmount.toLocaleString()}đ`,
          billData: bill
        });
      }
    });

    // Sort by most recent photo taken (timestamp descending)
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [items, bills, customerMap]);

  // Filtered list based on Search and Tabs
  const filteredGallery = useMemo(() => {
    return galleryItems.filter(media => {
      // 1. Filter type
      if (typeFilter !== 'all' && media.type !== typeFilter) {
        return false;
      }

      // 2. Filter search term
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      
      const matchTitle = media.title.toLowerCase().includes(term);
      const matchSubtitle = media.subtitle.toLowerCase().includes(term);
      const matchDate = media.date.includes(term);
      
      // Deep matching inside bill items if applicable
      let matchBillItems = false;
      if (media.billData) {
        matchBillItems = media.billData.items.some(it => 
          it.mẫuMã.toLowerCase().includes(term)
        );
      }

      return matchTitle || matchSubtitle || matchDate || matchBillItems;
    });
  }, [galleryItems, typeFilter, searchTerm]);

  // Download photo function
  const handleDownloadPhoto = (media: GalleryMediaItem) => {
    try {
      const link = document.createElement('a');
      link.href = media.photo;
      link.download = `${media.type}_${media.id}_image.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("⚠️ Không thể tải ảnh trực tiếp trên trình duyệt này.");
    }
  };

  // Delete photo function connected back to local states
  const handleDeletePhoto = (e: React.MouseEvent, media: GalleryMediaItem) => {
    e.stopPropagation(); // Stop propagation so we do not open detail modal
    
    const confirmDelete = window.confirm(
      media.type === 'import'
        ? `❓ Bạn có chắc chắn muốn xoá ảnh chụp của lô hàng nhập mẫu "${media.importData?.mẫu}" không?`
        : `❓ Bạn có chắc chắn muốn xoá ảnh chụp của hóa đơn #${media.billData?.billNumber} không?`
    );
    
    if (confirmDelete) {
      if (media.type === 'import' && media.importData) {
        setItems(prev => prev.map(item => {
          if (item.id === media.importData?.id) {
            const clone = { ...item };
            delete clone.photo;
            return clone;
          }
          return item;
        }));
      } else if (media.type === 'bill' && media.billData) {
        setBills(prev => prev.map(bill => {
          if (bill.id === media.billData?.id) {
            const clone = { ...bill };
            delete clone.photo;
            return clone;
          }
          return bill;
        }));
      }
      
      // If currently viewed in detail modal, close it
      if (selectedMedia?.id === media.id) {
        setSelectedMedia(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 🚀 Header banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5 text-left z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-850 dark:text-white uppercase tracking-tight leading-none font-sans">
              Thư viện Hình Ảnh Tổng Hợp
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl font-sans">
            Tổng hợp toàn bộ chứng từ, hóa đơn bán sỉ và ảnh chụp ghi nhận sản lượng thực tế khi chụp hình từ máy tính hoặc điện thoại.
          </p>
        </div>

        <div className="flex items-center gap-2 z-10 shrink-0">
          <div className="px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-150 dark:border-slate-850 text-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-mono">TỔNG FILE ẢNH Chụp</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {galleryItems.length} ảnh
            </span>
          </div>
        </div>

        {/* Decorative ambient background curves */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 🔮 Filter & Search bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs font-sans">
        
        {/* Toggle tabs for file types */}
        <div className="lg:col-span-5 flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-150 dark:border-slate-850/60 font-semibold text-xs text-slate-600 dark:text-slate-400">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${typeFilter === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'hover:text-slate-800'}`}
          >
            📂 Tất cả ({galleryItems.length})
          </button>
          <button
            onClick={() => setTypeFilter('import')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${typeFilter === 'import' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'hover:text-slate-800'}`}
          >
            📦 Nhập hàng ({galleryItems.filter(m => m.type === 'import').length})
          </button>
          <button
            onClick={() => setTypeFilter('bill')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${typeFilter === 'bill' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs' : 'hover:text-slate-800'}`}
          >
            🧾 Hóa đơn ({galleryItems.filter(m => m.type === 'bill').length})
          </button>
        </div>

        {/* Live Search bar input */}
        <div className="lg:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm mã mẫu, số HĐ, tên khách sỉ, ngày..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-950 text-xs border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-sans text-slate-750 dark:text-white"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mass Multi-Select Action Switch Trigger */}
        <div className="lg:col-span-3">
          <button
            type="button"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds([]);
            }}
            className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs border ${
              isSelectMode 
                ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-450 hover:bg-[#ffe4e6] dark:hover:bg-rose-950/50' 
                : 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-955'
            }`}
          >
            {isSelectMode ? (
              <>
                <X className="w-4 h-4" />
                <span>Hủy Chọn Nhiều</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                <span>Chọn Hàng Loạt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 🌟 Selection actions banner when select mode is active */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50/70 dark:bg-indigo-950/20 p-4 border border-indigo-200/50 dark:border-indigo-900/35 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans shadow-xs ring-1 ring-indigo-500/10"
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-indigo-850 dark:text-indigo-300 text-left">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse shrink-0" />
              <span>Đã chọn <strong className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base font-mono">{selectedIds.length}</strong> / {filteredGallery.length} hình ảnh hiển thị</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold leading-none">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 active:scale-95"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                disabled={selectedIds.length === 0}
                className={`px-3.5 py-2.5 rounded-xl text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  selectedIds.length === 0 
                    ? 'bg-red-400/40 dark:bg-red-955/25 text-slate-400 dark:text-slate-550 border border-transparent cursor-not-allowed' 
                    : 'bg-red-650 hover:bg-red-700 border border-transparent hover:scale-[1.01] active:scale-95'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa hàng loạt ({selectedIds.length})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🖼️ Grid Gallery list */}
      {filteredGallery.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-950 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-slate-200 dark:border-slate-850">
            <ImageIcon className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-sans">
              Không tìm thấy hình ảnh nào
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              {galleryItems.length === 0 
                ? "Thư viện hiện đang trống rỗng. Hãy bật camera chụp hình khi lập phiếu để hình ảnh được lưu trữ tự động tại đây." 
                : "Không tìm thấy ảnh chụp nào khớp với điều kiện lọc tìm kiếm của bạn. Hãy thử nhập từ khóa ngắn gọn hơn."}
            </p>
          </div>

          {galleryItems.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => setActiveTab('import')}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Mở Nhập Hàng chụp thử</span>
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Viết hoá đơn & chụp</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {filteredGallery.map((media) => {
            const isImport = media.type === 'import';
            const isSelected = selectedIds.includes(media.id);
            return (
              <motion.div
                key={media.id}
                layoutId={`card-${media.id}`}
                onClick={() => handleCardClick(media)}
                className={`gallery_image_card group bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden shadow-2xs hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col text-left relative ${
                  isSelectMode 
                    ? isSelected 
                      ? 'ring-2 ring-indigo-500 border-indigo-400 dark:border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/5 scale-[0.99]' 
                      : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-350'
                    : 'border-slate-200 dark:border-slate-800/80 hover:border-indigo-405 dark:hover:border-indigo-505'
                }`}
              >
                {/* Image display thumbnail */}
                <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative border-b border-slate-100 dark:border-slate-800">
                  <LazyImage
                    src={media.photo}
                    alt={media.title}
                    className={`w-full h-full object-cover transition-transform duration-500 pointer-events-none ${
                      isSelectMode && isSelected ? 'scale-100 opacity-90' : 'group-hover:scale-[1.04]'
                    }`}
                  />
                  
                  {/* Category Type Badge */}
                  <span className={`absolute top-2.5 left-2.5 text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-md select-none ${
                    isImport 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-805 dark:text-indigo-400' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-750 dark:bg-emerald-950 dark:border-emerald-805 dark:text-emerald-400'
                  }`}>
                    {isImport ? (
                      <>
                        <ShoppingBag className="w-2.5 h-2.5" />
                        <span>Nhập Hàng</span>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-2.5 h-2.5" />
                        <span>Viết Hoá Đơn</span>
                      </>
                    )}
                  </span>
 
                  {/* Selection Checkbox indicator overlay vs Trash icon */}
                  {isSelectMode ? (
                    isSelected ? (
                      <div className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-indigo-600 text-white shadow-md z-20 flex items-center justify-center border border-white/20 hover:scale-105 active:scale-95 transition-all">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="absolute top-2.5 right-2.5 p-[7px] rounded-full bg-slate-950/80 text-white border border-white/30 shadow-md z-20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                        <div className="w-2.5 h-2.5 rounded-full border border-current" />
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePhoto(e, media)}
                      className="absolute top-2.5 right-2.5 p-1.5 sm:p-2 rounded-xl bg-red-650/90 text-white hover:bg-red-650 hover:scale-110 active:scale-95 transition-all duration-200 z-20 shadow-md flex items-center justify-center cursor-pointer border border-red-500/30"
                      title="Xoá hình ảnh này khỏi hệ thống"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Quick hover reveal overlays */}
                  {!isSelectMode && (
                    <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                      <div className="px-3 py-1.5 bg-white/95 backdrop-blur-xs text-slate-800 hover:bg-white text-[10.5px] font-black uppercase tracking-wider rounded-xl shadow-md transform translate-y-2 group-hover:translate-y-0 transition duration-300 flex items-center gap-1.5">
                        <span>Xem chi tiết + Bill</span>
                        <ZoomIn className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info and tags below photo and thumbnail */}
                <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-500 transition leading-tight">
                      {media.title}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-sans line-clamp-1 leading-none">
                      {media.subtitle}
                    </p>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-105 dark:border-slate-800/60 pt-2.5 text-[11px] font-mono select-none">
                    <div className="text-indigo-600 dark:text-indigo-400 font-extrabold max-w-[60%] truncate">
                      {media.label}
                    </div>
                    <div className="text-slate-450 text-[10px]">
                      {media.secondaryLabel}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 🔮 MULTI-COMPARE DETAIL SPLIT LIGHTBOX VIEWER PANEL */}
      <AnimatePresence>
        {selectedMedia && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" id="gallery_lightbox_overlay">
            
            {/* Dark background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMedia(null)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            />

            {/* Main Double Compartment Panel */}
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="gallery_image_modal relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] md:h-[78vh] flex flex-col md:flex-row overflow-hidden shadow-2xl z-10 text-slate-800 dark:text-slate-100 text-left font-sans"
            >
              
              {/* COMPARTMENT 1: Dynamic zoom photo display area */}
              <div className="flex-1 bg-slate-950 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 group overflow-hidden h-[45%] md:h-full">
                
                {/* Backdrop design accent */}
                <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-slate-950/70 to-transparent z-10 flex justify-between items-center text-white font-sans pointer-events-none select-none">
                  <div className="flex items-center gap-1.5 md:gap-2.5">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-650 tracking-wider">
                      {selectedMedia.type === 'import' ? 'AN IMPORT FILE' : 'AN INVOICE BILL'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-350 bg-slate-900/60 px-2 py-0.5 rounded">
                      {formatVietnameseDate(selectedMedia.date)}
                    </span>
                  </div>
                </div>

                <div className={`w-full h-full flex items-center justify-center p-2 relative ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} onClick={() => setIsZoomed(!isZoomed)}>
                  <LazyImage
                    src={selectedMedia.photo}
                    alt={selectedMedia.title}
                    style={{ transform: `scale(${isZoomed ? 1.5 : 1}) rotate(${rotation}deg)` }}
                    className={`max-w-full max-h-full object-contain transition-transform duration-300 relative z-20 ${
                      isZoomed ? 'shadow-2xl rounded-lg' : 'group-hover:scale-[1.01]'
                    }`}
                  />
                </div>

                {/* Actions overlaid inside image frame */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10 font-sans">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRotation(prev => (prev + 90) % 360);
                    }}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white transition hover:scale-105 cursor-pointer flex items-center justify-center shadow-md border border-slate-800 text-xs gap-1 font-bold"
                    title="Xoay ảnh 90 độ"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Xoay 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPhoto(selectedMedia)}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white transition hover:scale-105 cursor-pointer flex items-center justify-center shadow-md border border-slate-800"
                    title="Tải ảnh này về máy"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white transition hover:scale-105 cursor-pointer flex items-center justify-center shadow-md border border-slate-800 text-xs gap-1 font-bold"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>{isZoomed ? 'Thu nhỏ' : 'Phóng to'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImmersiveFS(true)}
                    className="p-2 rounded-xl bg-indigo-650 hover:bg-indigo-750 text-white transition hover:scale-105 cursor-pointer flex items-center justify-center shadow-md text-xs gap-1 font-bold"
                    title="Xem ảnh toàn màn hình tối tối sẫm"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Toàn màn hình</span>
                  </button>
                </div>
              </div>

              {/* COMPARTMENT 2: Right side detail sheet (Compare side-by-side) */}
              <div className="w-full md:w-[420px] lg:w-[460px] bg-white dark:bg-slate-905 flex flex-col justify-between overflow-y-auto h-[55%] md:h-full">
                
                {/* Detail Header Block (with cancel icon button) */}
                <div className="p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-indigo-505 dark:text-indigo-400 block tracking-wider font-mono">
                      {selectedMedia.type === 'import' ? '📦 THÔNG TIN PHIẾU NHẬP HÀNG' : '🧾 CHI TIẾT HÓA ĐƠN BÁN SỈ'}
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-850 dark:text-white leading-tight">
                      {selectedMedia.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedMedia(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0 ml-4"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Detail Core Content Body */}
                <div className="p-4 sm:p-5 flex-grow space-y-5 overflow-y-auto">
                  
                  {/* Dynamic conditional render: Standard Goods Import Details */}
                  {selectedMedia.type === 'import' && selectedMedia.importData && (() => {
                    const h = selectedMedia.importData;
                    const revenue = h.sốLượng * h.đơnGiáMay;
                    return (
                      <div className="space-y-4 text-xs font-sans">
                        
                        {/* Highlights parameters sheet row */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 text-left">
                            <span className="text-[10px] text-slate-400 block uppercase font-mono font-bold leading-none mb-1">MÃ MẪU</span>
                            <span className="text-base font-black text-indigo-650 dark:text-indigo-455">
                              {h.mẫu}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 text-left">
                            <span className="text-[10px] text-slate-400 block uppercase font-mono font-bold leading-none mb-1">KỲ HÀNG (TUẦN)</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {h.weekKey}
                            </span>
                          </div>
                        </div>

                        {/* Detailed pricing and calculations ledger table */}
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-left border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>BÁO CÁO TÀI CHÍNH LÔ HÀNG</span>
                          </div>

                          <div className="space-y-2 text-slate-650 dark:text-slate-300">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-450">📅 Ngày nhập mộc:</span>
                              <span className="font-bold text-slate-800 dark:text-white font-mono">{formatVietnameseDate(h.ngày)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-450 font-sans">👕 Tổng sản lượng:</span>
                              <span className="font-extrabold text-slate-850 dark:text-white font-mono">{h.sốLượng.toLocaleString()} cái</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-450 font-sans">🪡 Đơn giá may gia công:</span>
                              <span className="font-extrabold text-slate-850 dark:text-white font-mono">{h.đơnGiáMay.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-105 dark:border-slate-800">
                              <span className="text-slate-800 dark:text-slate-200 font-bold">💰 Tổng tiền công may xưởng:</span>
                              <span className="text-sm font-black text-indigo-505 dark:text-indigo-400 font-mono">
                                {revenue.toLocaleString()}đ
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Transport delivery log summary card */}
                        <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-2.5 text-left text-[11px] leading-relaxed text-slate-500">
                          <div className="text-[10px] font-black uppercase text-indigo-505 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>TIỀN SHIP VẬN CHUYỂN HAI CHIỀU</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[9.5px] uppercase font-mono font-bold leading-tight">ĐỒNG THÁP → TP HCM</span>
                              <span className="font-extrabold text-slate-750 dark:text-white font-mono">+{h.vậnChuyểnĐT_TP.toLocaleString()} đ</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9.5px] uppercase font-mono font-bold leading-tight">TP HCM → ĐỒNG THÁP</span>
                              <span className="font-extrabold text-slate-750 dark:text-white font-mono">+{h.vậnChuyểnTP_ĐT.toLocaleString()} đ</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dynamic conditional render: Standard Invoiced Bills Details sheet */}
                  {selectedMedia.type === 'bill' && selectedMedia.billData && (() => {
                    const b = selectedMedia.billData;
                    const cust = customerMap.get(b.customerId);
                    return (
                      <div className="space-y-4 text-xs font-sans">
                        
                        {/* Customer Information Block */}
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-105 dark:border-indigo-900/30 rounded-xl flex items-center gap-2.5 text-left">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-650 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">KHÁCH SỈ TRONG PHIẾU</span>
                            <div className="font-black text-slate-800 dark:text-white text-xs">
                              {cust?.name || "Khách hàng sỉ"}
                            </div>
                            {cust?.phone && (
                              <div className="text-[10px] text-slate-450 font-mono mt-0.5">📞 {cust.phone}</div>
                            )}
                          </div>
                        </div>

                        {/* List items block list inside the bill */}
                        <div className="space-y-2 text-left">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-sans">DANH SÁCH MÃ MẪU TRONG PHIẾU ({b.items?.length || 0})</span>
                          
                          <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto">
                            <table className="w-full text-left text-[11px] leading-tight select-none">
                              <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-450 uppercase font-mono font-bold border-b border-slate-150 dark:border-slate-800">
                                <tr>
                                  <th className="p-2 pl-3">Mẫu Mã</th>
                                  <th className="p-2">Số lượng</th>
                                  <th className="p-2 text-right pr-3">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-105 dark:divide-slate-800">
                                {(!b.items || b.items.length === 0) ? (
                                  <tr>
                                    <td colSpan={3} className="p-2 text-center text-slate-400 italic">Hóa đơn không ghi nhận cụ thể mẫu nào.</td>
                                  </tr>
                                ) : (
                                  b.items.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30">
                                      <td className="p-2 pl-3 font-semibold text-slate-800 dark:text-slate-100">{item.mẫuMã}</td>
                                      <td className="p-2 text-slate-550 font-mono">{item.sốLượng} x {item.đơnGiá.toLocaleString()}đ</td>
                                      <td className="p-2 text-right pr-3 font-bold font-mono text-slate-700 dark:text-slate-350">{item.thànhTiền.toLocaleString()}đ</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Financial Ledger card summary */}
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-left">
                          <div className="text-[10px] font-black uppercase text-slate-450 tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>BẢNG ĐỐI CHIẾU CÔNG NỢ LŨY KẾ</span>
                          </div>

                          <div className="space-y-1 text-slate-650 dark:text-slate-300">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">1. Toa bán hôm nay:</span>
                              <span className="font-semibold text-slate-750 dark:text-white font-mono">+{b.subtotal.toLocaleString()} đ</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">2. Nợ cũ gối đầu trước đó:</span>
                              <span className="font-semibold text-slate-755 dark:text-white font-mono">+{b.previousDebt.toLocaleString()} đ</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pb-1 border-b border-dashed border-slate-105 dark:border-slate-800">
                              <span className="text-slate-400">3. Đã đưa trả hôm nay:</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">-{b.paymentAmount.toLocaleString()} đ</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 text-xs">
                              <span className="text-slate-800 dark:text-slate-200 font-bold">⚠️ SỔ NỢ LŨY KẾ CUỐI:</span>
                              <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                                {b.grandTotal.toLocaleString()} đ
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Quick text optimization utilities panel */}
                <div className="mx-4 sm:mx-5 mb-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 font-sans space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-black tracking-wider uppercase font-mono">Tối ưu & Chia sẻ (Zalo/Android)</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={sharingId === selectedMedia.id}
                      onClick={() => handleSharePhoto(selectedMedia)}
                      className="p-2.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 dark:bg-indigo-950/40 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl font-bold text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
                    >
                      <Share2 className="w-3.5 h-3.5 hover:scale-110 transition" />
                      <span>{sharingId === selectedMedia.id ? 'Đang gửi...' : 'Gửi qua Zalo'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={compressingId === selectedMedia.id}
                      onClick={() => handleCompressPhoto(selectedMedia)}
                      className="p-2.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl font-bold text-xs tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
                      title="Nén giảm dung lượng ảnh gốc để tránh đứng máy khi gửi Zalo"
                    >
                      <Zap className="w-3.5 h-3.5 hover:scale-110 transition text-amber-500" />
                      <span>{compressingId === selectedMedia.id ? 'Đang nén...' : 'Nén tối ưu'}</span>
                    </button>
                  </div>
                </div>

                {/* Bottom navigation link button */}
                <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMedia(null);
                      setActiveTab(selectedMedia.type === 'import' ? 'import' : 'invoices');
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-white font-black text-xs tracking-wider transition duration-200 uppercase flex items-center justify-center gap-2 cursor-pointer shadow-md select-none ${
                      selectedMedia.type === 'import' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-505/15' 
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-505/15'
                    }`}
                  >
                    <span>Mở phiếu gốc ở Quản lý</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🌌 IMMERSIVE TRUE FULLSCREEN CINEMATIC LIGHTBOX */}
      <AnimatePresence>
        {isImmersiveFS && selectedMedia && (
          <div className="gallery_image_modal fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
            
            {/* Background design glow */}
            <div className="absolute inset-x-0 top-0 p-5 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-center text-white z-20 font-sans">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                    selectedMedia.type === 'import' 
                      ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-400' 
                      : 'bg-emerald-950/80 border-emerald-700/50 text-emerald-400'
                  }`}>
                    {selectedMedia.type === 'import' ? 'NHẬP HÀNG' : 'HÓA ĐƠN BÁN SỈ'}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{formatVietnameseDate(selectedMedia.date)}</span>
                </div>
                <h4 className="text-base font-black mt-1 text-slate-100">{selectedMedia.title}</h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-3 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white rounded-full transition cursor-pointer select-none flex items-center justify-center gap-1 font-bold text-xs"
                  title="Xoay ảnh 90 độ"
                >
                  <RotateCw className="w-5 h-5" />
                  <span className="hidden sm:inline">Xoay 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSharePhoto(selectedMedia)}
                  disabled={sharingId === selectedMedia.id}
                  className="p-3 bg-white/10 hover:bg-indigo-650 hover:scale-105 active:scale-95 text-white rounded-full transition cursor-pointer select-none disabled:opacity-50"
                  title="Chia sẻ ảnh qua Zalo"
                >
                  <Share2 className="w-5 h-5 text-indigo-300" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCompressPhoto(selectedMedia)}
                  disabled={compressingId === selectedMedia.id}
                  className="p-3 bg-white/10 hover:bg-emerald-650 hover:scale-105 active:scale-95 text-white rounded-full transition cursor-pointer select-none disabled:opacity-50"
                  title="Nén nén nén giảm tối đa dung lượng"
                >
                  <Zap className="w-5 h-5 text-emerald-300" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(selectedMedia)}
                  className="p-3 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white rounded-full transition cursor-pointer select-none"
                  title="Tải ảnh về máy"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsImmersiveFS(false)}
                  className="p-3 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white rounded-full transition cursor-pointer"
                  title="Thoát chế độ toàn màn hình"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Immersive viewport area */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
              <img
                src={selectedMedia.photo}
                alt={selectedMedia.title}
                referrerPolicy="no-referrer"
                style={{ transform: `rotate(${rotation}deg)` }}
                className="max-w-[95vw] max-h-[80vh] object-contain select-none rounded-xl bg-neutral-900 shadow-2xl border border-white/5 transition-transform duration-300"
              />
            </div>

            {/* Floating details badge at the base */}
            <div className="absolute bottom-6 px-5 py-2.5 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-full text-xs text-slate-200 font-sans font-bold flex items-center gap-3 shadow-2xl select-none">
              <span className="text-white">{selectedMedia.label}</span>
              {selectedMedia.secondaryLabel && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
                  <span className="text-indigo-400 font-mono">{selectedMedia.secondaryLabel}</span>
                </>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
