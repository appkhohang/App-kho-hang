/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Trash2, Upload, AlertCircle } from 'lucide-react';
import { LazyImage } from './LazyImage';

interface CameraCaptureProps {
  onCapture: (dataUrl: string | null) => void;
  initialValue?: string | null;
  resolvedTheme?: 'light' | 'dark';
}

// Helper function to scale down and compress image data URLs
function compressImageDataUrl(
  dataUrl: string, 
  maxWidth = 1000, 
  maxHeight = 1000, 
  quality = 0.75, 
  callback: (compressed: string) => void
) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    callback(dataUrl);
    return;
  }
  
  const img = new Image();
  img.onload = () => {
    let width = img.width;
    let height = img.height;

    // Scale down while maintaining aspect ratio if limits exceeded
    if (width > maxWidth || height > maxHeight) {
      if (width > height) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      } else {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      // Quality factor reduces output size significantly
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(compressedDataUrl);
    } else {
      callback(dataUrl);
    }
  };
  img.onerror = () => {
    callback(dataUrl);
  };
  img.src = dataUrl;
}

export default function CameraCapture({
  onCapture,
  initialValue = null,
  resolvedTheme = 'light'
}: CameraCaptureProps) {
  const isDark = resolvedTheme === 'dark';
  const [photo, setPhoto] = useState<string | null>(initialValue);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setPhoto(initialValue);
  }, [initialValue]);

  // Clean up streams when component unmounts or active state changes
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg(null);
    setIsCameraActive(true);
    setPhoto(null);

    try {
      if (streamRef.current) {
        stopCamera();
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera preferred for scanning goods/bills
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => {
          console.error("Video play failed:", e);
        });
      }
    } catch (err: any) {
      console.warn("navigator.mediaDevices.getUserMedia error:", err);
      setErrorMsg(
        "Không thể mở trực tiếp webcam (Có thể do chế độ bảo mật trình duyệt hoặc thiếu quyền camera). Vui lòng chuyển sang chọn file chụp ảnh hoặc chọn từ thư viện."
      );
      // Automatically trigger file chooser as fallback
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Match canvas dimensions to video aspect
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 jpeg
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        // Auto compress and downsize to save space in storage
        compressImageDataUrl(rawDataUrl, 840, 840, 0.72, (compressed) => {
          setPhoto(compressed);
          onCapture(compressed);
        });
        
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Auto compress high resolution camera uploads immediately
        compressImageDataUrl(result, 840, 840, 0.72, (compressed) => {
          setPhoto(compressed);
          onCapture(compressed);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    onCapture(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (libraryInputRef.current) {
      libraryInputRef.current.value = '';
    }
  };

  const triggerCameraSelect = () => {
    stopCamera();
    setErrorMsg(null);
    fileInputRef.current?.click();
  };

  const triggerLibrarySelect = () => {
    stopCamera();
    setErrorMsg(null);
    libraryInputRef.current?.click();
  };

  return (
    <div className="space-y-2 mt-1 select-none">
      <div className="flex items-center justify-between">
        <span className={`text-[9.5px] uppercase font-extrabold tracking-wide font-mono ${isDark ? 'text-[#657f76]' : 'text-slate-500'}`}>
          Hình ảnh đính kèm (Biên lai / Sản phẩm)
        </span>
        {photo && (
          <button
            type="button"
            onClick={clearPhoto}
            className="text-rose-500 hover:text-rose-600 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition border border-rose-500/10 px-1.5 py-0.5 rounded bg-rose-500/5 hover:bg-rose-500/10"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xoá ảnh</span>
          </button>
        )}
      </div>

      <div className={`relative border border-dashed rounded-xl overflow-hidden min-h-[120px] flex flex-col items-center justify-center transition-all ${isDark ? 'border-[#1c2d27] bg-[#111c18]/45' : 'border-slate-200 bg-slate-50/50'}`}>
        {/* Hidden Camera File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment" // Hint to mobile devices to open camera directly
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Hidden Library File Input */}
        <input
          type="file"
          ref={libraryInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Canvas for drawing capture snapshot */}
        <canvas ref={canvasRef} className="hidden" />

        {photo ? (
          /* Captured photo preview state */
          <div className="relative w-full aspect-[4/3] max-h-[220px] bg-slate-900 group">
            <LazyImage
              src={photo}
              alt="Hóa đơn / Đơn hàng chụp mẫu"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition duration-150 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={triggerLibrarySelect}
                className="px-3 py-1.5 bg-white text-slate-800 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-md active:scale-95 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Thư viện máy
              </button>
              <button
                type="button"
                onClick={triggerCameraSelect}
                className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer shadow-md active:scale-95 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Chụp ảnh mới
              </button>
            </div>
            {/* Tiny quick preview indicator */}
            <span className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-inner text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
              Hình ảnh đính kèm ✓
            </span>
          </div>
        ) : isCameraActive ? (
          /* Live webcam stream view */
          <div className="relative w-full aspect-[4/3] max-h-[220px] bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Overlay controller */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 px-2.5 bg-slate-800 text-white rounded-lg flex items-center gap-1 hover:bg-slate-700 transition cursor-pointer text-[10px] font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 border-2 border-white flex items-center justify-center cursor-pointer transition transform active:scale-90"
                title="Bấm chụp hình"
              >
                <span className="w-3 h-3 rounded-full bg-white block" />
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={triggerCameraSelect}
                  className="p-1 px-2.5 bg-orange-600 text-white rounded-lg flex items-center gap-1 hover:bg-orange-500 transition cursor-pointer text-[10px] font-semibold"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Máy ảnh
                </button>
                <button
                  type="button"
                  onClick={triggerLibrarySelect}
                  className="p-1 px-2.5 bg-indigo-650 text-white rounded-lg flex items-center gap-1 hover:bg-indigo-600 transition cursor-pointer text-[10px] font-semibold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Thư viện
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Default state (Prompt to action) */
          <div className="p-4 text-center space-y-3.5 flex flex-col items-center">
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button
                type="button"
                onClick={triggerLibrarySelect}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10.5px] font-bold transition active:scale-95 cursor-pointer border shadow-sm ${
                  isDark ? 'bg-indigo-950/40 border-indigo-900/40 text-indigo-400 hover:bg-indigo-900/20 shadow-indigo-950/20' : 'bg-indigo-50 text-indigo-700 border-indigo-150 hover:bg-indigo-100'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Thư viện máy</span>
              </button>

              <button
                type="button"
                onClick={triggerCameraSelect}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10.5px] font-bold transition active:scale-95 cursor-pointer border shadow-sm ${
                  isDark ? 'bg-amber-950/40 border-amber-900/40 text-amber-400 hover:bg-amber-900/20 shadow-amber-950/20' : 'bg-amber-50 text-amber-700 border-amber-150 hover:bg-amber-100'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Chụp ảnh mới</span>
              </button>

              <button
                type="button"
                onClick={startCamera}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10.5px] font-bold transition active:scale-95 cursor-pointer border shadow-sm ${
                  isDark ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25 hover:bg-[#10b981]/20 shadow-emerald-950/20' : 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Mở Webcam</span>
              </button>
            </div>
            <p className={`text-[9px] max-w-xs leading-relaxed ${isDark ? 'text-[#556b62]' : 'text-slate-450'}`}>
              Hỗ trợ đầy đủ: Tải ảnh từ thư viện thiết bị, chụp trực tiếp bằng Camera điện thoại hoặc mở Webcam máy tính
            </p>
          </div>
        )}

        {/* Graceful capture error details fallback */}
        {errorMsg && (
          <div className="p-2 border-t border-amber-500/10 bg-amber-500/5 text-[9px] text-amber-500 font-mono leading-relaxed flex gap-1.5 items-start">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-1">
              <span>{errorMsg}</span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={triggerLibrarySelect}
                  className="underline font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                >
                  👉 Chọn từ Thư viện
                </button>
                <button
                  type="button"
                  onClick={triggerCameraSelect}
                  className="underline font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500"
                >
                  📷 Chụp bằng Camera hệ thống
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
