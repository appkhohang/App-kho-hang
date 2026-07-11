import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, X, Camera, CheckCircle, FileText, User, Calendar, Receipt, DollarSign, Sparkles, Plus, Share2, AlertCircle, Copy } from 'lucide-react';
import { Bill, Customer, PaymentRecord } from '../types';
import { formatVietnameseDate } from '../utils/dateUtils';
import { safeHtml2Canvas } from '../utils/safeHtml2Canvas';
import { convertCanvasToPngBlob, shareImageFile, downloadImageNative } from '../utils/imageUtils';
import { Capacitor } from '@capacitor/core';

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
  const [blobObjectUrl, setBlobObjectUrl] = useState<string>('');

  useEffect(() => {
    if (!exportedBlob) {
      setBlobObjectUrl('');
      return;
    }
    try {
      const url = URL.createObjectURL(exportedBlob);
      setBlobObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.warn("Lỗi khi tạo URL tạm thời cho tệp ảnh:", err);
    }
  }, [exportedBlob]);

  const handleAutoDownloadInvoice = async () => {
    let currentUrl = exportedImgUrl;
    let currentBlob = exportedBlob;
    
    // If not captured yet, capture it inline on the fly!
    if (!currentUrl) {
      if (!detailInvoicePaperRef.current) return;
      setIsExportingModalImage(true);
      setErrorMessage(null);
      await new Promise((resolve) => setTimeout(resolve, 80));
      try {
        const canvasObj = await safeHtml2Canvas(detailInvoicePaperRef.current, {
          scale: 1.8, // Super crisp high resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          fixedLayoutWidth: 580,
        });
        
        const pngBlob = await convertCanvasToPngBlob(canvasObj);
        const base64Url = canvasObj.toDataURL('image/png');
        
        setExportedBlob(pngBlob);
        setExportedImgUrl(base64Url);
        currentUrl = base64Url;
        currentBlob = pngBlob;
      } catch (captureErr: any) {
        console.error("Direct high-res capturing failed", captureErr);
        setErrorMessage("Lỗi chuẩn bị hình ảnh: " + (captureErr?.message || ""));
        setTimeout(() => setErrorMessage(null), 5000);
        setIsExportingModalImage(false);
        return;
      } finally {
        setIsExportingModalImage(false);
      }
    }

    if (!currentUrl) return;

    try {
      const pName = customer.name.replace(/\s+/g, "_");
      const fileName = `HOA_DON_${bill.billNumber}_${pName}.png`;

      // 1. Android APK & iOS Native via Capacitor Filesystem
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
          await downloadImageNative(currentUrl, fileName);
          setCopyStatus('downloaded');
          setTimeout(() => setCopyStatus('idle'), 5000);
          return;
        } catch (nativeErr: any) {
          console.warn("Native file saving error, falling back to Share UI", nativeErr);
          setErrorMessage("Không thể lưu ảnh trực tiếp. Đã mở bảng chia sẻ để bạn sao chép.");
          setTimeout(() => setErrorMessage(null), 5000);
        }
      }

      // 2. Mobile web view browser context
      const isWebView = /FBAN|FBAV|Zalo|Instagram/i.test(navigator.userAgent || '');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;
      const isAndroid = /Android/i.test(navigator.userAgent || '');

      if (isWebView || isIOS || isAndroid) {
        // Show success modal to enable long-press saving with explicit visual highlight!
        setShowExportSuccessModal(true);
        return;
      }

      // 3. Desktop browser context: Trigger standard file download automatically
      try {
        const link = document.createElement('a');
        link.href = currentUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setCopyStatus('downloaded');
        setTimeout(() => setCopyStatus('idle'), 4000);
      } catch (err) {
        console.warn("Desktop link click download failed", err);
        setShowExportSuccessModal(true);
      }
    } catch (err: any) {
      console.warn("Failed directly downloading document", err);
      setErrorMessage("Không thể tải xuống trực tiếp: " + (err?.message || ""));
      setTimeout(() => setErrorMessage(null), 5000);
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
      setShowExportSuccessModal(true); // Always open the dedicated download/long-press popup for absolute APK confidence!

      const pName = customer.name.replace(/\s+/g, "_");
      const fileName = `HOA_DON_${bill.billNumber}_${pName}.png`;

      // Trigger automatic save/download directly on desktop only, otherwise rely on the beautiful success popup
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
          await downloadImageNative(base64Url, fileName);
          setCopyStatus('downloaded');
          setTimeout(() => setCopyStatus('idle'), 4000);
        } catch (nativeErr) {
          console.warn("Auto native saving failed during capture", nativeErr);
        }
      } else {
        const isWebView = /FBAN|FBAV|Zalo|Instagram/i.test(navigator.userAgent || '');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;
        const isAndroid = /Android/i.test(navigator.userAgent || '');

        if (!isWebView && !isIOS && !isAndroid) {
          // Desktop browsers: Direct standard anchor click download is robust
          try {
            const link = document.createElement("a");
            link.download = fileName;
            link.href = base64Url;
            link.click();
            setCopyStatus('downloaded');
            setTimeout(() => setCopyStatus('idle'), 4000);
          } catch (downloadErr) {
            console.warn("Desktop link download blocked", downloadErr);
          }
        }
      }
    } catch (e: any) {
      console.error("Export past invoice failed", e);
      setErrorMessage(e?.message || "Có lỗi kỹ thuật khi trích xuất hình ảnh. Vui lòng thử lại hoặc chụp ảnh màn hình.");
      setTimeout(() => setErrorMessage(null), 7000);
    } finally {
      setIsExportingModalImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-lg z-10 flex flex-col gap-3 my-0 sm:my-6 mx-auto select-none"
      >
        {/* Floating Close Button in a reachable position on mobile and desktop */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:-top-1 sm:-right-1 z-35 w-8 h-8 rounded-full bg-slate-900/90 text-white border border-slate-700/80 flex items-center justify-center hover:bg-slate-800 transition active:scale-90 cursor-pointer shadow-md"
        >
          <X className="w-4 h-4 text-rose-400" />
        </button>
        {/* Scrollable Receipt Body Container (No borders/padding on mobile to fit screen edge-to-edge) */}
        <div className="border-0 sm:border border-slate-200/50 dark:border-slate-800 p-0 sm:p-1 bg-slate-50 dark:bg-[#090e0b] rounded-none sm:rounded-3xl shadow-2xl overflow-hidden max-h-screen sm:max-h-[82vh] overflow-y-auto mt-0 sm:mt-2">
          
          {/* Printable Invoice Paper Block - aspect ratio removed for standard dynamic vertical flow on mobile screens */}
          <div
            ref={detailInvoicePaperRef}
            id="home_card_hoa_don"
            className="bg-white text-slate-900 p-4 sm:p-8 w-full border-0 sm:border border-slate-100 flex flex-col space-y-6 rounded-none sm:rounded-2xl relative"
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

            {/* Invoice itemized listing ledger table - Built with standard HTML Table for absolute pixel alignment and perfect layout preservation in html2canvas */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs text-[11px] select-text bg-white">
              <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
                {/* Table Header */}
                <thead>
                  <tr className="bg-slate-50 text-indigo-950 font-extrabold border-b border-slate-200 text-[10px] uppercase tracking-wider text-left">
                    <th className="py-2 px-1 border-r border-slate-200 text-center font-mono font-extrabold align-middle">STT</th>
                    <th className="py-2 pl-2.5 pr-1.5 border-r border-slate-200 text-left font-sans font-extrabold align-middle">Phân Phối / Mẫu Mã</th>
                    <th className="py-2 px-1 border-r border-slate-200 text-center font-sans font-extrabold align-middle">SL</th>
                    <th className="py-2 pl-1.5 pr-2.5 border-r border-slate-200 text-right font-sans font-extrabold align-middle">Đơn Giá</th>
                    <th className="py-2 pl-1.5 pr-2.5 text-right font-sans font-extrabold align-middle">Thành Tiền</th>
                  </tr>
                </thead>
                
                {/* Table Body */}
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {bill.items.map((item, i) => (
                    <tr 
                      key={item.id} 
                      className="even:bg-slate-50/20 odd:bg-white text-slate-800 text-left border-b border-slate-150 last:border-b-0 min-h-[38px] align-middle"
                    >
                      <td className="py-2 px-1 border-r border-slate-200 font-mono text-center text-slate-400 font-bold whitespace-nowrap align-middle">
                        {i + 1}
                      </td>
                      <td className="py-2 pl-2.5 pr-1.5 border-r border-slate-200 font-sans font-bold text-slate-850 text-left py-1.5 align-middle">
                        <div className="break-words leading-normal whitespace-normal block w-full py-0.5">
                          {item.mẫuMã}
                        </div>
                      </td>
                      <td className="py-2 px-1 border-r border-slate-200 font-mono text-center font-bold text-indigo-650 whitespace-nowrap align-middle">
                        {item.sốLượng.toLocaleString()}
                      </td>
                      <td className="py-2 pl-1.5 pr-2.5 border-r border-slate-200 font-mono text-right text-slate-550 whitespace-nowrap align-middle">
                        {item.đơnGiá.toLocaleString()}
                      </td>
                      <td className="py-2 pl-1.5 pr-2.5 font-mono text-right font-black text-slate-900 whitespace-nowrap align-middle">
                        <span className="whitespace-nowrap flex-shrink-0">{item.thànhTiền.toLocaleString()}đ</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
 
            {/* Summary calculations area */}
            <div className="w-full sm:w-11/12 ml-auto space-y-2.5 text-xs border-t border-slate-150 pt-4 text-slate-700">
              <div className="flex justify-between items-center text-[11px] gap-2">
                <span className="text-slate-450 font-semibold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 animate-pulse-none">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>1. Nợ cũ dồn lại gối đầu:</span>
                </span>
                <span className="font-extrabold font-mono text-slate-650 bg-slate-50 px-2.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 text-right min-w-[100px] sm:min-w-[120px]">
                  {bill.previousDebt.toLocaleString()}đ
                </span>
              </div>
              
              <div className="flex justify-between items-center text-[11px] text-slate-850 gap-2">
                <span className="font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1 flex-shrink-0">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>2. Tổng cộng tiền hàng lô mới:</span>
                </span>
                <span className="font-black font-mono text-slate-900 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100/50 whitespace-nowrap flex-shrink-0 text-right min-w-[100px] sm:min-w-[120px]">
                  {bill.subtotal.toLocaleString()}đ
                </span>
              </div>
 
              {(bill.hasPaid || bill.paymentAmount > 0) && (
                <>
                  <div className="flex justify-between items-center text-[11px] sm:text-[11.5px] text-emerald-650 gap-2">
                    <span className="font-extrabold uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      <span>3. Khách thanh toán:</span>
                    </span>
                    <span className="font-black font-mono bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-100 whitespace-nowrap flex-shrink-0 text-right min-w-[100px] sm:min-w-[120px]">
                      -{bill.paymentAmount.toLocaleString()}đ
                    </span>
                  </div>
 
                  {/* Other payments belonging to the cycle */}
                  {cyclePayments && cyclePayments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-emerald-650 text-[10.5px] gap-2">
                      <span className="italic pl-4 text-slate-450 font-medium truncate max-w-[160px] sm:max-w-[200px] flex-shrink-0">
                        ↳ Đã nhận ({p.date} - {p.note || "Gối nợ sỉ"}):
                      </span>
                      <span className="font-bold font-mono bg-emerald-50/50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100/30 whitespace-nowrap flex-shrink-0 text-right min-w-[100px] sm:min-w-[120px]">
                        -{p.amount.toLocaleString()}đ
                      </span>
                    </div>
                  ))}
                </>
              )}
 
              {/* Grand Total Debt Display with specified requirements */}
              <div id="invoice-amount-container" className="flex justify-between items-center border-t-2 border-dashed border-slate-200 pt-3.5 text-[11px] sm:text-[13px] font-black text-rose-600 gap-1.5 w-full font-sans" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span className="uppercase tracking-wide text-slate-700 flex items-center gap-1 flex-shrink-0 animate-pulse-none" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <CheckCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{ (bill.hasPaid || bill.paymentAmount > 0) ? "4. TỔNG BILL CÒN NỢ:" : "3. TỔNG CỘNG TIỀN BILL:" }</span>
                </span>
                <span id="total-amount-display" className="font-extrabold font-mono text-rose-700 bg-rose-50 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl border border-rose-100/70 text-sm sm:text-base md:text-lg whitespace-nowrap flex-shrink-0 min-w-[100px] sm:min-w-[120px] text-right" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
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
        {copyStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs font-bold p-3 rounded-2xl text-center shadow-lg border ${
              copyStatus === 'downloaded' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              copyStatus === 'copied-img' ? 'bg-teal-50 text-teal-800 border-teal-200' :
              'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            {copyStatus === 'downloaded' && "✓ Đã lưu ảnh hóa đơn vào Bộ sưu tập điện thoại (thư mục Pictures) thành công!"}
            {copyStatus === 'copied-img' && "✓ Đã copy ảnh! Hãy mở Zalo và dán (Paste) để gửi ngay."}
            {copyStatus === 'copied-text' && "✓ Đã copy văn bản chi tiết hóa đơn!"}
          </motion.div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold p-3 rounded-2xl text-center shadow-md animate-pulse">
            ⚠️ {errorMessage}
          </div>
        )}

      </motion.div>

      {/* Modern overlay showing the captured invoice image with clear instruction for APK/Webview */}
      {showExportSuccessModal && exportedImgUrl && (
        <div className="fixed inset-0 z-56 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 transition-all overflow-y-auto">
          <div className="absolute inset-0" onClick={() => setShowExportSuccessModal(false)}></div>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-full max-w-sm text-center shadow-2xl z-10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto select-auto"
          >
            <button
              type="button"
              onClick={() => setShowExportSuccessModal(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-755 dark:text-slate-200 flex items-center justify-center transition active:scale-90 cursor-pointer shadow"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 mt-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/55 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Camera className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-105 uppercase tracking-tight mt-2">
                ĐÃ CHỤP ẢNH HOÁ ĐƠN! 📸
              </h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-extrabold px-2.5 py-2 block leading-relaxed bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-100/50">
                👉 XỬ LÝ LỖI WEBVIEW & APK:<br/>
                Bạn hãy <span className="underline decoration-wavy text-emerald-600 dark:text-emerald-400 font-black">ĐÈ GIỮ TRỰC TIẾP LÊN HÌNH ẢNH</span> bên dưới trong 2 giây rồi chọn <span className="font-black text-rose-700 dark:text-rose-350">"Lưu hình ảnh"</span>, hoặc bấm nút <span className="text-sky-600 dark:text-sky-450 font-black">Mở Ở TRANG MỚI</span> ngay ở dưới nhé!
              </p>
            </div>

            {/* Display the captured PNG actual Image so WebView can trigger native Save/Share on long press */}
            <div className="border-4 border-emerald-500/10 rounded-2xl overflow-hidden shadow-inner bg-slate-50 dark:bg-slate-950 p-1 flex justify-center items-center">
              <img
                src={exportedImgUrl}
                alt="Captured Invoice Image"
                className="w-full h-auto max-h-[38vh] object-contain rounded-xl pointer-events-auto cursor-pointer border border-slate-150 active:scale-[0.99] transition duration-200 select-auto"
                title="Đè giữ để lưu hoá đơn"
                style={{
                  touchAction: 'auto',
                  userSelect: 'auto',
                  WebkitUserSelect: 'auto',
                  WebkitTouchCallout: 'default',
                }}
              />
            </div>

            {/* Dynamic Action Controls */}
            <div className="flex flex-col gap-2">
              {/* Direct HTML download using native HTML5 download attribute */}
              <a
                href={blobObjectUrl || exportedImgUrl || '#'}
                download={`HOA_DON_${bill.billNumber}_${customer.name.replace(/\s+/g, "_")}.png`}
                onClick={() => {
                  setCopyStatus('downloaded');
                  setTimeout(() => setCopyStatus('idle'), 4000);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow active:scale-95 border border-emerald-500/25 text-center"
              >
                <Download className="w-4 h-4 animate-bounce" />
                <span>Bấm tải ảnh xuống (HTML)</span>
              </a>

              {/* Force Web open in a separate browser tab to bypass webview sandboxing entirely and make saving built-in */}
              <a
                href={blobObjectUrl || exportedImgUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow active:scale-95 border border-sky-400/25 text-center"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 animate-bounce" />
                <span>Mở ảnh rộng để tải về</span>
              </a>

              {/* Native web share button option */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow active:scale-95 border border-indigo-500/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Gửi nhanh Zalo / Apps khác</span>
              </button>

              <div className="grid grid-cols-2 gap-2 animate-none">
                <button
                  type="button"
                  onClick={handleCopyImageToClipboard}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200/50 dark:border-slate-800/50"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyTextToClipboard}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-205 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200/50 dark:border-slate-800/50"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Chữ</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowExportSuccessModal(false)}
                className="w-full py-2 mt-1 bg-slate-900 hover:bg-slate-950 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-350 dark:text-slate-300 font-bold text-xs rounded-xl transition active:scale-95 border border-slate-800"
              >
                Đóng bảng xem ảnh
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
