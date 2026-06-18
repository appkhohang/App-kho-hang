/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CURRENT_VERSION, AppUpdateInfo } from '../types';

/**
 * Checks for available application updates by fetching telemetry metadata.
 * Uses localStorage to support configurable update URL with absolute fallbacks.
 * Runs completely silently and fails gracefully if offline.
 */
export async function checkAppUpdate(customUrl?: string): Promise<AppUpdateInfo | null> {
  const defaultUrl = 'https://app-kho-an.web.app/version.json';
  const targetUrl = customUrl || localStorage.getItem('xuongan_update_url') || defaultUrl;

  try {
    // We add a random query parameter or cache bypass headers to ensure real-time results
    const response = await fetch(`${targetUrl}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json() as AppUpdateInfo;
    
    // Ensure accurate fields exist before proceeding
    if (data && typeof data.version === 'string' && Array.isArray(data.changelog)) {
      const activeVer = localStorage.getItem('capgo_active_version') || CURRENT_VERSION;
      if (isNewerVersion(data.version, activeVer)) {
        return data;
      }
    }
  } catch (error) {
    console.warn('[Update Checker] Could not perform update lookup. Reason:', error);
  }
  return null;
}

/**
 * Robust semantic version comparison.
 * Compares two dot-separated version strings (e.g. "1.10.2" > "1.2.9").
 * Returns true if remoteVersion is strictly greater than localVersion.
 */
export function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  const clean = (v: string) => v.replace(/[^0-9.]/g, '');
  const rParts = clean(remoteVersion).split('.').map(Number);
  const lParts = clean(localVersion).split('.').map(Number);
  
  const maxLength = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < maxLength; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}
