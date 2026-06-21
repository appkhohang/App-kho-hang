import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Download, X, Printer, CheckCircle2, Share2 } from 'lucide-react';
import { Bill, Customer, PaymentRecord } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import { safeHtml2Canvas } from '../utils/safeHtml2Canvas';
import { compressCanvasToBlob, shareImageFile } from '../utils/imageUtils';

interface PaymentReceiptModalProps {
  payment: PaymentRecord;
  customer: Customer;
  calculateDebtBefore: (upToTime: number) => number;
  onClose: () => void;
}

export default function PaymentReceiptModal({
  payment,
  customer,
  calculateDebtBefore,
  onClose
}: PaymentReceiptModalProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Compute debt just before and immediately after this payment
  const debtBefore = calculateDebtBefore(payment.createdAt);
  const debtAfter = debtBefore - payment.amount;

  const generateReceiptBlob = async (): Promise<Blob | null> => {
    if (!paperRef.current) return null;
    const canvasObj = await safeHtml2Canvas(paperRef.current, {
      scale: 1.7, // 1.7x Retina resolution provides highly crisp rendering on mobile screens with minuscule footprint (<150kb)
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    return await compressCanvasToBlob(canvasObj, 0.78);
  };

  const handleCaptureReceipt = async () => {
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const blob = await generateReceiptBlob();
      if (!blob) throw new Error("Thất bại");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const sanitizedName = customer.name.toUpperCase().replace(/\s+/g, "_");
      link.download = `BIEN_NHAN_THANH_TOAN_${sanitizedName}_${payment.date}.jpg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Export payment receipt image failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareReceipt = async () => {
    setIsSharing(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const blob = await generateReceiptBlob();
      if (!blob) throw new Error("Thất bại khi xuất ảnh");
      const sanitizedName = customer.name.replace(/\s+/g, "_");
      
      const shared = await shareImageFile(
        blob,
        `BIEN_NHAN_${sanitizedName}_${payment.date}.jpg`,
        `Biên nhận thanh toán ${customer.name}`,
        `Biên nhận thanh toán của khách sỉ ${customer.name} số tiền ${payment.amount.toLocaleString()}đ - Sổ sách Xưởng An`
      );
      if (!shared) {
        alert("Chia sẻ qua ứng dụng trực tiếp không khả dụng. Bạn có thể sử dụng nút Lưu Hình để tải về.");
      }
    } catch (e) {
      console.error("Share payment receipt image failed", e);
      alert("Đã xảy ra lỗi khi chia sẻ ảnh.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans">
      <div className="absolute inset-0" onClick={onClose} />
      
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-8"
      >
        {/* Actions headbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 flex justify-between items-center text-white shadow-lg">
          <span className="text-[11px] font-extrabold tracking-widest text-emerald-400 uppercase font-mono flex items-center gap-1.5">
            🧾 BIÊN NHẬN THANH TOÁN SỈ
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShareReceipt}
              disabled={isSharing || isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition select-none shadow active:scale-95"
              title="Chia sẻ qua Zalo/Ứng dụng"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing ? "Đang gửi..." : "Chia sẻ"}</span>
            </button>
            <button
              onClick={handleCaptureReceipt}
              disabled={isExporting || isSharing}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition select-none shadow active:scale-95"
              title="Lưu hình ảnh biên nhận về máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Đang lưu..." : "Lưu hình"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable/Exportable Paper Cash Voucher Card */}
        <div className="border border-slate-200/40 p-1 bg-slate-100 rounded-2xl shadow-xl overflow-hidden">
          <div
            ref={paperRef}
            className="bg-white text-slate-900 p-8 w-full font-serif border border-slate-100 flex flex-col space-y-6 rounded-xl select-none relative"
          >
            {/* Stamp elements */}
            {debtAfter <= 0 && (
              <div className="absolute top-10 right-8 pointer-events-none select-none flex flex-col items-center">
                <div className="border-4 border-dashed border-emerald-500/80 rounded-full px-3 py-1 font-sans text-center text-[10px] font-black uppercase text-emerald-600 -rotate-12 bg-white tracking-widest shadow-sm">
                  ● ĐÃ THU ĐỦ ●
                </div>
                <span className="text-[8px] font-sans text-slate-400 mt-1 uppercase tracking-wide">Quy trình An May</span>
              </div>
            )}

            {/* Header section */}
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-5 space-y-1">
              <h2 className="text-xl font-sans tracking-tight font-black text-slate-800 uppercase">XƯỞNG MAY AN</h2>
              <p className="text-[10px] font-sans text-slate-500 tracking-wide">Chuyên thiết kế / cung cấp quần áo sỉ</p>
              <div className="pt-2">
                <h1 className="text-2xl font-black text-indigo-900 tracking-wider">THANH TOÁN</h1>
                <p className="text-[10.5px] font-sans text-slate-500 italic">Liên gửi đối tác khách sỉ dồn công nợ</p>
              </div>
              <p className="text-[10px] font-sans text-slate-400 mt-1 font-mono">Thời gian lập phiếu: {formatVietnameseDate(payment.date)}</p>
            </div>

            {/* Partner / Customer and Voucher details */}
            <div className="space-y-3.5 font-sans">
              <div className="border-l-4 border-indigo-600 pl-3.5 py-1 space-y-1 bg-indigo-50/25 rounded-r-lg">
                <p className="text-[10px] tracking-wider text-indigo-800 uppercase font-extrabold">KHÁCH HÀNG:</p>
                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                {customer.phone && <p className="text-xs text-slate-600 font-mono">Liên hệ: {customer.phone}</p>}
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="flex justify-between items-center text-[#10b981]">
                  <span className="font-bold uppercase text-[10px]">Số tiền thực thu (Đồng):</span>
                  <span className="font-mono text-base font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl shadow-sm">
                    {payment.amount.toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>

            {/* Debt roll-forward ledger box - Coupling math */}
            <div className="border-2 border-dashed border-slate-200 p-4.5 rounded-xl font-sans bg-slate-50/50 space-y-3 leading-relaxed">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider">Lịch sử khấu trừ công nợ khách sỉ</span>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">1. Nợ cũ:</span>
                  <span className="font-mono text-slate-900 font-black">+{debtBefore.toLocaleString()}đ</span>
                </div>
                
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="font-medium italic">↳ Số tiền thanh toán:</span>
                  <span className="font-mono font-black">-{payment.amount.toLocaleString()}đ</span>
                </div>

                <div className="border-t border-slate-200 border-dashed pt-2 flex justify-between items-center font-bold text-indigo-950">
                  <span className="font-black text-rose-600 uppercase text-[11px] tracking-tight">2. Tổng còn lại:</span>
                  <span className="font-mono text-sm bg-rose-50 text-rose-700 px-2.5 py-1 rounded-xl">
                    {debtAfter.toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Signature Section */}
            <div className="grid grid-cols-2 text-[10.5px] font-sans pt-4 text-center leading-normal text-slate-500">
              <div className="space-y-14">
                <p className="font-extrabold text-slate-800 uppercase">Khách hàng</p>
                <p className="italic text-[9.5px] text-slate-400">(Ký, ghi rõ họ tên)</p>
              </div>
              <div className="space-y-14">
                <p className="font-extrabold text-indigo-900 uppercase">Đại lý lập phiếu</p>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 font-sans tracking-wide">Xưởng May An</p>
                  <p className="italic text-[9.5px] text-slate-400">(Đã thu tiền và chốt sổ tiếp theo)</p>
                </div>
              </div>
            </div>

            {/* Professional footer note */}
            <div className="text-center pt-8 border-t border-dashed border-slate-200">
              <p className="text-[8px] font-sans text-slate-400 tracking-widest uppercase">Cảm ơn quý khách đã tin chọn sản phẩm may mặc của xưởng may an!</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
