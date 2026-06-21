import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Download, X, Camera, CheckCircle, FileText, User, Calendar, Receipt, DollarSign, Sparkles, Plus, Share2, AlertCircle, Copy } from 'lucide-react';
import { Bill, Customer, PaymentRecord } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import { safeHtml2Canvas } from '../utils/safeHtml2Canvas';
import { convertCanvasToPngBlob, shareImageFile } from '../utils/imageUtils';

const dataURLtoBlob = (dataurl: string) => {
  try {
    const parts = dataurl.split(';base64,');
    if (parts.length < 2) return null;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error("dataURLtoBlob conversion failed", e);
    return null;
  }
};

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
  const [exportedImgUrl, setExportedImgUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied-img' | 'copied-text' | 'downloaded' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadImage = () => {
    if (!exportedImgUrl) return;
    try {
      const isWebView = /FBAN|FBAV|Zalo|Instagram/i.test(navigator.userAgent || '');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;
      const isAndroid = /Android/i.test(navigator.userAgent || '');

      if (isWebView || isIOS || isAndroid) {
        alert(
          "👉 Trên điện thoại di động (hoặc WebView Zalo/Facebook), trình duyệt không hỗ trợ tải tệp tự động.\n\n" +
          "💡 Giải pháp: Vui lòng NHẤN GIỮ (long-press) vào hình ảnh hóa đơn hiển thị ở phía dưới, rồi chọn 'Lưu hình ảnh' hoặc 'Lưu vào Album' nhé!"
        );
        return;
      }

      const link = document.createElement('a');
      link.href = exportedImgUrl;
      const pName = customer.name.replace(/\s+/g, "_");
      link.download = `HOA_DON_${bill.billNumber}_${pName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopyStatus('downloaded');
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch (err) {
      console.warn("Failed to download image", err);
      alert(
        "👉 Trình duyệt chặn tải trực tiếp.\n\n" +
        "💡 Giải pháp: Bạn hãy NHẤN GIỮ (long-press) vào hình ảnh hóa đơn ở bên dưới khoảng 2 giây, rồi chọn 'Lưu hình ảnh' để tải về nhé!"
      );
    }
  };

  const handleCopyImageToClipboard = async () => {
    if (!exportedImgUrl) return;
    try {
      let blob = exportedBlob;
      if (!blob) {
        if (exportedImgUrl.startsWith('blob:')) {
          const response = await fetch(exportedImgUrl);
          blob = await response.blob();
        } else {
          blob = dataURLtoBlob(exportedImgUrl);
        }
      }
      if (!blob) throw new Error("Chuyển đổi ảnh thất bại");
      
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        setCopyStatus('copied-img');
        setTimeout(() => setCopyStatus('idle'), 3000);
      } else {
        throw new Error("Trình duyệt không hỗ trợ ClipboardItem");
      }
    } catch (err) {
      console.warn("Failed to copy image to clipboard", err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const handleCopyTextToClipboard = async () => {
    try {
      const text = `SỔ SÁCH XƯỞNG AN - HOÁ ĐƠN BÁN HÀNG\n` +
                   `Đại lý: ${customer.name}\n` +
                   `Mã đơn: ${bill.billNumber || "HD-0000"}\n` +
                   `Ngày lập: ${bill.date}\n` +
                   `--------------------------------\n` +
                   `1. Nợ cũ dồn lại gối đầu: ${bill.previousDebt.toLocaleString()}đ\n` +
                   `2. Tổng cộng cộng tiền hàng lô mới: ${bill.subtotal.toLocaleString()}đ\n` +
                   (bill.paymentAmount > 0 ? `3. Khách đã thanh toán trực tiếp: -${bill.paymentAmount.toLocaleString()}đ\n` : '') +
                   `--------------------------------\n` +
                   `Tổng nợ: ${bill.grandTotal.toLocaleString()}đ\n` +
                   `--------------------------------\n` +
                   `🍀 Kính chúc Đại Lý buôn may bán đắt, thuận buồm xuôi gió!`;
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied-text');
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch (err) {
      console.warn("Failed to copy text", err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  const handleNativeShare = async () => {
    if (!exportedImgUrl) return;
    try {
      let b = exportedBlob;
      if (!b) {
        if (exportedImgUrl.startsWith('blob:')) {
          const res = await fetch(exportedImgUrl);
          b = await res.blob();
        } else {
          b = dataURLtoBlob(exportedImgUrl);
        }
      }
      if (!b) throw new Error("Chuyển đổi ảnh thất bại");
      const pName = customer.name.replace(/\s+/g, "_");
      
      const shared = await shareImageFile(
        b,
        `HOA_DON_${bill.billNumber}_${pName}.png`,
        "", // Không gửi title để tránh Zalo/Facebook tự chèn chú thích tiêu đề
        ""  // Không gửi text chú thích theo yêu cầu của khách hàng
      );
      if (!shared) {
        // Fallback: Copy to clipboard of the image
        handleCopyImageToClipboard();
      }
    } catch (err) {
      console.error("Lỗi chia sẻ:", err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3550);
    }
  };

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
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const canvasObj = await safeHtml2Canvas(detailInvoicePaperRef.current, {
        scale: 1.5, // 1.5x resolution is incredibly crisp while processing almost instantly
        useCORS: true,
        backgroundColor: '#ffffff',
        fixedLayoutWidth: 580,
      });
      
      const pngBlob = await convertCanvasToPngBlob(canvasObj);
      const base64Url = canvasObj.toDataURL('image/png');
      
      // Clean up previous blob URL if any
      if (exportedImgUrl && exportedImgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(exportedImgUrl);
      }
      
      setExportedBlob(pngBlob);
      setExportedImgUrl(base64Url); // Use Base64 data URL to ensure flawless long-press save in Zalo webviews

      // Trigger standard background download if possible (mostly on desktop browsers)
      const isWebView = /FBAN|FBAV|Zalo|Instagram/i.test(navigator.userAgent || '');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;
      const isAndroid = /Android/i.test(navigator.userAgent || '');

      if (!isWebView && !isIOS && !isAndroid) {
        try {
          const link = document.createElement("a");
          link.download = `HOA_DON_${bill.billNumber}_${customer.name.toUpperCase().replace(/\s+/g, "_")}.png`;
          link.href = base64Url;
          link.click();
        } catch (downloadErr) {
          console.warn("Direct link download blocked or failed, which is normal on mobile inside app containers", downloadErr);
        }
      }
      
      // Immediately open the high-fidelity Export Success Overlay
      // Here users can tap "Chia sẻ qua ứng dụng" (fresh synchronous user layout gesture)
      setShowExportSuccessModal(true);
    } catch (e: any) {
      console.error("Export past invoice failed", e);
      setErrorMessage(e?.message || "Có lỗi kỹ thuật khi trích xuất hình ảnh. Vui lòng thử lại hoặc chụp ảnh màn hình.");
      setTimeout(() => setErrorMessage(null), 7000);
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
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-6 mx-auto select-none"
      >
        {/* Scrollable Receipt Body Container (Includes proper top margin to safeguard iOS safe-area/notches) */}
        <div className="border border-slate-200/50 dark:border-slate-800 p-1 bg-slate-50 dark:bg-[#090e0b] rounded-3xl shadow-2xl overflow-hidden max-h-[82vh] overflow-y-auto mt-2">
          
          {/* Printable Invoice Paper Block */}
          <div
            ref={detailInvoicePaperRef}
            id="home_card_hoa_don"
            style={{ aspectRatio: '1 / 1.414' }}
            className="bg-white text-slate-900 p-6 sm:p-8 w-full border border-slate-100 flex flex-col space-y-6 rounded-2xl relative"
          >
            {/* Top design header */}
            <div className="relative border-b-2 border-dashed border-slate-200 pb-5 text-center flex flex-col items-center">
              {/* Confirmed stamp badge */}
              <div className="absolute top-0 right-0 border-2 border-indigo-600/80 text-indigo-700 text-[8px] sm:text-[9px] font-black uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-lg rotate-12 bg-indigo-50/10 shadow-sm">
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
              
              {/* Integrated cleanly without space-consuming card display to respect layout demands */}
              <p className="text-[11px] text-slate-600 font-mono mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
                <span>MÃ ĐƠN: <strong className="text-indigo-650 font-black tracking-wide text-xs bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md select-all">{bill.billNumber || "HD-0000"}</strong></span>
                <span className="text-slate-350">•</span>
                <span>NGÀY LẬP: <strong className="text-slate-750 font-bold">{bill.date}</strong></span>
              </p>
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

            {/* Invoice itemized listing ledger table - Built with pure CSS Grid for absolute pixel alignment and layout preservation */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs text-[11px] select-text">
              {/* Grid Header */}
              <div 
                style={{ display: 'grid', gridTemplateColumns: '10% 50% 10% 15% 15%' }}
                className="bg-slate-50 text-indigo-950 font-extrabold border-b border-slate-200 text-[10px] uppercase tracking-wider text-left items-stretch"
              >
                <div className="p-2.5 border-r border-slate-200 text-center font-mono h-full flex items-center justify-center">STT</div>
                <div className="p-2.5 border-r border-slate-200 text-left h-full flex items-center pl-3">Phân Phối / Mẫu Mã</div>
                <div className="p-2.5 border-r border-slate-200 text-center h-full flex items-center justify-center">SL</div>
                <div className="p-2.5 border-r border-slate-200 text-right h-full flex items-center justify-end pr-3">Đơn Giá</div>
                <div className="p-2.5 text-right h-full flex items-center justify-end pr-3">Thành Tiền</div>
              </div>
              
              {/* Grid Body */}
              <div className="divide-y divide-slate-150 text-slate-700">
                {bill.items.map((item, i) => (
                  <div 
                    key={item.id} 
                    style={{ display: 'grid', gridTemplateColumns: '10% 50% 10% 15% 15%' }}
                    className="even:bg-slate-50/20 odd:bg-white text-slate-800 items-stretch text-left border-b border-slate-150 last:border-b-0 min-h-[38px]"
                  >
                    <div className="p-2.5 border-r border-slate-200 font-mono text-center text-slate-400 font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="p-2.5 border-r border-slate-200 font-sans font-bold text-slate-850 text-left flex items-center min-w-0 py-1.5 pl-3">
                      <div className="break-words leading-normal whitespace-normal block w-full py-0.5">
                        {item.mẫuMã}
                      </div>
                    </div>
                    <div className="p-2.5 border-r border-slate-200 font-mono text-center font-bold text-indigo-650 flex items-center justify-center">
                      {item.sốLượng.toLocaleString()}
                    </div>
                    <div className="p-2.5 border-r border-slate-200 font-mono text-right text-slate-550 flex items-center justify-end pr-3">
                      {item.đơnGiá.toLocaleString()}
                    </div>
                    <div className="p-2.5 font-mono text-right font-black text-slate-900 flex items-center justify-end pr-3">
                      {item.thànhTiền.toLocaleString()}đ
                    </div>
                  </div>
                ))}
              </div>
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
                <p className="text-slate-550 text-[9.5px]">Khách hàng đại lý</p>
                <p className="text-[7.5px] italic mt-12 lowercase text-slate-400 font-medium font-serif select-none">(Ký tên và ghi rõ họ)</p>
              </div>
            </div>

            {/* Sincere Slogan Footer */}
            <div className="text-center text-[9px] text-slate-400 font-sans font-bold pt-4 border-t border-slate-100 uppercase tracking-widest select-none leading-none">
              ~ ĐỒNG TÂM PHÁT TRIỂN • THUẬN BUỒM XUÔI GIÓ ~
            </div>
          </div>
        </div>

        {/* Handy Bottom Action Deck (Excluded from captured image) */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold p-3 rounded-2xl text-center shadow-md animate-pulse">
            ⚠️ {errorMessage}
          </div>
        )}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-2 gap-2 shadow-xl shrink-0">
          <button
            type="button"
            onClick={handleCapturePastInvoice}
            disabled={isExportingModalImage}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 border border-emerald-500/15"
          >
            <Share2 className="w-4 h-4" />
            <span>{isExportingModalImage ? "Đang xuất..." : "Chia Sẻ Hóa Đơn"}</span>
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

      {/* Modern instructions overlay popup for iPhone/in-app Zalo browsers to save and share */}
      {showExportSuccessModal && exportedImgUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => setShowExportSuccessModal(false)} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative bg-white text-slate-800 border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full text-center space-y-4 z-10 shadow-2xl overflow-y-auto max-h-[92vh]"
          >
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 animate-bounce" />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-900 text-base uppercase tracking-wide">Đã Tạo Hóa Đơn Xong!</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                Cách tốt nhất để gửi hóa đơn này qua Zalo:
              </p>
            </div>

            {/* Quick Actions Dashboard */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex flex-col items-center justify-center gap-1.5 p-2 sm:p-3 bg-amber-50 hover:bg-amber-100/80 active:scale-95 text-amber-800 font-extrabold rounded-2xl transition border border-amber-150 hover:border-amber-200 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                <span>Tải Hóa Đơn</span>
              </button>

              <button
                type="button"
                onClick={handleCopyImageToClipboard}
                className="flex flex-col items-center justify-center gap-1.5 p-2 sm:p-3 bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 text-emerald-800 font-extrabold rounded-2xl transition border border-emerald-150 hover:border-emerald-200 shadow-sm cursor-pointer"
              >
                <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                <span>Sao Chép Ảnh</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTextToClipboard}
                className="flex flex-col items-center justify-center gap-1.5 p-2 sm:p-3 bg-indigo-50 hover:bg-indigo-100/80 active:scale-95 text-indigo-800 font-extrabold rounded-2xl transition border border-indigo-150 hover:border-indigo-200 shadow-sm cursor-pointer"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                <span>Sao Chép Chữ</span>
              </button>
            </div>

            {/* Notification alert states with smooth transition indicators */}
            {copyStatus !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                className={`text-[11px] font-bold p-2.5 rounded-xl border ${
                  copyStatus === 'downloaded' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  copyStatus === 'copied-img' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  copyStatus === 'copied-text' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                  'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {copyStatus === 'downloaded' && "✓ Đã tải ảnh hóa đơn về máy thành công!"}
                {copyStatus === 'copied-img' && "✓ Đã copy ảnh! Hãy mở cuộc trò chuyện Zalo và nhấn 'Dán' (Paste) để gửi ngay."}
                {copyStatus === 'copied-text' && "✓ Đã copy nội dung chữ chi tiết hóa đơn! Hãy mở Zalo và dán."}
                {copyStatus === 'error' && "⚠️ Trình duyệt/Thiết bị của bạn chặn thao tác nhanh. Vui lòng làm theo hướng dẫn bên dưới."}
              </motion.div>
            )}

            {/* Sincere Instruction Banner */}
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 text-[10.5px] leading-relaxed text-left font-sans">
              💡 <strong>Lưu ý tiện lợi:</strong> Nhấn giữ vào hình ảnh hóa đơn bên dưới khoảng 2 giây, rồi chọn <strong>"Gửi qua Zalo"</strong> hoặc <strong>"Lưu vào máy"</strong> để gửi nhanh chóng!
            </div>

            <div 
              className="border border-slate-200 rounded-xl overflow-y-auto max-h-[320px] bg-slate-50 p-2 pointer-events-auto select-text"
              style={{ userSelect: 'auto', WebkitUserSelect: 'auto' }}
            >
              <img 
                src={exportedImgUrl} 
                alt="Hóa đơn Xưởng An" 
                className="w-full h-auto rounded-lg mx-auto border border-slate-300 pointer-events-auto select-text cursor-pointer"
                style={{ userSelect: 'auto', WebkitUserSelect: 'auto', pointerEvents: 'auto' }}
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 border border-indigo-550/20"
              >
                <Share2 className="w-4 h-4" />
                <span>Chia sẻ qua ứng dụng</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExportSuccessModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
