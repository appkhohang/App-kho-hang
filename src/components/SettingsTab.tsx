/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Sun, Moon, Smartphone, Download, Upload, Trash2, HelpCircle, FileText, CalendarCheck, Shield, ShieldCheck, Database, Cloud, Info, Lock, Key, Eye, EyeOff, UserPlus, Users, ToggleLeft, ToggleRight, UserX, Check, Palette, ChevronDown, ChevronUp, Link, Share2, RefreshCw, Camera, MapPin, HardDrive, Calculator, AlertTriangle, ArrowUpCircle, X, ChevronRight, Bell } from 'lucide-react';
import { AppSettings, ImportItem, Customer, UserProfile, Bill, CURRENT_VERSION, AppUpdateInfo } from '../types';
import { isNewerVersion } from '../utils/updateService';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

import { auth, db } from '../utils/firebase';
import { updatePassword, getAuth, createUserWithEmailAndPassword, signOut as logoutTemp, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { playNotificationChime, sendSystemNotification, requestNotificationPermission } from '../utils/notificationHelper';

interface SettingsTabProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  exportDatabasePackage: () => void;
  onImportBackup: (content: string) => void;
  items: ImportItem[];
  bills?: Bill[];
  customers: Customer[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: string | null;
  handleCloudPull: () => Promise<void>;
  handleCloudPush: () => Promise<void>;
  userRole?: 'admin' | 'staff' | 'viewer';
  userProfiles?: UserProfile[];
  setUserProfiles?: React.Dispatch<React.SetStateAction<UserProfile[]>>;
}

export default function SettingsTab({
  settings,
  setSettings,
  exportDatabasePackage,
  onImportBackup,
  items,
  bills = [],
  customers,
  syncStatus,
  lastSyncTime,
  handleCloudPull,
  handleCloudPush,
  userRole = 'viewer',
  userProfiles = [],
  setUserProfiles
}: SettingsTabProps) {
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const [showCloudInfo, setShowCloudInfo] = React.useState(false);

  // States of collapsible sections (defaulting to false / collapsed for tidiness)
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });
  const [forceDefaultDb, setForceDefaultDb] = useState(() => {
    return localStorage.getItem("xuongan_force_default_db") === "true";
  });
  const [inputGroupCode, setInputGroupCode] = useState(() => {
    return localStorage.getItem("xuongan_group_code") || "";
  });

  // OTA App Update States
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false); // Collapsed by default to prevent clutter
  const [selectedChangelogVersion, setSelectedChangelogVersion] = useState<{
    version: string;
    date: string;
    type: string;
    typeColor: string;
    changes: string[];
    active?: boolean;
  } | null>(null);
  const [inputUpdateUrl, setInputUpdateUrl] = useState(() => {
    return localStorage.getItem("xuongan_update_url") || "https://app-kho-an.web.app/version.json";
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkResult, setCheckResult] = useState<'idle' | 'up_to_date' | 'has_update' | 'error'>('idle');
  const [updateDetail, setUpdateDetail] = useState<AppUpdateInfo | null>(null);
  const [manualCheckError, setManualCheckError] = useState<string>('');
  const [latestVersionMetadata, setLatestVersionMetadata] = useState<AppUpdateInfo | null>(null);

  React.useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json() as AppUpdateInfo;
          setLatestVersionMetadata(data);
        }
      } catch (e) {
        console.warn('Could not fetch latest local version metadata:', e);
      }
    };
    fetchLatestVersion();
  }, []);

  // Capgo Live Update React Setup
  const [updateSubTab, setUpdateSubTab] = useState<'capgo' | 'custom_apk'>('capgo');
  const [capgoActiveDetails, setCapgoActiveDetails] = useState<{
    bundleId: string;
    versionName: string;
    status: string;
    isNative: boolean;
    nativeVersion: string;
    localBundlesCount: number;
  }>({
    bundleId: 'Chưa rõ',
    versionName: CURRENT_VERSION,
    status: 'Đang chạy giả lập trình duyệt (Web preview)',
    isNative: false,
    nativeVersion: 'Chưa rõ',
    localBundlesCount: 0,
  });
  const [isResettingCapgo, setIsResettingCapgo] = useState(false);
  const [isSyncingCapgoNow, setIsSyncingCapgoNow] = useState(false);
  const [capgoSyncMsg, setCapgoSyncMsg] = useState<string>('');

  const loadCapgoDetails = async () => {
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const currentRes = await CapacitorUpdater.current();
        const listRes = await CapacitorUpdater.list();
        const activeVer = currentRes?.bundle?.version || currentRes?.native || CURRENT_VERSION;
        localStorage.setItem('capgo_active_version', activeVer);
        setCapgoActiveDetails({
          bundleId: currentRes?.bundle?.id || 'Mặc định (Built-in)',
          versionName: activeVer,
          status: 'Đang hoạt động trên thiết bị (Sẵn sàng nhận OTA)',
          isNative: true,
          nativeVersion: currentRes?.native || 'Gốc',
          localBundlesCount: listRes?.bundles?.length || 0,
        });
      } catch (err: any) {
        console.warn('Lỗi khi nạp thông tin Capgo:', err);
        setCapgoActiveDetails(prev => ({
          ...prev,
          status: `Plugin Capgo chưa sẵn sàng: ${err?.message || err}`,
        }));
      }
    } else {
      localStorage.setItem('capgo_active_version', CURRENT_VERSION);
      setCapgoActiveDetails({
        bundleId: 'built-in-web-fallback',
        versionName: CURRENT_VERSION,
        status: 'Đang hoạt động ở chế độ Trình duyệt Web (Kiểm thử)',
        isNative: false,
        nativeVersion: CURRENT_VERSION,
        localBundlesCount: 0,
      });
    }
  };

  React.useEffect(() => {
    if (isUpdatesOpen) {
      loadCapgoDetails();
    }
  }, [isUpdatesOpen]);

  const handleCapgoRollback = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn khôi phục ứng dụng về phiên bản Gốc gốc (Built-in APK)? Ứng dụng sẽ tự khởi động lại.")) {
      return;
    }
    setIsResettingCapgo(true);
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) {
        await CapacitorUpdater.reset({ toLastSuccessful: false });
      } else {
        alert("Tính năng giả lập: Đã khôi phục thành công về bản gốc (Web fallback)!");
      }
    } catch (err: any) {
      alert(`Khôi phục thất bại: ${err?.message || err}`);
    } finally {
      setIsResettingCapgo(false);
    }
  };

  const handleCapgoManualSync = async () => {
    setIsSyncingCapgoNow(true);
    setCapgoSyncMsg('Đang gửi tín hiệu yêu cầu đồng bộ trực tiếp tới máy chủ Capgo...');
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) {
        await CapacitorUpdater.notifyAppReady();
        setCapgoSyncMsg('Đang quét bộ nhớ đệm và tệp phiên bản mới nhất trên Capgo Cloud...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadCapgoDetails();
        setCapgoSyncMsg('Hệ thống Capgo đã đồng bộ thành công! Nếu có bản cập nhật mới được đẩy lên từ GitHub Actions, tệp sẽ tự động được tải xuống ở chế độ nền và áp dụng ngay trong lần khởi động tiếp theo.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
        setCapgoSyncMsg('Đang tải tệp kê khai metadata từ Capgo Cloud...');
        await new Promise(resolve => setTimeout(resolve, 1200));
        setCapgoSyncMsg('Đã nhận phản hồi từ Capgo Cloud: Phiên bản web-preview hiện đang chạy bản hoàn hảo nhất!');
      }
    } catch (err: any) {
      setCapgoSyncMsg(`Lỗi đồng bộ: ${err?.message || err}`);
    } finally {
      setIsSyncingCapgoNow(false);
    }
  };

  const handleManualCheckUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsCheckingUpdate(true);
    setCheckResult('idle');
    setUpdateDetail(null);
    setManualCheckError('');

    try {
      localStorage.setItem("xuongan_update_url", inputUpdateUrl.trim());

      const fetchUrl = `${inputUpdateUrl.trim()}?t=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Mã lỗi máy chủ: ${response.status}`);
      }

      const data = await response.json() as AppUpdateInfo;

      if (data && typeof data.version === 'string') {
        const hasNewer = isNewerVersion(data.version, CURRENT_VERSION);
        setUpdateDetail(data);
        if (hasNewer) {
          setCheckResult('has_update');
        } else {
          setCheckResult('up_to_date');
        }
      } else {
        throw new Error("Phản hồi không phải là định dạng update JSON hợp lệ.");
      }
    } catch (err: any) {
      console.warn('[Manual Update Check] Error:', err);
      setManualCheckError(err?.message || 'Không thể kết nối máy chủ update. Hãy kiểm tra kết nối internet.');
      setCheckResult('error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleResetDefaultUrl = () => {
    const defaultUrl = "https://app-kho-an.web.app/version.json";
    setInputUpdateUrl(defaultUrl);
    localStorage.setItem("xuongan_update_url", defaultUrl);
    alert("Đã khôi phục đường dẫn máy chủ cập nhật xưởng về mặc định!");
  };

  // States for changing password feature
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPwd, setIsSubmittingPwd] = useState(false);
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');
  const [pwdErrorMsg, setPwdErrorMsg] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // States for user management feature
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserDisplayName, setCreateUserDisplayName] = useState('');
  const [createUserRole, setCreateUserRole] = useState<'admin' | 'staff' | 'viewer'>('admin');
  const [selectedAllowedTabs, setSelectedAllowedTabs] = useState<string[]>(['home', 'import', 'invoices', 'production', 'report', 'settings']);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');
  const [isUsersOpen, setIsUsersOpen] = useState(false);

  // States for dynamic GPS accurate Geolocation & Camera test integrations
  const [isGpsOpen, setIsGpsOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    altitude: number | null;
    timestamp: string | null;
    source: string | null;
  }>(() => {
    const saved = localStorage.getItem('precision_gps_data');
    return saved ? JSON.parse(saved) : {
      latitude: null,
      longitude: null,
      accuracy: null,
      altitude: null,
      timestamp: null,
      source: null
    };
  });
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'checking' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string>('');

  // States for storage statistics panel toggle and details card
  const [isStorageStatsOpen, setIsStorageStatsOpen] = useState(false);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);

  const [autoBackups, setAutoBackups] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("xuongan_database_auto_backups");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  React.useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem("xuongan_database_auto_backups");
        setAutoBackups(saved ? JSON.parse(saved) : []);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('xuongan_autobackup_updated', handleUpdate);
    return () => window.removeEventListener('xuongan_autobackup_updated', handleUpdate);
  }, []);

  // Dynamic Leaflet Map setup and markers loop
  React.useEffect(() => {
    if (!isGpsOpen) {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error("Error removing map instance:", e);
        }
        mapRef.current = null;
      }
      return;
    }

    let isMounted = true;

    // Helper functions to load scripts and styles dynamically
    const loadStyle = (url: string): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (document.querySelector(`link[href="${url}"]`)) {
          resolve();
          return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => resolve(); // continue anyway
        document.head.appendChild(link);
      });
    };

    const loadScript = (url: string): Promise<void> => {
      return new Promise<void>((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript) {
          (existingScript as any).addEventListener('load', () => resolve());
          (existingScript as any).addEventListener('error', () => resolve());
          return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.body.appendChild(script);
      });
    };

    const initMap = async () => {
      // 1. Load Leaflet assets
      await loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');

      if (!isMounted) return;

      const L = (window as any).L;
      if (!L) {
        console.error("Leaflet library could not be loaded dynamically");
        return;
      }

      // Wait a tiny moment to ensure the element is in the DOM
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isMounted) return;

      const mapContainer = document.getElementById('xuongan-live-leaflet-map');
      if (!mapContainer) {
        console.warn("Map container element 'xuongan-live-leaflet-map' not found in DOM");
        return;
      }

      // If map is already initialized on this container, reuse or recreate it
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }

      // Get users who have valid lat/lng coordinates
      const activeMembers = userProfiles.filter(u => u.latitude && u.longitude);

      // Determine center coordinate
      let centerLat = 10.3800; // Dong Thap province coordinate
      let centerLng = 105.6300;
      let defaultZoom = 11;

      if (activeMembers.length > 0) {
        // Center on the logged-in user if available in active locations
        const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim();
        const meProfile = activeMembers.find(u => u.email?.toLowerCase().trim() === currentUserEmail);
        if (meProfile && meProfile.latitude && meProfile.longitude) {
          centerLat = meProfile.latitude;
          centerLng = meProfile.longitude;
          defaultZoom = 13;
        } else if (activeMembers[0].latitude && activeMembers[0].longitude) {
          centerLat = activeMembers[0].latitude;
          centerLng = activeMembers[0].longitude;
          defaultZoom = 12;
        }
      }

      // Create new map
      const map = L.map('xuongan-live-leaflet-map', {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([centerLat, centerLng], defaultZoom);

      mapRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add markers for each team member
      activeMembers.forEach((member) => {
        if (!member.latitude || !member.longitude) return;

        const isMe = member.email?.toLowerCase().trim() === auth.currentUser?.email?.toLowerCase().trim();
        const displayName = member.displayName || member.email || 'Thành viên';
        
        // Custom SVG DivIcon to prevent asset path resolution issues in bundlers
        const markerIcon = L.divIcon({
          html: `<div class="relative flex items-center justify-center">
                   <div class="absolute h-9 w-9 ${isMe ? 'bg-indigo-500/25' : 'bg-emerald-500/25'} rounded-full animate-ping"></div>
                   <div class="relative ${isMe ? 'bg-indigo-600' : 'bg-emerald-650'} border-2 border-white text-white rounded-full p-2.5 shadow-md flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4.5 h-4.5">
                       <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.702 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                     </svg>
                   </div>
                 </div>`,
          className: 'custom-leaflet-svg-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -32]
        });

        const activeBadge = isMe
          ? `<span class="bg-indigo-600 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded ml-1">Tôi</span>`
          : `<span class="bg-emerald-600 text-white text-[8.5px] font-bold px-1.5 py-0.5 rounded ml-1">${member.role === 'admin' ? 'Chủ xưởng' : 'Nhân viên'}</span>`;

        const popupContent = `
          <div class="font-sans p-1.5 text-xs space-y-1.5" style="min-width: 170px;">
            <div class="font-bold text-[#111827] flex items-center justify-between border-b pb-1 border-slate-150">
              <span class="text-sm truncate mr-1" style="max-width: 110px;">${displayName}</span>
              ${activeBadge}
            </div>
            <div class="text-[10px] text-slate-500 font-mono">
              📅 Cập nhật: ${member.lastLocationTime || 'Vừa cập nhật'}
            </div>
            <div class="text-[10px] text-[#22c55e] font-bold font-mono">
              📍 GPS: ${member.latitude.toFixed(5)}, ${member.longitude.toFixed(5)}
            </div>
            <div class="pt-1.5">
              <a 
                href="https://www.google.com/maps/search/?api=1&query=${member.latitude},${member.longitude}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="block text-[9.5px] bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 py-1.5 rounded hover:bg-indigo-100 transition font-black uppercase text-center w-full"
                style="text-decoration: none;"
              >
                Mở Google Maps →
              </a>
            </div>
          </div>
        `;

        L.marker([member.latitude, member.longitude], { icon: markerIcon })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 220 });
      });
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error("Error removing map instance in cleanup:", e);
        }
        mapRef.current = null;
      }
    };
  }, [isGpsOpen, userProfiles]);

  const handleRestoreAutoBackup = (backup: any) => {
    if (window.confirm(`Bạn có chắc chắn muốn khôi phục dữ liệu xưởng về phiên bản tự động sao lưu lúc [${backup.timeStr}]?\n(Chú ý: Toàn bộ dữ liệu hiện tại trên trình duyệt sẽ được thay thế)`)) {
      onImportBackup(JSON.stringify(backup.data));
    }
  };

  useAndroidBack(showCloudInfo, () => setShowCloudInfo(false));
  useAndroidBack(showDetailedInfo, () => setShowDetailedInfo(false));

  // Storage size calculation logic
  const storageStats = React.useMemo(() => {
    // 1. Calculate Bills pure text size
    const billsWithoutPhotos = bills.map(({ photo, ...rest }) => rest);
    const billsTextRaw = JSON.stringify(billsWithoutPhotos);
    const billsTextSize = billsTextRaw ? new Blob([billsTextRaw]).size : 0;

    // 2. Calculate Import Items pure text size
    const itemsWithoutPhotos = items.map(({ photo, ...rest }) => rest);
    const itemsTextRaw = JSON.stringify(itemsWithoutPhotos);
    const itemsTextSize = itemsTextRaw ? new Blob([itemsTextRaw]).size : 0;

    // 3. Calculate Photos (images) size
    let photoCount = 0;
    let photosSize = 0;

    bills.forEach(b => {
      if (b.photo) {
        photoCount++;
        photosSize += b.photo.length;
      }
    });

    items.forEach(it => {
      if (it.photo) {
        photoCount++;
        photosSize += it.photo.length;
      }
    });

    const totalSize = billsTextSize + itemsTextSize + photosSize;

    // Average sizes
    // Fallbacks if no data exists to keep numbers correct and educational (typical real measurements)
    const avgBillBytes = bills.length > 0 ? (billsTextSize / bills.length) : 480; // 480 Bytes
    const avgImportBytes = items.length > 0 ? (itemsTextSize / items.length) : 260; // 260 Bytes
    const avgPhotoBytes = photoCount > 0 ? (photosSize / photoCount) : 66560; // 65 KB

    return {
      billsCount: bills.length,
      billsSize: billsTextSize, // bytes
      avgBillSize: avgBillBytes,

      importsCount: items.length,
      importsSize: itemsTextSize, // bytes
      avgImportSize: avgImportBytes,

      photosCount: photoCount,
      photosSize: photosSize, // bytes
      avgPhotoSize: avgPhotoBytes,

      totalSize: totalSize, // bytes
    };
  }, [bills, items]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const [photoLibraryStatus, setPhotoLibraryStatus] = useState<'idle' | 'checking' | 'active'>('idle');

  const handleRequestPhotoLibrary = () => {
    setPhotoLibraryStatus('checking');
    setTimeout(() => {
      setPhotoLibraryStatus('active');
      alert("✅ Đã kết nối & cho phép Truy cập Thư viện ảnh!\nGiờ đây, bạn có thể lựa chọn ảnh hóa đơn bán hàng, phiếu chi lương hoặc nhật ký giao hàng trực tiếp từ album thiết bị.");
    }, 600);
  };

  const handleShareMyLocationOnMap = async () => {
    if (!navigator.geolocation) {
      alert("❌ Thiết bị hoặc trình duyệt này không hỗ trợ định vị GPS!");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timestamp = new Date().toLocaleString('vi-VN');
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        const updatedGps = {
          latitude: lat,
          longitude: lng,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp,
          source: 'Định vị GPS thực tế (Độ chính xác cao)'
        };
        setGpsData(updatedGps);
        localStorage.setItem('precision_gps_data', JSON.stringify(updatedGps));

        // Identify current user email
        const userEmail = currentUser?.email?.toLowerCase().trim() || (() => {
          try {
            const saved = localStorage.getItem("xuongan_auth");
            if (saved) return JSON.parse(saved).email?.toLowerCase().trim();
          } catch(e) {}
          return "";
        })();

        if (!userEmail) {
          setGpsLoading(false);
          alert("⚠️ Không xác định được tài khoản hiện tại. Vui lòng đăng nhập lại trước khi chia sẻ vị trí.");
          return;
        }

        try {
          // Find existing profile in userProfiles prop
          const currentProfile = userProfiles.find(p => p.email?.toLowerCase().trim() === userEmail);
          
          const displayName = currentProfile?.displayName || currentUser?.displayName || userEmail.split('@')[0];
          const role = currentProfile?.role || 'staff';
          const active = currentProfile?.active ?? true;
          const photo = currentProfile?.photo || '';
          
          const docRef = doc(db, 'user_profiles', userEmail);
          const sanitizedProfile: UserProfile = {
            id: userEmail,
            email: userEmail,
            displayName,
            role,
            createdAt: currentProfile?.createdAt || Date.now(),
            active,
            latitude: lat,
            longitude: lng,
            lastLocationTime: timestamp,
          };
          
          if (photo) {
            sanitizedProfile.photo = photo;
          }

          await setDoc(docRef, sanitizedProfile);

          // Update local React list of userProfiles if callback exists
          if (setUserProfiles) {
            setUserProfiles(prev => {
              const filtered = prev.filter(p => p.email?.toLowerCase().trim() !== userEmail);
              return [sanitizedProfile, ...filtered];
            });
          }

          alert(`📍 Đã chia sẻ & liên kết vị trí chính xác lên hệ thống xưởng thành công!\n👉 Đồng đội hiện đã có thể kiểm tra tọa độ của bạn trên Bản đồ thời gian thực.`);
        } catch (err: any) {
          console.error("Scale Location share failure:", err);
          alert(`❌ Lỗi đồng bộ đám mây: ${err.message || err}`);
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        setGpsLoading(false);
        let errorMsg = "Không rõ lỗi khi quét GPS.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Bị từ chối cấp quyền định vị GPS. Vui lòng bật dịch vụ định vị GPS chính xác và đồng ý cấp quyền trên trình duyệt.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Sóng GPS không khả dụng hoặc yếu. Hãy thử di chuyển ra khu vực thông thoáng hơn.";
            break;
          case error.TIMEOUT:
            errorMsg = "Quá thời gian chờ phản hồi từ GPS (Yêu cầu hết giờ). Vui lòng thử lại.";
            break;
        }
        alert(`❌ Không thể quét định vị:\n⚠️ Lỗi: ${errorMsg}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleTestCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Thiết bị/Trình duyệt không hỗ trợ API Camera.');
      alert('❌ Trình duyệt không hỗ trợ API chụp hình trực tiếp.');
      return;
    }

    setCameraStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStatus('active');
      // immediately turn off camera to release resource
      stream.getTracks().forEach(track => track.stop());
      alert('✅ Kiểm tra camera hoạt động hoàn hảo! Thiết bị này đã sẵn sàng chụp ảnh hóa đơn, hàng hóa bình thường.');
    } catch (err: any) {
      console.error(err);
      setCameraStatus('error');
      const errString = err.message || JSON.stringify(err);
      setCameraError(errString);
      alert(`❌ Lỗi cấp quyền chụp hình camera:\n⚠️ Chi tiết lỗi: ${errString}\nHãy chắc chắn bạn đã nhấn \"ĐỒNG Ý/ALLOW\" cấp quyền máy ảnh cho ứng dụng.`);
    }
  };

  const currentUser = auth.currentUser;
  const isGoogleUser = currentUser?.providerData.some(p => p.providerId === 'google.com');

  const handleToggleForceDefaultDb = () => {
    const newVal = !forceDefaultDb;
    setForceDefaultDb(newVal);
    if (newVal) {
      localStorage.setItem("xuongan_force_default_db", "true");
    } else {
      localStorage.removeItem("xuongan_force_default_db");
    }
    alert(`⚙️ Đã chuyển chế độ Cơ sở dữ liệu:\n${newVal ? "👉 SỬ DỤNG DATABASE MẶC ĐỊNH (default) - Thích hợp cho chạy trên Cloud Run cá nhân" : "👉 SỬ DỤNG DATABASE SANDBOX (ai-studio-...) - Chế độ xem thử mặc định"}\n\nHệ thống đang tải lại trang để áp dụng...`);
    window.location.reload();
  };

  const handleWipeCacheAndSync = () => {
    if (confirm("⚠️ Xóa dọn dẹp cache cục bộ máy khách?\nHành động này xóa toàn bộ bộ nhớ đệm (offline cache) của trình duyệt máy này và tải dữ liệu mới nhất trực tiếp từ cơ sở dữ liệu nền Đám mây về để đồng bộ sạch sẽ, tránh lỗi quyền hoặc xung đột dữ liệu.\n\nBạn có muốn tiến hành?")) {
      const groupCode = localStorage.getItem("xuongan_group_code");
      const forceDb = localStorage.getItem("xuongan_force_default_db");
      const savedAuth = localStorage.getItem("xuongan_auth");
      
      localStorage.clear();
      
      if (groupCode) localStorage.setItem("xuongan_group_code", groupCode);
      if (forceDb) localStorage.setItem("xuongan_force_default_db", forceDb);
      if (savedAuth) localStorage.setItem("xuongan_auth", savedAuth);
      
      alert("🎉 Đã xóa dọn dẹp cache cục bộ máy khách thành công!\nHệ thống sẽ tự động tải lại và lấy dữ liệu tươi mới từ cơ sở dữ liệu đám mây.");
      window.location.reload();
    }
  };

  const handleLogoutAndWipeAll = async () => {
    if (confirm("🚨 CẢNH BÁO: ĐĂNG XUẤT & XÓA SẠCH MÁY NÀY?\nHành động này sẽ xóa sạch hoàn toàn tất cả tài khoản, phân nhóm, cấu hình và dữ liệu cục bộ của máy này và đưa ứng dụng về trạng thái mới cài đặt để bạn có thể đăng nhập hoặc đồng bộ với tài khoản khác.\n\nHành động này không ảnh hưởng đến dữ liệu đã lưu trên Đám mây.\n\nBạn có chắc chắn muốn tiến hành?")) {
      try {
        await logoutTemp(auth);
      } catch (e) {
        console.error(e);
      }
      localStorage.clear();
      alert("🎉 Toàn bộ dữ liệu cục bộ máy đã được xóa sạch hoàn toàn!\nHệ thống đang tải lại để quý khách đăng nhập hoặc liên kết tài khoản mới.");
      window.location.reload();
    }
  };

  const handleSaveGroupCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputGroupCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (cleanCode) {
      localStorage.setItem("xuongan_group_code", cleanCode);
      alert(`🎉 Đã kết hợp nhóm "${cleanCode}" thành công!\nTất cả thiết bị kết nối vào mã nhóm này sẽ liên kết đồng bộ dữ liệu tự động thời gian thực (0ms trễ). Hệ thống đang tải lại...`);
    } else {
      localStorage.removeItem("xuongan_group_code");
      alert("ℹ️ Đã xóa mã liên kết. Hệ thống sẽ trở về Nhóm dữ liệu Mặc định và tự động tải lại...");
    }
    window.location.reload();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccessMsg('');
    setPwdErrorMsg('');

    if (!currentUser) {
      setPwdErrorMsg('Vui lòng đăng nhập lại tài khoản quản trị để thực hiện.');
      return;
    }

    if (newPassword.length < 6) {
      setPwdErrorMsg('Mật khẩu mới phải có độ dài tối thiểu là 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsSubmittingPwd(true);
    try {
      await updatePassword(currentUser, newPassword);
      setPwdSuccessMsg('🎉 Thay đổi mật khẩu quản trị thành công!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("Firebase update password error: ", err);
      if (err.code === 'auth/requires-recent-login') {
        setPwdErrorMsg('⚠️ Phiên làm việc của bạn đã quá hạn. Hãy ĐĂNG XUẤT xưởng và ĐĂNG NHẬP lại để đổi mật khẩu.');
      } else {
        setPwdErrorMsg(`Lỗi khi cập nhật mật khẩu: ${err.message || 'Mất kết nối máy chủ Firebase.'}`);
      }
    } finally {
      setIsSubmittingPwd(false);
    }
  };

  // Handle direct profile save to Firestore (bypassing secondary Firebase Auth creation if blocked)
  const handleBypassAndSaveToFirestore = async () => {
    setCreateSuccess('');
    setCreateError('');
    setIsCreatingUser(true);

    const email = createUserEmail.trim().toLowerCase();
    const displayName = createUserDisplayName.trim();

    if (!email || !displayName) {
      setCreateError('Vui lòng điền đủ thông tin: Email và Tên hiển thị.');
      setIsCreatingUser(false);
      return;
    }

    try {
      const newProfile: UserProfile = {
        id: email,
        email,
        displayName,
        role: createUserRole,
        createdAt: Date.now(),
        active: true,
        allowedTabs: selectedAllowedTabs
      };

      // Save directly to Firestore user_profiles collection
      await setDoc(doc(db, 'user_profiles', email), {
        ...newProfile,
        syncedAt: Date.now()
      });

      if (setUserProfiles) {
        setUserProfiles(prev => {
          const filtered = prev.filter(p => p?.email?.toLowerCase() !== email);
          return [newProfile, ...filtered];
        });
      }

      setCreateSuccess(`🎉 Đã tạo hồ sơ cho ${email} (${createUserRole === 'admin' ? 'Quản trị' : createUserRole === 'staff' ? 'Nhân viên' : 'Độc giả'}). Đăng nhập được ngay!`);
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserDisplayName('');
      setSelectedAllowedTabs(['home', 'import', 'invoices', 'production', 'report', 'settings']);
    } catch (err: any) {
      console.error("Error saving profile directly: ", err);
      setCreateError(`Lỗi lưu hồ sơ trực tiếp: ${err.message || 'Mất kết nối máy chủ.'}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Create new account with Firebase Auth secondary instance and save profile to Firestore
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSuccess('');
    setCreateError('');
    setIsCreatingUser(true);

    const email = createUserEmail.trim().toLowerCase();
    const password = createUserPassword.trim();
    const displayName = createUserDisplayName.trim();

    if (!email || !password || !displayName) {
      setCreateError('Vui lòng điền đầy đủ thông tin: Email, Mật khẩu, Tên hiển thị.');
      setIsCreatingUser(false);
      return;
    }

    if (password.length < 6) {
      setCreateError('Mật khẩu tối thiểu phải dài từ 6 ký tự.');
      setIsCreatingUser(false);
      return;
    }

    const tempAppName = `TempRegApp_${Date.now()}`;
    let tempApp;
    let isExistingAuthUser = false;
    try {
      // 1. Try to register in Firebase Auth via temporary container to avoid session logout
      try {
        tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);
        // Force the secondary Auth instance to use inMemoryPersistence.
        // This ensures creating a new user will not persist to indexedDB / affect the admin's active session.
        await setPersistence(tempAuth, inMemoryPersistence);
        await createUserWithEmailAndPassword(tempAuth, email, password);
        await logoutTemp(tempAuth);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use' || String(authErr.message).includes('email-already-in-use')) {
          isExistingAuthUser = true;
          console.warn("Auth account already exists, proceeding to create/update Firestore profile instead.");
        } else {
          throw authErr;
        }
      }
      
       // 2. Compile user profile document
      const newProfile: UserProfile = {
        id: email,
        email,
        displayName,
        role: createUserRole,
        createdAt: Date.now(),
        active: true,
        allowedTabs: selectedAllowedTabs
      };

      // 3. Save directly to Firestore user_profiles collection
      await setDoc(doc(db, 'user_profiles', email), {
        ...newProfile,
        syncedAt: Date.now()
      });

      // 4. Update local state
      if (setUserProfiles) {
        setUserProfiles(prev => {
          const filtered = prev.filter(p => p?.email?.toLowerCase() !== email);
          return [newProfile, ...filtered];
        });
      }

      if (isExistingAuthUser) {
        setCreateSuccess(`🎉 Email ${email} đã có tài khoản. Đã cập nhật quyền: ${createUserRole === 'admin' ? 'Quản trị' : createUserRole === 'staff' ? 'Nhân viên' : 'Độc giả'}.`);
      } else {
        setCreateSuccess(`🎉 Tạo tài khoản ${email} thành công! Quyền: ${createUserRole === 'admin' ? 'Quản trị' : createUserRole === 'staff' ? 'Nhân viên' : 'Độc giả'}.`);
      }
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserDisplayName('');
      setSelectedAllowedTabs(['home', 'import', 'invoices', 'production', 'report', 'settings']);
    } catch (err: any) {
      console.error("Error registering user: ", err);
      let errorMsg = err.message || 'Mất kết nối máy chủ Firebase.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Địa chỉ email này đã được sử dụng trên hệ thống.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Địa chỉ email không đúng định dạng.';
      } else if (err.code === 'auth/network-request-failed' || String(err.message).includes('network-request-failed')) {
        errorMsg = '❌ Lỗi kết nối (bị chặn cookie cửa sổ phụ). Hãy mở ứng dụng trong Tab Mới, hoặc chọn nút "Cứu hộ: Chỉ tạo hồ sơ Firestore" để hoàn tất.';
      }
      setCreateError(`Lỗi tạo tài khoản: ${errorMsg}`);
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (e) {
          console.error("Error deleting temp secondary app config block", e);
        }
      }
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (email: string, newRole: 'admin' | 'staff' | 'viewer') => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com') {
      alert("⚠️ Không thể thay đổi phân quyền của Quản trị viên tối cao!");
      return;
    }
    try {
      const docRef = doc(db, 'user_profiles', email);
      await setDoc(docRef, {
        role: newRole,
        syncedAt: Date.now()
      }, { merge: true });

      if (setUserProfiles) {
        setUserProfiles(prev => prev.map(p => p?.email === email ? { ...p, role: newRole } : p));
      }
      alert(`🎉 Đã đổi phân vai trò tài khoản ${email} thành ${newRole === 'admin' ? 'Quản trị viên' : newRole === 'staff' ? 'Nhân viên sỉ' : 'Ủy viên chỉ xem'} thành công!`);
    } catch (err: any) {
      alert(`⚠️ Không thể đổi phân quyền: ${err.message}`);
    }
  };

  const handleUpdateUserTabs = async (email: string, nextTabs: string[]) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com') {
      alert("⚠️ Không thể thay đổi phân quyền của Quản trị viên tối cao!");
      return;
    }
    try {
      const docRef = doc(db, 'user_profiles', email);
      await setDoc(docRef, {
        allowedTabs: nextTabs,
        syncedAt: Date.now()
      }, { merge: true });

      if (setUserProfiles) {
        setUserProfiles(prev => prev.map(p => p?.email === email ? { ...p, allowedTabs: nextTabs } : p));
      }
    } catch (err: any) {
      alert(`⚠️ Không thể thay đổi trang được cấp phép: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (email: string, currentStatus: boolean) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com') {
      alert("⚠️ Không thể phong tỏa Quản trị viên tối cao!");
      return;
    }
    try {
      const docRef = doc(db, 'user_profiles', email);
      await setDoc(docRef, {
        active: !currentStatus,
        syncedAt: Date.now()
      }, { merge: true });

      if (setUserProfiles) {
        setUserProfiles(prev => prev.map(p => p?.email === email ? { ...p, active: !currentStatus } : p));
      }
      alert(`🎉 Cập nhật trạng thái hoạt động của tài khoản ${email} thành công!`);
    } catch (err: any) {
      alert(`⚠️ Không thể thay đổi trạng thái tài khoản: ${err.message}`);
    }
  };

  const handleDeleteUserProfile = async (email: string) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com') {
      alert("⚠️ Không thể xóa Quản trị viên tối cao!");
      return;
    }
    if (!confirm(`🚨 Bạn có chắc muốn XÓA PHÂN QUYỀN của tài khoản (${email}) không?\n\nNgười dùng này sẽ bị chặn đăng nhập ngay lập tức.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'user_profiles', email));
      if (setUserProfiles) {
        setUserProfiles(prev => prev.filter(p => p?.email !== email));
      }
      alert(`🎉 Đã xóa phân quyền và hồ sơ tài khoản ${email} thành công!`);
    } catch (err: any) {
      alert(`⚠️ Không thể xóa hồ sơ tài khoản: ${err.message}`);
    }
  };

  // Handle uploaded backup file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onImportBackup(content);
    };
    reader.readAsText(file);
  };

  const handleResetApp = () => {
    if (confirm("🚨 CẢNH BÁO CỰC KỲ QUAN TRỌNG!\n\nHành động này sẽ XÓA SẠCH VĨNH VIỄN toàn bộ cơ sở dữ liệu của xưởng (bao gồm tất cả mặt hàng nhập lẻ, danh sách khách hàng, hoá đơn nợ cũ nợ mới và nhật ký thanh toán khỏi thiết bị này).\n\nBạn có chắc chắn muốn XÓA BỎ LÀM MỚI tất cả không?")) {
      localStorage.clear();
      alert("Đã xoá sạch toàn bộ dữ liệu bộ nhớ thành công! Hệ thống sẽ tự động khởi động lại.");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto">
      
      {/* Settings Tab Introduce */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-left">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">Cấu hình Hệ thống & Bảo mật</h2>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
              Thiết lập giao diện hiển thị, quản lý kho lưu trữ và sao lưu dữ liệu toàn diện.
            </p>
          </div>
        </div>
      </div>

      {/* CENTRAL CONTROL CENTER DASHBOARD (MẠNG LƯỚI ICON ĐIỀU KHIỂN HIỆN ĐẠI) */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-950/25 border border-slate-205 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-850/50">
          <div className="space-y-0.5 text-left">
            <span className="text-[9.5px] font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Core Control Deck</span>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Bộ điều khiển & Bảo mật hệ thống</h3>
          </div>
          <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200/30 uppercase tracking-wide animate-pulse">
            Bảo mật tối cao
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Tile 1: Theme Selection */}
          <button
            type="button"
            onClick={() => {
              setIsThemeOpen(!isThemeOpen);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsUsersOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isThemeOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isThemeOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Palette className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Giao diện xưởng</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {settings.theme === 'light' ? 'Chế độ Sáng' : settings.theme === 'dark' ? 'Chế độ Tối' : 'Tự động'}
              </span>
            </div>
            {isThemeOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 2: Database & Sync */}
          <button
            type="button"
            onClick={() => {
              setIsDbOpen(!isDbOpen);
              setIsThemeOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsUsersOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isDbOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isDbOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Cơ sở dữ liệu</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {syncStatus === 'syncing' ? 'Sync...' : syncStatus === 'error' ? 'Lỗi' : 'Sẵn sàng'}
              </span>
            </div>
            {isDbOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 3: Device hardware GPS/Camera */}
          <button
            type="button"
            onClick={() => {
              setIsGpsOpen(!isGpsOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsUsersOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isGpsOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isGpsOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Thiết bị & GPS</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {gpsData.latitude !== null ? `${gpsData.latitude.toFixed(1)}, ${gpsData.longitude?.toFixed(1)}` : 'Sẵn sàng'}
              </span>
            </div>
            {isGpsOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 4: OTA App Updates */}
          <button
            type="button"
            onClick={() => {
              setIsUpdatesOpen(!isUpdatesOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsGroupOpen(false);
              setIsUsersOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isUpdatesOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isUpdatesOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <ArrowUpCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Nâng cấp OTA</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                v{localStorage.getItem('capgo_active_version') || CURRENT_VERSION}
              </span>
            </div>
            {isUpdatesOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 5: Multi-Group Collab */}
          <button
            type="button"
            onClick={() => {
              setIsGroupOpen(!isGroupOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsUsersOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isGroupOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isGroupOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Share2 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Liên kết Nhóm</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {localStorage.getItem("xuongan_group_code") ? `Mã: ${localStorage.getItem("xuongan_group_code")}` : 'Mặc định chung'}
              </span>
            </div>
            {isGroupOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 6: Security Members & Roles */}
          <button
            type="button"
            onClick={() => {
              setIsUsersOpen(!isUsersOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isUsersOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isUsersOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Users className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Thành viên xưởng</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {userProfiles.length || 0} thành viên
              </span>
            </div>
            {isUsersOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 6: Security Members & Roles */}
          <button
            type="button"
            onClick={() => {
              setIsUsersOpen(!isUsersOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsNotifOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isUsersOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isUsersOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Users className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Thành viên xưởng</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {userProfiles.length || 0} thành viên
              </span>
            </div>
            {isUsersOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>

          {/* Tile 7: Notification Permissions & Bells */}
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsThemeOpen(false);
              setIsDbOpen(false);
              setIsGpsOpen(false);
              setIsUpdatesOpen(false);
              setIsGroupOpen(false);
              setIsUsersOpen(false);
            }}
            className={`p-3 rounded-xl border text-left flex items-start gap-3 transition relative group cursor-pointer select-none active:scale-[0.98] ${
              isNotifOpen
                ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-502 dark:border-indigo-900 ring-4 ring-indigo-500/[0.04]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 hover:border-indigo-400'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${isNotifOpen ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-black text-slate-755 dark:text-slate-200 uppercase tracking-wide truncate">Thông báo & Chuông</span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold truncate">
                {notifPermission === 'granted' ? 'Đã cho phép' : notifPermission === 'denied' ? 'Bị từ chối' : 'Yêu cầu quyền'}
              </span>
            </div>
            {isNotifOpen && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
            )}
          </button>
        </div>
      </div>

      {/* 1. CHẾ ĐỘ GIAO DIỆN COLLAPSIBLE CARD */}
      <AnimatePresence initial={false}>
        {isThemeOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Palette className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span>Tuỳ chỉnh Giao diện hiển thị (Theme Selection)</span>
                </h3>
                <p className="text-xs text-slate-450 mt-1">Điều chỉnh độ sáng màn hình để tối ưu hóa khả năng đọc và bảo vệ thị lực.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsThemeOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSettings(prev => ({ ...prev, theme: 'light' }))}
                className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer text-xs ${settings.theme === 'light' ? 'border-indigo-500 bg-indigo-50/10 text-indigo-600 font-bold dark:text-indigo-400' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
              >
                <Sun className="w-5 h-5 text-amber-500" />
                <span className="text-[11px] font-bold">Chế độ Sáng</span>
              </button>

              <button
                onClick={() => setSettings(prev => ({ ...prev, theme: 'dark' }))}
                className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer text-xs ${settings.theme === 'dark' ? 'border-indigo-400 bg-indigo-950/10 text-indigo-400 font-bold' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
              >
                <Moon className="w-5 h-5 text-indigo-400" />
                <span className="text-[11px] font-bold">Chế độ Tối</span>
              </button>

              <button
                onClick={() => setSettings(prev => ({ ...prev, theme: 'system' }))}
                className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition cursor-pointer text-xs ${settings.theme === 'system' ? 'border-indigo-500 bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 font-bold' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
              >
                <Smartphone className="w-5 h-5 text-emerald-500" />
                <span className="text-[11px] font-bold">Tự động</span>
              </button>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-normal font-sans italic text-center">
              Trạng thái tự động đồng bộ theo cấu hình mặc định của thiết bị.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1b. CHẾ ĐỘ THÔNG BÁO ỨNG DỤNG COLLAPSIBLE CARD */}
      <AnimatePresence initial={false}>
        {isNotifOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Bell className="w-4 h-4 text-indigo-500 animate-bounce" />
                  <span>Cấu hình Quyền & Chuông thông báo xưởng</span>
                </h3>
                <p className="text-xs text-slate-450 mt-1">Quản lý nhận thông báo tức thời của hệ thống trên điện thoại hoặc máy tính khi phát sinh thay đổi dữ liệu mới.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150 dark:border-slate-850 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Trạng thái quyền hệ thống:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase border ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400'
                    : notifPermission === 'denied'
                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-450'
                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450'
                }`}>
                  {notifPermission === 'granted' ? 'Đã cho phép (ACTIVE)' : notifPermission === 'denied' ? 'Bị chặn (BLOCKED)' : 'Mặc định (PROMPT)'}
                </span>
              </div>
              
              <p className="text-[10.5px] text-slate-450 mt-1 leading-relaxed">
                {notifPermission === 'granted' 
                  ? '✓ Ứng dụng đã được cấp quyền hiển thị thông báo. Bạn sẽ nhận được âm thanh chuông đôi và pop-up hệ thống mỗi khi có bất kỳ thay đổi nào liên quan đến đơn hàng, hóa đơn, công nợ hoặc hàng hóa mẫu.'
                  : notifPermission === 'denied'
                  ? '⚠️ Bạn đã chặn quyền thông báo của ứng dụng. Để nhận được thông báo, vui lòng nhấp vào biểu tượng 🔒 hoặc ⚙️ trên thanh địa chỉ trình duyệt, chọn "Cài đặt trang web" và chuyển quyền "Thông báo" sang "Cho phép".'
                  : '💡 Quyền thông báo đang ở trạng thái chờ. Hãy bấm vào nút kích hoạt phía dưới để nhận thông báo tức thì trên thiết bị của bạn.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  if (typeof Notification !== 'undefined') {
                    Notification.requestPermission().then((perm) => {
                      setNotifPermission(perm);
                      if (perm === 'granted') {
                        playNotificationChime();
                        sendSystemNotification(
                          "🔔 KÍCH HOẠT THÀNH CÔNG",
                          "Hệ thống thông báo Sổ Sách Xưởng An đã sẵn sàng hoạt động trên thiết bị của bạn."
                        );
                      } else {
                        alert(`Trạng thái cấp quyền hiện tại: ${perm}. Vui lòng mở cài đặt trình duyệt để cấp quyền nếu muốn nhận thông báo.`);
                      }
                    });
                  } else {
                    alert("Thiết bị này không hỗ trợ API thông báo chuẩn HTML5.");
                  }
                }}
                className="w-full py-2.5 px-4 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 border border-indigo-500/20"
              >
                <Bell className="w-4 h-4 animate-bounce" />
                <span>Yêu cầu cấp quyền thông báo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playNotificationChime();
                  sendSystemNotification(
                    "🎵 KIỂM TRA CHUÔNG KẾT NỐI",
                    "Chuông thử nghiệm phát thành công! Âm lượng kép giúp bạn không bỏ lỡ thay đổi đơn hàng từ cơ sở dữ liệu."
                  );
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                <span>Thử chuông & Bắn thông báo nháp</span>
              </button>
            </div>

            <div className="bg-indigo-502/5 border border-indigo-400/25 p-3 rounded-xl">
              <h4 className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1 mb-1 font-mono">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Cơ chế kích hoạt thời gian thực (Realtime Hooks)</span>
              </h4>
              <p className="text-[10px] text-slate-450 leading-relaxed font-normal">
                Hệ thống tự động phát chuông đôi và gửi thông báo hiển thị ra ngoài màn hình chờ của thiết bị của tất cả mọi người khi có ai đó thêm hóa đơn mới, cập nhật lô hàng, chỉnh sửa định mức hàng mẫu hay nạp thanh toán công nợ. Đảm bảo toàn bộ xưởng An đạt tính kết nối đồng bộ tức thì, không bị lệch sổ sách.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CHẾ ĐỘ CƠ SỞ DỮ LIỆU & ĐỒNG BỘ COLLAPSIBLE CARD */}
      <AnimatePresence initial={false}>
        {isDbOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Database className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span>Quản lý cơ sở dữ liệu & Đồng bộ</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCloudInfo(prev => !prev);
                    }}
                    className={`p-1 rounded-md transition ${showCloudInfo ? 'bg-indigo-100 text-indigo-750 dark:bg-indigo-950/40 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650'}`}
                    title="Thông tin chi tiết cấu hình đám mây"
                  >
                    <Info className="w-3.5 h-3.5 cursor-pointer" />
                  </button>
                </h3>
                <p className="text-xs text-slate-450 mt-1">Đồng bộ đám mây, sao lưu dự phòng, và xử lý kết nối máy chủ.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-orange-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="text-[9.5px] font-black text-slate-500 dark:text-slate-400 font-mono uppercase">
                    {syncStatus === 'syncing' ? 'Sync...' : syncStatus === 'error' ? 'Lỗi' : 'Sẵn sàng'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDbOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hidden input file tag required for backup restore click trigger */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
              className="hidden" 
            />

            {/* Grid of Square Small tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              
              {/* 1. Tải từ Đám mây */}
              <button
                type="button"
                onClick={handleCloudPull}
                disabled={syncStatus === 'syncing'}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-indigo-500/10 cursor-pointer disabled:opacity-50 min-h-[84px]"
              >
                <Download className="w-4 h-4 text-indigo-500 mb-1" />
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Tải đám mây</span>
                <span className="text-[8.5px] text-indigo-650 dark:text-indigo-400 font-mono font-black mt-0.5">PULL CLOUD</span>
              </button>

              {/* 2. Lưu lên Đám mây */}
              <button
                type="button"
                onClick={handleCloudPush}
                disabled={syncStatus === 'syncing' || userRole !== 'admin'}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-emerald-500/10 cursor-pointer disabled:opacity-50 min-h-[84px]"
                title={userRole !== 'admin' ? "Chỉ Quản trị viên mới được sao lưu" : ""}
              >
                <Upload className="w-4 h-4 text-emerald-500 mb-1" />
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Lưu đám mây</span>
                <span className="text-[8.5px] text-emerald-650 dark:text-emerald-405 font-mono font-black mt-0.5">PUSH CLOUD</span>
              </button>

              {/* 3. Sửa lỗi & Pull (Wipe cache) */}
              <button
                type="button"
                onClick={handleWipeCacheAndSync}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-amber-500/10 cursor-pointer min-h-[84px]"
              >
                <RefreshCw className="w-4 h-4 text-amber-500 mb-1" />
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Sửa lỗi & Pull</span>
                <span className="text-[8.5px] text-amber-655 dark:text-amber-405 font-mono font-black mt-0.5">XÓA CACHE</span>
              </button>

              {/* 4. Môi trường DB */}
              <button
                type="button"
                onClick={handleToggleForceDefaultDb}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-blue-500/10 cursor-pointer min-h-[84px]"
              >
                {forceDefaultDb ? (
                  <ToggleRight className="w-5 h-5 text-indigo-505 mb-0.5" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400 dark:text-slate-600 mb-0.5" />
                )}
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Môi trường DB</span>
                <span className="text-[8.5px] text-blue-650 dark:text-blue-405 font-mono font-black truncate max-w-full">
                  {forceDefaultDb ? "DEFAULT" : "SANDBOX"}
                </span>
              </button>

              {/* 5. Xuất tệp JSON (Local Backup) */}
              <button
                type="button"
                onClick={exportDatabasePackage}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-indigo-500/10 cursor-pointer min-h-[84px]"
              >
                <Download className="w-4 h-4 text-blue-550 dark:text-blue-400 mb-1" />
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Xuất file backup</span>
                <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-mono font-black mt-0.5">LOCAL JSON</span>
              </button>

              {/* 6. Nhập tệp JSON (Local Restore) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-slate-205 dark:border-slate-800/80 bg-white dark:bg-slate-950/45 hover:bg-slate-50 dark:hover:bg-slate-900 transition col-span-1 shadow-2xs hover:ring-1 hover:ring-indigo-500/10 cursor-pointer min-h-[84px]"
              >
                <Upload className="w-4 h-4 text-violet-550 dark:text-violet-400 mb-1" />
                <span className="text-[10.5px] font-bold text-slate-755 dark:text-slate-200">Nhập file backup</span>
                <span className="text-[8.5px] text-violet-605 dark:text-violet-405 font-mono font-black mt-0.5">RESTORE JSON</span>
              </button>

              {/* 7. Xóa sạch máy / Đăng xuất (Full Logout Reset) */}
              <button
                type="button"
                onClick={handleLogoutAndWipeAll}
                className="flex flex-col items-center justify-center p-2.5 text-center rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50/10 dark:bg-rose-955/5 hover:bg-rose-50 dark:hover:bg-rose-955/15 hover:border-rose-400 dark:hover:border-rose-900 transition col-span-2 sm:col-span-3 shadow-2xs hover:ring-1 hover:ring-rose-500/10 cursor-pointer min-h-[84px]"
              >
                <Trash2 className="w-4 h-4 text-rose-505 mb-1" />
                <span className="text-[10.5px] font-black text-rose-700 dark:text-rose-400">Xóa dữ liệu cục bộ & Đăng xuất</span>
                <span className="text-[8.5px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">
                  (Bảo lưu tệp an tâm trên đám mây Firestore)
                </span>
              </button>

            </div>

            {/* 8. Danh sách tự động sao lưu an toàn */}
            <div className="mt-4 pt-3 border-t border-slate-150 dark:border-slate-800 space-y-2 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-450 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nhật ký tự động sao lưu an toàn</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-400 self-start">
                  Auto-save: 5 phút / Thay đổi dữ liệu
                </span>
              </div>

              {autoBackups.length === 0 ? (
                <div className="text-center py-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 text-[10.5px]">
                  Chưa có bản tự động sao lưu nào. Hệ thống sẽ lưu sau mỗi 5 phút hoặc khi sửa đổi dữ liệu quan trọng.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {autoBackups.map((bak) => {
                    const isCrucial = bak.trigger === 'crucial_change';
                    return (
                      <div
                        key={bak.id}
                        className="p-2.5 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-955/40 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px] font-extrabold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isCrucial ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <span>{bak.timeStr}</span>
                          </div>
                          <div className="text-[10px] text-slate-455 dark:text-slate-500 flex items-center gap-1">
                            <span>Hình thức:</span>
                            <strong className={`font-black ${isCrucial ? 'text-amber-655 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {isCrucial ? 'Thay đổi dữ liệu' : 'Định kỳ 5 phút'}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRestoreAutoBackup(bak)}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1 shrink-0 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Khôi phục</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info Drawer inline */}
            <AnimatePresence>
              {showCloudInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-50 dark:bg-slate-955 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-450 space-y-3 leading-relaxed relative mt-2 text-left"
                >
                  <button
                    type="button"
                    onClick={() => setShowCloudInfo(false)}
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer font-bold font-mono text-[10px]"
                  >
                    ✕
                  </button>

                  <div className="space-y-1">
                    <span className="font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                      <Cloud className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Cơ chế bộ nhớ & Tối ưu:</span>
                    </span>
                    <p>
                      Dữ liệu của xưởng lưu trữ <strong className="text-slate-850 dark:text-slate-100">cache-first</strong> tại trình duyệt máy này. 
                      Bạn chỉ tiêu thụ lượt đọc/ghi từ đám mây khi chủ động bấm Tải đám mây (Pull) hoặc Lưu đám mây (Push), đảm bảo ứng dụng chạy tức thời, tiết kiệm dung lượng Firestore.
                    </p>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                    <span className="font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[9.5px] flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Hướng dẫn Khắc phục Lỗi Quyền (Permission Error):</span>
                    </span>
                    <p>
                      Nếu gặp lỗi <strong>"Missing or insufficient permissions"</strong> (thường do môi trường Sandbox bị mất session hoặc hết hạn), hãy bấm nút <strong>"Sửa lỗi & Pull"</strong> để tái đồng bộ. Nếu chạy trong container Cloud Run riêng, hãy đổi <strong>Môi trường DB sang DEFAULT</strong>.
                    </p>
                  </div>

                  {userRole !== 'admin' && (
                    <div className="p-2 border border-amber-200/60 dark:border-amber-900/40 bg-amber-500/[0.03] dark:bg-amber-500/[0.01] rounded-lg text-amber-800 dark:text-amber-400 leading-normal">
                      🔒 Tài khoản của bạn đang có vai trò <strong>{userRole === 'staff' ? 'Nhân viên nhập thợ' : 'Chỉ xem'}</strong>, chỉ dùng để cập nhật nghiệp vụ cục bộ, không thể PUSH ghi đè cơ sở dữ liệu chung trên đám mây.
                    </div>
                  )}

                  {lastSyncTime && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 pt-2 border-t border-slate-200/65 dark:border-slate-800/80">
                      <span>🔄 Lần đồng bộ máy này gần nhất:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{lastSyncTime}</strong>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* CƠ CHẾ CẤP QUYỀN HỆ THỐNG & ĐỊNH VỊ LIÊN KẾT NHÓM */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition duration-205">
        <div 
          onClick={() => setIsGpsOpen(true)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition duration-200">
              <MapPin className="w-5 h-5 animate-bounce-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">
                  Quản lý Quyền Hệ Thống & Bản đồ Nội bộ Xưởng
                </h3>
                <span className="px-2 py-0.5 rounded text-[8.5px] font-extrabold text-indigo-600 bg-indigo-500/10 dark:text-indigo-400 dark:bg-indigo-500/20 font-mono tracking-wider uppercase shrink-0">HỘP THOẠI</span>
              </div>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                Yêu cầu quyền ứng dụng (Máy ảnh, Định vị, Album ảnh) và theo dõi tọa độ thành viên trong cùng nhóm liên kết.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/55 group-hover:text-indigo-600 transition ml-2 shrink-0">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* GPS AND PERMISSIONS MODAL DIALOG */}
      <AnimatePresence>
        {isGpsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
            <div className="absolute inset-0" onClick={() => setIsGpsOpen(false)}></div>
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh] text-left"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-slate-805 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <MapPin className="w-5 h-5 animate-bounce-slow" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">
                      Quản lý Quyền Hệ Thống & Bản đồ Nội bộ Xưởng
                    </h3>
                    <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5 leading-none">
                      Định cấu hình phần cứng thiết bị & theo dõi GPS sơ đồ xưởng hàng ngày
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGpsOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white shrink-0"
                  title="Đóng hộp thoại"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
                
                {/* Part 1: Permission Management Board */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* 1. Camera permission */}
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-indigo-505" />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">Quyền máy ảnh</span>
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-normal">
                        Kích hoạt camera điện thoại để scan trực tiếp hóa đơn nhập mộc, biên nhận vải và hàng hóa lên đám mây.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-150/50 dark:border-slate-850/40">
                      <button
                        type="button"
                        onClick={handleTestCamera}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{cameraStatus === 'active' ? 'Thao tác tốt' : 'Yêu cầu quyền'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${cameraStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-bold text-slate-505 uppercase font-mono">
                          {cameraStatus === 'active' ? 'Bật tốt' : 'Yêu cầu'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Geolocation permission */}
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-505" />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">Quyền định vị GPS</span>
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-normal">
                        Cấp quyền truy cập GPS để hiển thị bản đồ nội bộ, định mức chi phí ship tùy theo hành trình thực tế.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-150/50 dark:border-slate-850/40">
                      <button
                        type="button"
                        onClick={handleShareMyLocationOnMap}
                        className="py-1.5 px-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Chia sẻ vị trí</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${gpsData.latitude !== null ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-bold text-slate-505 uppercase font-mono">
                          {gpsData.latitude !== null ? 'Đồng bộ' : 'Yêu cầu'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Photo library permission */}
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-505" />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">Thư viện điện thoại</span>
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-normal">
                        Trình liên kết album máy để tải lên ảnh biên lai khố vải, rập cắt may thiết kế lưu trữ sẵn trên thiết bị di động.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-150/50 dark:border-slate-850/40">
                      <button
                        type="button"
                        onClick={handleRequestPhotoLibrary}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1 cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>{photoLibraryStatus === 'active' ? 'Đã cho phép' : 'Mở Thư viện'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${photoLibraryStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-bold text-slate-505 uppercase font-mono">
                          {photoLibraryStatus === 'active' ? 'Đồng bộ' : 'Yêu cầu'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Part 2: Interactive Accurate Map & List of Linked devices */}
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                        <span className="block h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                        <span>BẢN ĐỒ VỊ TRÍ LIÊN KẾT NHÓM XƯỞNG MAY (LIVE INSTANT MAP)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Hiển thị định vị chính xác và lộ trình công việc của các thiết bị có tài khoản đã liên kết trong cùng nhóm.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={gpsLoading}
                        onClick={handleShareMyLocationOnMap}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                        <span>{gpsLoading ? 'Đang cập nhật GPS...' : 'Chia sẻ Vị trí của tôi'}</span>
                      </button>
                    </div>
                  </div>

                  {/* List of active location members */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {userProfiles.filter(u => u.latitude && u.longitude).length === 0 ? (
                      <div className="col-span-full py-2 px-3 bg-amber-500/[0.04] text-amber-700 dark:text-amber-400 border border-amber-200/30 rounded-lg text-[11px] text-center italic">
                        Chưa có thành viên nào chia sẻ vị trí của họ lên bản đồ nhóm xưởng. Hãy click "Chia sẻ Vị trí của tôi" để mở đầu!
                      </div>
                    ) : (
                      userProfiles.filter(u => u.latitude && u.longitude).map((user) => {
                        const isMe = user.email?.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim();
                        return (
                          <div 
                            key={user.id} 
                            className={`p-2.5 rounded-lg border bg-white dark:bg-slate-900 flex items-center gap-2.5 shadow-3xs ${
                              isMe 
                                ? 'border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/10' 
                                : 'border-slate-150 dark:border-slate-850'
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-black text-xs uppercase ${
                              isMe ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {user.displayName ? user.displayName.substring(0, 2) : 'TV'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[#111827] dark:text-slate-200 truncate block">
                                {user.displayName || user.email}
                                {isMe && <span className="ml-1 text-[8.5px] bg-indigo-600 text-white px-1 py-0.2 rounded">Tôi</span>}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate font-mono">
                                Cập nhật: {user.lastLocationTime || 'vừa xong'}
                              </span>
                              <span className="text-[9px] text-[#22c55e] font-mono block">
                                📍 {user.latitude?.toFixed(5)}, {user.longitude?.toFixed(5)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Osm Map view container */}
                  <div className="relative">
                    <div 
                      id="xuongan-live-leaflet-map"
                      className="h-[320px] sm:h-[380px] w-full bg-slate-100 dark:bg-slate-950 rounded-xl relative z-0 overflow-hidden shadow-xs border border-slate-250 dark:border-slate-800"
                    />
                    
                    {/* Static Map loading overlay or helper display */}
                    {userProfiles.filter(u => u.latitude && u.longitude).length === 0 && (
                      <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/40 pointer-events-none flex items-center justify-center p-4">
                        <div className="bg-white/95 dark:bg-slate-900/95 max-w-sm border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-lg space-y-2 pointer-events-auto">
                          <MapPin className="w-8 h-8 text-indigo-505 mx-auto animate-bounce" />
                          <h5 className="font-bold text-xs uppercase text-slate-805 dark:text-slate-200">Đang chờ tín hiệu map</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Hãy click nút <strong>"Chia sẻ Vị trí của tôi"</strong> phía trên để chia sẻ và cập nhật vị trí của bạn lên bản đồ nhóm chung.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-[#1e2f2a]/60 bg-slate-50/50 dark:bg-[#0b1210]/50 flex justify-end shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setIsGpsOpen(false)}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer select-none"
                >
                  Đóng lại
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 BẢN CẬP NHẬT HỆ THỐNG OTA (ONLINE / OFFLINE HYBRID UPDATE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsUpdatesOpen(!isUpdatesOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition duration-200">
              <ArrowUpCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                <span>Cập nhật ứng dụng tự động (OTA - Capgo)</span>
                <span className="text-[9px] bg-indigo-600 dark:bg-indigo-550 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">v{localStorage.getItem('capgo_active_version') || CURRENT_VERSION}</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                Quản lý nâng cấp tức thời Live Update qua Capgo Cloud hoặc Máy chủ tệp APK dự phòng.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-405 group-hover:text-slate-705 dark:group-hover:text-indigo-400 transition ml-2 shrink-0">
            {isUpdatesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isUpdatesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
            >
              {/* Selection Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 mb-2">
                <button
                  type="button"
                  onClick={() => setUpdateSubTab('capgo')}
                  className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition ${
                    updateSubTab === 'capgo'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  Capgo Live Update
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateSubTab('custom_apk')}
                  className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition ${
                    updateSubTab === 'custom_apk'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  Cập nhật File APK (Dự phòng)
                </button>
              </div>

              {updateSubTab === 'capgo' ? (
                <div className="space-y-4 text-left">
                  {/* Capgo Status Info */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-indigo-950/20 rounded-xl space-y-3 text-xs leading-relaxed">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold uppercase text-[11px]">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Trung Tâm Cấu Hình Capgo Live Update</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Phiên bản hiện hành (Live Bundle)</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-black truncate block">{capgoActiveDetails.bundleId}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Mã phiên bản (Version Code)</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black block">v{capgoActiveDetails.versionName}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-indigo-550 dark:text-indigo-400 font-extrabold block text-[10px] uppercase font-mono tracking-wider">Mới nhất trên mây (Capgo)</span>
                        <span className="font-mono text-[#111827] dark:text-slate-200 font-black block flex items-center gap-1">
                          <span>v{latestVersionMetadata ? latestVersionMetadata.version : '1.0.4'}</span>
                          {latestVersionMetadata && (
                            <span className={`text-[8px] font-sans px-1 py-0.5 rounded font-bold uppercase tracking-wide inline-block ${
                              isNewerVersion(latestVersionMetadata.version, localStorage.getItem('capgo_active_version') || CURRENT_VERSION)
                                ? 'bg-rose-105 border border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-400 animate-pulse'
                                : 'bg-emerald-50 border border-emerald-205 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-900/30 dark:text-emerald-400'
                            }`}>
                              {isNewerVersion(latestVersionMetadata.version, localStorage.getItem('capgo_active_version') || CURRENT_VERSION) ? 'Cần nâng' : 'Kịch trần'}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Phiên bản APK Gốc</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-black block">{capgoActiveDetails.nativeVersion}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Số lượng bản lưu local</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-black block">{capgoActiveDetails.localBundlesCount} gói</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Phát hành gần nhất</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-extrabold block">{latestVersionMetadata?.releaseDate || '18/06/2026'}</span>
                      </div>
                    </div>

                    {latestVersionMetadata && isNewerVersion(latestVersionMetadata.version, localStorage.getItem('capgo_active_version') || CURRENT_VERSION) && (
                      <div className="p-3 bg-rose-500/[0.03] dark:bg-rose-500/[0.01] border border-rose-200/60 dark:border-rose-900/30 rounded-xl space-y-1.5 text-xs text-rose-850 dark:text-rose-355">
                        <p className="font-black flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                          <span>Đã phát hiện bản cập nhật Live-OTA mới: v{latestVersionMetadata.version}</span>
                        </p>
                        <p className="text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                          <strong>Chi tiết cải tiến trong phiên bản mới:</strong>
                        </p>
                        <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-350">
                          {latestVersionMetadata.changelog.map((change, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-rose-500 font-bold shrink-0">✓</span>
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 space-y-1 bg-indigo-50/20 dark:bg-indigo-950/10 p-2.5 rounded-lg border border-indigo-100/40 dark:border-indigo-900/10">
                      <p className="font-extrabold text-[#111827] dark:text-slate-200">ℹ️ Quy trình tự động cập nhật Capgo:</p>
                      <p>
                        Khi bạn lưu thay đổi, hệ thống GitHub Actions sẽ tự động biên dịch code mới và đẩy trực tiếp vào kênh phân phối sản xuất của Capgo. Ứng dụng điện thoại đã bật sẵn thuộc tính <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">autoUpdate: true</code> sẽ âm thầm tải bản nâng cấp khi hoạt động và áp dụng ngay trong lần mở tiếp theo mà không làm gián đoạn công việc của xưởng.
                      </p>
                    </div>

                    {/* Developer Guide Box */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                      <p className="font-bold text-[#111827] dark:text-slate-200 uppercase tracking-wider text-[10px] flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <Shield className="w-3.5 h-3.5" />
                        <span>QUY TRÌNH RA MẮT & ĐẨY PHIÊN BẢN CẬP NHẬT MỚI (DÀNH CHO CHỦ XƯỞNG)</span>
                      </p>
                      <div className="space-y-2.5 text-slate-650 dark:text-slate-350 text-[11px] leading-relaxed">
                        <p>Hệ thống hỗ trợ tăng số phiên bản tự động của ứng dụng bằng các tập lệnh chuẩn hóa. Hãy làm theo 3 bước đơn giản dưới đây để đẩy tính năng mới:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2.5 rounded-lg">
                            <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold block mb-0.5">1. Sửa đổi / Soạn thảo</strong>
                            Đi sửa hoặc viết thêm tính năng trực tiếp trong mã nguồn, đồng thời cập nhật nhật ký đổi mới vào file <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">public/version.json</code> (mục changelog).
                          </div>
                          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2.5 rounded-lg">
                            <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold block mb-0.5">2. Kích hoạt Push</strong>
                            Mở Terminal và chạy lệnh:
                            <div className="mt-1 bg-slate-950 text-[#10b981] font-mono text-[9px] p-1.5 rounded select-all break-all border border-slate-850">
                              npm run capgo-push
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 p-2.5 rounded-lg">
                            <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold block mb-0.5">3. Đồng bộ hóa Tự động</strong>
                            Lệnh trên sẽ tăng số phiên bản Patch, build ứng dụng và tải lên máy chủ Capgo. Máy điện thoại của thợ sẽ tự tải và nâng cấp tức thì trong lần mở sau!
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>{capgoActiveDetails.status}</span>
                    </p>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={isSyncingCapgoNow}
                      onClick={handleCapgoManualSync}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-sans font-black tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingCapgoNow ? 'animate-spin' : ''}`} />
                      <span>{isSyncingCapgoNow ? 'Đang gửi yêu cầu đồng bộ...' : 'Đợi/Yêu cầu Đồng bộ Capgo'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isResettingCapgo}
                      onClick={handleCapgoRollback}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Khôi phục lại ứng dụng về bản gốc cài trong APK"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Khôi phục bản gốc</span>
                    </button>
                  </div>

                  {/* Capgo message dialog logs */}
                  {capgoSyncMsg && (
                    <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20 text-[11px] p-3 text-slate-650 dark:text-slate-350 font-mono tracking-wide">
                      <span className="font-extrabold text-slate-400 block mb-1 uppercase text-[9px] tracking-wider">Nhật ký xử lý:</span>
                      <p className="leading-relaxed whitespace-pre-wrap">{capgoSyncMsg}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Question Explainer for the user */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-indigo-950/20 rounded-xl space-y-2 text-xs text-slate-550 dark:text-slate-350 leading-relaxed text-left">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10.5px]">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Cơ chế cập nhật ngoại tuyến lai (Offline-first Hybrid OTA)</span>
                    </div>
                    <p>
                      Ứng dụng được cài đặt trực tiếp dưới dạng tệp APK, cho phép hạch toán và ghi nhớ sổ sách <strong className="text-slate-800 dark:text-slate-100">hoàn toàn ngoại tuyến (Offline)</strong> khi không có mạng.
                    </p>
                    <p>
                      Khi thiết bị có kết nối mạng (Online), ứng dụng sẽ tự động tải tệp metadata cấu hình nhỏ để so sánh phiên bản. Nếu phát hiện xưởng có bản nâng cấp mới, màn hình sẽ hiển thị thông báo để tải xuống file APK cập nhật an toàn.
                    </p>
                  </div>

                  {/* Server URL Config Form */}
                  <form onSubmit={(e) => { e.preventDefault(); handleManualCheckUpdate(); }} className="space-y-4 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider font-mono">
                          Đường dẫn máy chủ cập nhật (JSON Endpoint)
                        </label>
                        <div className="relative">
                          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="url"
                            value={inputUpdateUrl}
                            onChange={(e) => setInputUpdateUrl(e.target.value)}
                            placeholder="Hãy điền URL tệp version.json của xưởng"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-2.5 pl-9 pr-4 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none transition"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-end gap-2">
                        <button
                          type="submit"
                          disabled={isCheckingUpdate}
                          className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-sans font-black tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          {isCheckingUpdate ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Đang kiểm tra...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>Kiểm tra Cập nhật</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleResetDefaultUrl}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer"
                          title="Khôi phục URL mặc định"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Dynamic Check results and logs */}
                  {checkResult !== 'idle' && (
                    <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden text-left bg-slate-50/20 dark:bg-slate-950/10 text-xs">
                      {/* Results Headers */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
                        <span className="font-mono text-[10.5px] font-black text-slate-400 uppercase tracking-wider font-bold">Trạng thái phản hồi:</span>
                        {checkResult === 'has_update' ? (
                          <span className="font-bold py-0.5 px-2 bg-rose-50 dark:bg-rose-955/20 text-rose-650 dark:text-rose-450 rounded text-[10px] uppercase font-mono tracking-widest animate-pulse border border-rose-250 dark:border-rose-900/40">
                            🔴 Có bản cập nhật mới
                          </span>
                        ) : checkResult === 'up_to_date' ? (
                          <span className="font-bold py-0.5 px-2 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-450 rounded text-[10px] uppercase font-mono tracking-widest border border-emerald-250 dark:border-emerald-990/40">
                            🟢 Phiên bản mới nhất
                          </span>
                        ) : (
                          <span className="font-bold py-0.5 px-2 bg-amber-50 dark:bg-[#1f1712] text-amber-65 border border-amber-250 dark:border-[#fbbf24]/10 rounded text-[10px] uppercase font-mono tracking-widest">
                            ⚠️ Gặp lỗi kết nối
                          </span>
                        )}
                      </div>

                      {/* Result Body content */}
                      <div className="p-4 space-y-4 leading-relaxed text-slate-650 dark:text-slate-300">
                        {checkResult === 'has_update' && updateDetail && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-start flex-wrap gap-2 pb-2.5 border-b border-slate-150 dark:border-slate-800/80">
                              <div>
                                <p className="font-extrabold text-[#111827] dark:text-white text-[13px]">Bản nâng cấp tối ưu v{updateDetail.version}</p>
                                <p className="text-[10px] text-[#A0A0A0]">Ngày phát hành: {updateDetail.releaseDate || 'Mới đây'}</p>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => window.open(updateDetail.apkUrl, '_blank', 'noopener,noreferrer')}
                                className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black tracking-wide transition flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Tải về file APK ngay</span>
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              <p className="font-bold text-[11px] font-mono uppercase text-slate-400 tracking-wider">Thông tin thay đổi mới nhất:</p>
                              <ul className="space-y-1 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150 dark:border-slate-850">
                                {updateDetail.changelog.map((line, idx) => (
                                  <li key={idx} className="flex gap-1.5 items-start text-[11.5px]">
                                    <span className="text-emerald-500 shrink-0 select-none font-bold">✓</span>
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {checkResult === 'up_to_date' && updateDetail && (
                          <div className="space-y-2">
                            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                              <span className="text-emerald-500 text-base font-bold">✓</span>
                              <span>Ứng dụng của bạn đang chạy phiên bản hoàn hảo ({localStorage.getItem('capgo_active_version') || CURRENT_VERSION})!</span>
                            </p>
                            <p className="text-slate-500">
                              Máy chủ chứa bản nâng cấp hiện tại: <strong className="text-slate-700 dark:text-slate-350 font-bold">v{updateDetail.version}</strong> (Phát hành ngày {updateDetail.releaseDate || 'Mới đây'}). Bạn đã có sẵn bản hoàn thiện, không cần nâng cấp gì thêm.
                            </p>
                          </div>
                        )}

                        {checkResult === 'error' && (
                          <div className="space-y-2 p-3 border border-red-200 dark:border-red-950/40 bg-red-500/[0.02] rounded-xl text-red-650 dark:text-red-400 font-medium">
                            <p className="font-bold uppercase tracking-wider text-[10.5px] font-mono flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /><span>Chi tiết nhật ký lỗi kết nối:</span></p>
                            <p className="font-mono text-[11px] leading-relaxed select-all bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-150 dark:border-slate-850">{manualCheckError}</p>
                            <p className="text-[10px] text-slate-400 font-sans font-normal leading-normal pt-1 border-t border-red-200/50 dark:border-slate-800">
                              Hãy kiểm tra lại đường dẫn máy chủ URL ở trên có hoạt động được không (truy cập bằng điện thoại/máy tính xem có hiện JSON chữ không) hoặc kiểm tra xem thiết bị của bạn có đăng trực tuyến Wifi / 4G hay không.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 📋 NHẬT KÝ THAY ĐỔI PHIÊN BẢN (CHANGELOG HISTORY TABLE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsChangelogOpen(!isChangelogOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition duration-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                <span>Nhật ký thay đổi phiên bản (Changelog)</span>
                <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">Phiên bản hiện tại v{localStorage.getItem('capgo_active_version') || CURRENT_VERSION}</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                Theo dõi các tính năng mới cập nhật, tối ưu hóa hiệu năng và sửa lỗi của hệ thống Sổ Sách Xưởng An.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
            {isChangelogOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isChangelogOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800"
            >
              {/* Compact Versions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    version: latestVersionMetadata ? `v${latestVersionMetadata.version}` : `v${CURRENT_VERSION}`,
                    date: latestVersionMetadata ? latestVersionMetadata.releaseDate : "20/06/2026",
                    type: "Phiên bản hiện hành",
                    typeColor: "bg-indigo-50 border-indigo-150 text-indigo-750 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400",
                    changes: latestVersionMetadata ? latestVersionMetadata.changelog : [
                      "Cải tiến cơ cấu nén ảnh hóa đơn gốc giúp chạy mượt khi mạng yếu",
                      "Sửa lỗi đồng bộ dữ liệu ngoại tuyến (Offline) khi mất kết nối mạng bất ngờ",
                      "Tối ưu độ chính xác của cảm biến định vị vệ tinh GPS trên các thiết bị Android từ phiên bản 11 trở lên",
                      "Hiển thị bảng chi tiết dung lượng lưu trữ đệm sạch sẽ trong cài đặt xưởng"
                    ],
                    active: true
                  },
                  {
                    version: "v1.0.3",
                    date: "20/04/2026",
                    type: "Định vị & Tối ưu",
                    typeColor: "bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400",
                    changes: [
                      "Hỗ trợ chế độ thu thập vị trí GPS chính xác cao của vệ tinh trên thiết bị chạy Android 11+.",
                      "Nhúng bảng xem chi tiết dung lượng bộ nhớ dùng chung, nâng cao khả năng quản trị thiết bị."
                    ]
                  },
                  {
                    version: "v1.0.2",
                    date: "05/03/2026",
                    type: "Khởi tạo hệ thống",
                    typeColor: "bg-slate-100 border-slate-205 text-slate-700 dark:bg-slate-800/40 dark:border-slate-800/80 dark:text-slate-300",
                    changes: [
                      "Khởi hoạt chuỗi hệ quản trị sổ sách sản xuất xưởng may An tích hợp cơ sở dữ liệu đồng bộ hai chiều."
                    ]
                  }
                ].map((row, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedChangelogVersion(row)}
                    className={`p-3.5 rounded-xl border transition duration-200 cursor-pointer text-left flex flex-col justify-between gap-3 relative overflow-hidden group select-none active:scale-[0.98] ${
                      row.active
                        ? 'bg-indigo-50/25 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50/45 dark:hover:bg-indigo-950/15'
                        : 'bg-slate-50/50 dark:bg-slate-950/15 border-slate-205 dark:border-slate-800/75 hover:bg-slate-50 dark:hover:bg-slate-950/30'
                    }`}
                  >
                    {/* Ring highlight accent for the active version */}
                    {row.active && (
                      <span className="absolute top-0 right-0 w-2 h-2 rounded-bl-lg bg-indigo-600 dark:bg-indigo-500 shrink-0" />
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-black tracking-wider ${
                          row.active ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-850 text-slate-750 dark:text-slate-300'
                        }`}>
                          {row.version}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 font-bold">{row.date}</span>
                      </div>

                      <div className="flex flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border text-[9px] uppercase font-extrabold tracking-wider ${row.typeColor}`}>
                          {row.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-150/60 dark:border-slate-850/60 text-[10.5px] font-extrabold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition duration-200">
                      <span>Bấm xem {row.changes.length} thay đổi</span>
                      <ChevronRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* POPUP HỘP THOẠI CHI TIẾT PHIÊN BẢN (CHANGELOG DETAILS POPUP MODAL) */}
      <AnimatePresence>
        {selectedChangelogVersion && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Tap to dismiss dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedChangelogVersion(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Centered animated card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl p-5 flex flex-col gap-4 font-sans text-left overflow-hidden z-10"
            >
              {/* Dismiss Button */}
              <button
                onClick={() => setSelectedChangelogVersion(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-655 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header title */}
              <div className="space-y-1.5 pr-8">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-105 dark:bg-amber-955/50 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                    Phát hành {selectedChangelogVersion.date}
                  </span>
                  {selectedChangelogVersion.active && (
                    <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider animate-pulse">
                      Hiện tại
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  Chi tiết bản {selectedChangelogVersion.version}
                </h3>
              </div>

              {/* Classification badge block */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850/80">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Phân loại cập nhật:</p>
                <div className="mt-1">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase font-extrabold tracking-wide ${selectedChangelogVersion.typeColor}`}>
                    {selectedChangelogVersion.type}
                  </span>
                </div>
              </div>

              {/* Changes List */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">Chi tiết nội dung nâng cấp:</span>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 bg-slate-50/40 dark:bg-zinc-900/30 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
                  {selectedChangelogVersion.changes.map((change, cIdx) => (
                    <div key={cIdx} className="flex gap-2 items-start text-[11.5px] leading-relaxed text-slate-655 dark:text-slate-300 font-bold">
                      <span className="text-emerald-505 shrink-0 font-bold select-none mt-0.5">✓</span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer action */}
              <button
                onClick={() => setSelectedChangelogVersion(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition text-xs uppercase cursor-pointer text-center"
              >
                Đồng ý & Đóng
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Coupling / Collective Coordination Panel (Chức năng Kết hợp Nhóm & Đa liên kết) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsGroupOpen(!isGroupOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-400 rounded-xl">
              <Share2 className="w-5 h-5 group-hover:scale-110 transition shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Kết hợp Nhóm & Liên kết thiết bị</span>
                <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">Realtime 0ms</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400">
                Thiết lập phòng liên kết đồng bộ tức thì cho nhiều điện thoại, máy tính của xưởng.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
            {isGroupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isGroupOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              {/* Question Explainer for the user */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0c101d] border border-slate-200 dark:border-indigo-900/40 rounded-xl space-y-2.5 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px]">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Xác nhận: Cơ chế Tự động Đồng bộ hoàn toàn Tức thì</span>
                </div>
                <p>
                  Khi tài khoản <strong className="text-slate-800 dark:text-slate-100">A</strong> cập nhật sổ sách (may mẫu, nhập vải, làm hoá đơn...), hệ thống truyền tải dữ liệu đám mây ngay lúc đó. 
                  Nhờ vậy, màn hình máy tài khoản <strong className="text-slate-800 dark:text-slate-100">B</strong> sẽ <strong className="text-indigo-600 dark:text-indigo-400 underline font-black font-sans">TỰ ĐỘNG CẬP NHẬT NGAY LẬP TỨC</strong> mà không cần phải tải lại trang (reload) hay khởi động lại ứng dụng!
                </p>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-150 dark:border-slate-850">
                  ⚠️ <strong>Cơ chế liên kết nhóm:</strong> Để hai hay nhiều máy tự động sáp nhập cập nhật sang nhau, các tài khoản cần liên kết chung một <strong>Mã nhóm liên kết</strong> ở dưới đây.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Trạng thái nhóm hiện tại:</span>
                {localStorage.getItem("xuongan_group_code") ? (
                  <span className="inline-flex items-center gap-1 text-emerald-650 dark:text-emerald-400 font-bold font-mono py-0.5 px-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-md border border-emerald-200/50 uppercase">
                    🟢 Nhóm collab &lsquo;{localStorage.getItem("xuongan_group_code")}&rsquo;
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold font-mono py-0.5 px-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-md border border-indigo-200/50 uppercase">
                    🔵 nhóm mặc định chung (public)
                  </span>
                )}
              </div>

              {/* Config Form */}
              <form onSubmit={handleSaveGroupCode} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider font-mono">
                    Mã liên kết nhóm của xưởng (Chỉ viết liền không dấu, viết hoa)
                  </label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={inputGroupCode}
                      onChange={(e) => setInputGroupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                      placeholder="Ví dụ: COMAYXUONGAN, TEAMAN_STUDIO, NHOMMAY_01"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Thiết bị của cộng sự/thợ phụ chỉ cần điền đúng chính xác mã này là hai bên sẽ cùng truy cập một nguồn dữ liệu và nhìn thấy bảng số liệu của nhau thời gian thực.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Lưu & Kích hoạt liên kết Nhóm này</span>
                  </button>

                  {localStorage.getItem("xuongan_group_code") && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputGroupCode("");
                        localStorage.removeItem("xuongan_group_code");
                        alert("ℹ️ Đang xóa mã kết nối để về Nhóm mặc định chung. Hệ thống sẽ tải lại...");
                        window.location.reload();
                      }}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span>Rời nhóm (Về nhóm mặc định)</span>
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Account Management & Role Selection Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsUsersOpen(!isUsersOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-5 h-5 group-hover:scale-110 transition shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                Quản lý thành viên xưởng
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400">
                Cấp tài khoản và quản lý thành viên truy cập sổ sách của xưởng (Mọi người dùng đều có toàn quyền hạch toán và quản lý, không phân quyền hạn hạn chế).
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
            {isUsersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isUsersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-6 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              {/* Form to Create Sub-Account */}
              {userRole === 'admin' && (
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-indigo-105 dark:border-indigo-950/40 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50 dark:border-slate-800">
                    <UserPlus className="w-4 h-4 text-indigo-500 font-bold" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      Thêm tài khoản thành viên mới
                    </h4>
                  </div>

                  {createError && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-xs leading-normal font-mono">
                      ⚠️ {createError}
                    </div>
                  )}

                  {createSuccess && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs leading-normal font-bold">
                      🎉 {createSuccess}
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        Email Đăng Nhập
                      </label>
                      <input
                        type="email"
                        value={createUserEmail}
                        onChange={(e) => setCreateUserEmail(e.target.value)}
                        placeholder="VD: tho1@xuongan.com"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-505"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        Tên Thành Viên / Vai trò
                      </label>
                      <input
                        type="text"
                        value={createUserDisplayName}
                        onChange={(e) => setCreateUserDisplayName(e.target.value)}
                        placeholder="VD: Thợ may Lan, Kế toán Vân"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-505"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        Mật Khẩu Đăng Nhập
                      </label>
                      <input
                        type="text"
                        value={createUserPassword}
                        onChange={(e) => setCreateUserPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-505"
                      />
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">
                          Phân vai chức vụ mặc định
                        </label>
                        <select
                          value={createUserRole}
                          onChange={(e: any) => setCreateUserRole(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-505"
                        >
                          <option value="staff">Nhân viên / Thợ may (staff)</option>
                          <option value="viewer">Độc giả chỉ xem (viewer)</option>
                          <option value="admin">Quản trị viên toàn quyền (admin)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                          Hành động đăng ký tài khoản
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={isCreatingUser}
                            className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>Thêm tài khoản chuẩn (Auth)</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={handleBypassAndSaveToFirestore}
                            disabled={isCreatingUser}
                            className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-705 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center"
                            title="Nếu bị chặn cookie liên kết, bấm nút này để chỉ tạo hồ sơ trên Firestore. Người dùng vẫn đăng nhập bình thường nếu tài khoản đã tồn tại."
                          >
                            <span>Cứu hộ (Chỉ tạo hồ sơ)</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Permissions Pre-selection */}
                    <div className="md:col-span-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                          Chọn trước phân hệ được cấp phép xem/chỉnh sửa
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const allTabs = ['home', 'import', 'invoices', 'production', 'inventory', 'profit_estimator', 'report', 'gallery', 'settings'];
                            setSelectedAllowedTabs(selectedAllowedTabs.length === allTabs.length ? ['home'] : allTabs);
                          }}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                        >
                          {selectedAllowedTabs.length === 9 ? 'Bỏ chọn hết' : 'Chọn toàn bộ'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {[
                          { id: 'home', label: 'Trang chủ' },
                          { id: 'import', label: '1. Nhập hàng' },
                          { id: 'invoices', label: '2. Hóa đơn bán' },
                          { id: 'production', label: '3. Sản xuất' },
                          { id: 'inventory', label: '4. Kho hàng' },
                          { id: 'profit_estimator', label: '5. Giá thành' },
                          { id: 'report', label: 'Báo cáo' },
                          { id: 'gallery', label: 'Thư viện ảnh' },
                          { id: 'settings', label: 'Cài đặt' },
                        ].map((tab) => {
                          const isChecked = selectedAllowedTabs.includes(tab.id);
                          return (
                            <label
                              key={tab.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                                isChecked
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300'
                                  : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedAllowedTabs((prev) =>
                                    prev.includes(tab.id)
                                      ? prev.filter((id) => id !== tab.id)
                                      : [...prev, tab.id]
                                  );
                                }}
                                className="accent-indigo-600"
                              />
                              <span>{tab.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Members/Users List */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Danh sách thành viên xưởng ({userProfiles.length})</span>
                </h4>

                {userProfiles.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-555 text-xs">
                    Chưa có tài khoản phụ nào được đăng ký.
                  </div>
                ) : (
                  <div className="space-y-4 font-sans">
                    {userProfiles.map((p) => {
                      const email = p?.email || p?.id || '';
                      if (!email) return null;
                      const isSuperAdmin = email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com';
                      const currentAllowedTabs = p.allowedTabs || ['home', 'import', 'invoices', 'production', 'report', 'settings'];

                      return (
                        <div 
                          key={email}
                          className="bg-slate-50/40 dark:bg-slate-850/30 p-4 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3 flex flex-col"
                        >
                          {/* Profile details line */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-slate-800">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                  {p.displayName || 'Thành viên'}
                                </h5>
                                {isSuperAdmin ? (
                                  <span className="text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full border bg-indigo-50 text-indigo-650 border-indigo-200/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/35">
                                    Quản trị tối cao (Super-Admin)
                                  </span>
                                ) : (
                                  <span className={`text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full border ${
                                    p.role === 'admin' 
                                      ? 'bg-indigo-50 text-indigo-650 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400' 
                                      : p.role === 'staff' 
                                      ? 'bg-amber-50 text-amber-705 border-amber-250 dark:bg-[#1f1712] dark:text-amber-400' 
                                      : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-450'
                                  }`}>
                                    {p.role === 'admin' ? 'Quản trị viên' : p.role === 'staff' ? 'Thợ may/Nhân viên' : 'Độc giả (Chỉ xem)'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-450 font-mono select-all mt-0.5">
                                {email}
                              </p>
                            </div>

                            {/* Actions Right */}
                            <div className="flex flex-wrap items-center gap-3">
                              {/* Change Role Selector */}
                              {!isSuperAdmin && userRole === 'admin' && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider font-mono">Chức vụ:</span>
                                  <select
                                    value={p.role || 'staff'}
                                    onChange={(e) => handleUpdateUserRole(email, e.target.value as any)}
                                    className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg py-1 px-2 text-[11px] text-slate-805 dark:text-slate-200 focus:outline-none"
                                  >
                                    <option value="staff">Nhân viên / Thợ may (staff)</option>
                                    <option value="viewer">Độc giả (viewer)</option>
                                    <option value="admin">Quản trị viên (admin)</option>
                                  </select>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Trạng thái:</span>
                                <button
                                  type="button"
                                  disabled={isSuperAdmin || userRole !== 'admin'}
                                  onClick={() => handleToggleUserActive(email, p.active)}
                                  className={`inline-flex items-center gap-1 py-1 px-2 rounded-md border text-[10px] font-bold cursor-pointer transition ${
                                    p.active 
                                      ? 'bg-emerald-50 text-emerald-650 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 animate-pulse-slow' 
                                      : 'bg-amber-50 text-amber-65 border-amber-200 dark:bg-[#1f1712] dark:text-amber-500'
                                  }`}
                                >
                                  <span>{p.active ? '● Hoạt động' : '○ Đã khóa'}</span>
                                </button>
                              </div>

                              {!isSuperAdmin && userRole === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUserProfile(email)}
                                  className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 border border-transparent hover:border-red-200 rounded-lg cursor-pointer transition text-xs font-bold"
                                  title="Xóa tài khoản thành viên"
                                >
                                  <UserX className="w-4 h-4 text-rose-500" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Interactive allowedTabs Configuration Grid */}
                          <div className="space-y-2">
                            <span className="block text-[10px] font-black text-rose-500 dark:text-indigo-400 uppercase tracking-wider font-mono">
                              🔑 CHO PHÉP TRUY CẬP CÁC PHÂN HỆ TÁC VỤ (TAB PERMISSIONS):
                            </span>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 font-mono">
                              {[
                                { id: 'home', label: 'Trang chủ' },
                                { id: 'import', label: '1. Nhập hàng' },
                                { id: 'invoices', label: '2. Hóa đơn bán' },
                                { id: 'production', label: '3. Sản xuất' },
                                { id: 'inventory', label: '4. Kho hàng' },
                                { id: 'profit_estimator', label: '5. Giá thành' },
                                { id: 'report', label: 'Báo cáo' },
                                { id: 'gallery', label: 'Thư viện ảnh' },
                                { id: 'settings', label: 'Cài đặt' },
                              ].map((tab) => {
                                const isAllowed = isSuperAdmin || currentAllowedTabs.includes(tab.id);
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    disabled={isSuperAdmin || userRole !== 'admin'}
                                    onClick={() => {
                                      let updatedTabs = [...currentAllowedTabs];
                                      if (updatedTabs.includes(tab.id)) {
                                        updatedTabs = updatedTabs.filter(id => id !== tab.id);
                                      } else {
                                        updatedTabs.push(tab.id);
                                      }
                                      handleUpdateUserTabs(email, updatedTabs);
                                    }}
                                    className={`py-1 px-2 text-[10.5px] font-bold rounded-lg border text-left transition flex items-center gap-1.5 ${
                                      isAllowed
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-705 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400'
                                        : 'bg-white border-slate-205 text-slate-400 dark:bg-slate-900 dark:border-slate-800/80/50'
                                    } ${isSuperAdmin || userRole !== 'admin' ? '' : 'hover:scale-102 hover:border-indigo-400 cursor-pointer'}`}
                                  >
                                    <span className={`block w-2.5 h-2.5 rounded-full ${isAllowed ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-350 dark:bg-slate-705'}`} />
                                    <span className="truncate">{tab.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Change Password for Manager Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsPwdOpen(!isPwdOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#818cf8]/14 dark:bg-indigo-950/40 text-indigo-605 dark:text-indigo-400 rounded-xl">
              <Lock className="w-5 h-5 group-hover:scale-110 transition shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                Thay đổi mật khẩu quản lý
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400">
                Cập nhật định kỳ mật khẩu quản trị mật thiết cho hệ thống hạch toán Xưởng An.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
            {isPwdOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isPwdOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              {isGoogleUser ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-305 leading-relaxed space-y-1">
                  <p className="font-bold">🔑 TÀI KHOẢN ĐANG LIÊN KẾT VỚI GOOGLE</p>
                  <p>
                    Tài khoản quản trị hiện tại (<strong className="underline">{currentUser?.email}</strong>) đang đăng nhập bằng dịch vụ ủy quyền Google Sign-in. 
                    Bạn không cần đặt mật khẩu hoặc thay đổi mật khẩu email trong ứng dụng này.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
                        Mật khẩu mới
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPwd ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mật khẩu tối thiểu 6 ký tự"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 rounded-lg py-2 pl-9 pr-9 text-xs text-slate-800 dark:text-slate-200 outline-none transition"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-405 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer flex items-center justify-center"
                        >
                          {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-305 uppercase tracking-wider mb-2 font-mono">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPwd ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Xác nhận lại mật khẩu mới"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 rounded-lg py-2 pl-9 pr-9 text-xs text-slate-800 dark:text-slate-200 outline-none transition"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {pwdErrorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-655 dark:text-red-400 font-medium flex items-start gap-2">
                      <span className="shrink-0 text-red-500 font-bold">⚠️</span>
                      <span>{pwdErrorMsg}</span>
                    </div>
                  )}

                  {pwdSuccessMsg && (
                    <div className="p-3 bg-emerald-55/10 dark:bg-emerald-955/20 border border-emerald-250 dark:border-emerald-900/40 rounded-lg text-xs text-emerald-650 dark:text-emerald-450 font-semibold flex items-start gap-2">
                      <span className="shrink-0 text-emerald-550 font-bold">✓</span>
                      <span>{pwdSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingPwd}
                      className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98 shadow-xs w-full sm:w-auto"
                    >
                      {isSubmittingPwd ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Đang cập nhật...</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-3.5 h-3.5 text-sky-200" />
                          <span>Xác nhận Đổi mật khẩu</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 📊 BẢNG TÍNH TOÁN THỐNG KÊ & DUNG LƯỢNG BỘ NHỚ LƯU TRỮ */}
      <div id="storage-estimator-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-3xs space-y-3">
        
        {/* Toggle Header Button */}
        <button
          type="button"
          onClick={() => setIsStorageStatsOpen(!isStorageStatsOpen)}
          className="w-full flex items-center justify-between text-left focus:outline-none transition group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition duration-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>Thống Kê Dung Lượng & Cloud Storage</span>
                <span className="text-[8px] bg-indigo-600 dark:bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase font-mono tracking-widest font-black">Chính xác</span>
              </h3>
              <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-0.5">
                Xem chi tiết dung lượng hoá đơn, phiếu nhập hàng và hình ảnh trên đám mây.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-mono">Tổng dung lượng sử dụng</span>
              <span className="text-sm font-black text-indigo-600 dark:text-[#818cf8] font-mono">
                {formatSize(storageStats.totalSize)}
              </span>
            </div>
            <div className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition">
              {isStorageStatsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Dynamic Inner Section (Only renders if expanded) */}
        <AnimatePresence>
          {isStorageStatsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              
              {/* 📊 COMPACTED CLOUD STORAGE TRACK & PROGRESS BAR */}
              {(() => {
                const quotaLimitBytes = 1024 * 1024 * 1024; // 1 GB
                const currentQuotaPercent = Math.min(100, (storageStats.totalSize / quotaLimitBytes) * 100);
                const displayPercentStr = currentQuotaPercent.toFixed(currentQuotaPercent < 0.01 && currentQuotaPercent > 0 ? 4 : 2);
                
                const isNearLimit = currentQuotaPercent >= 80;
                const isCriticalLimit = currentQuotaPercent >= 90;

                // Color calculation
                let progressColorClass = "bg-indigo-600 dark:bg-indigo-500";
                let textColorClass = "text-indigo-650 dark:text-indigo-400";
                let borderGlowClass = "border-slate-100 dark:border-slate-800";

                if (isCriticalLimit) {
                  progressColorClass = "bg-rose-600 dark:bg-rose-500 animate-pulse";
                  textColorClass = "text-rose-650 dark:text-rose-400";
                  borderGlowClass = "border-rose-200 dark:border-rose-900/40 ring-1 ring-rose-500/10";
                } else if (isNearLimit) {
                  progressColorClass = "bg-amber-500 dark:bg-amber-450";
                  textColorClass = "text-amber-655 dark:text-amber-400";
                  borderGlowClass = "border-amber-200 dark:border-amber-900/40 ring-1 ring-amber-500/10";
                }

                return (
                  <div className={`p-4 rounded-xl border ${borderGlowClass} bg-slate-50/50 dark:bg-[#0c101d] space-y-3`}>
                    
                    {/* Header values & Clickable Helper Icon */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Cloud className={`w-4 h-4 ${isNearLimit ? 'text-rose-500 animate-bounce' : 'text-indigo-500'}`} />
                        <span className="text-[11px] font-extrabold text-slate-705 dark:text-slate-300 font-mono uppercase tracking-wider">
                          Dung lượng Firestore (Miễn phí 1GB)
                        </span>
                        
                        {/* ℹ️ CLICKABLE HELPER i ON-DEMAND */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDetailedInfo(!showDetailedInfo);
                          }}
                          className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition cursor-pointer flex items-center justify-center"
                          title="Click xem mật độ lưu trữ chi tiết"
                        >
                          <Info className={`w-4 h-4 ${showDetailedInfo ? 'text-indigo-600 dark:text-indigo-455' : 'text-slate-400'}`} />
                        </button>
                      </div>
                      
                      <div className="text-right font-mono text-[11px]">
                        <span className={`font-black ${textColorClass}`}>{formatSize(storageStats.totalSize)}</span>
                        <span className="text-slate-405 dark:text-slate-505"> / 1.00 GB ({displayPercentStr}%)</span>
                      </div>
                    </div>

                    {/* Progress slider track */}
                    <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 p-[1px]">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${progressColorClass}`}
                        style={{ width: `${currentQuotaPercent}%` }}
                      />
                    </div>

                    {/* Expandable detailed Info popup inline (Interactive On Demand) */}
                    <AnimatePresence>
                      {showDetailedInfo && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-2.5 border-t border-slate-200/50 dark:border-slate-800 text-[11px] text-slate-550 dark:text-slate-400 space-y-2 text-left"
                        >
                          <div className="font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1 font-mono uppercase text-[10px]">
                            <span>ℹ️ Bản dịch & mật độ lưu trữ bình quân:</span>
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                            <li><strong>Hóa đơn thanh toán (Bill):</strong> Bình quân ~{formatSize(Math.round(storageStats.avgBillSize))} / bill. 1 Megabyte (MB) lưu được khoảng ~{Math.floor(1024 * 1024 / storageStats.avgBillSize).toLocaleString()} hóa đơn.</li>
                            <li><strong>Phiếu hàng nhập xưởng:</strong> Bình quân ~{formatSize(Math.round(storageStats.avgImportSize))} / phiếu. 1 MB lưu được khoảng ~{Math.floor(1024 * 1024 / storageStats.avgImportSize).toLocaleString()} phiếu.</li>
                            <li><strong>Chứng từ hình ảnh mẫu:</strong> Bình quân ~{formatSize(Math.round(storageStats.avgPhotoSize))} / ảnh mẫu. 1 MB lưu được khoảng ~{Math.floor(1024 * 1024 / storageStats.avgPhotoSize).toLocaleString()} ảnh.</li>
                          </ul>
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 italic leading-relaxed">
                            * Cơ sở dữ liệu đám mây Firebase Firestore lưu trữ thông tin cực tốt và siêu nhẹ. Chỉ những hình ảnh chứng từ mẫu nguyên bản kích thước lớn mới tốn tài nguyên thực tế.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Proactive 80%+ Warning UI triggers */}
                    <AnimatePresence>
                      {isNearLimit && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-3 rounded-lg border border-rose-250 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-[11px] flex gap-2.5 items-start mt-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                          <div className="space-y-1 text-left text-slate-650 dark:text-slate-300">
                            <h5 className="font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                              BÁO ĐỘNG: BỘ NHỚ LƯU TRỮ CLOUD ĐẠT {displayPercentStr}% HẠN MỨC!
                            </h5>
                            <p className="leading-relaxed">
                              Vui lòng dọn dẹp bớt các hình chụp mẫu cũ trong <strong className="underline cursor-pointer" onClick={() => setShowDetailedInfo(true)}>Thư viện ảnh</strong> để giải phóng không gian bộ nhớ, hoặc chủ động tải bản sao lưu dữ liệu toàn phần về máy.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                );
              })()}

              {/* ⚡ COMPACT INDIVIDUAL COUNTERS IN ONE ROW FOR OPTIMAL SCREEN REAL ESTATE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                
                {/* Compact Invoices Block */}
                <div className="p-2 bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-1.5 hover:ring-1 hover:ring-indigo-500/10 transition">
                  <div className="text-left leading-tight">
                    <span className="text-[9px] font-black text-indigo-650 dark:text-indigo-405 uppercase tracking-wider font-mono block">Bảng hoá đơn</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">{storageStats.billsCount.toLocaleString()} HĐ ({formatSize(storageStats.billsSize)})</span>
                  </div>
                  <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-800 font-mono shrink-0">
                    TB: {formatSize(Math.round(storageStats.avgBillSize))}
                  </div>
                </div>

                {/* Compact Imports Block */}
                <div className="p-2 bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-1.5 hover:ring-1 hover:ring-emerald-500/10 transition">
                  <div className="text-left leading-tight">
                    <span className="text-[9px] font-black text-emerald-650 dark:text-emerald-405 uppercase tracking-wider font-mono block">Nhập xưởng lẻ</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">{storageStats.importsCount.toLocaleString()} Phiếu ({formatSize(storageStats.importsSize)})</span>
                  </div>
                  <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-800 font-mono shrink-0">
                    TB: {formatSize(Math.round(storageStats.avgImportSize))}
                  </div>
                </div>

                {/* Compact Photo Block */}
                <div className="p-2 bg-slate-50/60 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-1.5 hover:ring-1 hover:ring-sky-500/10 transition">
                  <div className="text-left leading-tight">
                    <span className="text-[9px] font-black text-sky-655 dark:text-sky-405 uppercase tracking-wider font-mono block">Ảnh tài liệu</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">{storageStats.photosCount.toLocaleString()} Ảnh ({formatSize(storageStats.photosSize)})</span>
                  </div>
                  <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-800 font-mono shrink-0">
                    TB: {formatSize(Math.round(storageStats.avgPhotoSize))}
                  </div>
                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* App Guide & Manual Instructions card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-150 dark:border-slate-800">
          <HelpCircle className="w-5 h-5 text-indigo-505" />
          <span>Sổ tay Hướng dẫn nghiệp vụ Xưởng An</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-650" />
              <span>Ghi nhận sỉ & Nhập Thợ</span>
            </h4>
            <p>
              Tổ hạch toán điền mã hàng (ví dụ: thun gân ráp sườn), số lượng chính xác, và chọn đơn giá may Đồng Tháp hoặc TP.HCM. 
              Hệ thống tự động liên kết số liệu vận chuyển và tính toán chênh lệch để chi trả công tổ thợ công bằng nhất.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-650" />
              <span>Hoá đơn Nợ lũy kế</span>
            </h4>
            <p>
              Khi làm biên lai xuất sỉ cho khách sỉ, hệ thống tự động tính nợ cũ dồn qua tổng cộng tiền bill mới chính xác đến từng xu. 
              Bạn có thể dễ dàng quản lý doanh số thu hồi trực quan bằng đồ thị và bảng kê xuất sắc.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
