/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User, Bell, Shield, ShieldCheck, Menu, Info, RefreshCw, Layers, CheckCircle2, X, BarChart3, Database, Sun, Moon, HelpCircle, Download, Upload, AlertCircle, Trash2, Settings, FileSpreadsheet, Smartphone, Scissors, Home, TrendingUp, ShoppingCart, FileText, Factory, Calendar, DollarSign, ChevronRight, Palette } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import GoodsImportTab from './components/GoodsImportTab';
import InvoicesTab from './components/InvoicesTab';
import ProductionTab from './components/ProductionTab';
import ReportTab from './components/ReportTab';
import SettingsTab from './components/SettingsTab';
import FloatingStats from './components/FloatingStats';
import { ImportItem, LaborPayment, Customer, Bill, PaymentRecord, AuthState, AppSettings, TpDtShippingItem, ModelOperationBreakdown, Worker, WorkerJob, RawMaterial, ModelMaterialRecipe, ProductionBatch, MaterialReimport, LoginNotification, TaskType, UserProfile } from './types';
import { initLocalStorage, getSavedState, saveState, importDatabasePackage, exportDatabasePackage } from './utils/storage';
import { downloadAllFromCloud, pushAllLocalStateToCloud } from './utils/syncService';
import { auth, db } from './utils/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function getSavedArray<T>(key: string, fallback: T[]): T[] {
  const value = getSavedState<T[]>(key, fallback);
  return Array.isArray(value) ? value : fallback;
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
  const [settings, setSettings] = useState<AppSettings>(() => getSavedState("xuongan_settings", {
    theme: 'system',
    currencySymbol: 'đ',
    exportFormat: 'xlsx'
  }));

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
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>(() => getSavedArray("xuongan_user_profiles", []));
  const [profileFetchCompleted, setProfileFetchCompleted] = useState<boolean>(false);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'home' | 'import' | 'invoices' | 'production' | 'report' | 'settings' | 'notifications'>('home');
  
  // Mobile hamburger drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active settings tab state inside the hamburger drawer
  const [settingsActiveTab, setSettingsActiveTab] = useState<'charts' | 'backup' | 'theme' | 'guide'>('charts');

  // File input reference for database restoration upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Selected week filter ('all' or specific weekKey) for import tab filtration
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all');
  
  // Real-time Push Notification alert states
  const [activeLoginToast, setActiveLoginToast] = useState<any | null>(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  
  // Real-time auto updated dates and clock
  const [currentLiveTime, setCurrentLiveTime] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
  const [showSyncBanner, setShowSyncBanner] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem("xuongan_last_sync") || null);
  const [showCloudInfo, setShowCloudInfo] = useState(false);

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
    const allTabs = ['home', 'import', 'invoices', 'production', 'report', 'settings'];
    if (!email) {
      console.log("[getUserAllowedTabs] No email found in current auth state. Returning fallback ['home']");
      return ['home'];
    }
    // All authenticated users are allowed full tab access.
    return allTabs;
  };
  const allowedTabs = getUserAllowedTabs();

  // Automatically fetch current user profile from Firestore on mount/login
  useEffect(() => {
    let active = true;
    const fetchUserProfile = async () => {
      if (fbAuthLoading) return;
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

  // Automatically pull database from cloud upon successful authentication / session restore
  useEffect(() => {
    let active = true;
    const triggerAutoPull = async () => {
      if (fbAuthLoading) return;
      if (!authState.isAuthenticated || !authState.email) return;
      
      try {
        setSyncStatus('syncing');
        const cloudData = await downloadAllFromCloud();
        if (!active) return;
        
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
          setSyncStatus('success');
          console.log("Auto-synchronized database from Cloud Firestore successfully");
        } else {
          setSyncStatus('idle');
        }
      } catch (err) {
        console.warn("Failed to auto-pull database from Cloud", err);
        setSyncStatus('error');
      }
    };

    triggerAutoPull();
    return () => {
      active = false;
    };
  }, [authState.email, authState.isAuthenticated, fbAuthLoading]);

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
        const sysSyncLog: LoginNotification = {
          id: "sync-" + Date.now(),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
          ip: "Thành công",
          location: "Cao Lãnh, Đồng Tháp",
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
      const sysSyncLog: LoginNotification = {
        id: "sync-" + Date.now(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
        ip: "Thành công",
        location: "Cao Lãnh, Đồng Tháp",
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
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('home');
      }
      setTimeout(() => {
        isPoppingState.current = false;
      }, 80);
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ tab: 'home' }, '', '');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!isPoppingState.current) {
      // Add to browser history stack for back button support
      if (window.history.state?.tab !== activeTab) {
        window.history.pushState({ tab: activeTab }, '', '');
      }
    }
  }, [activeTab]);

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
      setSettings(getSavedState("xuongan_settings", { theme: 'system', currencySymbol: 'đ', exportFormat: 'xlsx' }));
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
        const sysSyncLog: LoginNotification = {
          id: "sync-" + Date.now(),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + todayStr,
          ip: "Cục bộ máy khách (Client)",
          location: "Hải Phòng / Việt Nam",
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
    }
  };

  const markAllNotificationsAsRead = () => {
    setAuthState(prev => ({
      ...prev,
      loginNotifications: (prev?.loginNotifications || []).map(n => ({ ...n, isRead: true }))
    }));
  };

  const deleteNotification = (id: string) => {
    setAuthState(prev => ({
      ...prev,
      loginNotifications: (prev?.loginNotifications || []).filter(n => n.id !== id)
    }));
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
    const list = itemsByWeek[weekKey];
    const qty = list.reduce((a, b) => a + b.sốLượng, 0);
    const val = list.reduce((a, b) => a + (b.sốLượng * b.đơnGiáMay), 0);
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
    const currentMonthImportCount = items.length || 18;
    const currentMonthBillCount = bills.length || 24;
    
    const rawRevenue = bills.reduce((sum, b) => sum + b.subtotal, 0);
    const totalRevenueFormatted = rawRevenue > 0 
      ? (rawRevenue / 1000000).toFixed(1) + "M" 
      : "48.5M";

    const runningBatchesCount = productionBatches.length || 12;

    return (
      <div className="space-y-6 font-sans select-none" id="dashboard_home_screen">
        
        {/* Profile Card matching the top dark visual container of the screenshot */}
        <div className="bg-white dark:bg-[#0f1224] text-slate-800 dark:text-white rounded-2xl p-6 relative overflow-hidden border border-slate-150/80 dark:border-slate-900/60 flex items-center gap-5 shadow-lg shadow-slate-100/50 dark:shadow-slate-950/20 transition-all duration-300">
          <div className="absolute right-0 top-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Avatar frame */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#415ef4] to-[#6366f1] border-2 border-indigo-500/20 flex items-center justify-center text-white text-[18px] font-black shrink-0 shadow-lg shadow-indigo-500/10">
            {initials}
          </div>
          
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase font-mono">XIN CHÀO,</span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {authState.displayName || 'Demo User'}
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
              {authState.email || 'demo@khohoadon.app'}
            </p>
          </div>
        </div>

        {/* 4 Cards Grid Layout with interactive functions - 2 columns always as shown on image */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Card 1: Nhập hàng */}
          {allowedTabs.includes('import') && (
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
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">{currentMonthImportCount}</p>
                  <p className="text-[9.5px] md:text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-sans whitespace-nowrap">Đơn nhập tháng này</p>
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
          {allowedTabs.includes('invoices') && (
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
                </div>
                
                {/* View Details Button with Icon */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-500/25 transition-all duration-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:border-blue-250 dark:group-hover:border-blue-500/40 group-hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)] text-[9.5px] md:text-[10.5px] font-black uppercase tracking-wider shrink-0">
                  <span className="hidden sm:inline">Xem chi tiết</span>
                  <FileText className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Card 3: Doanh thu */}
          {allowedTabs.includes('report') && (
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
          {allowedTabs.includes('production') && (
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
            <LogOut className="w-4 h-4 text-slate-405" />
            <span>Đăng xuất hệ thống</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen">
          
          {/* Main Dashboard Navigation Header */}
          <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-850 shadow-xs leading-none">
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
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-primary/80 flex items-center justify-center text-white shadow-md shadow-brand-glow">
                    <Layers className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-base font-black tracking-tight text-slate-850 dark:text-slate-105 font-sans block leading-none">Kho Hóa Đơn</span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase leading-none">XƯỞNG MAY AN</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Tab buttons selector - STAYS ON DESKTOP ONLY */}
              <nav className="hidden lg:flex bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs font-semibold">
                {allowedTabs.includes('home') && (
                  <button
                    id="tab_home_btn"
                    onClick={() => setActiveTab('home')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'home' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Trang chủ</span>
                  </button>
                )}
                {allowedTabs.includes('import') && (
                  <button
                    id="tab_import_btn"
                    onClick={() => setActiveTab('import')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span>1. Nhập Hàng Lên/Về</span>
                  </button>
                )}
                {allowedTabs.includes('invoices') && (
                  <button
                    id="tab_invoices_btn"
                    onClick={() => setActiveTab('invoices')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'invoices' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <span>2. Viết Hoá Đơn Bán</span>
                  </button>
                )}
                {allowedTabs.includes('production') && (
                  <button
                    id="tab_production_btn"
                    onClick={() => setActiveTab('production')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'production' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-80s dark:hover:text-slate-200'}`}
                  >
                    <span>3. Quản Lý Sản Xuất</span>
                  </button>
                )}
                {allowedTabs.includes('report') && (
                  <button
                    id="tab_report_btn"
                    onClick={() => setActiveTab('report')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'report' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Báo cáo</span>
                  </button>
                )}
                {allowedTabs.includes('settings') && (
                  <button
                    id="tab_settings_btn"
                    onClick={() => setActiveTab('settings')}
                    className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 text-brand-primary shadow-xs font-bold border border-slate-200/60 dark:border-slate-750' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Cài đặt</span>
                  </button>
                )}
              </nav>

              {/* Right menu actions */}
              <div className="flex items-center gap-2.5">
                
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

                {/* 2. Active User badge / Identity details */}
                <div className="flex items-center gap-2 border-l border-slate-150 dark:border-slate-800 pl-2.5">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden md:block text-left text-xs font-sans">
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{authState.displayName || 'Kế toán viên'}</p>
                    <p className="text-[9px] text-slate-400 font-mono -mt-0.5">Role: Admin Chốt</p>
                  </div>
                </div>

                {/* 3. Safe Sign-Out */}
                <button
                  id="dashboard_logout_btn"
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-transparent hover:bg-slate-100/10 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs font-bold leading-none shrink-0"
                  title="Đăng xuất khỏi phiên"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
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
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs cursor-pointer"
                />

                {/* Drawer Body Container */}
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="relative w-[82vw] max-w-xs bg-slate-50 dark:bg-[#0f172a] min-h-screen shadow-2xl flex flex-col justify-between border-r border-slate-200 dark:border-slate-800"
                >
                  <div className="p-5 space-y-5 overflow-y-auto flex-grow scrollbar-none">
                    {/* Header line inside cabinet */}
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-650 flex items-center justify-center text-white shadow-xs">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans">QUẢN LÝ XƯỞNG AN</span>
                      </div>
                      <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 rounded-lg transition duration-200 cursor-pointer"
                        aria-label="Đóng menu"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Navigation Tab selection lists */}
                    <div className="space-y-3">
                      <p className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">DANH MỤC TRỰC QUAN</p>
                      
                      <div className="space-y-2">
                        {/* Tab 1 button link */}
                        {allowedTabs.includes('import') && (
                          <button
                            onClick={() => {
                              setActiveTab('import');
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'import' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-105 dark:bg-zinc-900 text-slate-505 dark:text-slate-400'}`}>
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">1. Hàng Hoá & Nhập Hàng</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal">Mẫu mã nhập về, lượng công thợ, đơn giá ship hai vùng</span>
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
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'invoices' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-805'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'invoices' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-105 dark:bg-zinc-900 text-slate-505 dark:text-slate-400'}`}>
                              <Layers className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">2. Viết Hoá Đơn Bán</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal">Hóa đơn công nợ lũy kế, thu chi khách sỉ và in hóa đơn sành điệu</span>
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
                            className={`w-full text-left p-3.5 rounded-2xl transition flex items-start gap-3 cursor-pointer select-none group border ${activeTab === 'production' ? 'bg-indigo-50/70 border-indigo-200 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-800'}`}
                          >
                            <div className={`mt-0.5 p-1.5 rounded-lg flex items-center justify-center ${activeTab === 'production' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-105 dark:bg-zinc-900 text-slate-505 dark:text-slate-400'}`}>
                              <Scissors className="w-4 h-4 text-indigo-505" />
                            </div>
                            <div>
                              <span className="text-[12.5px] font-bold block leading-tight">3. Quản Lý Sản Xuất</span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5 block leading-normal">Định mức nguyên liệu kho, phân tổ công đoạn thợ may</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Week filter integration specifically requested by user to be placed inside the 3-gạch menu */}
                    {activeTab === 'import' && weekKeys.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">📅 LỌC THEO TUẦN</p>
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

                          {weekKeys.map((weekKey) => {
                            const qty = itemsByWeek[weekKey].reduce((sum, item) => sum + item.sốLượng, 0);
                            const count = itemsByWeek[weekKey].length;
                            const isSelected = selectedWeekFilter === weekKey;
                            return (
                              <button
                                key={weekKey}
                                onClick={() => {
                                  setSelectedWeekFilter(weekKey);
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-between border ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-250 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-305'
                                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <span className="truncate max-w-[130px]">{weekKey}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-400 font-mono">({count} lô)</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    isSelected ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-105 text-slate-600 dark:bg-zinc-900'
                                  }`}>
                                    {qty.toLocaleString()}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
                          { id: 'charts', label: 'Biểu đồ', icon: BarChart3 },
                          { id: 'backup', label: 'Sao lưu', icon: Database },
                          { id: 'theme', label: 'Sáng/Tối', icon: Sun },
                          { id: 'guide', label: 'H.Dẫn', icon: HelpCircle }
                        ].map(tab => {
                          const Icon = tab.icon;
                          const isActive = settingsActiveTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setSettingsActiveTab(tab.id as any)}
                              className={`flex-1 py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition cursor-pointer leading-none min-w-0 ${isActive ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-xs font-bold font-sans' : 'text-slate-505 dark:text-slate-450 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span className="truncate">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Settings tab container */}
                      <div className="bg-slate-100/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3">
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

                        {settingsActiveTab === 'charts' && (
                          <div className="space-y-3">
                            {weekStatsForChart.length === 0 ? (
                              <div className="text-center py-6 text-[11px] text-slate-400">
                                Chưa có dữ liệu tuần để hiển thị biểu đồ.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* Custom SVG Line chart for production count */}
                                <div className="space-y-1">
                                  <span className="text-[9px] uppercase font-bold text-slate-450 dark:text-slate-400 tracking-wider">Sản lượng may (chiếc)</span>
                                  <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-1">
                                    <svg viewBox="0 0 300 110" className="w-full overflow-visible">
                                      <defs>
                                        <linearGradient id="qtyGradient" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                                        </linearGradient>
                                      </defs>
                                      {/* Horizontal helper dashed lines */}
                                      <line x1="15" y1="20" x2="285" y2="20" stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeDasharray="3" />
                                      <line x1="15" y1="50" x2="285" y2="50" stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeDasharray="3" />
                                      <line x1="15" y1="80" x2="285" y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800/50" strokeDasharray="3" />

                                      {(() => {
                                        const maxQty = Math.max(...weekStatsForChart.map(w => w.qty)) || 1;
                                        const points = weekStatsForChart.map((ws, i) => {
                                          const x = 20 + (i * 260) / (weekStatsForChart.length - 1 || 1);
                                          // Map qty to Y coord: top is 15px, bottom is 80px
                                          const y = 80 - ((ws.qty / maxQty) * 60);
                                          return { x, y, qty: ws.qty, name: ws.name };
                                        });

                                        // Form solid line path
                                        const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                        const areaD = points.length > 0 
                                          ? `${lineD} L ${points[points.length - 1].x} 80 L ${points[0].x} 80 Z`
                                          : '';

                                        return (
                                          <>
                                            {/* Filled gradient area under line chart */}
                                            {areaD && <path d={areaD} fill="url(#qtyGradient)" />}
                                            
                                            {/* Polyline line path */}
                                            {lineD && <path d={lineD} fill="none" stroke="#4f46e5" strokeWidth="2" />}
                                            
                                            {/* Highlight points & markers */}
                                            {points.map((p, idx) => (
                                              <g key={idx}>
                                                <circle cx={p.x} cy={p.y} r="3.5" className="fill-white dark:fill-slate-900 stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="2" />
                                                <text x={p.x} y={p.y - 7} textAnchor="middle" className="text-[8px] font-bold font-mono fill-indigo-600 dark:fill-indigo-400">
                                                  {p.qty}
                                                </text>
                                                <text x={p.x} y="95" textAnchor="middle" className="text-[8px] font-mono fill-slate-450 dark:fill-slate-500">
                                                  {p.name}
                                                </text>
                                              </g>
                                            ))}
                                          </>
                                        );
                                      })()}
                                    </svg>
                                  </div>
                                </div>

                                {/* Custom SVG Line chart for Costs */}
                                <div className="space-y-1 pt-1">
                                  <span className="text-[9px] uppercase font-bold text-slate-455 dark:text-slate-400 tracking-wider">Tiền may tuần (đồng)</span>
                                  <div className="h-28 flex items-end justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-1">
                                    {weekStatsForChart.map((ws, i) => {
                                      const maxVal = Math.max(...weekStatsForChart.map(w => w.val)) || 1;
                                      const heightPr = (ws.val / maxVal) * 100;
                                      return (
                                        <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                                          <span className="text-[8px] font-mono text-slate-505 mb-0.5">{(ws.val / 1000000).toFixed(1)}M</span>
                                          <div 
                                            className="w-4 bg-emerald-500 dark:bg-emerald-605 rounded-t-[3px]"
                                            style={{ height: `${heightPr}%`, minHeight: '2px' }}
                                          />
                                          <span className="text-[8px] text-slate-400 mt-1 truncate max-w-full font-mono">{ws.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
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
                              className="w-full bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
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
                  <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest">{authState.displayName || 'Kế toán viên'} (Admin)</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 hover:text-red-700 dark:text-red-400 p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-red-100 dark:border-transparent cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất hệ thống</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
                  transition={{ duration: 0.18 }}
                >
                  {renderHomeContent()}
                </motion.div>
              ) : activeTab === 'import' ? (
                <motion.div
                  key="import-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                >
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
                  />
                </motion.div>
              ) : activeTab === 'invoices' ? (
                <motion.div
                  key="invoices-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                >
                  <InvoicesTab
                    customers={customers}
                    setCustomers={setCustomers}
                    bills={bills}
                    setBills={setBills}
                    payments={payments}
                    setPayments={setPayments}
                    userRole={userRole}
                  />
                </motion.div>
              ) : activeTab === 'production' ? (
                <motion.div
                  key="production-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                >
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
                  />
                </motion.div>
              ) : activeTab === 'report' ? (
                <motion.div
                  key="report-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                >
                  <ReportTab
                    items={items}
                    bills={bills}
                    productionBatches={productionBatches}
                    workers={workers}
                    workerJobs={workerJobs}
                  />
                </motion.div>
              ) : activeTab === 'settings' ? (
                <motion.div
                  key="settings-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                >
                  <SettingsTab
                    settings={settings}
                    setSettings={setSettings}
                    exportDatabasePackage={exportDatabasePackage}
                    onImportBackup={handleImportBackup}
                    items={items}
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
              ) : (
                <motion.div
                  key="notifications-tab-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4 max-w-2xl mx-auto font-sans"
                >
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                    <h2 className="text-base font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 leading-none">
                      <Bell className="w-5 h-5 text-indigo-505" />
                      <span>Nhật ký truy cập và thông báo</span>
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {(!authState?.loginNotifications || authState.loginNotifications.length === 0) ? (
                      <p className="text-center py-12 text-slate-405 italic text-xs">Không có lịch sử đăng nhập hay cấu hình bảo mật mới.</p>
                    ) : (
                      (authState?.loginNotifications || []).map(notif => (
                        <div
                          key={notif.id}
                          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative group text-xs shadow-2xs"
                        >
                          <div className="flex gap-2 text-[10.5px] text-slate-400 font-mono">
                            {notif.device.includes("Hệ thống tự động") ? (
                              <RefreshCw className="w-3.5 h-3.5 mt-0.5 text-emerald-500 animate-spin-slow" />
                            ) : (
                              <Shield className="w-3.5 h-3.5 mt-0.5 text-indigo-400" />
                            )}
                            <span>{notif.time}</span>
                          </div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-2 text-sm leading-none">
                            {notif.device.includes("Hệ thống tự động") ? "🔄 Tự động đồng bộ ngày mới & hệ thống" : "🔐 Đăng nhập thành công"}
                          </p>
                          <p className="text-slate-500 mt-1">
                            Địa chỉ IP: <span className="font-mono text-emerald-650 dark:text-emerald-400 font-bold">{notif.ip}</span> | Vị trí: <span className="font-semibold text-slate-600 dark:text-slate-300">{notif.location}</span>
                          </p>
                          <p className="text-[11px] font-medium text-slate-400 mt-2 font-mono bg-slate-50 dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850">{notif.device}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Draggable system Floating stats capsule. Only mounted on the import tab! */}
            {activeTab === 'import' && <FloatingStats items={items} />}

          </main>

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

            {/* 4. Cài đặt */}
            {allowedTabs.includes('settings') && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-all ${activeTab === 'settings' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-250'}`}
              >
                <Settings className="w-4.5 h-4.5" />
                <span className="text-[9.5px]">Cài đặt</span>
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
      </AnimatePresence>

    </div>
  );
}
