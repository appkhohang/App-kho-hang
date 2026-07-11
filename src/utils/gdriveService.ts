/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export interface GDriveAccount {
  id: string;
  email: string;
  folderId: string;
  folderName: string;
  isActive: boolean;
  isLocked: boolean;
  createdAt: number;
  // Storage Quota fields
  storageLimit?: number;         // Total bytes limit (e.g. 15 GB = 16106127360)
  storageUsage?: number;         // Total bytes used
  warningThresholdGb?: number;   // Threshold warning limit in GB
  stopUploadOnWarning?: boolean; // If true, block updates when threshold is exceeded
  lastQuotaUpdate?: number;      // Timestamp of last successful quota fetch
}

export interface GDriveStorageQuota {
  limit: number;
  usage: number;
  usageInDrive: number;
}

/**
 * Fetch storage quota from Google Drive
 */
export async function getGDriveStorageQuota(accessToken: string): Promise<GDriveStorageQuota> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể lấy thông tin dung lượng Google Drive');
  }
  
  const data = await res.json();
  return {
    limit: Number(data.storageQuota?.limit || 0),
    usage: Number(data.storageQuota?.usage || 0),
    usageInDrive: Number(data.storageQuota?.usageInDrive || 0),
  };
}

// In-memory cache for Google Drive access tokens, keyed by account email
const accessTokenCache: Record<string, string> = {};

export function cacheAccessToken(email: string, token: string) {
  accessTokenCache[email.toLowerCase().trim()] = token;
}

export function getCachedAccessToken(email: string): string | null {
  return accessTokenCache[email.toLowerCase().trim()] || null;
}

export function clearCachedAccessToken(email: string) {
  delete accessTokenCache[email.toLowerCase().trim()];
}

/**
 * Prompt user to authenticate with a specific Google account and return token + email
 */
export async function authenticateGDriveAccount(expectedEmail?: string): Promise<{ token: string; email: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.metadata');
  
  // Set custom parameter to prompt account selection so users can choose Account 2, Account 3, etc.
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (!credential?.accessToken) {
    throw new Error('Không thể lấy mã truy cập Google Drive từ Firebase Auth.');
  }

  const email = result.user.email?.toLowerCase().trim();
  if (!email) {
    throw new Error('Không thể xác định Email của tài khoản Google vừa đăng nhập.');
  }

  if (expectedEmail && email !== expectedEmail.toLowerCase().trim()) {
    throw new Error(`Tài khoản đăng nhập (${email}) không khớp với tài khoản được yêu cầu (${expectedEmail.toLowerCase().trim()}).`);
  }

  cacheAccessToken(email, credential.accessToken);
  return {
    token: credential.accessToken,
    email
  };
}

/**
 * Create a folder in Google Drive
 */
export async function createGDriveFolder(accessToken: string, folderName: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể tạo thư mục Google Drive');
  }
  
  const data = await res.json();
  return data.id;
}

/**
 * Make a Google Drive file publicly viewable so direct links work
 */
export async function makeFilePublic(accessToken: string, fileId: string): Promise<void> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    
    if (!res.ok) {
      console.warn('Failed to set Google Drive permissions:', await res.json().catch(() => ({})));
    }
  } catch (err) {
    console.warn('Error setting Google Drive permissions:', err);
  }
}

/**
 * Upload base64 image to Google Drive folder
 */
export async function uploadBase64ToGDrive(
  accessToken: string,
  base64Data: string,
  fileName: string,
  folderId: string
): Promise<{ fileId: string; viewUrl: string }> {
  const mimeMatch = base64Data.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  const base64Clean = base64Data.includes(';base64,') 
    ? base64Data.split(';base64,')[1] 
    : base64Data;
    
  const byteCharacters = atob(base64Clean);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const arrayBuffer = byteArray.buffer;
  
  const boundary = 'gdrive_upload_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;
  
  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: [folderId]
  };
  
  const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
  const mediaPartHeader = `\r\nContent-Type: ${mimeType}\r\n\r\n`;
  
  const blob = new Blob([
    delimiter,
    metadataPart,
    delimiter,
    mediaPartHeader,
    arrayBuffer,
    close_delim
  ], { type: `multipart/related; boundary=${boundary}` });
  
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: blob
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể tải tệp lên Google Drive');
  }
  
  const data = await res.json();
  const fileId = data.id;
  
  // Make public so anyone can view
  await makeFilePublic(accessToken, fileId);
  
  return {
    fileId,
    viewUrl: `https://lh3.googleusercontent.com/d/${fileId}`
  };
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFileFromGDrive(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    console.warn('Failed to delete file from Google Drive:', await res.json().catch(() => ({})));
  }
}
