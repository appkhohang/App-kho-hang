import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Image as ImageIcon, X, Printer, CheckCircle2 } from 'lucide-react';
import { ImportItem, LaborPayment } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import html2canvas from 'html2canvas';

interface LaborPaymentReceiptModalProps {
  payment: LaborPayment;
  weekItems: ImportItem[];
  allLaborPayments: LaborPayment[];
  onClose: () => void;
}

export default function LaborPaymentReceiptModal({
  payment,
  weekItems,
  allLaborPayments,
  onClose
}: LaborPaymentReceiptModalProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Computed metrics for the week
  const totalQty = weekItems.reduce((acc, curr) => acc + (curr?.sốLượng || 0), 0);
  const totalAmount = weekItems.reduce((acc, curr) => acc + ((curr?.sốLượng || 0) * (curr?.đơnGiáMay || 0)), 0); // "Tiền hàng" (Tiền công may)
  const totalShipDT_TP = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnĐT_TP || 0), 0);
  const totalShipTP_ĐT = weekItems.reduce((acc, curr) => acc + (curr?.vậnChuyểnTP_ĐT || 0), 0);
  const netBackShipValue = totalShipTP_ĐT - totalShipDT_TP; // "Vận chuyển"
  const grandTotal = totalAmount + netBackShipValue; // "Thành tiền"

  // Compute payment history and balance
  // Filter payments for this week that happened before or equal to this payment
  const historicalPayments = allLaborPayments
    .filter(p => p.weekKey === payment.weekKey && p.createdAt < payment.createdAt);
  const previousPaid = historicalPayments.reduce((acc, p) => acc + p.amount, 0);
  
  const balanceBeforeThisPayment = grandTotal - previousPaid;
  const balanceAfterThisPayment = balanceBeforeThisPayment - payment.amount;

  const handleCaptureReceipt = async () => {
    if (!paperRef.current) return;
    setIsExporting(true);
    // Short wait to allow modal layout to form cleanly
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const canvasObj = await html2canvas(paperRef.current, {
        scale: 3, // Ultra crisp HD capture for sharing
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvasObj.toDataURL("image/png");
      const link = document.createElement("a");
      const sanitizedWeek = payment.weekKey.toUpperCase().replace(/\s+/g, "_").replace(/[\/\\?*:[\]]/g, "_");
      link.download = `BIEN_NHAN_CONG_THO_${sanitizedWeek}_${payment.date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export labor payment voucher failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans">
      <div className="absolute inset-0" onClick={onClose} />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-8"
      >
        {/* Actions headbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 flex justify-between items-center text-white shadow-lg">
          <span className="text-[11px] font-extrabold tracking-widest text-[#4f46e5] uppercase font-mono flex items-center gap-1.5">
            💸 PHIẾU THANH TOÁN CÔNG THỢ
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCaptureReceipt}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-extrabold text-[11px] py-1.5 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition select-none shadow"
            >
              <ImageIcon className="w-4 h-4" />
              <span>{isExporting ? "Đang xuất..." : "Chụp hình / Gửi thợ"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Exportable Slip Card Wrapper with nice outer background */}
        <div className="border border-slate-200/40 p-1 bg-slate-100 rounded-2xl shadow-xl overflow-hidden">
          <div
            ref={paperRef}
            className="bg-white text-slate-900 p-8 w-full font-serif border border-slate-100 flex flex-col space-y-6 rounded-xl select-none relative"
          >
            {/* Elegant Vintage Watermark / Stamp */}
            <div className="absolute top-10 right-8 pointer-events-none select-none flex flex-col items-center">
              <div className="border-4 border-dashed border-indigo-500/80 rounded-full px-3 py-1 font-sans text-center text-[10px] font-black uppercase text-indigo-600 -rotate-12 bg-white tracking-wider shadow-sm">
                ● ĐÃ THANH TOÁN ●
              </div>
              <span className="text-[8px] font-sans text-slate-400 mt-1 uppercase tracking-wide">Xưởng May An</span>
            </div>

            {/* Header branding */}
            <div className="text-center border-b-2 border-dashed border-slate-200 pb-5 space-y-1">
              <h2 className="text-xl font-sans tracking-tight font-black text-slate-800 uppercase">XƯỞNG MAY AN</h2>
              <p className="text-[10px] font-sans text-slate-500 tracking-wide">Chuyên thiết kế / cung cấp quần áo sỉ</p>
              <div className="pt-2">
                <h1 className="text-xl font-black text-slate-900 tracking-wider">PHIẾU THANH TOÁN CÔNG THỢ</h1>
                <p className="text-[10.5px] font-sans text-slate-500 italic">Ghi nhận chi trả lương thợ gia công</p>
              </div>
              <p className="text-[10px] font-sans text-slate-400 mt-1 font-mono">Phiếu chi lập ngày: {formatVietnameseDate(payment.date)}</p>
            </div>

            {/* Content Details: Apply details */}
            <div className="space-y-4 font-sans">
              
              {/* Target week scope block */}
              <div className="border-l-4 border-indigo-600 pl-3.5 py-1.5 space-y-1 bg-indigo-50/25 rounded-r-lg">
                <p className="text-[9px] tracking-wider text-indigo-800 uppercase font-extrabold font-mono">THỜI GIAN / ĐỢT ÁP DỤNG:</p>
                <p className="text-sm font-bold text-slate-900 uppercase">{payment.weekKey}</p>
                <p className="text-[10.5px] text-slate-600">Nội dung chi: <span className="font-semibold">{payment.note}</span></p>
              </div>

              {/* Breakdown Table (Tiền hàng, vận chuyển, thành tiền) */}
              <div className="space-y-3.5">
                <h3 className="text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">Chi chi tiết công nợ đợt nhập</h3>
                
                <div className="space-y-2 text-xs">
                  {/* Category 1: Tiền Hàng */}
                  <div className="pb-3 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-800 text-[11.5px] uppercase">1. TIỀN HÀNG (TIỀN CÔNG MAY)</span>
                      <span className="font-mono font-bold text-indigo-700">+{totalAmount.toLocaleString()}đ</span>
                    </div>
                    
                    {/* Detailed list showing: mẫu mã, số lượng, đơn giá, thành tiền */}
                    <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-150 space-y-2 mt-1 mx-0.5">
                      <div className="grid grid-cols-12 gap-1 px-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200">
                        <span className="col-span-5">Mẫu mã</span>
                        <span className="col-span-2 text-right">S.Lượng</span>
                        <span className="col-span-2 text-right">Đơn giá</span>
                        <span className="col-span-3 text-right">Thành tiền</span>
                      </div>
                      
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {weekItems.map((item, idx) => {
                          const itemTotalAmount = item.sốLượng * item.đơnGiáMay;
                          return (
                            <div key={item.id} className="grid grid-cols-12 gap-1 items-center px-1 text-[10.5px] py-1 border-b border-dashed border-slate-100 last:border-b-0 text-slate-700">
                              <span className="col-span-5 font-semibold truncate" title={item.mẫu}>
                                {idx + 1}. {item.mẫu}
                              </span>
                              <span className="col-span-2 text-right font-mono font-bold text-slate-900">
                                {item.sốLượng}
                              </span>
                              <span className="col-span-2 text-right font-mono text-slate-500">
                                {item.đơnGiáMay.toLocaleString()}
                              </span>
                              <span className="col-span-3 text-right font-mono font-bold text-indigo-950">
                                {itemTotalAmount.toLocaleString()}đ
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Mini Total row for items details */}
                      <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center text-[9.5px] font-extrabold text-slate-500">
                        <span>CỘNG SẢN LƯỢNG MAY:</span>
                        <span className="font-mono text-slate-800 text-xs">
                          {totalQty.toLocaleString()} cái
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Chi phí Vận chuyển */}
                  <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 text-[11.5px]">2. CHI PHÍ VẬN CHUYỂN (SHIP)</span>
                      <p className="text-[10px] text-slate-550 italic">
                        TP ➔ ĐT (+{totalShipTP_ĐT.toLocaleString()}đ) - ĐT ➔ TP (-{totalShipDT_TP.toLocaleString()}đ)
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {netBackShipValue >= 0 ? '+' : ''}{netBackShipValue.toLocaleString()}đ
                    </span>
                  </div>

                  {/* Category 3: Thành tiền */}
                  <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="font-extrabold text-indigo-900 text-xs uppercase tracking-tight">3. TỔNG THÀNH TIỀN (1 + 2):</span>
                    <span className="font-mono text-sm font-black text-indigo-950">
                      {grandTotal.toLocaleString()}đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions roll structure */}
              <div className="border-t border-dashed border-slate-200 pt-3.5 space-y-2.5">
                <h3 className="text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">Thông tin thanh toán đợt này</h3>
                
                <div className="space-y-2 text-xs bg-indigo-50/15 p-3 rounded-xl border border-indigo-100/40">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Nợ luỹ kế trước thanh toán:</span>
                    <span className="font-mono font-bold text-slate-800">+{balanceBeforeThisPayment.toLocaleString()}đ</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-600 font-bold py-1 border-y border-dashed border-slate-200">
                    <span className="uppercase text-[10.5px]">Thực chi đợt này (Tiền mặt/Chuyển khoản):</span>
                    <span className="font-mono text-base font-black bg-emerald-50 text-emerald-700 px-3 py-0.5 rounded-lg">
                      -{payment.amount.toLocaleString()}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600 font-extrabold pt-0.5">
                    <span>CÒN LẠI TIẾP TỤC DỒN GHI SỔ:</span>
                    <span className="font-mono text-sm bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg">
                      {balanceAfterThisPayment.toLocaleString()}đ
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Signature structure */}
            <div className="grid grid-cols-2 text-[10.5px] font-sans pt-4 text-center leading-normal text-slate-500">
              <div className="space-y-12">
                <p className="font-extrabold text-slate-800 uppercase">Người nhận tiền (Thợ)</p>
                <p className="italic text-[9.5px] text-slate-400">(Ký, ghi nhận đủ tiền)</p>
              </div>
              <div className="space-y-12">
                <p className="font-extrabold text-slate-800 uppercase">Đại diện Xưởng May An</p>
                <p className="italic text-[9.5px] text-slate-400 font-semibold text-indigo-700">Đã chi phiếu và khóa sổ</p>
              </div>
            </div>

            {/* Bottom footnote */}
            <div className="text-center pt-8 border-t border-dashed border-slate-200">
              <p className="text-[8px] font-sans text-slate-400 tracking-widest uppercase mb-1">CẢM ƠN QUÝ THỢ GIA CÔNG LUÔN ĐỒNG HÀNH BỀN VỮNG CÙNG XƯỞNG MAY AN!</p>
              <p className="text-[7.5px] font-mono text-slate-400 leading-none">Mã phiếu chi: {payment.id}</p>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
