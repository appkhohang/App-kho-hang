/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User, Bell, Shield, ShieldCheck, Menu, Info, RefreshCw, Layers, CheckCircle2, X, BarChart3, Database, Sun, Moon, HelpCircle, Download, Upload, AlertCircle, Trash2, Settings, FileSpreadsheet, Smartphone, Scissors, Home, TrendingUp, ShoppingCart, FileText, Factory, Calendar, DollarSign, ChevronRight, Palette, Image, Plus, Edit, ArrowUpDown, Boxes, Receipt, Package, ArrowRight, CheckSquare, Square, Users, Check, Filter } from 'lucide-react';
import LoginScreen from './components/LoginScreen';

// Statically imported child components/tabs to prevent hook errors and version mismatch bugs
import GoodsImportTab from './components/GoodsImportTab';
import ProductionTab from './components/ProductionTab';

import ReportTab from './components/ReportTab';
import SettingsTab from './components/SettingsTab';
import ProfitEstimatorTab from './components/ProfitEstimatorTab';
import GalleryTab from './components/GalleryTab';
import InvoicesTab from './components/InvoicesTab';
import ReportInventoryDetail from './components/ReportInventoryDetail';
import FloatingStats from './components/FloatingStats';
import CameraCapture from './components/CameraCapture';
import { CURRENT_VERSION, ImportItem, LaborPayment, Customer, Bill, PaymentRecord, AuthState, AppSettings, TpDtShippingItem, ModelOperationBreakdown, Worker, WorkerJob, RawMaterial, ModelMaterialRecipe, ProductionBatch, MaterialReimport, LoginNotification, TaskType, UserProfile, AppUpdateInfo } from './types';
import { initLocalStorage, getSavedState, saveState, importDatabasePackage, exportDatabasePackage, DatabasePackage } from './utils/storage';
import { downloadAllFromCloud, pushAllLocalStateToCloud } from './utils/syncService';
import { useRealtimeSync } from './utils/realtimeSync';
import { auth, db } from './utils/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { formatVietnameseDate, getCurrentDateStr, getVietnameseWeekKey } from './utils/dateUtils';
import { useAndroidBack } from './hooks/useAndroidBack';
import { checkAppUpdate, isNewerVersion } from './utils/updateService';
import { App as CapApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import AppUpdateModal from './components/AppUpdateModal';
import AnBrandLogo from './components/AnBrandLogo';


const TabLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-slate-400 dark:text-[#657f76] animate-pulse">
    <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <span className="text-xs font-semibold tracking-widest uppercase font-mono">Đang tải phân hệ...</span>
    <span className="text-[10px] text-slate-500 dark:text-[#556b62] mt-1">Vui lòng đợi trong giây lát</span>
  </div>
);


function getSavedArray<T>(key: string, fallback: T[]): T[] {
  const value = getSavedState<T[]>(key, fallback);
  return Array.isArray(value) ? value.filter(Boolean) : fallback;
}

export default function App() {
  // Initialize LocalStorage with seeds if empty
  useEffect(() => {
    initLocalStorage();
  }, []);

  // Firebase Auth initialized state
  const [fbAuthLoading, setFbAuthLoading] = useState<boolean>(true);

  // Track Firebase Auth initialization and restore active sessions safely
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("[Firebase Auth] Detected active user:", user.email);
        setAuthState(prev => {
          const trimmedEmail = user.email?.toLowerCase().trim() || null;
          if (!prev.isAuthenticated || prev.email?.toLowerCase().trim() !== trimmedEmail) {
            return {
              ...prev,
              isAuthenticated: true,
              email: trimmedEmail,
              displayName: user.displayName || user.email?.split('@')[0] || 'Kế toán viên',
            };
          }
          return prev;
        });
      } else {
        console.log("[Firebase Auth] No active user detected.");
        // If local storage says we are authenticated but Firebase has no active session, 
        // safely reset locally to prompt the user to sign in
        setAuthState(prev => {
          if (prev.isAuthenticated) {
            return {
              ...prev,
              isAuthenticated: false,
              email: null,
              displayName: null,
            };
          }
          return prev;
        });
      }
      setFbAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Application States
  const [items, setItems] = useState<ImportItem[]>(() => getSavedArray("xuongan_import_items", []));
  const [fastEditMode, setFastEditMode] = useState<boolean>(() => {
    return localStorage.getItem('xuongan_fast_edit_mode') === 'true';
  });
  const [isQuickPricingModalOpen, setIsQuickPricingModalOpen] = useState<boolean>(false);
  const [quickDefaultLabor, setQuickDefaultLabor] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_default_labor_cost') || '15000');
  });
  const [quickDefaultMargin, setQuickDefaultMargin] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_default_profit_margin_percent') || '50');
  });
  const [laborPayments, setLaborPayments] = useState<LaborPayment[]>(() => getSavedArray("xuongan_labor_payments", []));
  const [tpDtShippings, setTpDtShippings] = useState<TpDtShippingItem[]>(() => getSavedArray("xuongan_tp_dt_shippings", []));
  const [customers, setCustomers] = useState<Customer[]>(() => getSavedArray("xuongan_customers", []));
  const [bills, setBills] = useState<Bill[]>(() => getSavedArray("xuongan_bills", []));
  const [payments, setPayments] = useState<PaymentRecord[]>(() => getSavedArray("xuongan_payments", []));
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = getSavedState<AuthState>("xuongan_auth", {
      isAuthenticated: false,
      email: null,
      displayName: null,
      twoFactorEnabled: false,
      twoFactorSetup: false,
      twoFactorSecret: null,
      verified2FA: false,
      loginNotifications: []
    });
    if (!saved || typeof saved !== 'object') {
      return {
        isAuthenticated: false,
        email: null,
        displayName: null,
        twoFactorEnabled: false,
        twoFactorSetup: false,
        twoFactorSecret: null,
        verified2FA: false,
        loginNotifications: []
      };
    }
    return {
      ...saved,
      loginNotifications: Array.isArray(saved.loginNotifications) ? saved.loginNotifications : []
    };
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = getSavedState<AppSettings>("xuongan_settings", {
      theme: 'system',
      currencySymbol: 'đ',
      exportFormat: 'xlsx'
    });
    if (!saved || typeof saved !== 'object') {
      return {
        theme: 'system',
        currencySymbol: 'đ',
        exportFormat: 'xlsx'
      };
    }
    return {
      ...saved,
      theme: saved.theme || 'system',
      currencySymbol: saved.currencySymbol || 'đ',
      exportFormat: saved.exportFormat || 'xlsx'
    };
  });

  // Production Management States
  const [operationBreakdowns, setOperationBreakdowns] = useState<ModelOperationBreakdown[]>(() => getSavedArray("xuongan_operation_breakdowns", []));
  const [workers, setWorkers] = useState<Worker[]>(() => getSavedArray("xuongan_workers", []));
  const [tasks, setTasks] = useState<TaskType[]>(() => getSavedArray("xuongan_tasks", [
    { id: 'task_1', name: 'Cắt vải', createdAt: Date.now() },
    { id: 'task_2', name: 'Ráp sườn', createdAt: Date.now() + 1 },
    { id: 'task_3', name: 'May cổ', createdAt: Date.now() + 2 },
    { id: 'task_4', name: 'Lên lai', createdAt: Date.now() + 3 },
    { id: 'task_5', name: 'Tra khóa sườn', createdAt: Date.now() + 4 },
    { id: 'task_6', name: 'Ủi xếp & Chỉ thừa', createdAt: Date.now() + 5 },
    { id: 'task_7', name: 'Đóng gói', createdAt: Date.now() + 6 }
  ]));
  const [workerJobs, setWorkerJobs] = useState<WorkerJob[]>(() => getSavedArray("xuongan_worker_jobs", []));
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => getSavedArray("xuongan_raw_materials", []));
  const [materialRecipes, setMaterialRecipes] = useState<ModelMaterialRecipe[]>(() => getSavedArray("xuongan_material_recipes", []));
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>(() => getSavedArray("xuongan_production_batches", []));
  const [materialReimports, setMaterialReimports] = useState<MaterialReimport[]>(() => getSavedArray("xuongan_material_reimports", []));
  const [productionSubTab, setProductionSubTab] = useState<'breakdown' | 'materials'>('breakdown');
  const [invoiceSelectedCustomerId, setInvoiceSelectedCustomerId] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>(() => getSavedArray("xuongan_user_profiles", []));
  const [profileFetchCompleted, setProfileFetchCompleted] = useState<boolean>(false);

  const [isEditingSelfProfile, setIsEditingSelfProfile] = useState<boolean>(false);
  const [selfProfileName, setSelfProfileName] = useState<string>('');
  const [selfProfilePhoto, setSelfProfilePhoto] = useState<string | null>(null);

  // Synchronize state when the modal is opened
  useEffect(() => {
    if (isEditingSelfProfile) {
      setSelfProfileName(authState.displayName || '');
      setSelfProfilePhoto(authState.photo || null);
    }
  }, [isEditingSelfProfile, authState]);

  const getAutoWelcomeText = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "Chào buổi sáng ☀️ Chúc một ngày ngập tràn năng lượng!";
    if (hr >= 12 && hr < 18) return "Chào buổi chiều 🌤️ Mong công việc của bạn hanh thông!";
    if (hr >= 18 && hr < 22) return "Chào buổi tối 🌙 Chúc bạn có một khoảng thời gian ấm áp!";
    return "Chào đêm muộn 🌟 Chúc bạn có một giấc ngủ thật ngon!";
  };

  const handleSaveSelfProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthState(prev => ({
      ...prev,
      displayName: selfProfileName || 'Kế toán viên',
      photo: selfProfilePhoto || undefined
    }));
    setIsEditingSelfProfile(false);
  };

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Language translation dictionary
  const [language, setLanguage] = useState<'vi' | 'en'>(() => 'vi');
  
  const syncGoogleTranslate = (lang: 'vi' | 'en') => {
    try {
      const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (combo) {
        if (combo.value !== lang) {
          combo.value = lang;
          combo.dispatchEvent(new Event('change'));
        }
        return true;
      }
    } catch (e) {
      console.warn("Google Translate combo sync error:", e);
    }
    return false;
  };

  const changeLanguage = (lang: 'vi' | 'en') => {
    setLanguage(lang);
    localStorage.setItem('xuongan_language', lang);
    
    // Programmatically trigger direct combo select (instant перевод without full load)
    const synced = syncGoogleTranslate(lang);
    
    // Set cookie backup
    const cookieValue = lang === 'en' ? '/vi/en' : '/vi/vi';
    const cleanHostname = window.location.hostname;
    
    // Clear and override potential cookie scopes
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${cleanHostname};`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cleanHostname};`;
    
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=.${cleanHostname};`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${cleanHostname};`;
    
    // If translation widget combo wasn't loaded yet, refresh page to let cookie fallback execute
    if (!synced) {
      window.location.reload();
    }
  };

  const t = (viText: string, enText: string) => {
    return language === 'vi' ? viText : enText;
  };



  // Active Tab state
  const [activeTab, setActiveTab] = useState<'home' | 'import' | 'invoices' | 'production' | 'report' | 'settings' | 'notifications' | 'gallery' | 'inventory' | 'profit_estimator'>('home');
  
  // States for Notifications multi-select and account filtering
  const [notifAccountFilter, setNotifAccountFilter] = useState<string>('all');
  const [selectedNotifIds, setSelectedNotifIds] = useState<string[]>([]);
  const [isMultiSelectNotifActive, setIsMultiSelectNotifActive] = useState<boolean>(false);
  
  // Quick transition states from Home FAB
  const [autoExpandImportForm, setAutoExpandImportForm] = useState(false);
  const [autoOpenCreateBill, setAutoOpenCreateBill] = useState(false);
  const [isHomeFabOpen, setIsHomeFabOpen] = useState(false);
  
  // Mobile hamburger drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active settings tab state inside the hamburger drawer
  const [settingsActiveTab, setSettingsActiveTab] = useState<'backup' | 'theme' | 'features' | 'guide'>('backup');

  // Customize which features/cards are shown on the home screen
  const [enabledHomeFeatures, setEnabledHomeFeatures] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_enabled_home_features');
      return saved ? JSON.parse(saved) : ['import', 'invoices', 'report', 'production', 'materials', 'gallery', 'inventory', 'profit_estimator'];
    } catch (e) {
      return ['import', 'invoices', 'report', 'production', 'materials', 'gallery', 'inventory', 'profit_estimator'];
    }
  });

  useEffect(() => {
    localStorage.setItem('xuongan_enabled_home_features', JSON.stringify(enabledHomeFeatures));
  }, [enabledHomeFeatures]);

  // File input reference for database restoration upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // References for automated database auto-backup to LocalStorage
  const isBackupMountedRef = useRef<boolean>(false);
  const backupTimeoutRef = useRef<any>(null);
  const backupDataRef = useRef<any>(null);

  // Selected week filter ('all' or specific weekKey) for import tab filtration
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all');
  
  // Sorting order ('desc' or 'asc') for week filters list
  const [weekSortOrder, setWeekSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Real-time Push Notification alert states
  const [activeLoginToast, setActiveLoginToast] = useState<any | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  
  // Register Android back handlers for dropdowns and menus
  useAndroidBack(isMobileMenuOpen, () => setIsMobileMenuOpen(false));
  useAndroidBack(showNotificationsDropdown, () => setShowNotificationsDropdown(false));
  useAndroidBack(showColorDropdown, () => setShowColorDropdown(false));
  useAndroidBack(isMultiSelectNotifActive, () => {
    setIsMultiSelectNotifActive(false);
    setSelectedNotifIds([]);
  });
  useAndroidBack(notifAccountFilter !== 'all', () => setNotifAccountFilter('all'));
  
  // Real-time auto updated dates and clock
  const [currentLiveTime, setCurrentLiveTime] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
  const [showSyncBanner, setShowSyncBanner] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem("xuongan_last_sync") || null);
  const [showCloudInfo, setShowCloudInfo] = useState(false);

  // OTA Update states
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [capgoPendingUpdate, setCapgoPendingUpdate] = useState<string | null>(null);

  // Capgo Live Update Auto-Updater Listener
  useEffect(() => {
    let downloadListener: any = null;
    let updateFailedListener: any = null;

    const setupCapgoListeners = async () => {
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform();
      if (!isNative) {
        localStorage.setItem('capgo_active_version', CURRENT_VERSION);
        return;
      }

      try {
        // Retrieve and set the active dynamic version on launch
        const currentRes = await CapacitorUpdater.current();
        const activeVer = currentRes?.bundle?.version || currentRes?.native || CURRENT_VERSION;
        localStorage.setItem('capgo_active_version', activeVer);

        // Notify app ready to finish the loaded bundle verification
        await CapacitorUpdater.notifyAppReady();

        // Listen for new bundle downloaded successfully in background
        downloadListener = await CapacitorUpdater.addListener('downloadComplete', (info) => {
          console.log('[Capgo OTA] Received downloadComplete event:', info);
          if (info?.bundle?.version) {
            setCapgoPendingUpdate(info.bundle.version);
          }
        });

        updateFailedListener = await CapacitorUpdater.addListener('updateFailed', (err) => {
          console.error('[Capgo OTA] Received updateFailed event:', err);
        });

        // Trigger a background update check proactively on startup
        await CapacitorUpdater.triggerUpdateCheck();
      } catch (err) {
        console.warn('[Capgo OTA] Error during live-update init:', err);
      }
    };

    setupCapgoListeners();

    return () => {
      if (downloadListener) {
        downloadListener.remove().catch((e: any) => console.log('Error removing Capgo downloadListener:', e));
      }
      if (updateFailedListener) {
        updateFailedListener.remove().catch((e: any) => console.log('Error removing Capgo updateFailedListener:', e));
      }
    };
  }, []);

  // Auto check for updates on startup (silently, online-first)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await checkAppUpdate();
        if (update) {
          const activeVer = localStorage.getItem('capgo_active_version') || CURRENT_VERSION;
          const dismissedVer = localStorage.getItem('xuongan_dismissed_update_version');
          if (isNewerVersion(update.version, activeVer)) {
            if (update.critical || dismissedVer !== update.version) {
              setUpdateInfo(update);
            }
          }
        }
      } catch (err) {
        console.warn('Silent update lookup skipped.', err);
      }
    }, 0); // 0s/0ms delay after app boot for instant loading
    return () => clearTimeout(timer);
  }, []);

  const handleDismissUpdate = () => {
    if (updateInfo) {
      localStorage.setItem('xuongan_dismissed_update_version', updateInfo.version);
    }
    setUpdateInfo(null);
  };


  // Tab scroll positions persistence
  const tabScrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    const handleScroll = () => {
      tabScrollPositions.current[activeTab] = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeTab]);

  useEffect(() => {
    const savedPos = tabScrollPositions.current[activeTab] || 0;
    
    let timer1: any;
    let timer2: any;
    let timer3: any;
    
    const restore = () => {
      window.scrollTo({
        top: savedPos,
        behavior: 'instant' as any
      });
    };

    // Restore multiple times at different ticks to guarantee that different custom components with varied render times stabilize correctly.
    restore();
    timer1 = setTimeout(restore, 40);
    timer2 = setTimeout(restore, 120);
    timer3 = setTimeout(restore, 250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [activeTab]);

  const getUserRole = (): 'admin' | 'staff' | 'viewer' => {
    const email = authState.email?.toLowerCase().trim();
    if (!email) return 'viewer';
    // To completely disable permission and role constraints ("bỏ chế độ phân quyền"),
    // all authenticated users are granted the admin role by default.
    return 'admin';
  };
  const userRole = getUserRole();

  const getUserAllowedTabs = (): string[] => {
    const email = authState.email?.toLowerCase().trim();
    const allTabs = ['home', 'import', 'invoices', 'production', 'inventory', 'report', 'settings', 'gallery', 'profit_estimator'];
    if (!email) {
      console.log("[getUserAllowedTabs] No email found in current auth state. Returning fallback ['home']");
      return ['home'];
    }
    // All authenticated users are allowed full tab access.
    return allTabs;
  };
  const allowedTabs = getUserAllowedTabs();

  // Tổng số lượng thành phẩm trong kho = tổng nhập - tổng xuất
  const totalStockQuantity = useMemo(() => {
    const totalImported = items.reduce((sum, curr) => sum + (curr.sốLượng || 0), 0);
    let totalSold = 0;
    bills.forEach(bill => {
      if (bill.items && Array.isArray(bill.items)) {
        bill.items.forEach(bitem => {
          totalSold += (bitem.sốLượng || 0);
        });
      }
    });
    return totalImported - totalSold;
  }, [items, bills]);

  // Automatically fetch current user profile from Firestore on mount/login
  useEffect(() => {
    let active = true;
    const fetchUserProfile = async () => {
      if (fbAuthLoading || (db as any)._isMock) {
        if (active) setProfileFetchCompleted(true);
        return;
      }
      const email = authState.email?.toLowerCase().trim();
      if (!email || !authState.isAuthenticated) {
        if (active) setProfileFetchCompleted(false);
        return;
      }
      
      if (email === 'vukuli.123@gmail.com' || email === 'vukuli123@gmail.com') {
        if (active) setProfileFetchCompleted(true);
        return;
      }
      
      console.log(`[fetchUserProfile] Fetching profile for user email: "${email}" from Firestore...`);
      try {
        // Query using the perfectly sanitized, lowercase and trimmed email format first
        const docRef = doc(db, 'user_profiles', email);
        console.log(`[fetchUserProfile] Accessing collection path: "user_profiles/${email}"`);
        let docSnap = await getDoc(docRef);
        
        // As a robust fallback, if not found and original differs, try the exact original
        if (!docSnap.exists() && authState.email !== email) {
          console.log(`[fetchUserProfile] Document "user_profiles/${email}" does not exist. Retrying with original authState.email: "${authState.email}"`);
          const origDocRef = doc(db, 'user_profiles', authState.email);
          docSnap = await getDoc(origDocRef);
        }

        if (docSnap.exists() && active) {
          const profileData = docSnap.data() as UserProfile;
          console.log(`[fetchUserProfile] Successfully resolved Firestore document. Raw Document ID: "${docSnap.id}", Data:`, profileData);
          
          // Ensure profile has consistent id and email properties
          if (!profileData.id) profileData.id = docSnap.id;
          if (!profileData.email) profileData.email = docSnap.id;

          setUserProfiles(prev => {
            const filtered = prev.filter(p => {
              const pEmail = p?.email?.toLowerCase().trim();
              const pId = p?.id?.toLowerCase().trim();
              return pEmail !== email && pId !== email;
            });
            const updated = [profileData, ...filtered];
            console.log("[fetchUserProfile] Merged direct profile fetch into local userProfiles array: ", updated);
            return updated;
          });
        } else {
          if (active) {
            console.log(`[fetchUserProfile] User profile document "${email}" was NOT found in Firestore. If this is a secondary account, make sure they have been created under Settings -> Accounts.`);
          }
        }
      } catch (err) {
        console.warn("[fetchUserProfile] Failed to fetch user profile directly, relying on synced state", err);
      } finally {
        if (active) {
          setProfileFetchCompleted(true);
        }
      }
    };

    fetchUserProfile();
    return () => {
      active = false;
    };
  }, [authState.email, authState.isAuthenticated, fbAuthLoading]);

  // Synchronize database bidirectionally in real-time with Firestore
  useRealtimeSync({
    items, setItems,
    laborPayments, setLaborPayments,
    tpDtShippings, setTpDtShippings,
    customers, setCustomers,
    bills, setBills,
    payments, setPayments,
    operationBreakdowns, setOperationBreakdowns,
    workers, setWorkers,
    workerJobs, setWorkerJobs,
    rawMaterials, setRawMaterials,
    materialRecipes, setMaterialRecipes,
    productionBatches, setProductionBatches,
    materialReimports, setMaterialReimports,
    tasks, setTasks,
    userProfiles, setUserProfiles,
    settings, setSettings,
    isAuthenticated: authState.isAuthenticated,
    userEmail: authState.email,
    fbAuthLoading,
    setLastSyncTime,
    setSyncStatus,
    setSyncError,
    setAuthState
  });

  // Route protection and dynamic redirection based on page level permissions
  React.useEffect(() => {
    if (authState.isAuthenticated && allowedTabs.length > 0) {
      const validTabs = allowedTabs.filter(t => t !== 'loading');
      if (validTabs.length > 0 && activeTab !== 'notifications' && !validTabs.includes(activeTab)) {
        setActiveTab(validTabs[0] as any);
      }
    }
  }, [activeTab, allowedTabs, authState.isAuthenticated]);

  const handleCloudPull = async () => {
    setSyncStatus('syncing');
    try {
      const cloudData = await downloadAllFromCloud();
      if (cloudData) {
        if (cloudData.importItems && cloudData.importItems.length > 0) {
          setItems(cloudData.importItems);
          saveState("xuongan_import_items", cloudData.importItems);
        }
        if (cloudData.laborPayments && cloudData.laborPayments.length > 0) {
          setLaborPayments(cloudData.laborPayments);
          saveState("xuongan_labor_payments", cloudData.laborPayments);
        }
        if (cloudData.tpDtShippings && cloudData.tpDtShippings.length > 0) {
          setTpDtShippings(cloudData.tpDtShippings);
          saveState("xuongan_tp_dt_shippings", cloudData.tpDtShippings);
        }
        if (cloudData.customers && cloudData.customers.length > 0) {
          setCustomers(cloudData.customers);
          saveState("xuongan_customers", cloudData.customers);
        }
        if (cloudData.bills && cloudData.bills.length > 0) {
          setBills(cloudData.bills);
          saveState("xuongan_bills", cloudData.bills);
        }
        if (cloudData.payments && cloudData.payments.length > 0) {
          setPayments(cloudData.payments);
          saveState("xuongan_payments", cloudData.payments);
        }
        if (cloudData.operationBreakdowns && cloudData.operationBreakdowns.length > 0) {
          setOperationBreakdowns(cloudData.operationBreakdowns);
          saveState("xuongan_operation_breakdowns", cloudData.operationBreakdowns);
        }
        if (cloudData.workers && cloudData.workers.length > 0) {
          setWorkers(cloudData.workers);
          saveState("xuongan_workers", cloudData.workers);
        }
        if (cloudData.workerJobs && cloudData.workerJobs.length > 0) {
          setWorkerJobs(cloudData.workerJobs);
          saveState("xuongan_worker_jobs", cloudData.workerJobs);
        }
        if (cloudData.rawMaterials && cloudData.rawMaterials.length > 0) {
          setRawMaterials(cloudData.rawMaterials);
          saveState("xuongan_raw_materials", cloudData.rawMaterials);
        }
        if (cloudData.materialRecipes && cloudData.materialRecipes.length > 0) {
          setMaterialRecipes(cloudData.materialRecipes);
          saveState("xuongan_material_recipes", cloudData.materialRecipes);
        }
        if (cloudData.productionBatches && cloudData.productionBatches.length > 0) {
          setProductionBatches(cloudData.productionBatches);
          saveState("xuongan_production_batches", cloudData.productionBatches);
        }
        if (cloudData.materialReimports && cloudData.materialReimports.length > 0) {
          setMaterialReimports(cloudData.materialReimports);
          saveState("xuongan_material_reimports", cloudData.materialReimports);
        }
        if (cloudData.tasks && cloudData.tasks.length > 0) {
          setTasks(cloudData.tasks);
          saveState("xuongan_tasks", cloudData.tasks);
        }
        if (cloudData.userProfiles && cloudData.userProfiles.length > 0) {
          setUserProfiles(cloudData.userProfiles);
          saveState("xuongan_user_profiles", cloudData.userProfiles);
        }
        if (cloudData.settings) {
          setSettings(cloudData.settings as any);
          saveState("xuongan_settings", cloudData.settings);
        }
        
        const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
        setLastSyncTime(nowStr);
        localStorage.setItem("xuongan_last_sync", nowStr);
        setSyncStatus('success');
        
        const activeEmail = auth.currentUser?.email || "vukuli.123@gmail.com";
        const todayStr = new Date().toLocaleDateString('vi-VN');
        
        // Use precision GPS if available
        let locString = "Cao Lãnh, Đồng Tháp";
        const savedGps = localStorage.getItem('precision_gps_data');
        if (savedGps) {
          try {
            const parsed = JSON.parse(savedGps);
            if (parsed && parsed.latitude && parsed.longitude) {
              locString = `📍 GPS: ${parsed.latitude.toFixed(4)}, ${parsed.longitude.toFixed(4)}`;
            }
          } catch(err) {}
        }

        const sysSyncLog: LoginNotification = {
          id: "sync-" + Date.now(),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
          ip: "Thành công",
          location: locString,
          device: `Tài khoản ${activeEmail} đồng bộ dữ liệu đám mây Firestore tải xuống bộ nhớ máy khách thành công.`,
          isRead: false
        };
        setAuthState(prev => ({
          ...prev,
          loginNotifications: [sysSyncLog, ...(prev?.loginNotifications || [])].slice(0, 40)
        }));
        
        alert("🎉 Đã tải và đồng bộ đám mây toàn bộ cơ sở dữ liệu Xưởng thành công!");
      } else {
        setSyncStatus('idle');
      }
    } catch (e: any) {
      setSyncStatus('error');
      console.error(e);
      alert(`⚠️ Không thể đồng bộ từ đám mây: ${e.message || 'Mất kết nối mạng hoặc sai phân quyền.'}`);
    }
  };

  const handleCloudPush = async () => {
    if (!confirm("Hành động này sẽ tải toàn bộ cơ sở dữ liệu hiện tại lên đám mây và ĐÈ GHI LÊN dữ liệu Firestore hiện hữu.\n\nSếp có chắc chắn muốn tải lên để lưu trữ dự phòng không?")) {
      return;
    }
    setSyncStatus('syncing');
    try {
      await pushAllLocalStateToCloud({
        importItems: items,
        laborPayments,
        tpDtShippings,
        customers,
        bills,
        payments,
        operationBreakdowns,
        workers,
        workerJobs,
        rawMaterials,
        materialRecipes,
        productionBatches,
        materialReimports,
        loginNotifications: authState.loginNotifications || [],
        tasks,
        userProfiles,
        settings
      });
      const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
      setLastSyncTime(nowStr);
      localStorage.setItem("xuongan_last_sync", nowStr);
      setSyncStatus('success');
      
      const activeEmail = auth.currentUser?.email || "vukuli.123@gmail.com";
      const todayStr = new Date().toLocaleDateString('vi-VN');

      // Use precision GPS if available
      let locString = "Cao Lãnh, Đồng Tháp";
      const savedGps = localStorage.getItem('precision_gps_data');
      if (savedGps) {
        try {
          const parsed = JSON.parse(savedGps);
          if (parsed && parsed.latitude && parsed.longitude) {
            locString = `📍 GPS: ${parsed.latitude.toFixed(4)}, ${parsed.longitude.toFixed(4)}`;
          }
        } catch(err) {}
      }

      const sysSyncLog: LoginNotification = {
        id: "sync-" + Date.now(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
        ip: "Thành công",
        location: locString,
        device: `Tài khoản ${activeEmail} đăng tải đồng bộ lưu trữ đám mây Firestore thành công.`,
        isRead: false
      };
      setAuthState(prev => ({
        ...prev,
        loginNotifications: [sysSyncLog, ...(prev?.loginNotifications || [])].slice(0, 40)
      }));
      
      alert("🎉 Đã đồng bộ đăng tải dữ liệu Xưởng thành công lên cơ sở dữ liệu Firestore đám mây!");
    } catch (e: any) {
      setSyncStatus('error');
      console.error(e);
      alert(`⚠️ Lỗi tải dữ liệu lên đám mây: ${e.message || 'Mất kết nối hoặc sai phân quyền.'}`);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCurrentLiveTime(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    }, 1000);
    
    // Automatically trigger dates check silently without showing any screen notification
    setShowSyncBanner(false);
    const bannerTimer = setTimeout(() => {
      setShowSyncBanner(false);
    }, 4500);

    return () => {
      clearInterval(timer);
      clearTimeout(bannerTimer);
    };
  }, []);

  // Back navigation on mobile phones block
  const isPoppingState = React.useRef(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPoppingState.current = true;

      // 1. Intercept if there are any active modal/drawer handlers
      const w = window as any;
      const handlers = w.androidBackHandlers || [];
      if (handlers.length > 0) {
        const lastHandler = handlers[handlers.length - 1];
        const handled = lastHandler();
        if (handled) {
          // Since browser popped history, push state back to keep the history depth invariant
          window.history.pushState({ tab: activeTab }, '', '');
          setTimeout(() => {
            isPoppingState.current = false;
          }, 80);
          return;
        }
      }

      // 2. Default tab restoration
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('home');
      }
      setTimeout(() => {
        isPoppingState.current = false;
      }, 80);
    };

    // 3. Native Android Wrapper hardware button event handler (Cordova/Capacitor/WebView)
    const handleAndroidHardwareButton = (e?: Event) => {
      const w = window as any;
      const handlers = w.androidBackHandlers || [];
      if (handlers.length > 0) {
        const lastHandler = handlers[handlers.length - 1];
        const handled = lastHandler();
        if (handled) {
          if (e) e.preventDefault();
          return true;
        }
      }

      // If no open overlays, back button navigates back in browser history (like on the web)
      if (activeTab !== 'home') {
        if (e) e.preventDefault();
        window.history.back();
        return true;
      }
      return false;
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleAndroidHardwareButton);
    
    // 4. Register Capacitor App Plugin backButton Listener to capture swipe back gestures and back clicks
    let capAppListenerPromise: Promise<any> | null = null;
    try {
      capAppListenerPromise = CapApp.addListener('backButton', () => {
        const handled = handleAndroidHardwareButton();
        if (!handled && activeTab === 'home') {
          // If we are already at the home tab and there are no modals/drawers open, exit the app cleanly
          CapApp.exitApp();
        }
      });
    } catch (err) {
      console.log('CapApp backButton is not supported on this platform:', err);
    }
    
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ tab: 'home' }, '', '');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleAndroidHardwareButton);
      if (capAppListenerPromise) {
        capAppListenerPromise.then(sub => {
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        }).catch(err => console.error("Error removing CapApp backbutton listener", err));
      }
    };
  }, [activeTab]);

  useEffect(() => {
    if (!isPoppingState.current) {
      // Add to browser history stack for back button support
      if (window.history.state?.tab !== activeTab) {
        window.history.pushState({ tab: activeTab }, '', '');
      }
    }
  }, [activeTab]);

  // Synchronize state values inside the reference dynamically on every render
  backupDataRef.current = {
    importItems: items,
    laborPayments: laborPayments,
    tpDtShippings: tpDtShippings,
    customers: customers,
    bills: bills,
    payments: payments,
    operationBreakdowns: operationBreakdowns,
    workers: workers,
    workerJobs: workerJobs,
    rawMaterials: rawMaterials,
    materialRecipes: materialRecipes,
    productionBatches: productionBatches,
    materialReimports: materialReimports,
    settings: settings
  };

  const saveAutoBackup = (trigger: 'interval' | 'crucial_change') => {
    try {
      const source = backupDataRef.current || {
        importItems: items,
        laborPayments: laborPayments,
        tpDtShippings: tpDtShippings,
        customers: customers,
        bills: bills,
        payments: payments,
        operationBreakdowns: operationBreakdowns,
        workers: workers,
        workerJobs: workerJobs,
        rawMaterials: rawMaterials,
        materialRecipes: materialRecipes,
        productionBatches: productionBatches,
        materialReimports: materialReimports,
        settings: settings
      };

      const dataPackage: DatabasePackage = {
        importItems: source.importItems,
        laborPayments: source.laborPayments,
        tpDtShippings: source.tpDtShippings,
        customers: source.customers,
        bills: source.bills,
        payments: source.payments,
        operationBreakdowns: source.operationBreakdowns,
        workers: source.workers,
        workerJobs: source.workerJobs,
        rawMaterials: source.rawMaterials,
        materialRecipes: source.materialRecipes,
        productionBatches: source.productionBatches,
        materialReimports: source.materialReimports,
        settings: source.settings,
        version: "1.2",
        exportedAt: new Date().toISOString()
      };

      const existingBackupsRaw = localStorage.getItem("xuongan_database_auto_backups");
      let backups = [];
      if (existingBackupsRaw) {
        try {
          backups = JSON.parse(existingBackupsRaw);
        } catch (e) {
          backups = [];
        }
      }
      if (!Array.isArray(backups)) {
        backups = [];
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      const newBackup = {
        id: "backup_" + Date.now(),
        timestamp: now.toISOString(),
        timeStr,
        trigger,
        data: dataPackage
      };

      backups.unshift(newBackup);
      if (backups.length > 5) {
        backups = backups.slice(0, 5);
      }

      localStorage.setItem("xuongan_database_auto_backups", JSON.stringify(backups));
      window.dispatchEvent(new Event('xuongan_autobackup_updated'));
      console.log(`[Auto-Backup] Tự động sao lưu (${trigger}) thành công lúc ${timeStr}`);
    } catch (err) {
      console.error("[Auto-Backup] Lỗi sao lưu:", err);
    }
  };

  const triggerCrucialChangeBackup = () => {
    if (backupTimeoutRef.current) {
      clearTimeout(backupTimeoutRef.current);
    }
    backupTimeoutRef.current = setTimeout(() => {
      saveAutoBackup('crucial_change');
    }, 5000); // 5 seconds debounce
  };

  // Crucial data change tracker useEffect
  useEffect(() => {
    if (!isBackupMountedRef.current) {
      isBackupMountedRef.current = true;
      return;
    }
    triggerCrucialChangeBackup();
  }, [items, bills, payments, laborPayments, workers, productionBatches]);

  // Periodic interval automatic backup useEffect (5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      saveAutoBackup('interval');
    }, 5 * 60 * 1000); // Every 5 minutes in ms
    return () => clearInterval(interval);
  }, []);

  // Sync state changes to LocalStorage hooks
  useEffect(() => {
    saveState("xuongan_import_items", items);
  }, [items]);

  useEffect(() => {
    saveState("xuongan_customers", customers);
  }, [customers]);

  useEffect(() => {
    saveState("xuongan_bills", bills);
  }, [bills]);

  useEffect(() => {
    saveState("xuongan_payments", payments);
  }, [payments]);

  useEffect(() => {
    saveState("xuongan_labor_payments", laborPayments);
  }, [laborPayments]);

  useEffect(() => {
    saveState("xuongan_tp_dt_shippings", tpDtShippings);
  }, [tpDtShippings]);

  useEffect(() => {
    saveState("xuongan_operation_breakdowns", operationBreakdowns);
  }, [operationBreakdowns]);

  useEffect(() => {
    saveState("xuongan_workers", workers);
  }, [workers]);

  useEffect(() => {
    saveState("xuongan_tasks", tasks);
  }, [tasks]);

  useEffect(() => {
    saveState("xuongan_worker_jobs", workerJobs);
  }, [workerJobs]);

  useEffect(() => {
    saveState("xuongan_raw_materials", rawMaterials);
  }, [rawMaterials]);

  useEffect(() => {
    saveState("xuongan_material_recipes", materialRecipes);
  }, [materialRecipes]);

  useEffect(() => {
    saveState("xuongan_production_batches", productionBatches);
  }, [productionBatches]);

  useEffect(() => {
    saveState("xuongan_material_reimports", materialReimports);
  }, [materialReimports]);

  useEffect(() => {
    saveState("xuongan_user_profiles", userProfiles);
  }, [userProfiles]);

  useEffect(() => {
    saveState("xuongan_auth", authState);
  }, [authState]);

  useEffect(() => {
    saveState("xuongan_settings", settings);
    
    const rootEl = document.documentElement;
    
    // Apply Primary Brand Colors dynamically
    const primary = settings.primaryColor || 'blue';
    
    // Custom color helper
    const getCustomColors = (hex: string) => {
      const cleanHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#6366f1';
      const num = parseInt(cleanHex.replace("#", ""), 16);
      const r = num >> 16;
      const g = (num >> 8) & 0x00FF;
      const b = num & 0x0000FF;
      
      // Darken for hover (subtracting delta gracefully)
      const R = Math.max(0, Math.min(255, r - 30));
      const G = Math.max(0, Math.min(255, g - 25));
      const B = Math.max(0, Math.min(255, b - 20));
      
      // Format back to hex
      const hoverHex = "#" + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
      
      return {
        primary: cleanHex,
        hover: hoverHex,
        light: `rgba(${r}, ${g}, ${b}, 0.06)`,
        glow: `rgba(${r}, ${g}, ${b}, 0.15)`
      };
    };

    const colorMap: Record<string, { primary: string; hover: string; light: string; glow: string }> = {
      green: {
        primary: '#10b981',
        hover: '#059669',
        light: '#ecfdf5',
        glow: 'rgba(16, 185, 129, 0.15)'
      },
      blue: {
        primary: '#3b82f6',
        hover: '#2563eb',
        light: '#eff6ff',
        glow: 'rgba(59, 130, 246, 0.15)'
      },
      purple: {
        primary: '#a855f7',
        hover: '#9333ea',
        light: '#faf5ff',
        glow: 'rgba(168, 85, 247, 0.15)'
      },
      red: {
        primary: '#f43f5e',
        hover: '#e11d48',
        light: '#fff1f2',
        glow: 'rgba(244, 63, 94, 0.15)'
      },
      orange: {
        primary: '#f97316',
        hover: '#ea580c',
        light: '#fff7ed',
        glow: 'rgba(249, 115, 22, 0.15)'
      },
      cyan: {
        primary: '#06b6d4',
        hover: '#0891b2',
        light: '#ecfeff',
        glow: 'rgba(6, 182, 212, 0.15)'
      },
      pink: {
        primary: '#ec4899',
        hover: '#db2777',
        light: '#fdf2f8',
        glow: 'rgba(236, 72, 153, 0.15)'
      },
      amber: {
        primary: '#f59e0b',
        hover: '#d97706',
        light: '#fffbeb',
        glow: 'rgba(245, 158, 11, 0.15)'
      },
      indigo: {
        primary: '#6366f1',
        hover: '#4f46e5',
        light: '#f5f3ff',
        glow: 'rgba(99, 102, 241, 0.15)'
      }
    };
    
    const colors = primary === 'custom' && settings.customColorHex
      ? getCustomColors(settings.customColorHex)
      : (colorMap[primary] || colorMap.blue);
      
    rootEl.style.setProperty('--brand-primary', colors.primary);
    rootEl.style.setProperty('--brand-hover', colors.hover);
    rootEl.style.setProperty('--brand-light', colors.light);
    rootEl.style.setProperty('--brand-glow', colors.glow);

    const applyTheme = () => {
      let isDark = false;
      if (settings.theme === 'dark') {
        isDark = true;
      } else if (settings.theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      if (isDark) {
        rootEl.classList.add('dark');
        setResolvedTheme('dark');
      } else {
        rootEl.classList.remove('dark');
        setResolvedTheme('light');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings]);

  // Handle direct file backups uploads
  const handleImportBackup = (content: string) => {
    const success = importDatabasePackage(content);
    if (success) {
      // Reload states instandly to force view update
      setItems(getSavedState("xuongan_import_items", []));
      setLaborPayments(getSavedState("xuongan_labor_payments", []));
      setCustomers(getSavedState("xuongan_customers", []));
      setBills(getSavedState("xuongan_bills", []));
      setPayments(getSavedState("xuongan_payments", []));
      setTpDtShippings(getSavedState("xuongan_tp_dt_shippings", []));
      setOperationBreakdowns(getSavedState("xuongan_operation_breakdowns", []));
      setWorkers(getSavedState("xuongan_workers", []));
      setWorkerJobs(getSavedState("xuongan_worker_jobs", []));
      setRawMaterials(getSavedState("xuongan_raw_materials", []));
      setMaterialRecipes(getSavedState("xuongan_material_recipes", []));
      setProductionBatches(getSavedState("xuongan_production_batches", []));
      setMaterialReimports(getSavedState("xuongan_material_reimports", []));
      setSettings(getSavedState("xuongan_settings", { theme: 'light', currencySymbol: 'đ', exportFormat: 'xlsx' }));
      alert("Đồng bộ hóa khôi phục Cơ sở dữ liệu xưởng thành công!");
    } else {
      alert("Lỗi! File khôi phục không đúng định dạng chuẩn của Xưởng An.");
    }
  };

  // Login successful side-effect: triggers push-style security alert toast
  const handleLoginSuccess = () => {
    // Read the newest notification
    const newestLogs = getSavedState<AuthState>("xuongan_auth", authState)?.loginNotifications;
    const latestLog = newestLogs?.[0];
    
    if (latestLog) {
      setActiveLoginToast(latestLog);
      // Autodismiss after 8 seconds
      setTimeout(() => {
        setActiveLoginToast(null);
      }, 7500);
    }
  };

  // Automatically check and add automatic date/data update notification log
  useEffect(() => {
    if (authState.isAuthenticated) {
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const alreadyLogged = (authState?.loginNotifications || []).some(n => n.device === "Hệ thống tự động cập nhật dữ liệu & ngày mới" && n.time.includes(todayStr));
      
      if (!alreadyLogged) {
        let locString = "Vị trí hiện tại (Cục bộ)";
        const savedGps = localStorage.getItem('precision_gps_data');
        if (savedGps) {
          try {
            const parsed = JSON.parse(savedGps);
            if (parsed && parsed.latitude && parsed.longitude) {
              locString = `📍 GPS: ${parsed.latitude.toFixed(4)}, ${parsed.longitude.toFixed(4)}`;
            }
          } catch(err) {}
        }

        const sysSyncLog: LoginNotification = {
          id: "sync-" + Date.now(),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
          ip: "Cục bộ máy khách (Client)",
          location: locString,
          device: "Hệ thống tự động cập nhật dữ liệu & ngày mới",
          isRead: false
        };
        setAuthState(prev => ({
          ...prev,
          loginNotifications: [sysSyncLog, ...(prev?.loginNotifications || [])].slice(0, 40)
        }));
      }
    }
  }, [authState.isAuthenticated]);

  const handleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc an toàn?")) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Firebase SignOut error: ", e);
      }
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        email: null,
        displayName: null,
        verified2FA: false
      }));
      // Reset all custom local states to clear user data on logging out
      setItems([]);
      setLaborPayments([]);
      setTpDtShippings([]);
      setCustomers([]);
      setBills([]);
      setPayments([]);
      setOperationBreakdowns([]);
      setWorkers([]);
      setWorkerJobs([]);
      setRawMaterials([]);
      setMaterialRecipes([]);
      setProductionBatches([]);
      setMaterialReimports([]);
    }
  };

  const markAllNotificationsAsRead = () => {
    setAuthState(prev => ({
      ...prev,
      loginNotifications: (prev?.loginNotifications || []).map(n => ({ ...n, isRead: true }))
    }));
  };

  const getAccountFromNotif = (notif: LoginNotification): string => {
    if (!notif.device) return "Hệ thống";
    if (notif.device.includes("Hệ thống tự động")) return "Hệ thống";
    const match = notif.device.match(/Tài khoản\s+([^\s]+)/i);
    if (match && match[1]) {
      return match[1].replace(/[.,;:!\n\r\t]/g, '').trim();
    }
    return "Hệ thống";
  };

  const deleteNotification = (id: string) => {
    setAuthState(prev => ({
      ...prev,
      loginNotifications: (prev?.loginNotifications || []).filter(n => n.id !== id)
    }));
    setSelectedNotifIds(prev => prev.filter(x => x !== id));
  };

  // Helper calculations for notifications tab UI
  const notifLogs = authState?.loginNotifications || [];
  const accountCounts: { [key: string]: number } = {};
  notifLogs.forEach(notif => {
    const acc = getAccountFromNotif(notif);
    accountCounts[acc] = (accountCounts[acc] || 0) + 1;
  });
  const uniqueAccounts = Object.keys(accountCounts).sort();
  const filteredNotifs = notifLogs.filter(notif => {
    if (notifAccountFilter === 'all') return true;
    return getAccountFromNotif(notif) === notifAccountFilter;
  });

  const getNotifDateObj = (notif: LoginNotification): Date => {
    if (notif.id && typeof notif.id === 'string' && notif.id.startsWith('sync-')) {
      const tsStr = notif.id.replace('sync-', '');
      const ts = parseInt(tsStr, 10);
      if (!isNaN(ts) && ts > 0) {
        return new Date(ts);
      }
    }
    if (notif.time && typeof notif.time === 'string') {
      const dateMatch = notif.time.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        const year = parseInt(dateMatch[3], 10);
        
        const timeMatch = notif.time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          if (timeMatch[3]) {
            seconds = parseInt(timeMatch[3], 10);
          }
        }
        return new Date(year, month, day, hours, minutes, seconds);
      }
    }
    return new Date();
  };

  const groupNotificationsByDate = (notifications: LoginNotification[]) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const dayOfWeek = startOfToday.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const todayItems: LoginNotification[] = [];
    const yesterdayItems: LoginNotification[] = [];
    const thisWeekItems: LoginNotification[] = [];
    const olderItems: LoginNotification[] = [];

    notifications.forEach(notif => {
      const d = getNotifDateObj(notif);
      const timeVal = d.getTime();

      if (timeVal >= startOfToday.getTime()) {
        todayItems.push(notif);
      } else if (timeVal >= startOfYesterday.getTime()) {
        yesterdayItems.push(notif);
      } else if (timeVal >= startOfWeek.getTime()) {
        thisWeekItems.push(notif);
      } else {
        olderItems.push(notif);
      }
    });

    return [
      { key: 'today', label: 'Hôm nay', items: todayItems },
      { key: 'yesterday', label: 'Hôm qua', items: yesterdayItems },
      { key: 'this_week', label: 'Tuần này', items: thisWeekItems },
      { key: 'older', label: 'Cũ hơn', items: olderItems }
    ].filter(g => g.items.length > 0);
  };

  const groupedNotifCategories = groupNotificationsByDate(filteredNotifs);

  const toggleSelectNotif = (id: string) => {
    setSelectedNotifIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllNotifs = () => {
    setSelectedNotifIds(filteredNotifs.map(n => n.id));
  };

  const handleDeselectAllNotifs = () => {
    setSelectedNotifIds([]);
  };

  const handleDeleteSelectedNotifs = () => {
    if (selectedNotifIds.length === 0) return;
    if (window.confirm(`Bạn có chắc chắn muốn xoá ${selectedNotifIds.length} thông báo đã chọn?`)) {
      setAuthState(prev => ({
        ...prev,
        loginNotifications: (prev?.loginNotifications || []).filter(n => !selectedNotifIds.includes(n.id))
      }));
      setSelectedNotifIds([]);
      setIsMultiSelectNotifActive(false);
    }
  };

  const handleDeleteAllForCurrentAccount = () => {
    const accountLabel = notifAccountFilter === 'all' ? 'tất cả tài khoản' : `tài khoản ${notifAccountFilter}`;
    if (window.confirm(`Bạn có chắc chắn muốn xoá TOÀN BỘ thông báo của ${accountLabel}?`)) {
      setAuthState(prev => ({
        ...prev,
        loginNotifications: (prev?.loginNotifications || []).filter(n => {
          if (notifAccountFilter === 'all') return false;
          return getAccountFromNotif(n) !== notifAccountFilter;
        })
      }));
      setSelectedNotifIds([]);
      setIsMultiSelectNotifActive(false);
    }
  };

  const handleNotificationClick = (notif: LoginNotification) => {
    // Mark as read
    setAuthState(prev => ({
      ...prev,
      loginNotifications: (prev?.loginNotifications || []).map(n => n.id === notif.id ? { ...n, isRead: true } : n)
    }));

    if (notif.targetType === 'import') {
      setActiveTab('import');
      if (notif.targetExtra) {
        setSelectedWeekFilter(notif.targetExtra);
      }
    } else if (notif.targetType === 'invoice') {
      setActiveTab('invoices');
      if (notif.targetExtra) {
        setInvoiceSelectedCustomerId(notif.targetExtra);
      }
    } else if (notif.targetType === 'material') {
      setActiveTab('production');
      setProductionSubTab('materials');
    }
  };

  // Calculations for Notification indicators
  const unreadCount = (authState?.loginNotifications || []).filter(n => !n.isRead).length;

  // Group items by Week in App.tsx to feed the Hamburger filter
  const itemsByWeek: { [weekLabel: string]: any[] } = {};
  items.forEach(item => {
    if (!item) return;
    const week = item.weekKey || "Tuần Không Xác Định";
    if (!itemsByWeek[week]) {
      itemsByWeek[week] = [];
    }
    itemsByWeek[week].push(item);
  });
  const weekKeys = Object.keys(itemsByWeek).sort((a, b) => b.localeCompare(a));

  // Calculate statistics for operating charts inside the drawer
  const weekStatsForChart = weekKeys.map(weekKey => {
    const list = itemsByWeek[weekKey] || [];
    const qty = list.reduce((a, b) => a + (b?.sốLượng || 0), 0);
    const val = list.reduce((a, b) => a + ((b?.sốLượng || 0) * (b?.đơnGiáMay || 0)), 0);
    return { name: weekKey.split(" ")[1] || "W", qty, val };
  }).reverse().slice(0, 5); // Limit 5 weeks

  // Handle uploaded backup database restoration file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleImportBackup(content);
    };
    reader.readAsText(file);
    setIsMobileMenuOpen(false);
  };

  // Render dashboard home content based on screenshot design
  const renderHomeContent = () => {
    const initials = authState.displayName 
      ? authState.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
      : "DU";

    // Dynamic metrics or fallbacks exactly matching the image mockup values
    const isUserDbActive = authState.isAuthenticated && authState.email;
    const currentMonthImportCount = isUserDbActive ? (items || []).length : ((items || []).length || 18);
    const currentMonthBillCount = isUserDbActive ? (bills || []).length : ((bills || []).length || 24);

    const latestImportItem = (items || []).length > 0 
      ? [...items]
          .filter(i => i && typeof i.ngày === 'string')
          .sort((a, b) => (b.ngày || '').localeCompare(a.ngày || ''))[0] || null
      : null;
    const latestImportDate = latestImportItem 
      ? formatVietnameseDate(latestImportItem.ngày) 
      : "";

    const latestBillItem = (bills || []).length > 0 
      ? [...bills]
          .filter(b => b && typeof b.date === 'string')
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null
      : null;
    const latestBillDate = latestBillItem 
      ? formatVietnameseDate(latestBillItem.date) 
      : "";
    
    const rawRevenue = (bills || []).reduce((sum, b) => sum + (b?.subtotal || 0), 0);
    const totalRevenueFormatted = isUserDbActive
      ? (rawRevenue / 1000000).toFixed(1) + "M"
      : (rawRevenue > 0 ? (rawRevenue / 1000000).toFixed(1) + "M" : "48.5M");

    const runningBatchesCount = isUserDbActive ? (productionBatches || []).length : ((productionBatches || []).length || 12);

    return (
      <div className="space-y-6 font-sans select-none" id="dashboard_home_screen">
        
        {/* Profile Card matching the top dark visual container of the screenshot */}
        <div className="bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-6 relative overflow-hidden border border-slate-150/80 dark:border-slate-900/60 flex items-center gap-5 shadow-lg shadow-slate-100/50 dark:shadow-slate-950/20 transition-all duration-300">
          <div className="absolute right-0 top-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Avatar frame */}
          <div 
            onClick={() => setIsEditingSelfProfile(true)}
            className="relative cursor-pointer group active:scale-95 transition shrink-0"
            title="Nhấp để thay đổi ảnh đại diện"
          >
            {authState.photo ? (
              <img
                src={authState.photo}
                alt={authState.displayName || 'User Photo'}
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/20 shrink-0 shadow-lg group-hover:border-indigo-500/60 transition"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#415ef4] to-[#6366f1] border-2 border-indigo-500/20 flex items-center justify-center text-white text-[18px] font-black shrink-0 shadow-lg shadow-indigo-500/10 group-hover:border-indigo-500/60 transition">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[9px] text-white font-black uppercase text-center p-1 font-mono tracking-tight select-none">
              Sửa ảnh 📷
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase font-mono mb-0.5">
              XIN CHÀO,
            </div>
            
            <h1 
              onClick={() => setIsEditingSelfProfile(true)}
              className="text-xl md:text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400 leading-tight cursor-pointer hover:underline hover:text-[#415ef4] dark:hover:text-[#6366f1] transition-all"
              title="Nhấp để chỉnh sửa tên hiển thị"
            >
              {authState.displayName || 'Demo User'}
            </h1>
            
            <div className="text-[10px] font-black text-emerald-600 dark:text-[#10b981] font-mono tracking-wide bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 mt-1">
              <span>{getAutoWelcomeText()}</span>
            </div>

            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono mt-1">
              {authState.email || 'demo@nhapkho.app'}
            </p>
          </div>
        </div>

        {/* 4 Cards Grid Layout with interactive functions - 2 columns always as shown on image */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Card 1: Nhập hàng */}
          {allowedTabs.includes('import') && enabledHomeFeatures.includes('import') && (
            <motion.div 
              id="home_card_nhap_hang"
              onClick={() => setActiveTab('import')}
              whileHover={{ 
                scale: 1.015,
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(16, 185, 129, 0.12), 0 8px 10px -6px rgba(16, 185, 129, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-emerald-500/50 dark:hover:border-[#10b981]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-[#10b981] text-white flex items-center justify-center shrink-0 shadow-md">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Nhập hàng</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Quản lý nhập hàng và nhà cung cấp</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Quản lý nhập hàng và nhà cung cấp
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 font-sans lg:tracking-wide whitespace-nowrap">Đơn nhập tháng này</p>
                  <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-mono leading-none">{currentMonthImportCount}</p>
                  {latestImportDate && (
                    <div 
                      title={`Ngày nhập lô hàng gần nhất: ${latestImportDate}`}
                      className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[9px] md:text-[10px] font-extrabold uppercase tracking-wide rounded-md border-none shadow-xs shadow-emerald-500/10 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-emerald-500/35"
                    >
                      <span>Mới nhất: {latestImportDate}</span>
                    </div>
                  )}
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-500/25 transition-all duration-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:border-emerald-250 dark:group-hover:border-emerald-500/40 group-hover:shadow-[0_4px_12px_rgba(16,185,129,0.15)] text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Xem chi tiết</span>
                  <ShoppingCart className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 2: Hóa đơn */}
          {allowedTabs.includes('invoices') && enabledHomeFeatures.includes('invoices') && (
            <motion.div 
              id="home_card_hoa_don"
              onClick={() => setActiveTab('invoices')}
              whileHover={{ 
                scale: 1.015,
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.12), 0 8px 10px -6px rgba(59, 130, 246, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-blue-500/50 dark:hover:border-[#3b82f6]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-blue-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-[#3b82f6] text-white flex items-center justify-center shrink-0 shadow-md">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Hóa đơn</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Quản lý hóa đơn bán hàng</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Quản lý hóa đơn bán hàng
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">{currentMonthBillCount}</p>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-sans whitespace-nowrap">Hóa đơn tháng này</p>
                  {latestBillDate && (
                    <div 
                      title={`Ngày tạo hoá đơn gần nhất: ${latestBillDate}`}
                      className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[9px] md:text-[10px] font-extrabold uppercase tracking-wide rounded-md border-none shadow-xs shadow-emerald-500/10 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-emerald-500/35"
                    >
                      <span>Mới nhất: {latestBillDate}</span>
                    </div>
                  )}
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-500/25 transition-all duration-300 group-hover:bg-blue-150 dark:group-hover:bg-blue-500/20 group-hover:border-blue-250 dark:group-hover:border-blue-500/40 group-hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)] text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Xem chi tiết</span>
                  <FileText className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 3: Doanh thu */}
          {allowedTabs.includes('report') && enabledHomeFeatures.includes('report') && (
            <motion.div 
              id="home_card_doanh_thu"
              onClick={() => setActiveTab('report')}
              whileHover={{ 
                scale: 1.015,
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(234, 179, 8, 0.12), 0 8px 10px -6px rgba(234, 179, 8, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-amber-500/50 dark:hover:border-[#eab308]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-amber-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-[#eab308] text-white flex items-center justify-center shrink-0 shadow-md">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Doanh thu</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Thống kê doanh thu và lợi nhuận</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Thống kê doanh thu và lợi nhuận
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">{totalRevenueFormatted}</p>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-amber-600 dark:text-amber-400 mt-1.5 font-sans whitespace-nowrap">Doanh thu tháng này</p>
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-500/25 transition-all duration-300 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 group-hover:border-amber-250 dark:group-hover:border-amber-500/40 group-hover:shadow-[0_4px_12px_rgba(234,179,8,0.15)] text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Xem chi tiết</span>
                  <DollarSign className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 4: Quản lý sản xuất */}
          {allowedTabs.includes('production') && enabledHomeFeatures.includes('production') && (
            <motion.div 
              id="home_card_san_xuat"
              onClick={() => setActiveTab('production')}
              whileHover={{ 
                scale: 1.015,
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(168, 85, 247, 0.12), 0 8px 10px -6px rgba(168, 85, 247, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-purple-500/50 dark:hover:border-[#a855f7]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-purple-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-[#a855f7] text-white flex items-center justify-center shrink-0 shadow-md">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                      <line x1="6" y1="6" x2="6.01" y2="6" />
                      <line x1="6" y1="18" x2="6.01" y2="18" />
                    </svg>
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Sản xuất</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Theo dõi sản xuất và đơn hàng</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Theo dõi sản xuất và đơn hàng
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">{runningBatchesCount}</p>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-purple-600 dark:text-purple-400 mt-1.5 font-sans whitespace-nowrap">Lô sản xuất chạy</p>
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-500/25 transition-all duration-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 group-hover:border-purple-250 dark:group-hover:border-purple-500/40 group-hover:shadow-[0_4px_12px_rgba(168,85,247,0.15)] text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Xem chi tiết</span>
                  <Calendar className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 4.5: Kho thành phẩm */}
          {allowedTabs.includes('inventory') && enabledHomeFeatures.includes('inventory') && (
            <motion.div 
              id="home_card_kho_thanh_pham"
              onClick={() => setActiveTab('inventory')}
              whileHover={{ 
                scale: 1.015,
                y: -5,
                boxShadow: "0 20px 25px -5px rgba(16, 185, 129, 0.12), 0 8px 10px -6px rgba(16, 185, 129, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-emerald-500/50 dark:hover:border-[#10b981]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Boxes className="w-5 h-5 text-white" />
                  </div>
                  <div className="truncate min-w-0 pr-1 text-left">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">4. Kho Thành Phẩm</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Kiểm đếm xưởng tự động</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5 text-left">
                Kiểm đếm xuất nhập tồn kho xưởng
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end text-left">
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
                    {totalStockQuantity.toLocaleString()} <span className="text-xs font-bold text-slate-450 dark:text-slate-400 font-sans">bộ đồ</span>
                  </p>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-sans whitespace-nowrap">Tự động đối soát</p>
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-500/25 transition-all duration-300 group-hover:bg-emerald-100 dark:group-hover:bg-[#10b981]/20 group-hover:border-emerald-250 dark:group-hover:border-[#10b981]/40 text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Vào kho</span>
                  <Boxes className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 5: Kho nhiên liệu và định mức */}
          {allowedTabs.includes('production') && enabledHomeFeatures.includes('materials') && (
            <motion.div 
              id="home_card_kho_nhien_lieu"
              onClick={() => {
                setProductionSubTab('materials');
                setActiveTab('production');
              }}
              whileHover={{ 
                scale: 1.01,
                y: -3,
                boxShadow: "0 20px 25px -5px rgba(20, 184, 166, 0.12), 0 8px 10px -6px rgba(20, 184, 166, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className={`group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-teal-500/50 dark:hover:border-[#14b8a6]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-teal-500/5 ${enabledHomeFeatures.includes('gallery') ? 'col-span-1' : 'col-span-2'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Nguyên liệu & Định mức</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Định mức các mẫu sản phẩm</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Định mức mẫu & phụ kiện tồn kho
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Vật tư</span>
                    <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none mt-1">
                      {rawMaterials.length} <span className="text-[10px] font-bold text-slate-400 font-sans">loại</span>
                    </p>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-150 dark:bg-slate-800" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Định mức</span>
                    <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none mt-1">
                      {materialRecipes.length} <span className="text-[10px] font-bold text-slate-450 dark:text-slate-400 font-sans">bài</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-teal-50 dark:bg-[#14b8a6]/10 text-teal-600 dark:text-[#14b8a6] rounded-xl border border-teal-100 dark:border-[#14b8a6]/25 transition-all duration-300 group-hover:bg-teal-100 dark:group-hover:bg-[#14b8a6]/20 group-hover:border-teal-250 dark:group-hover:border-[#14b8a6]/40 text-[9px] md:text-[10px] font-black uppercase tracking-wider shrink-0">
                  <Database className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 5.5: Tính Giá Thành & Lợi Nhuận Bộ Đồ */}
          {allowedTabs.includes('profit_estimator') && enabledHomeFeatures.includes('profit_estimator') && (
            <motion.div 
              id="home_card_gia_thanh_loi_nhuan"
              onClick={() => setActiveTab('profit_estimator')}
              whileHover={{ 
                scale: 1.012,
                y: -4,
                boxShadow: "0 20px 25px -5px rgba(99, 102, 241, 0.12), 0 8px 10px -6px rgba(99, 102, 241, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className="group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-indigo-500/50 dark:hover:border-[#6366f1]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[195px] h-auto shadow-xs hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div className="truncate min-w-0 pr-1 text-left">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Giá Thành & Lợi Nhuận</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Dự phóng chi phí & biên lãi sỉ bộ đồ</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5 text-left">
                Tính toán biên lợi nhuận thông minh
              </p>

              {/* Fast Edit Mode & Quick Pricing controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1 sm:mt-2">
                {/* Fast Edit Mode Toggle */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newVal = !fastEditMode;
                    setFastEditMode(newVal);
                    localStorage.setItem('xuongan_fast_edit_mode', String(newVal));
                  }}
                  className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800"
                >
                  <span className={`w-2 h-2 rounded-full ${fastEditMode ? 'bg-[#6366f1] animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Sửa Nhanh</span>
                  <div className={`relative w-6 h-3.5 rounded-full transition-colors ${fastEditMode ? 'bg-[#6366f1]' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-0.5 left-0.5 bg-white w-2.5 h-2.5 rounded-full transition-transform ${fastEditMode ? 'translate-x-2.5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* Edit Pricing Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickDefaultLabor(Number(localStorage.getItem('xuongan_default_labor_cost') || '15000'));
                    setQuickDefaultMargin(Number(localStorage.getItem('xuongan_default_profit_margin_percent') || '50'));
                    setIsQuickPricingModalOpen(true);
                  }}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 font-bold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer transition-all shrink-0"
                >
                  <Edit className="w-3 h-3 text-indigo-500" />
                  <span>Sửa công/lãi mốc</span>
                </button>
              </div>

              <div className="border-t border-slate-150 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end text-left">
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
                    {materialRecipes.length} <span className="text-xs font-bold text-slate-450 dark:text-slate-400 font-sans">bản định mức</span>
                  </p>
                  <p className="text-[9.5px]/none font-extrabold text-[#6366f1] dark:text-indigo-400 mt-1 font-sans whitespace-nowrap">Đầy đủ tham số tính toán</p>
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-500/25 transition-all duration-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 group-hover:border-indigo-250 dark:group-hover:border-indigo-500/40 text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Tính toán</span>
                  <DollarSign className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 6: Thư viện ảnh chụp */}
          {allowedTabs.includes('gallery') && enabledHomeFeatures.includes('gallery') && (
            <motion.div 
              id="home_card_thu_vien_anh"
              onClick={() => setActiveTab('gallery')}
              whileHover={{ 
                scale: 1.01,
                y: -3,
                boxShadow: "0 20px 25px -5px rgba(139, 92, 246, 0.12), 0 8px 10px -6px rgba(139, 92, 246, 0.12)"
              }}
              whileTap={{ scale: 0.98 }}
              className={`group relative bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-5 border border-slate-150/80 dark:border-slate-900/60 hover:border-purple-500/50 dark:hover:border-[#8b5cf6]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[170px] shadow-xs hover:shadow-lg hover:shadow-purple-500/5 ${enabledHomeFeatures.includes('materials') ? 'col-span-1' : 'col-span-2'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Image className="w-5 h-5 text-white" />
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-[13px] md:text-[15px] tracking-tight truncate leading-tight">Thư viện ảnh</h3>
                    <p className="text-[9.5px] md:text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">Chụp hình trực tiếp & đính kèm</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Mobile/Tablet mini description line */}
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate sm:hidden -mt-1.5">
                Xem toàn bộ kho hình chụp sản phẩm
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800/40 my-1 w-full" />

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                    {items.filter(i => i.photo).length + bills.filter(b => b.photo).length} <span className="text-[10px] font-bold text-slate-400 font-sans">tấm</span>
                  </p>
                  <p className="text-[9.5px]/none font-extrabold text-purple-600 dark:text-purple-400 mt-1 uppercase tracker-wider text-[9px]">Hình đính kèm</p>
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-500/25 transition-all duration-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 group-hover:border-purple-250 dark:group-hover:border-purple-500/40 text-[9px] md:text-[10px] font-black uppercase tracking-wider shrink-0">
                  <Image className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* If no feature is enabled, show an instructive alert card */}
        {enabledHomeFeatures.length === 0 && (
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-inner">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed">
              Bạn đã ẩn toàn bộ các ô tính năng trên trang chủ. Vui lòng mở menu 3 gạch (ở góc trên) và chọn thẻ <b>"Trang chủ"</b> để cài đặt hiển thị lại các chức năng.
            </p>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md inline-flex items-center gap-1.5"
            >
              <Menu className="w-4 h-4 text-white" />
              <span>Cài đặt bật chức năng</span>
            </button>
          </div>
        )}

        {/* Floating Action Button (FAB) with speed dial quick options */}
        {/* Backdrop overlay for speed dial */}
        {isHomeFabOpen && (
          <div 
            className="fixed inset-0 z-45 bg-slate-950/45 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsHomeFabOpen(false)}
          />
        )}

        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-55 flex flex-col items-end gap-3 font-sans">
          <AnimatePresence>
            {isHomeFabOpen && (
              <div className="flex flex-col items-end gap-3.5 pb-1 select-none">
                {/* Option 1: Nhập hàng mới */}
                {allowedTabs.includes('import') && (
                  <motion.button
                    initial={{ opacity: 0, y: 15, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.9 }}
                    onClick={() => {
                      setIsHomeFabOpen(false);
                      setAutoExpandImportForm(true);
                      setActiveTab('import');
                    }}
                    className="flex items-center gap-2.5 px-4.5 py-3 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-black shadow-2xl border border-emerald-450/20 active:scale-95 transition cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span>Nhập hàng mới</span>
                  </motion.button>
                )}

                {/* Option 2: Viết bill hóa đơn */}
                {allowedTabs.includes('invoices') && (
                  <motion.button
                    initial={{ opacity: 0, y: 15, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.9 }}
                    onClick={() => {
                      setIsHomeFabOpen(false);
                      setAutoOpenCreateBill(true);
                      setActiveTab('invoices');
                    }}
                    className="flex items-center gap-2.5 px-4.5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xl border border-indigo-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>Viết bill hóa đơn</span>
                  </motion.button>
                )}
              </div>
            )}
          </AnimatePresence>

          {/* Main Floating Trigger Button with pulsing indicator */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsHomeFabOpen(!isHomeFabOpen)}
            className="w-14 h-14 rounded-full bg-linear-to-tr from-[#415ef4] to-[#6366f1] text-white flex items-center justify-center shadow-2xl shadow-indigo-550/20 border border-indigo-500/25 cursor-pointer active:scale-95 transition relative group"
            title="Tác vụ nhanh"
          >
            {/* Pulsing ring effect to attract focus */}
            <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping pointer-events-none group-hover:bg-indigo-500/25" />
            
            <motion.div
              animate={{ rotate: isHomeFabOpen ? 135 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <Plus className="w-7 h-7 font-black" />
            </motion.div>
          </motion.button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#0b0f19] transition-colors duration-200 font-sans ${resolvedTheme === 'dark' ? 'dark text-slate-100' : 'text-slate-800'}`}>
      
      {/* 2. SECURITY LAYER: Check registration of active authenticated session */}
      {!authState.isAuthenticated ? (
        <LoginScreen
          authState={authState}
          setAuthState={setAuthState}
          userProfiles={userProfiles}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : allowedTabs.includes('loading') ? (
        <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-white text-center font-sans select-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-505/20 flex items-center justify-center mb-6 relative shadow-lg shadow-indigo-600/5">
            <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
          </div>
          <h3 className="text-base font-black tracking-widest text-[#415ef4] mb-2 uppercase font-mono">Đồng bộ không gian làm việc</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Hệ thống đang kiểm tra danh tiếng thành viên và thiết lập quyền hạn truy cập của xưởng từ đám mây...
          </p>
        </div>
      ) : allowedTabs.length === 0 ? (
        <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-white text-center font-sans select-none">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-lg shadow-red-500/5">
            <AlertCircle className="w-7 h-7 text-red-505 animate-pulse" />
          </div>
          <h3 className="text-lg font-black tracking-tight text-white mb-1 uppercase">QUYỀN TRUY CẬP BỊ GIỚI HẠN</h3>
          <p className="text-[10px] font-bold text-red-400 tracking-wider uppercase font-mono">ACCESS RESTRICTED</p>
          
          <div className="bg-[#11162d] border border-indigo-950/60 rounded-3xl p-6 max-w-md my-6 space-y-4 shadow-2xl">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">TÀI KHOẢN ĐANG ĐĂNG NHẬP</span>
              <p className="text-xs text-indigo-300 font-mono font-bold bg-slate-950/40 py-1.5 px-3 rounded-lg border border-slate-900 inline-block">
                {authState.email}
              </p>
            </div>
            
            <p className="text-xs text-slate-350 leading-relaxed text-left border-t border-indigo-950/50 pt-4">
              Tài khoản này chưa được chủ xưởng cấp quyền sử dụng bất kỳ mục chức năng nào, hoặc hồ sơ phụ của bạn hiện đang ở trạng thái ngừng hoạt động.
            </p>
            <p className="text-[11px] text-slate-450 text-left leading-relaxed italic border-t border-[#0b0f19] pt-4">
              Vui lòng liên hệ trực tiếp với quản trị viên chính (Email: <strong className="text-slate-300 not-italic">vukuli.123@gmail.com</strong>) để nhận quyền sử dụng (Nhập hàng, Hóa đơn nợ, hoặc Quản lý sản xuất).
            </p>
          </div>
          
          <button
            onClick={async () => {
              try {
                await signOut(auth);
              } catch (e) {
                console.error("Firebase SignOut error: ", e);
              }
              setAuthState(prev => ({
                ...prev,
                isAuthenticated: false,
                email: null,
                displayName: null,
                verified2FA: false
              }));
            }}
            className="bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-800 cursor-pointer shadow-md"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Đăng xuất hệ thống</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
          
          {/* Main Dashboard Navigation Header */}
          <header className="shrink-0 z-30 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs leading-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
              
              {/* Left Logo / Hamburger Wrapper */}
              <div className="flex items-center gap-3 select-none">
                {/* Hamburger (3 gạch) Button for Screens */}
                <button
                  id="mobile_hamburger_menu_btn"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-black dark:hover:bg-zinc-900 rounded-xl transition cursor-pointer flex items-center justify-center border border-slate-200 dark:border-slate-800"
                  aria-label="Danh mục quản lý"
                >
                  <Menu className="w-5 h-5 text-brand-primary" />
                </button>

                {/* Brand Identity details */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 flex items-center justify-center overflow-hidden shrink-0">
                    <AnBrandLogo size={40} showText={false} />
                  </div>
                </div>
              </div>

              {/* Middle Tab buttons selector - STAYS ON DESKTOP ONLY */}
              <nav className="hidden lg:flex bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs font-semibold">
                {allowedTabs.includes('home') && (
                  <button
                    id="tab_home_btn"
                    onClick={() => setActiveTab('home')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'home' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Trang chủ</span>
                  </button>
                )}
                {allowedTabs.includes('import') && (
                  <button
                    id="tab_import_btn"
                    onClick={() => setActiveTab('import')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span>1. Nhập Hàng Lên/Về</span>
                  </button>
                )}
                {allowedTabs.includes('invoices') && (
                  <button
                    id="tab_invoices_btn"
                    onClick={() => setActiveTab('invoices')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'invoices' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span>2. Viết Hoá Đơn Bán</span>
                  </button>
                )}
                {allowedTabs.includes('production') && (
                  <button
                    id="tab_production_btn"
                    onClick={() => setActiveTab('production')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'production' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span>3. Quản Lý Sản Xuất</span>
                  </button>
                )}
                {allowedTabs.includes('inventory') && (
                  <button
                    id="tab_inventory_btn"
                    onClick={() => setActiveTab('inventory')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Boxes className="w-3.5 h-3.5 text-emerald-500" />
                    <span>4. Kho Hàng</span>
                  </button>
                )}
                {allowedTabs.includes('profit_estimator') && (
                  <button
                    id="tab_profit_estimator_btn"
                    onClick={() => setActiveTab('profit_estimator')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'profit_estimator' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <DollarSign className="w-3.5 h-3.5 text-indigo-505" />
                    <span>5. Giá Thành & Lợi Nhuận Bộ Đồ</span>
                  </button>
                )}
                {allowedTabs.includes('report') && (
                  <button
                    id="tab_report_btn"
                    onClick={() => setActiveTab('report')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'report' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-805 dark:hover:text-slate-200'}`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Báo cáo</span>
                  </button>
                )}
                {allowedTabs.includes('settings') && (
                  <button
                    id="tab_settings_btn"
                    onClick={() => setActiveTab('settings')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Cài đặt</span>
                  </button>
                )}
                {allowedTabs.includes('gallery') && (
                  <button
                    id="tab_gallery_btn"
                    onClick={() => setActiveTab('gallery')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'gallery' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Image className="w-3.5 h-3.5 text-indigo-505" />
                    <span>Thư viện ảnh</span>
                  </button>
                )}
              </nav>

              {/* Right menu actions */}
              <div className="flex items-center gap-2.5">
                
                {/* Real-time Database Link/Sync Status Pill */}
                <button 
                  onClick={() => {
                    if (syncStatus === 'error') {
                      alert(`⚠️ Chi tiết lỗi kết nối Đám mây:\n\n${syncError || "Không thể tải cấu hình do mất kết nối mạng hoặc sai ID Cơ sở dữ liệu. Nếu sếp dùng Firebase riêng, sếp hãy kiểm tra xem Rules ở Firestore của sếp đã cho phép đọc ghi chưa."}`);
                    } else if (syncStatus === 'success') {
                      alert(`🟢 Cơ sở dữ liệu đám mây kết nối THÀNH CÔNG!\n\n• Cập nhật mới nhất: ${lastSyncTime || "Vừa xong"}\n• Thiết bị đang truyền tải dữ liệu tự động 2 chiều theo thời gian thực (Real-time).`);
                    } else {
                      alert(`🟡 Hệ thống đang kiểm tra liên kết và thiết lập luồng đồng bộ song phương với Firebase...`);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-xs font-bold transition-all duration-300 shadow-2xs cursor-pointer active:scale-95 ${
                    syncStatus === 'syncing' 
                      ? 'bg-amber-50/60 dark:bg-amber-950/10 border-amber-250 dark:border-amber-900 text-amber-600 dark:text-amber-400 hover:bg-amber-100/40' 
                      : syncStatus === 'error'
                      ? 'bg-red-50/60 dark:bg-red-950/10 border-red-250 dark:border-red-900 text-red-650 dark:text-red-400 hover:bg-red-100/40'
                      : 'bg-emerald-50/60 dark:bg-emerald-950/10 border-emerald-250 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/40'
                  }`}
                  title={
                    syncStatus === 'syncing' 
                      ? 'Hệ thống đang đồng bộ dữ liệu song phương với đám mây... Click để xem chi tiết.' 
                      : syncStatus === 'error'
                      ? 'Kết nối đồng bộ đám mây thất bại hoặc sai thông số cấu hình. Click để xem chi tiết lỗi.'
                      : `Liên kết dữ liệu đám mây hoạt động. Cập nhật: ${lastSyncTime || 'Sẵn sàng'}. Click để xem chi tiết.`
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="hidden select-none xs:block leading-none font-sans">
                    {syncStatus === 'syncing' ? 'Đang đồng bộ' : syncStatus === 'error' ? 'Mất kết nối' : 'Đã kết nối'}
                  </span>
                </button>

                {/* Brand Colors Popover Dropdown */}
                <div className="relative">
                  <button
                    id="trigger_color_dropdown_btn"
                    onClick={() => {
                      setShowColorDropdown(!showColorDropdown);
                      setShowNotificationsDropdown(false);
                    }}
                    className="p-2 bg-white hover:bg-slate-50 dark:bg-black dark:hover:bg-zinc-900 text-slate-600 dark:text-slate-350 rounded-lg transition relative cursor-pointer border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 shadow-2xs"
                    title="Đổi tông màu nhấn ứng dụng"
                  >
                    <Palette className="w-4 h-4 text-brand-primary" />
                    <span className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: 'var(--brand-primary)' }} />
                  </button>
                  {/* Popover/Dropdown panel */}
                  <AnimatePresence>
                    {showColorDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColorDropdown(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 mt-2.5 w-60 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3.5 overflow-hidden z-50 space-y-3"
                        >
                          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                              <Palette className="w-3.5 h-3.5 text-brand-primary" />
                              Màu chủ đạo
                            </span>
                            <button
                              onClick={() => setShowColorDropdown(false)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { id: 'green', name: 'Xanh lá', color: '#10b981' },
                              { id: 'blue', name: 'Xanh dương', color: '#3b82f6' },
                              { id: 'purple', name: 'Tím', color: '#a855f7' },
                              { id: 'red', name: 'Đỏ hồng', color: '#f43f5e' },
                              { id: 'orange', name: 'Cam', color: '#f97316' },
                              { id: 'cyan', name: 'Xanh lơ', color: '#06b6d4' },
                              { id: 'pink', name: 'Hồng sen', color: '#ec4899' },
                              { id: 'amber', name: 'Hổ phách', color: '#f59e0b' },
                              { id: 'indigo', name: 'Indigo', color: '#6366f1' }
                            ].map(col => {
                              const colActive = settings.primaryColor === col.id;
                              return (
                                <button
                                  key={col.id}
                                  onClick={() => {
                                    setSettings(prev => ({ ...prev, primaryColor: col.id as any }));
                                    setShowColorDropdown(false);
                                  }}
                                  title={col.name}
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer relative ${colActive ? 'border-amber-400 dark:border-amber-300 scale-105 shadow-md shadow-brand-glow/30' : 'border-slate-200 dark:border-slate-700'}`}
                                  style={{ backgroundColor: col.color }}
                                >
                                  {colActive && (
                                    <span className="w-1.5 h-1.5 bg-white rounded-full shadow-md" />
                                  )}
                                </button>
                              );
                            })}
                            
                            {/* Custom Gradient Options button */}
                            <button
                              onClick={() => {
                                setSettings(prev => ({ ...prev, primaryColor: 'custom', customColorHex: prev.customColorHex || '#6366f1' }));
                              }}
                              title="Tự chọn màu"
                              className={`w-7 h-7 rounded-full border flex items-center justify-center bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 hover:scale-110 active:scale-95 cursor-pointer relative ${settings.primaryColor === 'custom' ? 'border-amber-400 dark:border-amber-300 scale-105 shadow-md shadow-brand-glow/30' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                              {settings.primaryColor === 'custom' && (
                                <span className="w-1.5 h-1.5 bg-white rounded-full shadow-md" />
                              )}
                            </button>
                          </div>

                          {settings.primaryColor === 'custom' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between gap-1.5"
                            >
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Bảng màu:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={settings.customColorHex || '#6366f1'}
                                  onChange={(e) => setSettings(prev => ({ ...prev, customColorHex: e.target.value }))}
                                  className="w-7 h-6 rounded border border-slate-200 dark:border-slate-700 cursor-pointer overflow-hidden p-0 bg-transparent block"
                                />
                                <input
                                  type="text"
                                  maxLength={7}
                                  value={settings.customColorHex || '#6366f1'}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (val.length > 0 && !val.startsWith('#')) val = '#' + val;
                                    setSettings(prev => ({ ...prev, customColorHex: val }));
                                  }}
                                  placeholder="#6366f1"
                                  className="w-16 px-1.5 py-0.5 text-[10px] text-center border rounded bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-805 text-slate-800 dark:text-slate-100 font-mono"
                                />
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Active user details and logout option */}
                <div className="flex items-center gap-2 border-l border-slate-150 dark:border-slate-800 pl-2.5">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden md:block text-left text-xs font-sans">
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{authState.displayName || (language === 'vi' ? 'Kế toán viên' : 'Accountant')}</p>
                    <p className="text-[9px] text-slate-400 font-mono -mt-0.5">Role: Admin Chốt</p>
                  </div>
                </div>

                {/* 3. Safe Sign-Out */}
                <button
                  id="dashboard_logout_btn"
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-transparent hover:bg-slate-100/10 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs font-bold leading-none shrink-0"
                  title={t('Đăng xuất khỏi phiên', 'Logout session')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('Đăng xuất', 'Logout')}</span>
                </button>

              </div>
            </div>
          </header>

          {/* BEAUTIFUL MOBILE MENU SLIDER DRAWER TỔNG (3 GẠCH) */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <div className="fixed inset-0 z-50 flex" id="mobile_drawer_container">
                {/* Backdrop mask */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs cursor-pointer"
                />

                {/* Drawer Body Container */}
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0 }}
                  className="relative w-[82vw] max-w-xs bg-slate-50 dark:bg-[#0f172a] min-h-screen shadow-2xl flex flex-col justify-between border-r border-slate-200 dark:border-slate-800"
                >
                  <div className="p-5 space-y-5 overflow-y-auto flex-grow scrollbar-none">
                    {/* Header line inside cabinet */}
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center overflow-hidden shrink-0">
                          <AnBrandLogo size={32} showText={false} />
                        </div>
                        <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans">{t('SỔ SÁCH XƯỞNG AN', 'AN FACTORY ACCOUNTBOOK')}</span>
                      </div>
                      <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 rounded-lg transition duration-200 cursor-pointer"
                        aria-label={t('Đóng menu', 'Close menu')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Navigation Tab selection lists */}
                    <div className="space-y-3">
                      <p className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">{t('DANH MỤC TRỰC QUAN', 'VISUAL CATEGORIES')}</p>
                      
                      <div className="space-y-2">
                        {/* Tab 1 button link */}
                        {allowedTabs.includes('import') && (
                          <button
                            onClick={() => {
                              setActiveTab('import');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'import' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('1. Hàng Hoá & Nhập Hàng', '1. Materials & Imports')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal">{t('Mẫu mã nhập về, lượng công thợ, đơn giá ship hai vùng', 'Imported models, worker workloads, shipping rates')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab 2 button link */}
                        {allowedTabs.includes('invoices') && (
                          <button
                            onClick={() => {
                              setActiveTab('invoices');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'invoices' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-850'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'invoices' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Layers className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('2. Viết Hoá Đơn Bán', '2. Create Sales Invoice')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal">{t('Hóa đơn công nợ lũy kế, thu chi khách sỉ và in hóa đơn sành điệu', 'Debt tracking, wholesale customer invoices & printing')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab 3 button link */}
                        {allowedTabs.includes('production') && (
                          <button
                            onClick={() => {
                              setActiveTab('production');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'production' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'production' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Scissors className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('3. Quản Lý Sản Xuất', '3. Production Control')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal font-sans">{t('Định mức nguyên liệu kho, phân tổ công đoạn thợ may', 'Warehouse raw materials, tailor job allocation')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab 4 button link - Kho Hàng */}
                        {allowedTabs.includes('inventory') && (
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'inventory' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Boxes className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('4. Kho Hàng & Thành Phẩm', '4. Finished Goods Warehouse')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal font-sans">{t('Tự động kiểm đếm, đối soát hàng hoá nhập xuất chi tiết', 'Automatic calculation & verification of finished goods inventory')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab 5 button link - Giá Thành & Lợi Nhuận Bộ Đồ */}
                        {allowedTabs.includes('profit_estimator') && (
                          <button
                            onClick={() => {
                              setActiveTab('profit_estimator');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'profit_estimator' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'profit_estimator' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <DollarSign className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('5. Giá Thành & Lợi Nhuận', '5. Pricing & Profit Estimation')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal font-sans">{t('Dự phóng doanh thu, giá vốn gia công định lượng', 'Automatic cost-profit forecasting using raw material recipes')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab Gallery button link */}
                        {allowedTabs.includes('gallery') && (
                          <button
                            onClick={() => {
                              setActiveTab('gallery');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'gallery' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'gallery' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Image className="w-4 h-4 text-purple-505" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('Thư viện Ảnh chụp', 'Captured Photo Gallery')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal font-sans">{t('Tìm kiếm và đối so sánh đồng thời hình ảnh đã chụp với Bill, Nhập hàng', 'Compare captured model photos across Bills & Imports')}</span>
                            </div>
                          </button>
                        )}

                        {/* Tab Settings button link */}
                        {allowedTabs.includes('settings') && (
                          <button
                            onClick={() => {
                              setActiveTab('settings');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'settings' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-slate-400'}`}>
                              <Settings className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">{t('Cài đặt hệ thống', 'System Settings')}</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal font-sans">{t('Chọn giao diện hiển thị, sao lưu, khôi phục dữ liệu xưởng', 'Display options, secure backups & factory database recovery')}</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Week filter integration specifically requested by user to be placed inside the 3-gạch menu */}
                    {activeTab === 'import' && weekKeys.length > 0 && (() => {
                      const currentWeekKeyOfToday = getVietnameseWeekKey(getCurrentDateStr());
                      const sortedWeekKeysForDrawer = [...weekKeys].sort((a, b) => {
                        return weekSortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
                      });
                      return (
                        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">📅 LỌC THEO TUẦN</p>
                            <div className="flex items-center gap-1.5">
                              {/* Sort Toggle Button */}
                              <button
                                onClick={() => setWeekSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                                title={weekSortOrder === 'desc' ? 'Xếp cũ nhất trước' : 'Xếp mới nhất trước'}
                              >
                                <ArrowUpDown className="w-3 h-3 text-current" />
                                <span className="font-mono text-[9.5px]">{weekSortOrder === 'desc' ? 'Mới → Cũ' : 'Cũ → Mới'}</span>
                              </button>
                              
                              <span className="text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                                Tổng: {weekKeys.length} tuần
                              </span>
                            </div>
                          </div>

                          {/* Làm mới danh sách button */}
                          <button
                            onClick={() => {
                              const latestItems = getSavedArray("xuongan_import_items", []);
                              setItems(latestItems);
                            }}
                            className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-[10.5px] font-bold text-slate-600 dark:text-slate-350 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Làm mới danh sách</span>
                          </button>

                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                            <button
                              onClick={() => {
                                setSelectedWeekFilter('all');
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                                selectedWeekFilter === 'all'
                                  ? 'bg-indigo-50 border-indigo-250 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305'
                                  : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <span>🌈 Hiện tất cả tuần</span>
                              <span className="text-[10px] bg-slate-105 dark:bg-zinc-900 text-slate-500 rounded px-1.5 py-0.5 font-mono">
                                {items.length} lô
                              </span>
                            </button>

                            {sortedWeekKeysForDrawer.map((weekKey) => {
                              const list = itemsByWeek[weekKey] || [];
                              const qty = list.reduce((sum, item) => sum + (item?.sốLượng || 0), 0);
                              const count = list.length;
                              const isSelected = selectedWeekFilter === weekKey;
                              const isCurrentWeek = weekKey === currentWeekKeyOfToday;
                              
                              return (
                                <button
                                  key={weekKey}
                                  onClick={() => {
                                    setSelectedWeekFilter(weekKey);
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between border ${
                                    isSelected
                                      ? 'bg-indigo-50 border-indigo-250 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305 font-bold'
                                      : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500 hover:text-slate-700 dark:text-slate-400 font-semibold'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                                    <span className={`truncate ${
                                      isCurrentWeek 
                                        ? 'font-black text-indigo-600 dark:text-indigo-400' 
                                        : isSelected 
                                          ? 'font-bold text-slate-900 dark:text-white' 
                                          : 'font-semibold text-slate-700 dark:text-slate-350'
                                    }`}>
                                      {weekKey}
                                    </span>
                                    {isCurrentWeek && (
                                      <span className="px-1 py-0.2 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded border border-emerald-500/20 shrink-0">
                                        Hiện tại
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] text-slate-400 font-mono">({count} lô)</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                      isSelected ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-slate-105 text-slate-600 dark:bg-zinc-900'
                                    }`}>
                                      {qty.toLocaleString()}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Short metrics preview indicator */}
                    <div className="bg-slate-100/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
                      <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block mb-1">Cơ sở dữ liệu xưởng</span>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                        📦 Sản lượng nhập: <span className="font-mono text-indigo-700 dark:text-indigo-400 font-extrabold">{items.length} lô</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-350 mt-1">
                        👥 Khách sỉ: <span className="font-mono text-indigo-700 dark:text-indigo-400 font-extrabold">{customers.length} người</span>
                      </p>
                    </div>

                    {/* MENU ĐIỀU HÀNH TỔNG QUAN */}
                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">⚙️ MENU ĐIỀU HÀNH HỆ THỐNG</p>
                      
                      <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs font-semibold gap-0.5">
                        {[
                          { id: 'backup', label: 'Sao lưu', icon: Database },
                          { id: 'features', label: 'Trang chủ', icon: Home },
                          { id: 'theme', label: 'Sáng/Tối', icon: Sun },
                          { id: 'guide', label: 'H.Dẫn', icon: HelpCircle }
                        ].map(tab => {
                          const Icon = tab.icon;
                          const isActive = settingsActiveTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setSettingsActiveTab(tab.id as any)}
                              className={`flex-1 py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition cursor-pointer leading-none min-w-0 ${isActive ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold font-sans' : 'text-slate-500 dark:text-slate-450 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span className="truncate">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Settings tab container */}
                      <div className="bg-slate-100/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3">
                        {settingsActiveTab === 'features' && (
                          <div className="space-y-3" id="settings_panel_features">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-350 leading-tight">
                              Bật/Tắt hiển thị ngoài trang chủ:
                            </p>
                            
                            <div className="space-y-1 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 select-none max-h-56 overflow-y-auto">
                              {[
                                { id: 'import', label: '1. Nhập hàng', desc: 'Sản lượng thợ & đơn giá bộ', color: 'text-emerald-500' },
                                { id: 'invoices', label: '2. Hóa đơn', desc: 'Tạo bill, in nhiệt, nợ sỉ', color: 'text-blue-500' },
                                { id: 'report', label: '3. Doanh thu', desc: 'Báo cáo thống kê lãi gộp', color: 'text-amber-500' },
                                { id: 'production', label: '4. Sản xuất', desc: 'Cắt gá & phân tổ may ráp', color: 'text-purple-500' },
                                { id: 'inventory', label: '5. Kho thành phẩm', desc: 'Kiểm đếm xưởng tự động', color: 'text-emerald-500' },
                                { id: 'profit_estimator', label: '6. Giá thành & lợi nhuận', desc: 'Dự phóng chi phí & biên lãi sỉ', color: 'text-indigo-500' },
                                { id: 'materials', label: '7. Định mức', desc: 'Định mức nhiên liệu vật tư', color: 'text-teal-500' },
                                { id: 'gallery', label: '8. Thư viện ảnh', desc: 'Hình ảnh đính kèm sản phẩm', color: 'text-indigo-500' }
                              ].map(feat => {
                                const isChecked = enabledHomeFeatures.includes(feat.id);
                                return (
                                  <label 
                                    key={feat.id} 
                                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition"
                                  >
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setEnabledHomeFeatures(prev => prev.filter(p => p !== feat.id));
                                        } else {
                                          setEnabledHomeFeatures(prev => [...prev, feat.id]);
                                        }
                                      }}
                                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1 ml-1.5">
                                      <span className={`text-[11px] font-extrabold ${feat.color} block leading-normal`}>
                                        {feat.label}
                                      </span>
                                      <span className="text-[8.5px] text-slate-400 block mt-0.5 leading-none truncate">
                                        {feat.desc}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {settingsActiveTab === 'theme' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500 font-medium">Chọn giao diện làm việc tối ưu:</p>
                            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                              <button
                                onClick={() => setSettings(prev => ({ ...prev, theme: 'light' }))}
                                className={`p-2 border rounded-lg flex flex-col items-center gap-1 transition cursor-pointer text-xs ${settings.theme === 'light' ? 'border-indigo-500 bg-indigo-50/10 text-indigo-600 font-bold' : 'border-slate-200/60 dark:border-slate-800 text-slate-505'}`}
                              >
                                <Sun className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px]">Sáng</span>
                              </button>

                              <button
                                onClick={() => setSettings(prev => ({ ...prev, theme: 'dark' }))}
                                className={`p-2 border rounded-lg flex flex-col items-center gap-1 transition cursor-pointer text-xs ${settings.theme === 'dark' ? 'border-indigo-400 bg-indigo-950/10 text-indigo-400 font-bold' : 'border-slate-200/60 dark:border-slate-800 text-slate-505'}`}
                              >
                                <Moon className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px]">Tối</span>
                              </button>

                              <button
                                onClick={() => setSettings(prev => ({ ...prev, theme: 'system' }))}
                                className={`p-2 border rounded-lg flex flex-col items-center gap-1 transition cursor-pointer text-xs ${settings.theme === 'system' ? 'border-indigo-500 bg-indigo-50/10 text-indigo-600 dark:text-indigo-400 font-bold' : 'border-slate-200/60 dark:border-slate-800 text-slate-505'}`}
                              >
                                <Smartphone className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px]">Hệ thống</span>
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center font-sans mt-1 leading-normal">
                              Chế độ <span className="font-semibold text-indigo-600 dark:text-indigo-400">Hệ thống</span> tự động đổi theo độ sáng điện thoại của bạn.
                            </p>
                          </div>
                        )}



                        {settingsActiveTab === 'backup' && (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={exportDatabasePackage}
                              className="w-full bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-100 text-[11px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Xuất Backup Database (.json)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Phục Hồi Dữ Liệu từ File</span>
                            </button>

                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".json"
                              onChange={handleFileUpload}
                              className="hidden"
                            />

                            <hr className="border-slate-150 dark:border-slate-800 my-1.5" />

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("🚨 CẢNH BÁO CỰC KỲ QUAN TRỌNG!\n\nHành động này sẽ XÓA SẠCH VĨNH VIỄN toàn bộ cơ sở dữ liệu của xưởng (bao gồm tất cả mặt hàng nhập lẻ, danh sách khách hàng, hoá đơn nợ cũ nợ mới và nhật ký thanh toán khỏi thiết bị này).\n\nBạn có chắc chắn muốn XÓA BỎ LÀM MỚI tất cả không?")) {
                                  localStorage.clear();
                                  alert("Đã xoá sạch toàn bộ dữ liệu bộ nhớ thành công! Hệ thống sẽ tự động khởi động lại.");
                                  window.location.reload();
                                }
                              }}
                              className="w-full bg-red-50 hover:bg-red-105 text-red-600 dark:bg-red-950/10 dark:text-red-400 text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Xoá Toàn Bộ Dữ Liệu Xưởng</span>
                            </button>
                          </div>
                        )}

                        {settingsActiveTab === 'guide' && (
                          <div className="space-y-2 text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed max-h-48 overflow-y-auto pr-0.5 scrollbar-thin">
                            <p className="font-bold text-slate-755 dark:text-slate-300">Hướng dẫn nhanh:</p>
                            <ol className="list-decimal pl-3 space-y-1">
                              <li>Thêm dữ liệu: Điền tên mẫu, số lượng và giá may rồi ấn "Xác nhận". Ngày nhập sẽ tự cập nhật.</li>
                              <li>Cập nhật đơn giá: Trong bảng danh sách, bấm bút chì để chỉnh sửa trực tiếp.</li>
                              <li>Lưu và chia sẻ: Xuất file backup (.json) ở tab "Sao lưu" máy cũ, rồi tải lên ở máy mới để tiếp tục.</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer controls */}
                  <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest">{authState.displayName || 'Kế toán viên'} (Admin)</span>
                      </div>
                      <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/20">
                        v{localStorage.getItem('capgo_active_version') || CURRENT_VERSION}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 hover:text-red-700 dark:text-red-400 p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-red-100 dark:border-transparent cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('Đăng xuất hệ thống', 'Logout System')}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto min-h-0 relative" id="main_scroll_container">
            {/* Sub-body page wrapper components */}
            <main className="flex-grow max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 w-full relative">
            
            {/* Display page logs / tab view */}
            <AnimatePresence mode="wait">
              {activeTab === 'home' ? (
                <motion.div
                  key="home-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  {renderHomeContent()}
                </motion.div>
              ) : activeTab === 'import' ? (
                <motion.div
                  key="import-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <Suspense fallback={<TabLoadingFallback />}>
                    <GoodsImportTab
                      items={items}
                      setItems={setItems}
                      laborPayments={laborPayments}
                      setLaborPayments={setLaborPayments}
                      tpDtShippings={tpDtShippings || []}
                      setTpDtShippings={setTpDtShippings}
                      settings={settings}
                      setSettings={setSettings}
                      onImportBackup={handleImportBackup}
                      selectedWeekFilter={selectedWeekFilter}
                      setSelectedWeekFilter={setSelectedWeekFilter}
                      userRole={userRole}
                      autoExpandForm={autoExpandImportForm}
                      onAutoExpandFormReset={() => setAutoExpandImportForm(false)}
                    />
                  </Suspense>
                </motion.div>
              ) : activeTab === 'invoices' ? (
                <motion.div
                  key="invoices-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <Suspense fallback={<TabLoadingFallback />}>
                    <InvoicesTab
                      customers={customers}
                      setCustomers={setCustomers}
                      bills={bills}
                      setBills={setBills}
                      payments={payments}
                      setPayments={setPayments}
                      userRole={userRole}
                      resolvedTheme={resolvedTheme}
                      autoOpenCreateBill={autoOpenCreateBill}
                      onAutoOpenCreateBillReset={() => setAutoOpenCreateBill(false)}
                      selectedCustomerId={invoiceSelectedCustomerId}
                      setSelectedCustomerId={setInvoiceSelectedCustomerId}
                      items={items}
                    />
                  </Suspense>
                </motion.div>
              ) : activeTab === 'production' ? (
                <motion.div
                  key="production-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <Suspense fallback={<TabLoadingFallback />}>
                    <ProductionTab
                      operationBreakdowns={operationBreakdowns}
                      setOperationBreakdowns={setOperationBreakdowns}
                      workers={workers}
                      setWorkers={setWorkers}
                      tasks={tasks}
                      setTasks={setTasks}
                      workerJobs={workerJobs}
                      setWorkerJobs={setWorkerJobs}
                      rawMaterials={rawMaterials}
                      setRawMaterials={setRawMaterials}
                      materialRecipes={materialRecipes}
                      setMaterialRecipes={setMaterialRecipes}
                      productionBatches={productionBatches}
                      setProductionBatches={setProductionBatches}
                      materialReimports={materialReimports}
                      setMaterialReimports={setMaterialReimports}
                      laborPayments={laborPayments}
                      setLaborPayments={setLaborPayments}
                      settings={settings}
                      userRole={userRole}
                      initialSubTab={productionSubTab}
                      onSubTabChange={setProductionSubTab}
                    />
                  </Suspense>
                </motion.div>
              ) : activeTab === 'profit_estimator' ? (
                <motion.div
                  key="profit-estimator-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <ProfitEstimatorTab
                    materialRecipes={materialRecipes}
                    rawMaterials={rawMaterials}
                    operationBreakdowns={operationBreakdowns}
                    fastEditMode={fastEditMode}
                    defaultLaborCost={quickDefaultLabor}
                    defaultProfitMarginPercent={quickDefaultMargin}
                  />
                </motion.div>
              ) : activeTab === 'inventory' ? (
                <motion.div
                  key="inventory-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                  className="bg-white dark:bg-[#0c101d] rounded-2xl border border-slate-200/50 dark:border-slate-800 p-6 shadow-xs max-w-7xl mx-auto"
                >
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-6 text-left">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-850 dark:text-slate-200 uppercase tracking-wider font-mono">
                        Kho Hàng & Thành Phẩm
                      </h1>
                      <p className="text-[11px] text-slate-455 dark:text-slate-400 mt-0.5 font-sans">
                        Tự động kiểm đếm, đối soát hàng hoá nhập xuất chi tiết theo thời gian thực.
                      </p>
                    </div>
                  </div>
                  <ReportInventoryDetail
                    items={items}
                    bills={bills}
                    customers={customers}
                    setActiveTab={setActiveTab}
                  />
                </motion.div>
              ) : activeTab === 'report' ? (
                <motion.div
                  key="report-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <ReportTab
                    items={items}
                    bills={bills}
                    productionBatches={productionBatches}
                    workers={workers}
                    workerJobs={workerJobs}
                    setActiveTab={setActiveTab}
                    payments={payments}
                    laborPayments={laborPayments}
                    customers={customers}
                  />
                </motion.div>
              ) : activeTab === 'settings' ? (
                <motion.div
                  key="settings-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <SettingsTab
                    settings={settings}
                    setSettings={setSettings}
                    exportDatabasePackage={exportDatabasePackage}
                    onImportBackup={handleImportBackup}
                    items={items}
                    bills={bills}
                    customers={customers}
                    syncStatus={syncStatus}
                    lastSyncTime={lastSyncTime}
                    handleCloudPull={handleCloudPull}
                    handleCloudPush={handleCloudPush}
                    userRole={userRole}
                    userProfiles={userProfiles}
                    setUserProfiles={setUserProfiles}
                  />
                </motion.div>
              ) : activeTab === 'gallery' ? (
                <motion.div
                  key="gallery-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                >
                  <GalleryTab
                    items={items}
                    setItems={setItems}
                    bills={bills}
                    setBills={setBills}
                    customers={customers}
                    setActiveTab={setActiveTab}
                    resolvedTheme={resolvedTheme}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="notifications-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0 }}
                  className="space-y-4 max-w-2xl mx-auto font-sans pb-12"
                >
                  {/* Title & Selection controls in Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 className="text-base font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 leading-none">
                        <Bell className="w-5 h-5 text-indigo-505" />
                        <span>Nhật ký truy cập & thông báo</span>
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        {/* 2. Mark all as read button */}
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllNotificationsAsRead}
                            className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Đọc tất cả ({unreadCount})</span>
                          </button>
                        )}

                        {/* Checkboxes Toggle / Multi-select Trigger */}
                        <button
                          onClick={() => {
                            setIsMultiSelectNotifActive(!isMultiSelectNotifActive);
                            setSelectedNotifIds([]);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isMultiSelectNotifActive 
                              ? "bg-indigo-50 border-indigo-205 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-850 dark:hover:bg-slate-800 dark:border-slate-750 dark:text-slate-300"
                          }`}
                        >
                          {isMultiSelectNotifActive ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>Hủy chọn nhiều</span>
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>Chọn nhiều để xoá</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Filter buttons for each unique account */}
                    {authState?.loginNotifications && authState.loginNotifications.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-850">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          <span>LỌC ĐỘC LẬP THEO TÀI KHOẢN</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {/* All option */}
                          <button
                            onClick={() => {
                              setNotifAccountFilter('all');
                              setSelectedNotifIds([]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border flex items-center gap-1.5 ${
                              notifAccountFilter === 'all'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>Tất cả ({authState.loginNotifications.length})</span>
                          </button>

                          {/* Dynamic Account filters */}
                          {uniqueAccounts.map(acc => {
                            const count = accountCounts[acc] || 0;
                            const isSystemAcc = acc === "Hệ thống";
                            const icon = isSystemAcc ? <RefreshCw className="w-3 h-3 text-emerald-500" /> : <User className="w-3 h-3 text-indigo-500" />;
                            return (
                              <button
                                key={acc}
                                onClick={() => {
                                  setNotifAccountFilter(acc);
                                  setSelectedNotifIds([]);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border flex items-center gap-1.5 ${
                                  notifAccountFilter === acc
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-800'
                                }`}
                              >
                                {icon}
                                <span className="font-mono text-[11px]">{acc} ({count})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bulk select operations bar */}
                    {isMultiSelectNotifActive && filteredNotifs.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/15 rounded-xl border border-indigo-100 dark:border-indigo-950/40">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSelectAllNotifs}
                            className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-indigo-600 dark:text-indigo-400 font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Chọn hết ({filteredNotifs.length})</span>
                          </button>
                          
                          {selectedNotifIds.length > 0 && (
                            <button
                              onClick={handleDeselectAllNotifs}
                              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 font-bold text-xs px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                            >
                              <span>Bỏ chọn</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {notifAccountFilter !== 'all' && (
                            <button
                              onClick={handleDeleteAllForCurrentAccount}
                              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition-all dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xoá hết nhóm này</span>
                            </button>
                          )}

                          <button
                            disabled={selectedNotifIds.length === 0}
                            onClick={handleDeleteSelectedNotifs}
                            className={`font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                              selectedNotifIds.length > 0
                                ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-650 cursor-not-allowed"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xoá {selectedNotifIds.length} mục đã chọn</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* List of Notification items */}
                  <div className="space-y-6">
                    {filteredNotifs.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500">
                        <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-50" />
                        <p className="italic text-xs">Không tồn tại nhật ký hoặc cấu hình bảo mật nào.</p>
                      </div>
                    ) : (
                      groupedNotifCategories.map(category => (
                        <div key={category.key} className="space-y-3">
                          {/* Group Header */}
                          <div className="flex items-center gap-2 px-1 pt-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600/90 dark:text-indigo-400/90">
                              {category.label}
                            </span>
                            <div className="flex-grow h-px bg-slate-100 dark:bg-slate-850" />
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850/60 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800/80">
                              {category.items.length} mục
                            </span>
                          </div>

                          <div className="space-y-3">
                            {category.items.map(notif => {
                              const isSystem = notif.device.includes("Hệ thống tự động");
                              const isRealtimeUpdate = !isSystem && !!notif.targetType;
                              const isSelected = selectedNotifIds.includes(notif.id);
                              
                              let displayTitle = "🔐 Đăng nhập thành công";
                              let titleIcon = <Shield className="w-3.5 h-3.5 mt-0.5 text-indigo-400" />;
                              
                              if (isSystem) {
                                displayTitle = "🔄 Tự động đồng bộ ngày mới & hệ thống";
                                titleIcon = <RefreshCw className="w-3.5 h-3.5 mt-0.5 text-emerald-500 animate-spin-slow" />;
                              } else if (notif.targetType === 'import') {
                                displayTitle = "📅 Lô Nhập Hàng Đã Cập Nhật";
                                titleIcon = <Boxes className="w-3.5 h-3.5 mt-0.5 text-blue-500" />;
                              } else if (notif.targetType === 'invoice') {
                                displayTitle = "🧾 Viết Hoá Đơn Đã Cập Nhật";
                                titleIcon = <Receipt className="w-3.5 h-3.5 mt-0.5 text-amber-500" />;
                              } else if (notif.targetType === 'material') {
                                displayTitle = "📦 Kho Định Mức Đã Cập Nhật";
                                titleIcon = <Package className="w-3.5 h-3.5 mt-0.5 text-rose-500" />;
                              }

                              return (
                                <div
                                  key={notif.id}
                                  onClick={() => {
                                    if (isMultiSelectNotifActive) {
                                      toggleSelectNotif(notif.id);
                                    } else if (isRealtimeUpdate) {
                                      handleNotificationClick(notif);
                                    }
                                  }}
                                  className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl relative group text-xs shadow-2xs transition-all flex gap-3.5 ${
                                    isMultiSelectNotifActive 
                                      ? "border-slate-250 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 cursor-pointer" 
                                      : isRealtimeUpdate 
                                        ? "border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer hover:shadow-md hover:-translate-y-0.5" 
                                        : "border-slate-200 dark:border-slate-800"
                                  } ${isSelected ? "ring-2 ring-indigo-500/80 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01]" : ""}`}
                                >
                                  {/* Checkbox on left when multi-select active */}
                                  {isMultiSelectNotifActive && (
                                    <div className="flex items-center flex-shrink-0">
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-transform scale-110" />
                                      ) : (
                                        <Square className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-slate-400 dark:hover:text-slate-600 transition-colors" />
                                      )}
                                    </div>
                                  )}

                                  {/* Main notification body */}
                                  <div className="flex-grow min-w-0">
                                    <div className="flex gap-2 text-[10.5px] text-slate-400 font-mono items-center">
                                      {titleIcon}
                                      <span>{notif.time}</span>
                                      {isRealtimeUpdate && (
                                        <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded ml-auto flex-shrink-0">
                                          Dữ liệu đồng bộ
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-2 text-sm leading-none">
                                      {displayTitle}
                                    </p>
                                    <p className="text-slate-500 mt-1">
                                      Địa chỉ: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{notif.ip}</span> | Vị trí: <span className="font-semibold text-slate-600 dark:text-slate-300">{notif.location}</span>
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-400 mt-2 font-mono bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850 whitespace-pre-wrap">{notif.device}</p>
                                    
                                    {/* Detailed Connection & Cloud Sync status badge */}
                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                                      {notif.ip === 'Thành công' || isSystem ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2.5 py-0.5 rounded-md font-semibold border border-emerald-100/60 dark:border-emerald-900/40">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          Đã lưu trữ thành công trên Firestore (Cloud)
                                        </span>
                                      ) : syncStatus === 'error' ? (
                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-400 px-2.5 py-0.5 rounded-md font-semibold border border-amber-100/50 dark:border-amber-900/30 animate-pulse">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                          Lưu cục bộ (Chờ kết nối internet để đồng bộ)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 bg-indigo-50/75 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 px-2.5 py-0.5 rounded-md font-semibold border border-indigo-100/50 dark:border-indigo-900/40">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          Đã đồng bộ an toàn lên Firestore
                                        </span>
                                      )}
                                    </div>

                                    {/* Direct sync update click indicators */}
                                    {isRealtimeUpdate && !isMultiSelectNotifActive && (
                                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-end text-[10px] text-indigo-600 dark:text-indigo-400 font-bold gap-1">
                                        <span>Chuyển đến mục xem ngay</span>
                                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Standalone delete button when NOT in multi-select mode */}
                                  {!isMultiSelectNotifActive && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation(); // Avoid triggering card click
                                        if (window.confirm("Bạn muốn xoá thông báo này?")) {
                                          deleteNotification(notif.id);
                                        }
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 hover:text-red-655 dark:hover:bg-red-950/30 dark:hover:text-red-400 text-slate-400 dark:text-slate-600 transition-all self-start flex-shrink-0 cursor-pointer"
                                      title="Xoá thông báo này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating stats is now placed inside ReportTab as a dedicated tab icon button */}

          </main>
          </div>

          {/* Sticky floating bottom shelf navigation for mobile/tablet screen sizes */}
          <div className="lg:hidden fixed bottom-3 left-3 right-3 rounded-2xl bg-[#0c101d]/90 text-white border border-slate-800/80 backdrop-blur-md shadow-2xl z-40 px-5 py-3 flex justify-between items-center text-center">
            
            {/* 1. Trang chủ */}
            {allowedTabs.includes('home') && (
              <button
                onClick={() => setActiveTab('home')}
                className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-all ${activeTab === 'home' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
              >
                <Home className="w-4.5 h-4.5" />
                <span className="text-[9.5px]">Trang chủ</span>
              </button>
            )}

            {/* 2. Báo cáo */}
            {allowedTabs.includes('report') && (
              <button
                onClick={() => setActiveTab('report')}
                className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-all ${activeTab === 'report' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
              >
                <BarChart3 className="w-4.5 h-4.5" />
                <span className="text-[9.5px]">Báo cáo</span>
              </button>
            )}

            {/* 2.5 Kho Hàng */}
            {allowedTabs.includes('inventory') && (
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-all ${activeTab === 'inventory' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
              >
                <Boxes className="w-4.5 h-4.5 text-emerald-405" />
                <span className="text-[9.5px]">Kho</span>
              </button>
            )}

            {/* 3. Thông báo */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 flex flex-col items-center gap-1 cursor-pointer relative transition-all ${activeTab === 'notifications' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute -top-1.5 right-[28%] bg-red-500 text-white font-extrabold text-[8.5px] px-1.5 py-0.5 rounded-full font-mono shadow-md animate-pulse">
                3
              </span>
              <span className="text-[9.5px]">Thông báo</span>
            </button>

            {/* 5. Thư viện ảnh */}
            {allowedTabs.includes('gallery') && (
              <button
                onClick={() => setActiveTab('gallery')}
                className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-all ${activeTab === 'gallery' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
              >
                <Image className="w-4.5 h-4.5" />
                <span className="text-[9.5px]">Thư viện ảnh</span>
              </button>
            )}

          </div>

          {/* Footer of whole application */}
          <footer className="py-6 border-t border-slate-200/60 dark:border-slate-850 mt-12 bg-white dark:bg-[#0b0f19]">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-1 select-none">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans uppercase">HỆ THỐNG KẾ TOÁN QUẢN LÝ NỘI BỘ - XƯỞNG MAY AN (ĐT)</p>
              <p className="text-[10px] text-slate-400/80 dark:text-slate-550 font-mono">Bảo mật đa tầng TLS 1.3 | AES-256 mã hóa cục bộ | Khôi phục chuyển máy liền mạch.</p>
            </div>
          </footer>
        </div>
      )}

      {/* POPUP SIMULATED WEB PUSH NOTIFICATION ALERT STYLE */}
      <AnimatePresence>
        {activeLoginToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-55 w-full max-w-sm bg-slate-900 border border-emerald-500/40 text-slate-100 rounded-2xl shadow-2xl p-4 flex gap-3 backdrop-blur-xl font-sans"
            style={{ contentVisibility: 'auto' }}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 flex-shrink-0 animate-pulse">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex-grow text-xs space-y-1">
              <p className="font-bold text-white text-[13px] flex items-center gap-1.5">
                <span>CẢNH BÁO BẢO MẬT ĐĂNG NHẬP</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </p>
              <p className="text-slate-350 leading-relaxed">
                Máy chủ xưởng may vừa ghi nhận phiên đăng nhập mới thành công.
              </p>
              <div className="mt-2 p-1.5 bg-slate-950/50 rounded-lg space-y-0.5 font-mono text-[10px] text-slate-400 border border-slate-850">
                <p>📍 Vị trí: <span className="text-slate-330 font-semibold">{activeLoginToast.location}</span></p>
                <p>🔌 Địa chỉ IP: <span className="text-indigo-400 font-semibold">{activeLoginToast.ip}</span></p>
                <p>🕒 Thời gian: {activeLoginToast.time}</p>
                <p>📱 Thiết bị: {activeLoginToast.device.split(',')[0]} (đã xác thực)</p>
              </div>
            </div>

            <button
              onClick={() => setActiveLoginToast(null)}
              className="text-slate-450 hover:text-slate-200 self-start p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {showSyncBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-55 w-full max-w-sm bg-zinc-950/95 border border-emerald-500/40 text-emerald-100 rounded-2xl shadow-2xl p-4 flex gap-3 backdrop-blur-xl font-sans"
            style={{ contentVisibility: 'auto' }}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 animate-pulse">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex-grow text-xs space-y-1">
              <p className="font-bold text-white text-[13px] flex items-center gap-1.5">
                <span>ĐỒNG BỘ DỮ LIỆU & NGÀY MỚI</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </p>
              <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                Hệ thống kế toán đã tự động đồng bộ thời gian trực tuyến và làm mới các bộ lọc lịch, ngày tháng ghi nhận thành công!
              </p>
              <div className="mt-1.5 font-mono text-[9.5px] text-emerald-400">
                📅 Ngày: <strong className="text-white font-bold">{currentLiveTime.split(" ")[0]}</strong> &bull; Giờ: {currentLiveTime.split(" ")[1]}
              </div>
            </div>

            <button
              onClick={() => setShowSyncBanner(false)}
              className="text-slate-400 hover:text-white self-start p-1 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {isEditingSelfProfile && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsEditingSelfProfile(false)} />
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSaveSelfProfile}
              className={`max-w-md w-full p-6 shadow-2xl rounded-2xl z-20 space-y-4 border ${resolvedTheme === 'dark' ? 'bg-[#101424] border-slate-850 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
            >
              <div className={`pb-3 flex justify-between items-center border-b ${resolvedTheme === 'dark' ? 'border-slate-850' : 'border-slate-150'}`}>
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase font-mono">Chỉnh sửa hồ sơ cá nhân</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Cập nhật họ tên hiển thị và ảnh đại diện của bạn</p>
                </div>
                <button type="button" onClick={() => setIsEditingSelfProfile(false)} className="text-slate-400 hover:text-slate-650 transition p-1 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">Họ tên hiển thị *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A, Thủ quỹ An..."
                    value={selfProfileName}
                    onChange={e => setSelfProfileName(e.target.value)}
                    className={`w-full border rounded-xl py-2.5 px-3.5 outline-none focus:border-indigo-505 transition font-sans ${resolvedTheme === 'dark' ? 'bg-slate-900 border-slate-850 text-white' : 'bg-white border-slate-200'}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">Ảnh chân dung / Ảnh đại diện của bạn</label>
                  <CameraCapture
                    onCapture={setSelfProfilePhoto}
                    initialValue={selfProfilePhoto}
                    resolvedTheme={resolvedTheme}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditingSelfProfile(false)}
                  className="w-1/2 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-medium cursor-pointer transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#6366f1] hover:bg-[#5053e1] text-white py-2.5 rounded-xl font-bold transition active:scale-[0.98] cursor-pointer"
                >
                  Ghi Nhận Hồ Sơ
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {isQuickPricingModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
            <div className="absolute inset-0" onClick={() => setIsQuickPricingModalOpen(false)} />
            <motion.form
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onSubmit={(e) => {
                e.preventDefault();
                localStorage.setItem('xuongan_default_labor_cost', String(quickDefaultLabor));
                localStorage.setItem('xuongan_default_profit_margin_percent', String(quickDefaultMargin));
                setIsQuickPricingModalOpen(false);
              }}
              className={`max-w-md w-full p-6 shadow-2xl rounded-3xl z-20 space-y-5 border ${
                resolvedTheme === 'dark' 
                  ? 'bg-[#101424] border-slate-850 text-white shadow-indigo-950/30' 
                  : 'bg-white border-slate-150 text-slate-800 shadow-slate-200'
              }`}
            >
              <div className={`pb-3.5 flex justify-between items-center border-b ${resolvedTheme === 'dark' ? 'border-slate-850' : 'border-slate-150'}`}>
                <div className="text-left">
                  <h3 className="text-sm font-black tracking-wider uppercase font-sans flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    🛠️ CẤU HÌNH THAM SỐ MỐC
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-1 leading-snug">
                    Điều chỉnh tham số mặc định được dùng khi khởi tạo dự phóng biên lãi Profit Estimator
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsQuickPricingModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="text-left">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-450 mb-1.5 tracking-wider flex items-center gap-1">
                    💸 Công thợ mặc định (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="VD: 15000"
                    value={quickDefaultLabor === 0 ? '' : quickDefaultLabor}
                    onChange={e => setQuickDefaultLabor(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={`w-full border rounded-2xl py-3 px-4 outline-none focus:border-indigo-505 transition font-mono font-bold text-sm ${
                      resolvedTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1">
                    Giá sàn công may rắp, thợ chính được gán làm giá mốc nếu mẫu may chưa có bảng rạp rã công chi tiết.
                  </p>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-450 mb-1.5 tracking-wider flex items-center gap-1">
                    📈 Biên lợi nhuận mục tiêu (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    placeholder="VD: 50"
                    value={quickDefaultMargin === 0 ? '' : quickDefaultMargin}
                    onChange={e => setQuickDefaultMargin(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={`w-full border rounded-2xl py-3 px-4 outline-none focus:border-indigo-505 transition font-mono font-bold text-sm ${
                      resolvedTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1">
                    Hệ số nâng giá sỉ dự kiến từ chi phí sản xuất: <code>Giá sỉ = Chi phí * (1 + biên lãi %)</code>. Ví dụ: biên lãi 50% ứng với nhân hệ số 1.5.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsQuickPricingModalOpen(false)}
                  className="w-1/2 py-3 border border-slate-200 text-slate-500 dark:text-slate-400 dark:border-slate-850 rounded-2xl font-bold cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-650 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition active:scale-[0.98] cursor-pointer shadow-md shadow-indigo-550/20"
                >
                  Cập Nhật Mốc
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {updateInfo && (
          <AppUpdateModal
            updateInfo={updateInfo}
            onClose={handleDismissUpdate}
          />
        )}

        {capgoPendingUpdate && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md bg-slate-950 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 text-white rounded-3xl p-4.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between font-sans"
          >
            <div className="space-y-1 text-left flex-1 pr-1">
              <span className="text-[8.5px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                Sẵn sàng nâng cấp (OTA)
              </span>
              <p className="text-xs text-slate-200 dark:text-slate-100 font-semibold leading-snug">
                Đã tải xong bản OTA cải tiến mới <strong className="text-emerald-400 font-black font-mono">v{capgoPendingUpdate}</strong>!
              </p>
              <p className="text-[10px] text-slate-400 leading-normal">
                Khởi động lại ngay để áp dụng mà không tốn dung lượng download.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end self-stretch sm:self-auto items-center pt-2 sm:pt-0 border-t border-slate-800 sm:border-0">
              <button
                type="button"
                onClick={() => setCapgoPendingUpdate(null)}
                className="px-3 py-2 hover:bg-slate-800 dark:hover:bg-slate-850 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await CapacitorUpdater.reload();
                  } catch (e: any) {
                    alert(`Không thể tự khởi động lại: ${e?.message || e}`);
                  }
                }}
                className="bg-indigo-500 hover:bg-indigo-400 active:scale-[0.97] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition duration-150 cursor-pointer shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nâng cấp ngay</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
