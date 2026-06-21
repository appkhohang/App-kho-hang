/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Convert a canvas to a crisp lossless PNG Blob
 */
export function convertCanvasToPngBlob(canvas: HTMLCanvasElement, maxWidth = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let finalCanvas = canvas;
    
    // If canvas is extremely wide or tall, downsample it slightly to avoid high GPU/render memory limits on Android
    if (canvas.width > maxWidth || canvas.height > maxWidth) {
      const scale = maxWidth / Math.max(canvas.width, canvas.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width * scale;
      tempCanvas.height = canvas.height * scale;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';
        tCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
        finalCanvas = tempCanvas;
      }
    }

    try {
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Không thể xuất Canvas sang Blob PNG."));
          }
        },
        "image/png"
      );
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Convert a canvas to a highly compressed but crisp JPEG Blob (saves up to 90% memory over PNG)
 */
export function compressCanvasToBlob(canvas: HTMLCanvasElement, quality = 0.75, maxWidth = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let finalCanvas = canvas;
    
    // If canvas is extremely wide or tall, downsample it to avoid high GPU/render memory limits on Android
    if (canvas.width > maxWidth || canvas.height > maxWidth) {
      const scale = maxWidth / Math.max(canvas.width, canvas.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width * scale;
      tempCanvas.height = canvas.height * scale;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';
        tCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
        finalCanvas = tempCanvas;
      }
    }

    try {
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Không thể nén Canvas thành Blob."));
          }
        },
        "image/jpeg",
        quality
      );
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Compress an existing DataURL/Base64 image to lower dimensions and quality.
 * Useful for compressing existing Gallery files.
 */
export function compressBase64Image(
  dataUrl: string,
  maxWidth = 900,
  maxHeight = 900,
  quality = 0.70
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;

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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Handles professional memory-safe native sharing using absolute Blob-to-File wrapper.
 * This completely avoids packing heavy base64 strings into matching share intents.
 */
export async function shareImageFile(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<boolean> {
  const isWebShareSupported = typeof navigator !== 'undefined' && !!navigator.share;
  
  if (!isWebShareSupported) {
    alert(
      "⚠️ Trình duyệt hoặc WebView ứng dụng (như Zalo/Facebook) hiện tại không hỗ trợ Web Share API.\n\n" +
      "👉 Giải pháp: Vui lòng nhấn vào nút 'Tải ảnh' hoặc chụp màn hình và tự gửi thủ công."
    );
    return false;
  }

  try {
    // Ensure accurate filename extension representation
    const safeFilename = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')
      ? filename
      : `${filename}.png`;

    // Ensure the blob has the correct mime-type
    const typedBlob = blob.type === 'image/png' || blob.type === 'image/jpeg'
      ? blob
      : new Blob([blob], { type: safeFilename.endsWith('.png') ? 'image/png' : 'image/jpeg' });

    const file = new File([typedBlob], safeFilename, { type: typedBlob.type });

    // Try detecting file share capability safely
    let canShareFiles = false;
    try {
      if (navigator.canShare) {
        canShareFiles = navigator.canShare({ files: [file] });
      }
    } catch (checkErr) {
      console.warn("Lỗi khi kiểm tra navigator.canShare:", checkErr);
    }

    if (!canShareFiles) {
      alert(
        "⚠️ Trình duyệt hoặc ứng dụng không cho phép chia sẻ trực tiếp tệp ảnh (MIME/File unsupported).\n\n" +
        "👉 Giải pháp: Vui lòng nhấn 'Tải ảnh' để lưu ảnh về thiết bị rồi gửi qua Zalo thủ công."
      );
      return false;
    }

    // Try executing the share call in a robust try-catch block
    try {
      const shareData: ShareData = {
        files: [file]
      };
      if (title && title.trim() !== "") {
        shareData.title = title;
      }
      if (text && text.trim() !== "") {
        shareData.text = text;
      }
      await navigator.share(shareData);
      return true;
    } catch (shareErr: any) {
      // AbortError is normal user cancellation, do not alert
      if (shareErr instanceof Error && shareErr.name === 'AbortError') {
        console.log("Người dùng đã huỷ thao tác chia sẻ.");
        return false;
      }
      
      console.error("Lỗi khi thực thi navigator.share:", shareErr);
      
      alert(
        `⚠️ Không thể chia sẻ trực tiếp hình ảnh do giới hạn ứng dụng hoặc bộ nhớ thiết bị quá tải.\n` +
        `Chi tiết lỗi: ${shareErr?.message || shareErr || 'Chờ phản hồi'}\n\n` +
        `👉 Khắc phục: Bạn vui lòng lưu/tải hình ảnh về máy trước và gửi thủ công.`
      );
      return false;
    }
  } catch (error: any) {
    console.error("Native sharing preparation error:", error);
    alert(
      `⚠️ Gặp sự cố không mong muốn khi chuẩn bị tệp ảnh để chia sẻ.\n` +
      `Chi tiết: ${error?.message || error || 'Lỗi xử lý file'}`
    );
    return false;
  }
}
