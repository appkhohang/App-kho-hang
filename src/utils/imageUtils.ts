/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  try {
    // Ensure accurate filename extension representation
    const safeFilename = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')
      ? filename
      : `${filename}.jpg`;

    // Ensure the blob is tagged correct type
    const typedBlob = blob.type === 'image/png' || blob.type === 'image/jpeg'
      ? blob
      : new Blob([blob], { type: 'image/jpeg' });

    const file = new File([typedBlob], safeFilename, { type: typedBlob.type });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: title,
        text: text
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Native sharing error:", error);
    return false;
  }
}
