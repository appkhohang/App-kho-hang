import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Image, X } from 'lucide-react';
import { Bill, Customer, PaymentRecord } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import html2canvas from 'html2canvas';

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
      const canvasObj = await html2canvas(detailInvoicePaperRef.current, {
        scale: 3, // Ultra crisp resolution
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
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto font-sans">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-8"
      >
        {/* Sticky Action Toolbar on Top (Not captured in screenshots) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex justify-between items-center text-white shadow-lg">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono">
            Chi tiết hóa đơn {bill.billNumber}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCapturePastInvoice}
              disabled={isExportingModalImage}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition select-none"
            >
              <Image className="w-3.5 h-3.5" />
              <span>{isExportingModalImage ? "Đang chụp..." : "Chụp gửi khách"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-450 hover:text-white p-1 rounded-lg transition hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Cash Voucher/Voucher Card */}
        <div className="border border-slate-200/40 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-xl overflow-hidden">
          <div
            ref={detailInvoicePaperRef}
            className="bg-white text-slate-900 p-8 w-full font-serif border border-slate-100 flex flex-col space-y-5 rounded-xl select-none"
          >
            {/* Decorative Invoice Header */}
            <div className="text-center border-b-2 border-dashed border-slate-350 pb-5 space-y-1 relative">
              <div className="absolute top-0 right-0 border border-indigo-600 text-indigo-700 text-[9px] font-extrabold uppercase font-sans tracking-widest px-2 py-0.5 rounded-lg rotate-12 bg-indigo-50/20 shadow-sm">
                ĐÃ LƯU SỔ
              </div>
              
              <h2 className="text-2xl font-black text-slate-800 tracking-wider uppercase">HOÁ ĐƠN THANH TOÁN</h2>
              <p className="text-xs font-bold text-indigo-700 font-sans tracking-wide uppercase italic">
                Xưởng An gửi {customer.name}
              </p>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Ngày lập: {formatVietnameseDate(bill.date)}</p>
            </div>

            {/* Removed supplier & partner units as per user request */}

            {/* Invoice itemized listing ledger table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden font-sans">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-indigo-900 font-bold border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200 font-mono text-center w-12">STT</th>
                    <th className="p-2 border-r border-slate-200">Tên Mẫu Sản Phẩm</th>
                    <th className="p-2 border-r border-slate-200 text-center w-16">Số Lượng</th>
                    <th className="p-2 border-r border-slate-200 text-right w-24">Đơn Giá</th>
                    <th className="p-2 text-right w-28">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {bill.items.map((item, i) => (
                    <tr 
                      key={item.id} 
                      className="even:bg-slate-50/40 odd:bg-white hover:bg-slate-100/70 transition-all duration-150 group/tr"
                    >
                      <td className="p-2.5 border-r border-slate-200 font-mono text-center text-slate-450 group-hover/tr:text-indigo-600 font-bold transition-colors">{i + 1}</td>
                      <td className="p-2.5 border-r border-slate-200 font-sans font-bold text-slate-800 group-hover/tr:text-indigo-700 transition-colors">{item.mẫuMã}</td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-center font-bold text-slate-700">{item.sốLượng.toLocaleString()}</td>
                      <td className="p-2.5 border-r border-slate-200 font-mono text-right text-slate-650 group-hover/tr:text-slate-900 transition-colors">{item.đơnGiá.toLocaleString()}đ</td>
                      <td className="p-2.5 font-mono text-right font-black text-slate-900 group-hover/tr:text-indigo-850 transition-colors">{item.thànhTiền.toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary math and cumulative debts */}
            <div className="w-2/3 ml-auto space-y-2 text-xs font-sans border-t border-slate-200 pt-3.5 text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">1. Tổng trị giá đơn hàng cũ dồn lại:</span>
                <span className="font-semibold font-mono text-slate-550">{bill.previousDebt.toLocaleString()}đ</span>
              </div>
              
              <div className="flex justify-between items-center text-slate-800">
                <span className="font-bold">2. Tổng giá trị lô sản phẩm mới:</span>
                <span className="font-extrabold font-mono text-slate-900 block bg-slate-100/60 px-2 py-0.5 rounded">{bill.subtotal.toLocaleString()}đ</span>
              </div>

              <div className="flex justify-between items-center text-emerald-600">
                <span className="font-bold">3. Khách đã thanh toán:</span>
                <span className="font-extrabold font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">-{bill.paymentAmount.toLocaleString()}đ</span>
              </div>

              {/* Other payments since the previous bill */}
              {cyclePayments && cyclePayments.map((p, idx) => (
                <div key={p.id} className="flex justify-between items-center text-emerald-600 text-[10.5px]">
                  <span className="italic pl-3 text-slate-500 font-medium">↳ Đã thanh toán ({p.date} - {p.note || "Thu dồn sỉ"}):</span>
                  <span className="font-extrabold font-mono bg-emerald-50/75 text-emerald-700 px-1.5 py-0.2 rounded">-{p.amount.toLocaleString()}đ</span>
                </div>
              ))}

              <div className="flex justify-between items-center border-t-2 border-dashed border-slate-350 pt-3 text-sm font-black text-rose-600">
                <span>4. TỔNG:</span>
                <span className="text-base font-extrabold font-mono text-red-650 bg-red-50 px-2.5 py-1 rounded-xl">
                  {bill.grandTotal.toLocaleString()}đ
                </span>
              </div>
            </div>

            {/* Elegant Signed Stamp Box section */}
            <div className="grid grid-cols-2 text-center text-[10px] mt-8 pt-6 border-t border-dashed border-slate-200 font-sans text-slate-450 leading-relaxed uppercase tracking-wider font-bold">
              <div>
                <p className="text-slate-600">Người lập phiếu (An)</p>
                <p className="text-[8px] italic mt-12 lowercase text-slate-400 font-medium font-serif">(Ký, ghi rõ họ tên)</p>
              </div>
              <div>
                <p className="text-slate-600">Người nhận hàng</p>
                <p className="text-[8px] italic mt-12 lowercase text-slate-400 font-medium font-serif">(Ký, ghi rõ họ tên)</p>
              </div>
            </div>

            {/* Footer Slogan */}
            <div className="text-center text-[9px] text-slate-400 font-sans font-semibold pt-4 border-t border-slate-100 uppercase tracking-widest leading-6">
              ~ ĐỒNG THÀNH PHÁT TRIỂN - CHÚC QUÝ KHÁCH HÀNG THUẬN BUỒM XUÔI GIÓ ~
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
