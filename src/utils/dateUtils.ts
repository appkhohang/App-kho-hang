/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns the Vietnam week string format, e.g., "Tuần 22 (25/05 - 31/05)"
 */
export function getVietnameseWeekKey(dateStr: string): string {
  if (!dateStr) return "Tuần Không Xác Định";
  // Parse as local year/month/date to avoid UTC timezone shifts
  let d = new Date(dateStr);
  if (dateStr.includes('-') && dateStr.length === 10) {
    const parts = dateStr.split('-');
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  if (isNaN(d.getTime())) return "Tuần Không Xác Định";
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - day);
  
  // Get first day of year
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  // Calculate full weeks to Thursday
  const weekNo = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  // Find Monday and Sunday of this week
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const monStr = `${pad(monday.getDate())}/${pad(monday.getMonth() + 1)}`;
  const sunStr = `${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}`;
  
  return `Tuần ${weekNo} (${monStr} - ${sunStr})`;
}

/**
 * Formats a YYYY-MM-DD date to Vietnamese DD/MM/YYYY
 */
export function formatVietnameseDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Gets the current date string in YYYY-MM-DD format
 */
export function getCurrentDateStr(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Get current Vietnamese Month Name, e.g., "Tháng 05/2026"
 */
export function getVietnameseMonthKey(dateStr: string): string {
  if (!dateStr) return "Tháng Không Xác Định";
  let d = new Date(dateStr);
  if (dateStr.includes('-') && dateStr.length === 10) {
    const parts = dateStr.split('-');
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  if (isNaN(d.getTime())) return "Tháng Không Xác Định";
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `Tháng ${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
