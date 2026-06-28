/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { B2Config } from '../types';

/**
 * Convert base64 data URL to standard Blob
 */
export function base64ToBlob(base64Data: string, contentType: string = 'image/jpeg'): Blob {
  const sliceSize = 512;
  const base64Clean = base64Data.includes(';base64,') 
    ? base64Data.split(';base64,')[1] 
    : base64Data;
    
  const byteCharacters = atob(base64Clean);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

interface B2AuthResponse {
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

/**
 * Get API base URL depending on execution environment (Web vs Android APK)
 */
export function getApiBaseUrl(): string {
  const isCapacitor = typeof window !== 'undefined' && (
    (window as any).Capacitor || 
    window.location.protocol === 'capacitor:' ||
    // If it's localhost but NOT port 3000, it's likely a native webview container or mobile frame
    (window.location.hostname === 'localhost' && window.location.port !== '3000')
  );

  // For standard web environments (browsers), we should ALWAYS use relative paths so that it queries
  // the exact same server hosting the frontend. This avoids CORS, SSL, and stale URL issues entirely.
  if (!isCapacitor) {
    return '';
  }

  // Only if running inside Capacitor (Android/iOS native app), we check and return the configured absolute URL
  if (typeof window !== 'undefined') {
    const configuredUrl = localStorage.getItem('xuongan_api_server_url');
    if (configuredUrl) {
      return configuredUrl.trim().replace(/\/$/, '');
    }
  }

  // Fallback to the synced web origin of the production/deployed application from local settings
  const settingsStr = localStorage.getItem("xuongan_settings");
  if (settingsStr) {
    try {
      const parsed = JSON.parse(settingsStr);
      if (parsed && parsed.lastWebOrigin) {
        return parsed.lastWebOrigin.trim().replace(/\/$/, '');
      }
    } catch (e) {
      // ignore
    }
  }
  
  // Default fallback for APK connecting back to development workspace server
  return 'https://ais-dev-gnu3s25fcxu6b3imyaqf2k-718976700880.asia-southeast1.run.app';
}

/**
 * Service to manage files on Backblaze B2 using server-side CORS proxies
 */
export const B2Service = {
  /**
   * Authorize a B2 account via server proxy to bypass CORS
   */
  async authorize(config: B2Config): Promise<B2AuthResponse> {
    if (!config.applicationKeyId || !config.applicationKey) {
      throw new Error('Thiếu Application Key ID hoặc Application Key.');
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/media-sync/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicationKeyId: config.applicationKeyId,
          applicationKey: config.applicationKey
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi kết nối B2 (${res.status})`);
      }

      return await res.json();
    } catch (err: any) {
      console.error('B2 Auth Error:', err);
      throw err;
    }
  },

  /**
   * Get an upload URL for a specific bucket via server proxy to bypass CORS
   */
  async getUploadUrl(apiUrl: string, authToken: string, bucketId: string): Promise<B2UploadUrlResponse> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/media-sync/getUploadUrl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl,
          authorizationToken: authToken,
          bucketId
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi lấy Upload URL (${res.status})`);
      }

      return await res.json();
    } catch (err: any) {
      console.error('B2 Get Upload URL Error:', err);
      throw err;
    }
  },

  /**
   * Upload a base64 or blob file to Backblaze B2 via server proxy to bypass CORS
   */
  async uploadFile(
    config: B2Config,
    fileData: string | Blob,
    fileName: string,
    fileType: string = 'image/jpeg'
  ): Promise<{ fileId: string; fileUrl: string; filePath: string }> {
    // 1. Authorize
    const auth = await this.authorize(config);

    // 2. Get Upload URL
    const uploadInfo = await this.getUploadUrl(auth.apiUrl, auth.authorizationToken, config.bucketId);

    // 3. Prepare file data (convert to base64 string without data:image/jpeg;base64, prefix)
    let fileBase64 = '';
    if (typeof fileData === 'string') {
      fileBase64 = fileData.includes(';base64,') 
        ? fileData.split(';base64,')[1] 
        : fileData;
    } else {
      // Convert Blob to base64
      fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.includes(';base64,') ? result.split(';base64,')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileData);
      });
    }

    // Clean filename for safety (remove accents and special characters, spaces to underscores)
    const cleanFileName = fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Replace special chars and spaces with _

    // Place files inside a distinct folder layout, e.g. "model_samples/cleanFileName"
    const finalFilePath = `model_samples/${Date.now()}_${cleanFileName}`;

    // 4. Upload file using proxy
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/media-sync/uploadFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadUrl: uploadInfo.uploadUrl,
          authorizationToken: uploadInfo.authorizationToken,
          filePath: finalFilePath,
          fileType: fileType,
          fileBase64: fileBase64
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi tải ảnh lên B2 (${res.status})`);
      }

      const uploadData = await res.json();
      
      // Construct public download URL
      const fileUrl = `${auth.downloadUrl}/file/${config.bucketName}/${finalFilePath}`;

      return {
        fileId: uploadData.fileId,
        fileUrl: fileUrl,
        filePath: finalFilePath
      };
    } catch (err: any) {
      console.error('B2 Upload File Error:', err);
      throw err;
    }
  },

  /**
   * Delete a file from B2 bucket via server proxy to bypass CORS
   */
  async deleteFile(config: B2Config, fileId: string, filePath: string): Promise<void> {
    try {
      // 1. Authorize
      const auth = await this.authorize(config);

      // 2. Call delete file version API via proxy
      const res = await fetch(`${getApiBaseUrl()}/api/media-sync/deleteFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: auth.apiUrl,
          authorizationToken: auth.authorizationToken,
          fileId: fileId,
          fileName: filePath
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi xóa file trên B2 (${res.status})`);
      }
    } catch (err) {
      console.error('B2 Delete File error:', err);
      throw err;
    }
  },

  /**
   * Fetch total storage size and file count from B2 bucket via server proxy
   */
  async getBucketSize(config: B2Config): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const auth = await this.authorize(config);
      const res = await fetch(`${getApiBaseUrl()}/api/media-sync/getBucketSize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: auth.apiUrl,
          authorizationToken: auth.authorizationToken,
          bucketId: config.bucketId
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi lấy thông tin dung lượng (${res.status})`);
      }

      return await res.json();
    } catch (err: any) {
      console.error('B2 Get Bucket Size error:', err);
      throw err;
    }
  }
};
