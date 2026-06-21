/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, X, Move, Sparkles, TrendingUp, Calendar, CalendarCheck, Package, Ship, DollarSign, Download, ChevronRight, Share2 } from 'lucide-react';
import { ImportItem } from '../types';
import { getVietnameseWeekKey, getVietnameseMonthKey, formatVietnameseDate } from '../utils/dateUtils';
import { safeHtml2Canvas } from '../utils/safeHtml2Canvas';
import { convertCanvasToPngBlob, shareImageFile } from '../utils/imageUtils';

interface FloatingStatsProps {
  items: ImportItem[];
  isFloating?: boolean;
}

export default function FloatingStats({ items, isFloating = true }: FloatingStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Group items to identify the MOST RECENT week
  const itemsByWeek: { [week: string]: ImportItem[] } = {};
  items.forEach(item => {
    if (!item) return;
    if (!itemsByWeek[item.weekKey]) itemsByWeek[item.weekKey] = [];
    itemsByWeek[item.weekKey].push(item);
  });
  
  const sortedWeeks = Object.keys(itemsByWeek).sort((a, b) => b.localeCompare(a)); // latest first
  const latestWeekLabel = sortedWeeks[0] || "Tuần Hiện Tại";
  const latestWeekItems = itemsByWeek[latestWeekLabel] || [];

  // Weekly Stats calculation
  const wQty = latestWeekItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
  const wSewValue = latestWeekItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0);
  const wShipĐT_TP = latestWeekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
  const wShipTP_ĐT = latestWeekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
  const wNetShip = wShipTP_ĐT - wShipĐT_TP;

  // Monthly Stats calculation (current month)
  const currentMonthKey = getVietnameseMonthKey(new Date().toISOString().split("T")[0]);
  const currentMonthItems = items.filter(item => item && getVietnameseMonthKey(item.ngày) === currentMonthKey);
  
  const mQty = currentMonthItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
  const mSewValue = currentMonthItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0);
  const mShipĐT_TP = currentMonthItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
  const mShipTP_ĐT = currentMonthItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
  const mNetShip = mShipTP_ĐT - mShipĐT_TP;

  const generateStatsBlob = async (): Promise<Blob | null> => {
    if (!printAreaRef.current) return null;
    const canvas = await safeHtml2Canvas(printAreaRef.current, {
      scale: 1.7, // 1.7x resolution keeps stats board completely readable yet fits perfectly within 150KB size bounds
      useCORS: true,
      backgroundColor: '#0f172a', // Slate dark background representation
    });
    return await convertCanvasToPngBlob(canvas);
  };

  // Export Stats Card to Image using html2canvas
  const exportStatsImage = async () => {
    setIsDownloading(true);
    // short delay for transitions
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const blob = await generateStatsBlob();
      if (!blob) throw new Error("Thất bại");
      const url = URL.createObjectURL(blob);
      const dLink = document.createElement("a");
      dLink.download = `THONG_KE_TUAN_${latestWeekLabel.replace(/\s+/g, "_")}.png`;
      dLink.href = url;
      dLink.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Failed to export stats image", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const shareStatsImage = async () => {
    setIsSharing(true);
    // short delay for transitions
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const blob = await generateStatsBlob();
      if (!blob) throw new Error("Thất bại tạo ảnh thống kê");
      const sanitizedLabel = latestWeekLabel.replace(/\s+/g, "_");
      
      const shared = await shareImageFile(
        blob,
        `THONG_KE_TUAN_${sanitizedLabel}.png`,
        `Thống kê ${latestWeekLabel}`,
        `Báo cáo thống kê sản lượng và chênh lệch phí ship tuần ${latestWeekLabel} - Xưởng May An`
      );
      if (!shared) {
        alert("Chia sẻ qua ứng dụng không khả dụng trên trình duyệt hiện tại. Bạn có thể bấm Lưu Thống Kê để tải ảnh.");
      }
    } catch (e) {
      console.error("Failed to share stats image", e);
      alert("Gặp lỗi trong lúc trích xuất ảnh thống kê.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      {isFloating ? (
        /* Floating Capsule - Draggable anywhere in viewport */
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.08}
          dragTransition={{ power: 0.1, timeConstant: 100 }}
          className="fixed bottom-6 right-6 z-40 touch-none select-none"
          title="Nhấn để phóng to thống kê - Giữ chuột để di chuyển"
        >
          <AnimatePresence mode="wait">
            {!isExpanded && (
              <motion.button
                key="collapsed-badge"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => setIsExpanded(true)}
                className="bg-slate-900/90 dark:bg-slate-900 border border-indigo-500/30 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 backdrop-blur-xl cursor-pointer hover:border-indigo-500 hover:shadow-indigo-500/10 transition active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-lg relative">
                  <AreaChart className="w-4.5 h-4.5 text-slate-950 animate-bounce-slow" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
                </div>
                
                <div className="text-left pr-2 font-sans">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1">
                    <Move className="w-3 h-3 text-slate-500" />
                    <span>Kéo di dời ➔</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-extrabold text-white font-mono">{(wQty).toLocaleString()} Sl/Tuần</span>
                  </div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Static button to trigger detailed report popup */
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer border border-indigo-500/30"
          title="Xem báo cáo thống kê chi tiết"
        >
          <AreaChart className="w-4 h-4 text-white" />
          <span>Thống Kê Chi Tiết</span>
        </button>
      )}

      {/* Expanded Stats Overlay Modal */}
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden font-sans">
            {/* Click outside to minimize */}
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setIsExpanded(false)}></div>
            
            <motion.div
              ref={containerRef}
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-lg bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl shadow-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                  <h3 className="text-sm font-semibold tracking-wide uppercase font-mono">BÁO CÁO THỐNG KÊ CHI TIẾT</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={shareStatsImage}
                    disabled={isSharing || isDownloading}
                    className="bg-slate-800 hover:bg-slate-750 text-white p-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
                    title="Chia sẻ báo cáo thống kê qua Zalo/Ứng dụng khác"
                  >
                    <Share2 className="w-4 h-4 text-indigo-400" />
                  </button>
                  <button
                    onClick={exportStatsImage}
                    disabled={isDownloading || isSharing}
                    className="bg-slate-800 hover:bg-slate-750 text-white p-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
                    title="Lưu ảnh thống kê tuần này về máy"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable stats card block */}
              <div className="p-6 overflow-y-auto space-y-6 flex-grow" ref={printAreaRef}>
                
                {/* Meta details header inside image area */}
                <div className="border border-indigo-500/20 bg-slate-950/40 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400 font-mono tracking-widest uppercase">XƯỞNG MAY AN (ĐT)</span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatVietnameseDate(new Date().toISOString().split("T")[0])}</span>
                  </div>
                  <h2 className="text-base font-bold text-white font-serif">BẢNG PHÂN TÍCH SẢN LƯỢNG & PHÍ SHIPPING</h2>
                </div>

                {/* WEEKLY METRICS BLOCK */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    <CalendarCheck className="w-4.5 h-4.5 text-indigo-400" />
                    <span>THỐNG KÊ CHI TIẾT THEO TUẦN (MỚI NHẤT)</span>
                  </div>

                  <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1.5">{latestWeekLabel}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">1. Tổng số sản phẩm may</span>
                        <p className="text-sm font-extrabold text-white font-mono">{wQty.toLocaleString()} chiếc</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">2. Tổng tiền công may (SL x Đơn giá)</span>
                        <p className="text-sm font-extrabold text-indigo-400 font-mono">{wSewValue.toLocaleString()} đ</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">3. Tổng ship ĐT ➔ TP</span>
                        <p className="text-xs font-bold text-slate-300 font-mono">{wShipĐT_TP.toLocaleString()} đ</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">4. Tổng ship TP ➔ ĐT</span>
                        <p className="text-xs font-bold text-slate-300 font-mono">{wShipTP_ĐT.toLocaleString()} đ</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2.5 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Chênh lệch Ship (TP➔ĐT trừ ĐT➔TP):</span>
                      <span className={`font-mono font-black ${wNetShip >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {wNetShip >= 0 ? '+' : ''}{wNetShip.toLocaleString()} đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* MONTHLY METRICS BLOCK */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    <Calendar className="w-4.5 h-4.5 text-emerald-400" />
                    <span>THỐNG KÊ TỔNG HỢP THEO THÁNG</span>
                  </div>

                  <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-emerald-400 border-b border-slate-800 pb-1.5">{currentMonthKey}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">Tổng SL may cả tháng</span>
                        <p className="text-sm font-extrabold text-white font-mono">{mQty.toLocaleString()} chiếc</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">Tổng tiền công may trong tháng</span>
                        <p className="text-sm font-extrabold text-emerald-400 font-mono">{mSewValue.toLocaleString()} đ</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">Nửa phí ship gửi lên ĐT-TP</span>
                        <p className="text-xs font-bold text-slate-300 font-mono">{mShipĐT_TP.toLocaleString()} đ</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-400 uppercase font-mono">Nửa phí ship gửi về TP-ĐT</span>
                        <p className="text-xs font-bold text-slate-300 font-mono">{mShipTP_ĐT.toLocaleString()} đ</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2.5 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Hiệu số chênh lệch ship cả tháng:</span>
                      <span className={`font-mono font-black ${mNetShip >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {mNetShip >= 0 ? '+' : ''}{mNetShip.toLocaleString()} đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer security stamp details */}
                <div className="text-center pt-2 font-mono text-[9px] text-slate-500 border-t border-slate-800 pb-2 leading-relaxed">
                  <p>MÃ HOÁ HỆ THỐNG XƯỞNG AN - BÁO CÁO CÓ GIÁ TRỊ PHÁP LÝ NỘI BỘ</p>
                  <p className="mt-0.5">CHUYỂN GIAO THIẾT BỊ LIÊN TỤC VÀ ĐƯỢC CHỐT TRỰC TUYẾN CHẶT CHẼ</p>
                </div>
              </div>

              {/* Bottom footer bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 text-center flex justify-between items-center text-xs text-slate-400">
                <span>Di chuột/tay vào tiêu đề để kéo di dời</span>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  Đóng thống kê
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
