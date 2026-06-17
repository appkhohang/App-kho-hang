/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpCircle, Info, Download, AlertTriangle, X, CheckCircle } from 'lucide-react';
import { AppUpdateInfo, CURRENT_VERSION } from '../types';

interface AppUpdateModalProps {
  updateInfo: AppUpdateInfo;
  onClose: () => void;
}

export default function AppUpdateModal({ updateInfo, onClose }: AppUpdateModalProps) {
  // Action to download the APK
  const handleDownloadUpdate = () => {
    if (updateInfo.apkUrl) {
      window.open(updateInfo.apkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Dimmed glass backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={updateInfo.critical ? undefined : onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-default"
      />

      {/* Centered card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-6 flex flex-col gap-4 font-sans max-h-[90vh]"
      >
        {/* Dismiss Button (only if not critical) */}
        {!updateInfo.critical && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 transition cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header Icon */}
        <div className="flex items-start gap-4 pr-6 mt-1">
          <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
            <ArrowUpCircle className="w-7 h-7 animate-bounce-slow" />
          </div>
          <div className="space-y-1">
            <span className="text-[9.5px] font-black uppercase tracking-widest text-indigo-620 dark:text-indigo-400 font-mono flex items-center gap-1.5">
              <span>Đã có phiên bản mới</span>
              {updateInfo.critical && (
                <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-normal animate-pulse">Bản bắt buộc</span>
              )}
            </span>
            <h3 className="text-lg font-black text-slate-850 dark:text-slate-50 uppercase tracking-wide">
              Cập nhật hệ thống
            </h3>
          </div>
        </div>

        {/* Version Compare badging */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150/80 dark:border-slate-850 justify-between text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Yêu cầu mới:</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">v{updateInfo.version}</span>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">Đang cài đặt:</span>
            <span className="font-extrabold text-slate-500 text-sm">v{localStorage.getItem('capgo_active_version') || CURRENT_VERSION}</span>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400">Phát hành:</span>
            <span className="font-extrabold text-slate-700 dark:text-slate-300">{updateInfo.releaseDate || "Mới đây"}</span>
          </div>
        </div>

        {/* Changlog Items scrollbox */}
        <div className="space-y-2.5 text-xs text-left">
          <div className="text-[10px] font-mono font-black text-slate-400 dark:text-slate-450 uppercase tracking-wider">
            Nội dung cải tiến & Chắp vá lỗi:
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-150/70 dark:border-slate-800 max-h-[190px] overflow-y-auto space-y-2 text-slate-600 dark:text-slate-350 leading-relaxed scrollbar-thin">
            {updateInfo.changelog && updateInfo.changelog.length > 0 ? (
              updateInfo.changelog.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start text-[11.5px]">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-505 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic text-center text-[11px]">Không có chi tiết nhật ký phát hành.</p>
            )}
          </div>
        </div>

        {/* Security checklist reminder */}
        <div className="p-3 bg-amber-500/[0.04] dark:bg-amber-500/[0.01] border border-amber-500/20 dark:border-amber-500/10 rounded-2xl text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-400 font-medium flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>
            <strong>Cơ chế bảo mật nén:</strong> Files APK được lưu trực tiếp trên Firebase Hosting bảo mật của xưởng. Nhấn Cập nhật để trình duyệt điện thoại tải và ghi đè file APK một cách an toàn.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2 pt-1">
          {!updateInfo.critical && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-755 rounded-2xl transition cursor-pointer active:scale-98"
            >
              Để sau (Skip)
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadUpdate}
            className="flex-2 py-3 px-4 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-md hover:shadow-lg shadow-indigo-600/10 hover:ring-2 hover:ring-indigo-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Tải & Cập nhật ngay</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
