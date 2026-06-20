import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Download, X, Camera, CheckCircle, FileText, User, Calendar, Receipt, DollarSign, Sparkles, Plus } from 'lucide-react';
import { Bill, Customer, PaymentRecord } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import { safeHtml2Canvas } from '../utils/safeHtml2Canvas';

interface InvoiceDetailModalProps {
  bill: Bill;
  customer: Customer;
  payments?: PaymentRecord[];
  bills?: Bill[];
  onClose: () => void;
}

export default function InvoiceDetailModal({
  bill,
  customer,
  payments,
  bills,
  onClose
}: InvoiceDetailModalProps) {
  const detailInvoicePaperRef = useRef<HTMLDivElement>(null);
  const [isExportingModalImage, setIsExportingModalImage] = useState(false);

  // Sort all bills of this customer to find the previous one and isolate cycle payments
  const customerBills = bills
    ? [...bills]
        .filter(b => b.customerId === customer.id)
        .sort((a, b) => a.createdAt - b.createdAt)
    : [];

  const currentBillIdx = customerBills.findIndex(b => b.id === bill.id);
  const prevBill = currentBillIdx > 0 ? customerBills[currentBillIdx - 1] : null;

  // Payments belonging to this bill's billing period (since previous bill up to this one)
  const cyclePayments = (payments && bills)
    ? payments.filter(p => {
        if (p.customerId !== customer.id) return false;
        if (prevBill) {
          return p.createdAt > prevBill.createdAt && p.createdAt <= bill.createdAt;
        } else {
          return p.createdAt <= bill.createdAt;
        }
      })
    : (payments ? payments.filter(p => p.customerId === customer.id && p.date === bill.date) : []);

  const handleCapturePastInvoice = async () => {
    if (!detailInvoicePaperRef.current) return;
    setIsExportingModalImage(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const canvasObj = await safeHtml2Canvas(detailInvoicePaperRef.current, {
        scale: 3, // Ultra crisp high-definition resolution for text & barcodes
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvasObj.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `HOA_DON_${bill.billNumber}_${customer.name.toUpperCase().replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export past invoice failed", e);
    } finally {
      setIsExportingModalImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-6 mx-auto"
      >
        {/* Modern Sticky Action Toolbar (Excluded from captured image) */}
        <div className="bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-3 flex justify-between items-center text-white shadow-xl">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-widest text-slate-300 uppercase font-mono">
              Hóa Đơn {bill.billNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCapturePastInvoice}
              disabled={isExportingModalImage}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition active:scale-95 select-none shadow-md shadow-indigo-600/20"
              title="Lưu hình ảnh hóa đơn về máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingModalImage ? "Đang tạo ảnh..." : "Lưu ảnh"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl transition hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body Container */}
        <div className="border border-slate-200/50 dark:border-slate-800 p-1 bg-slate-50 dark:bg-[#090e0b] rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto">
          
          {/* Printable Invoice Paper Block */}
          <div
            ref={detailInvoicePaperRef}
            className="bg-white text-slate-900 p-6 sm:p-8 w-full border border-slate-100 flex flex-col space-y-6 rounded-2xl select-none relative"
            style={{ contentVisibility: 'auto' }}
          >
            {/* Top design header */}
            <div className="relative border-b-2 border-dashed border-slate-200 pb-5 text-center flex flex-col items-center">
              {/* Confirmed stamp badge */}
              <div className="absolute top-0 right-0 border-2 border-indigo-600/80 text-indigo-700 text-[8px] sm:text-[9px] font-black uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-lg rotate-12 bg-indigo-50/10 shadow-sm select-none">
                ✓ ĐÃ GHI SỔ
              </div>

              <div className="flex items-center gap-1.5 mb-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-mono">
                <Sparkles className="w-3 h-3 text-emerald-500 animate-spin-slow" />
                <span>SỔ SÁCH XƯỞNG AN</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-850 tracking-wider">HOÁ ĐƠN BÁN HÀNG</h2>
              <div className="text-xs font-black text-indigo-700 font-sans tracking-wide uppercase italic mt-1 bg-indigo-50/40 px-3 py-0.5 rounded-md">
                Gửi Đại Lý: {customer.name}
              </div>
              <p className="text-[10px] text-slate-450 font-mono mt-1.5">Ngày hạch toán: {formatVietnameseDate(bill.date)}</p>
            </div>

            {/* PROMINENT OVERSIZED INVOICE CODE DISPLAY */}
            <div className="flex flex-col items-center justify-center text-center py-4 px-5 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100/60 shadow-xs">
              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase font-mono">MÃ SỐ HÓA ĐƠN</span>
              <span className="text-3xl sm:text-4xl font-mono font-black text-indigo-700 tracking-wider mt-1 select-all">
                {bill.billNumber || "HD-0000"}
              </span>
              <span className="text-[8px] text-slate-400 mt-1 uppercase font-semibold italic">Đại lý chụp hoặc rà soát mã này khi đối chiếu</span>
            </div>

            {/* Customer Details Minimal Card block */}
            <div className="bg-slate-50 border border-slate-150/80 rounded-xl p-4.5 space-y-2 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Khách hàng sỉ</span>
                  <span className="font-extrabold text-slate-850 text-[13px] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{customer.name}</span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Số điện thoại</span>
                  <span className="font-bold text-slate-700 block font-mono">
                    {customer.phone || "---"}
                  </span>
                </div>
                <div className="space-y-0.5 mt-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Trạng thái đối tác</span>
                  <span className="font-semibold text-emerald-650 block text-[11px] leading-tight flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Đại lý sỉ chính thức</span>
                  </span>
                </div>
                <div className="space-y-0.5 mt-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Ngày lập đơn</span>
                  <span className="font-bold text-slate-700 block font-mono flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{bill.date}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice itemized listing ledger table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-indigo-900 font-extrabold border-b border-slate-205 text-[10px] uppercase tracking-wider">
                    <th className="p-2.5 border-r border-slate-200 text-center w-10 font-mono">STT</th>
                    <th className="p-2.5 border-r border-slate-200">Phân Phối / Mẫu Mã</th>
                    <th className="p-2.5 border-r border-slate-200 text-center w-14">SL</th>
                    <th className="p-2.5 border-r border-slate-200 text-right w-20">Đơn Giá</th>
                    <th className="p-2.5 text-right w-24">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {bill.items.map((item, i) => (
                    <tr 
                      key={item.id} 
                      className="even:bg-slate-50/30 odd:bg-white text-slate-800"
                    >
                      <td className="p-2.5 border-r border-slate-200 font-mono text-center text-slate-400 font-bold">{i + 1}</td>
                      <td className="p-2.5 border-r border-slate-200 font-sans font-bold text-slate-800">{item.mẫuMã}</td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-center font-bold text-indigo-650">{item.sốLượng.toLocaleString()}</td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-right text-slate-550">{item.đơnGiá.toLocaleString()}</td>
                      <td className="p-2.5 font-mono text-right font-black text-slate-900">{item.thànhTiền.toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary calculations area */}
            <div className="w-full sm:w-11/12 ml-auto space-y-2.5 text-xs border-t border-slate-150 pt-4 text-slate-700">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-450 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>1. Nợ cũ dồn lại gối đầu:</span>
                </span>
                <span className="font-extrabold font-mono text-slate-650 bg-slate-50 px-2 py-0.5 rounded">{bill.previousDebt.toLocaleString()}đ</span>
              </div>
              
              <div className="flex justify-between items-center text-[11px] text-slate-850">
                <span className="font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>2. Tổng cộng tiền hàng lô mới:</span>
                </span>
                <span className="font-black font-mono text-slate-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/50">{bill.subtotal.toLocaleString()}đ</span>
              </div>

              {(bill.hasPaid || bill.paymentAmount > 0) && (
                <>
                  <div className="flex justify-between items-center text-[11.5px] text-emerald-650">
                    <span className="font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      <span>3. Khách đã thanh toán trực tiếp:</span>
                    </span>
                    <span className="font-black font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">-{bill.paymentAmount.toLocaleString()}đ</span>
                  </div>

                  {/* Other payments belonging to the cycle */}
                  {cyclePayments && cyclePayments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-emerald-650 text-[10.5px]">
                      <span className="italic pl-4 text-slate-450 font-medium truncate max-w-[200px]">
                        ↳ Đã nhận ({p.date} - {p.note || "Gối nợ sỉ"}):
                      </span>
                      <span className="font-bold font-mono bg-emerald-50/50 text-emerald-600 px-1.5 py-0.2 rounded border border-emerald-100/30">-{p.amount.toLocaleString()}đ</span>
                    </div>
                  ))}
                </>
              )}

              {/* Grand Total Debt Display */}
              <div className="flex justify-between items-center border-t-2 border-dashed border-slate-205 pt-3.5 text-[13px] font-black text-rose-600">
                <span className="uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-rose-500" />
                  <span>{ (bill.hasPaid || bill.paymentAmount > 0) ? "4. Tổng nợ còn lại gác sổ:" : "3. Tổng nợ mới hạch toán:" }</span>
                </span>
                <span className="font-black font-mono text-rose-700 bg-rose-50 px-3 py-1 rounded-2xl border-2 border-rose-100/50 text-lg">
                  {bill.grandTotal.toLocaleString()}đ
                </span>
              </div>
            </div>

            {/* Elegant Signature Pad design block */}
            <div className="grid grid-cols-2 text-center text-[10px] mt-8 pt-6 border-t border-dashed border-slate-200 uppercase tracking-widest font-bold">
              <div>
                <p className="text-slate-500 text-[9.5px]">Người lập phiếu (An)</p>
                <p className="text-[7.5px] italic mt-12 lowercase text-slate-400 font-medium font-serif select-none">(Ký tên và ghi rõ họ)</p>
              </div>
              <div>
                <p className="text-slate-550 text-[9.5px]">Đại diện Khách sỉ nhận</p>
                <p className="text-[7.5px] italic mt-12 lowercase text-slate-400 font-medium font-serif select-none">(Ký nhận lô hàng sỉ)</p>
              </div>
            </div>

            {/* Sincere Slogan Footer */}
            <div className="text-center text-[9px] text-slate-400 font-sans font-bold pt-4 border-t border-slate-100 uppercase tracking-widest select-none leading-none">
              ~ ĐỒNG TÂM PHÁT TRIỂN • THUẬN BUỒM XUÔI GIÓ ~
            </div>
          </div>
        </div>

        {/* Handy Bottom Action Deck (Excluded from captured image) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-2 gap-2 shadow-xl">
          <button
            type="button"
            onClick={handleCapturePastInvoice}
            disabled={isExportingModalImage}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 border border-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingModalImage ? "Đang xuất..." : "Lưu ảnh"}</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-slate-700"
          >
            <X className="w-4 h-4" />
            <span>Đóng lại</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
