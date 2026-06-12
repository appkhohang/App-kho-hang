/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Sun, Moon, Smartphone, Download, Upload, Trash2, HelpCircle, FileText, CalendarCheck, Shield, Database, Cloud, Info, Lock, Key, Eye, EyeOff, UserPlus, Users, ToggleLeft, ToggleRight, UserX, Check, Palette, ChevronDown, ChevronUp, Link, Share2, RefreshCw, Camera, MapPin, HardDrive, Calculator, AlertTriangle } from 'lucide-react';
import { AppSettings, ImportItem, Customer, UserProfile, Bill } from '../types';
import { auth, db } from '../utils/firebase';
import { updatePassword, getAuth, createUserWithEmailAndPassword, signOut as logoutTemp, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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
  const [showCloudInfo, setShowCloudInfo] = React.useState(false);

  // States of collapsible sections (defaulting to false / collapsed for tidiness)
  const [isDbOpen, setIsDbOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);
  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [isSyncRepairOpen, setIsSyncRepairOpen] = useState(false);
  const [forceDefaultDb, setForceDefaultDb] = useState(() => {
    return localStorage.getItem("xuongan_force_default_db") === "true";
  });
  const [inputGroupCode, setInputGroupCode] = useState(() => {
    return localStorage.getItem("xuongan_group_code") || "";
  });

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

  // States for what-if storage calculations
  const [estBills, setEstBills] = useState(100);
  const [estImports, setEstImports] = useState(50);
  const [estPhotos, setEstPhotos] = useState(10);

  // States for simulating Firestore storage limit warning
  const [isQuotaSimEnabled, setIsQuotaSimEnabled] = useState(false);
  const [simulatedQuotaPercent, setSimulatedQuotaPercent] = useState(82);

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

  const handleUpdatePrecisionGps = () => {
    if (!navigator.geolocation) {
      alert("❌ Thiết bị hoặc trình duyệt này không hỗ trợ định vị GPS!");
      return;
    }

    setGpsLoading(true);
    
    // Request fine, high-accuracy GPS coordinates
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const timestamp = new Date(position.timestamp).toLocaleString('vi-VN');
        const data = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp,
          source: 'Định vị GPS thực tế (Độ chính xác cao)'
        };
        setGpsData(data);
        localStorage.setItem('precision_gps_data', JSON.stringify(data));
        setGpsLoading(false);
        alert(`✅ Cập nhật định vị chính xác thành công!\n📍 Tọa độ GPS: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}\n🎯 Sai số thực tế: ±${Math.round(data.accuracy || 0)} mét.\n🕒 Cập nhật lúc: ${timestamp}`);
      },
      (error) => {
        setGpsLoading(false);
        let errorMsg = "Không rõ lỗi khi quét GPS.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Bị từ chối cấp quyền định vị GPS. Vui lòng bật dịch vụ định vị GPS chính xác và đồng ý cấp quyền cho ứng dụng.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Sóng GPS không khả dụng hoặc yếu. Hãy thử di chuyển ra khu vực thông thoáng hơn.";
            break;
          case error.TIMEOUT:
            errorMsg = "Quá thời gian chờ phản hồi từ GPS (Yêu cầu hết giờ). Vui lòng thử lại.";
            break;
        }
        alert(`❌ Không thể cập nhật định vị chính xác:\n⚠️ Lỗi: ${errorMsg}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Custom Theme Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Chế độ giao diện (Theme)</span>
            </h3>
            <p className="text-[11px] text-slate-450 mt-1">Điều chỉnh độ sáng màn hình để bảo vệ mắt trong quá trình thao tác.</p>
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


        </div>

        {/* Right Column: Database backup restore operations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div 
            onClick={() => setIsDbOpen(!isDbOpen)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Shield className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition" />
                <span>Quản lý cơ sở dữ liệu</span>
              </h3>
              <p className="text-[11px] text-slate-450 mt-1">Lưu trữ dự phòng hoặc luân chuyển dữ liệu sang thiết bị mới.</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-amber-450 transition ml-2 shrink-0">
              {isDbOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isDbOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800"
              >
                <button
                  onClick={exportDatabasePackage}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-755 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Xuất Tệp dự phòng (.json)</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4 text-sky-200" />
                  <span>Phục hồi từ File (.json)</span>
                </button>

                <button
                  onClick={handleResetApp}
                  className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 rounded-xl text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer border border-red-100 dark:border-transparent"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa sạch & Khởi tạo lại bộ nhớ</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Camera & GPS Geolocation configuration card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsGpsOpen(!isGpsOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition duration-200">
              <MapPin className="w-5 h-5 animate-bounce-slow" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">
                Cấu hình Thiết bị & Định vị GPS nâng cao (APK)
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                Yêu cầu cấp quyền chụp ảnh camera và cập nhật định vị chính xác từ chip GPS điện thoại.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-emerald-400 transition ml-2 shrink-0">
            {isGpsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isGpsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Camera permission checker */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-indigo-505" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">Quyền máy ảnh (Chụp hình APK)</span>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Cấp quyền chụp ảnh camera điện thoại để scan chứng từ, hóa đơn nhập mộc, biên nhận vải và hàng xuất kho.
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleTestCamera}
                      className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{cameraStatus === 'checking' ? 'Đang kích hoạt...' : cameraStatus === 'active' ? 'Thao tác tốt' : 'Yêu cầu Quyền & Thử camera'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${cameraStatus === 'active' ? 'bg-emerald-500 animate-pulse' : cameraStatus === 'error' ? 'bg-red-500' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-black text-slate-500 uppercase font-mono">
                        {cameraStatus === 'active' ? 'Đã kích hoạt' : cameraStatus === 'error' ? 'Có lỗi/Chưa cấp' : 'Sẵn sàng thử'}
                      </span>
                    </div>
                  </div>

                  {cameraStatus === 'error' && (
                    <p className="text-[10.5px] text-red-500 font-mono bg-red-50 dark:bg-red-950/15 p-2 rounded-lg border border-red-100 dark:border-transparent">
                      Lỗi: {cameraError}
                    </p>
                  )}
                </div>

                {/* 2. Geolocation checker with accurate GPS */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-150 dark:border-slate-850/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-505" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">Cập nhật định vị GPS chính xác</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Sóng GPS trực tiếp từ phần cứng điện thoại giúp định vị chính xác vị trí nhập kho, xuất hóa đơn của xưởng.
                  </p>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono space-y-1.5 text-slate-650 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Vĩ độ GPS:</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">
                        {gpsData.latitude !== null ? gpsData.latitude.toFixed(6) : "Chưa cập nhật"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Kinh độ GPS:</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">
                        {gpsData.longitude !== null ? gpsData.longitude.toFixed(6) : "Chưa cập nhật"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Sai số đo:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {gpsData.accuracy !== null ? `± ${Math.round(gpsData.accuracy)} mét` : "Chưa đo"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-150 dark:border-slate-800 pt-1 mt-1 text-[10px]">
                      <span className="text-slate-400">🕒 Đo gần nhất:</span>
                      <span className="font-semibold text-slate-500">{gpsData.timestamp || "Không khả dụng"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={gpsLoading}
                    onClick={handleUpdatePrecisionGps}
                    className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-black tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    <span>{gpsLoading ? 'Đang định vị chip vệ tinh...' : 'Yêu cầu định vị GPS vệ tinh'}</span>
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Firebase Cloud Sync Control panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsCloudOpen(!isCloudOpen)}
          className="flex items-center justify-between cursor-pointer select-none group pb-1"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <Cloud className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition" />
              <span>Đồng bộ hóa đám mây Google Firestore</span>
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400">
              Sao lưu dự phòng an tâm và kết xuất các máy khác nhanh chóng, chính xác.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex">
              <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-orange-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[10.5px] font-bold text-slate-550 dark:text-slate-400 font-mono uppercase">
                {syncStatus === 'syncing' ? 'Đang đồng bộ...' : syncStatus === 'error' ? 'Ghi nhận lỗi' : 'Hệ thống sẵn sàng'}
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
              {isCloudOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isCloudOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloudInfo(!showCloudInfo)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-indigo-600 dark:text-indigo-400 text-[10px] font-sans font-bold cursor-pointer transition active:scale-95 border border-slate-200 dark:border-slate-700"
                >
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cơ chế bộ nhớ & Chi phí</span>
                </button>
                <div className="flex items-center gap-1.5 sm:hidden">
                  <span className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-orange-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 font-mono uppercase">
                    {syncStatus === 'syncing' ? 'Đang đồng bộ...' : syncStatus === 'error' ? 'Lỗi' : 'Sẵn sàng'}
                  </span>
                </div>
              </div>

              {showCloudInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-slate-50 dark:bg-[#0f1424] rounded-xl p-4 border border-slate-150 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed relative"
                >
                  <button
                    type="button"
                    onClick={() => setShowCloudInfo(false)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 cursor-pointer font-bold font-mono text-xs p-1"
                    title="Đóng"
                  >
                    ✕
                  </button>
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase font-mono text-[9.5px]">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    <span>CƠ CHẾ TỐI ƯU TRUY VẤN:</span>
                  </p>
                  <p>
                    Tất cả hoá đơn nợ cũ nợ mới và danh sách thợ may được lưu trữ <strong className="text-slate-800 dark:text-slate-100">cache-first</strong> tối ưu tại bộ nhớ cục bộ trong máy. 
                    Bạn chỉ tốn lượt đọc/ghi từ đám mây khi chủ động bấm cập nhật tải hoặc lưu dưới đây. Điều này đảm bảo hiệu năng tối đa và tiết kiệm hoàn toàn dung lượng.
                  </p>
                  {lastSyncTime && (
                    <p className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                      🔄 Lần đồng bộ máy này gần nhất: <strong className="font-bold">{lastSyncTime}</strong>
                    </p>
                  )}
                </motion.div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCloudPull}
                  disabled={syncStatus === 'syncing'}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-slate-700 active:scale-98"
                  title="Đồng bộ cập nhật cơ sở dữ liệu từ đám mây"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Tải dữ liệu từ đám mây</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloudPush}
                  disabled={syncStatus === 'syncing' || userRole !== 'admin'}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs active:scale-98"
                  title={userRole !== 'admin' ? "Chỉ Quản trị viên mới được sao lưu" : ""}
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-350" />
                  <span>Lưu dự phòng lên đám mây</span>
                </button>
              </div>
              {userRole !== 'admin' && (
                <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[10.5px] text-amber-800 dark:text-amber-400 leading-normal flex items-start gap-2">
                  <span className="shrink-0 text-amber-500 font-bold">⚠️</span>
                  <span>Tài khoản hiện quy định chế độ <strong>{userRole === 'staff' ? 'Nhân viên nhập thợ' : 'Chỉ xem'}</strong>. Phân quyền này chỉ dùng để cập nhật nghiệp vụ hàng ngày cục bộ, không thể ghi đè sao lưu trực tiếp lên cơ sở dữ liệu tổng của xưởng trên nền đám mây.</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      {/* Cloud Sync Repair & Database Environment Modes Toggle Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div 
          onClick={() => setIsSyncRepairOpen(!isSyncRepairOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-955/20 text-amber-650 dark:text-amber-400 rounded-xl">
              <Database className="w-5 h-5 group-hover:scale-110 transition shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Khắc phục Đám mây & Đồng bộ dữ liệu</span>
                <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">Quản trị</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400">
                Xử lý lỗi quyền truy cập (Permission) hoặc xóa sạch dữ liệu đệm máy cục bộ để kết nối tài khoản khác.
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-450 group-hover:text-slate-700 dark:group-hover:text-amber-400 transition ml-2 shrink-0">
            {isSyncRepairOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isSyncRepairOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-4 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              <div className="p-4 bg-amber-50/20 dark:bg-amber-955/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl space-y-2 text-xs text-slate-650 dark:text-slate-350 leading-relaxed">
                <span className="font-bold text-amber-700 dark:text-amber-400 block uppercase text-[10px] tracking-wider">🛠 Hướng dẫn Khắc phục Lỗi Quyền Đám mây (Permission Error)</span>
                <p>
                  Nếu thiết bị của bạn bị báo lỗi <strong>"Missing or insufficient permissions"</strong>, lỗi đó xuất phát từ việc máy chủ đám mây không tìm thấy tên cơ sở dữ liệu Sandbox của AI Studio trên dự án cá nhân hoặc phiên kết nối bị hết hạn đột ngột.
                </p>
                <p>
                  Hãy sử dụng hai công cụ hạch toán mạnh mẽ dưới đây để tái cấu trúc hoặc đồng bộ tươi sạch.
                </p>
              </div>

              {/* Toggle Database Mode */}
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">Sử dụng Cơ sở dữ liệu mặc định (Default DB)</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Kích hoạt chế độ này nếu bạn đang chạy ứng dụng trong Container Cloud Run của tài khoản cá nhân. Hệ thống sẽ bỏ qua DB Sandbox để dùng DB chính chủ <code>(default)</code> của bạn.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={handleToggleForceDefaultDb} 
                    className="shrink-0 transition active:scale-95 cursor-pointer"
                  >
                    {forceDefaultDb ? (
                      <ToggleRight className="w-10 h-10 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                    )}
                  </button>
                </div>
                <div className="text-[10px] font-mono py-1 px-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-500 border border-slate-150 dark:border-slate-850">
                  Môi trường DB: <span className="font-bold text-indigo-600 dark:text-indigo-400">{forceDefaultDb ? "CHÍNH CHỦ (default)" : "SANDBOX (ai-studio)"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleWipeCacheAndSync}
                  className="p-3 bg-indigo-50 hover:bg-indigo-105 dark:bg-indigo-950/35 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-900/45 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-4.5 h-4.5 text-indigo-550 animate-pulse" />
                  <div className="text-left">
                    <span className="block text-[11px]">Xóa Cache Cục Bộ & Pull Mới</span>
                    <span className="block text-[9px] font-normal text-slate-400 dark:text-slate-500">Giữ phiên, tải sạch từ đám mây</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleLogoutAndWipeAll}
                  className="p-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-450 rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-900/20 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4.5 h-4.5 text-rose-550" />
                  <div className="text-left">
                    <span className="block text-[11px]">Xóa Sạch Máy & Đăng xuất</span>
                    <span className="block text-[9px] font-normal text-slate-400 dark:text-slate-500">Đặt lại ban đầu để thay đổi tài khoản</span>
                  </div>
                </button>
              </div>
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
              className="overflow-hidden space-y-5 pt-3 border-t border-slate-150 dark:border-slate-800"
            >
              {/* Members/Users List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Danh sách thành viên xưởng ({userProfiles.length})</span>
                </h4>

                {userProfiles.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-555 text-xs">
                    Chưa có tài khoản phụ nào được đăng ký.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {userProfiles.map((p) => {
                      const email = p?.email || p?.id || '';
                      if (!email) return null;
                      const isSuperAdmin = email.toLowerCase() === 'vukuli.123@gmail.com' || email.toLowerCase() === 'vukuli123@gmail.com';

                      return (
                        <div 
                          key={email}
                          className="bg-slate-50/40 dark:bg-slate-850/30 p-3.5 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-2.5 relative flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-[12.5px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                  {p.displayName || 'Thành viên'}
                                </h5>
                                <p className="text-[10.5px] text-slate-405 font-mono select-all">
                                  {email}
                                </p>
                              </div>

                              <span className="text-[9.5px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full border bg-emerald-50 text-emerald-650 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/35">
                                Quản trị viên (Toàn quyền)
                              </span>
                            </div>

                            {/* Toàn bộ tính năng hạch toán */}
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                                Thợ may
                              </span>
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                                Công nợ
                              </span>
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-[#1f1712] dark:text-[#fbbf24]/90 border border-indigo-100/50 dark:border-[#fbbf24]/20">
                                Nhập hàng
                              </span>
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                                Báo cáo
                              </span>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái:</span>
                              <button
                                type="button"
                                disabled={isSuperAdmin}
                                onClick={() => handleToggleUserActive(email, p.active)}
                                className={`inline-flex items-center gap-1 py-0.5 px-1.5 rounded-md border text-[10px] font-bold cursor-pointer transition ${
                                  p.active 
                                    ? 'bg-emerald-50 text-emerald-650 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                    : 'bg-amber-50 text-amber-65 border-amber-200 dark:bg-[#1f1712] dark:text-amber-500'
                                }`}
                              >
                                <span>{p.active ? '● Đang Hoạt động' : '○ Đã khóa'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUserProfile(email)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-md cursor-pointer transition"
                                  title="Xóa tài khoản thành viên"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              )}
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
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
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
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-405 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
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

      {/* 📊 BẢNG TÍNH TOÁN THỐNG KÊ & ƯỚC LƯỢNG DUNG LƯỢNG LƯU TRỮ CHÍNH XÁC */}
      <div id="storage-estimator-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>Phân Tích Thống Kê & Dung Lượng Bộ Nhớ</span>
                <span className="text-[9px] bg-indigo-600 dark:bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase font-mono tracking-widest font-black">Chính xác</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
                Chi tiết dung lượng thực tế của hoá đơn, nhập xưởng lẻ và tài liệu hình ảnh trên thiết bị.
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-mono">Tổng dung lượng cục bộ</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {formatSize(storageStats.totalSize)}
            </span>
          </div>
        </div>

        {/* ☁️ GIÁM SÁT HẠN MỨC QUOTA FIRESTORE DUNG LƯỢNG 1GB (SPARK FREE TIER) */}
        {(() => {
          const quotaLimitBytes = 1024 * 1024 * 1024; // 1 GB in bytes
          const currentQuotaPercent = isQuotaSimEnabled 
            ? simulatedQuotaPercent 
            : Math.min(100, (storageStats.totalSize / quotaLimitBytes) * 100);

          const displayPercentStr = currentQuotaPercent.toFixed(currentQuotaPercent < 0.01 && currentQuotaPercent > 0 ? 4 : 2);
          const displaySizeStr = isQuotaSimEnabled
            ? formatSize((simulatedQuotaPercent / 100) * quotaLimitBytes)
            : formatSize(storageStats.totalSize);

          const isNearLimit = currentQuotaPercent >= 80;
          const isCriticalLimit = currentQuotaPercent >= 90;

          // Color calculation
          let progressColorClass = "bg-indigo-600 dark:bg-indigo-500";
          let textColorClass = "text-indigo-650 dark:text-indigo-400";
          let borderGlowClass = "border-slate-200 dark:border-slate-800";

          if (isCriticalLimit) {
            progressColorClass = "bg-rose-600 dark:bg-rose-500 animate-pulse";
            textColorClass = "text-rose-650 dark:text-rose-400";
            borderGlowClass = "border-rose-300 dark:border-rose-900/60 ring-2 ring-rose-500/10";
          } else if (isNearLimit) {
            progressColorClass = "bg-amber-500 dark:bg-amber-450";
            textColorClass = "text-amber-650 dark:text-amber-400";
            borderGlowClass = "border-amber-300 dark:border-amber-900/60 ring-2 ring-amber-500/10";
          } else if (currentQuotaPercent >= 50) {
            progressColorClass = "bg-sky-500 dark:bg-sky-450";
            textColorClass = "text-sky-655 dark:text-sky-400";
          }

          return (
            <div className={`p-5 rounded-2xl border ${borderGlowClass} bg-slate-50/50 dark:bg-[#0c101d] space-y-4 transition-all duration-300`}>
              {/* Header metrics */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cloud className={`w-5 h-5 ${isNearLimit ? 'text-rose-550 dark:text-rose-450 animate-bounce' : 'text-indigo-500'}`} />
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-350 font-mono">
                      Hạn mức Lưu trữ Cloud Firestore (Gói Spark Free Tier)
                    </h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-sans">
                      Giới hạn dung lượng tài liệu & ảnh mẫu trên đám mây của Firestore là <strong className="font-mono">1.00 GB</strong>.
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className={`font-black ${textColorClass}`}>
                    {displaySizeStr}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500"> / 1.00 GB ({displayPercentStr}%)</span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 p-0.5 shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${progressColorClass}`}
                  style={{ width: `${currentQuotaPercent}%` }}
                />
              </div>

              {/* Proactive 80%+ Warn Trigger Block */}
              <AnimatePresence mode="wait">
                {isNearLimit && (
                  <motion.div
                    key="quota-warning-banner"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs flex gap-3 items-start overflow-hidden shadow-xs"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-450 shrink-0 mt-0.5 animate-bounce" />
                    <div className="space-y-1.5 text-left">
                      <h5 className="font-extrabold text-rose-700 dark:text-rose-450 uppercase tracking-wide flex items-center gap-1.5">
                        <span>CẢNH BÁO: DUNG LƯỢNG BỘ NHỚ ĐÃ ĐẠT {displayPercentStr}% HẠN MỨC!</span>
                      </h5>
                      <p className="text-slate-650 dark:text-slate-300 leading-relaxed">
                        Hệ thống phát hiện tài liệu lưu trữ đám mây của dự án Firestore sắp chạm ngưỡng giới hạn miễn phí 1.00 GB. Để tránh gián đoạn đọc/ghi dữ liệu, vui lòng:
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-550 dark:text-slate-400 mt-1.5 font-sans">
                        <li>
                          <strong className="text-slate-750 dark:text-slate-200">Dọn dẹp hình ảnh mẫu cũ:</strong> Vào phần <span className="underline font-bold">Thư Viện Ảnh</span> và chọn lọc xoá bớt các ảnh chứng từ, ảnh mẫu sản phẩm đã hoàn thiện từ nhiều tháng trước để giải phóng bộ nhớ.
                        </li>
                        <li>
                          <strong className="text-slate-750 dark:text-slate-200">Sao lưu & Đặt lại (Reset):</strong> Bấm nút <span className="underline font-bold">Xuất Lưu Trữ Thiết Bị</span> để tải tệp JSON lưu trữ toàn phần về máy tính, sau đó bạn có thể làm sạch kho ảnh để bắt đầu chu kỳ lưu trữ mới.
                        </li>
                        <li>
                          <strong className="text-slate-750 dark:text-slate-200">Nâng cấp Quota từ Firestore:</strong> Nâng cấp Firebase Project của bạn lên gói <span className="font-bold text-rose-650 dark:text-rose-400">Blaze Plan (Pay-as-you-go)</span> trực tiếp trên Firebase Console để nâng mức giới hạn document lên không giới hạn (hoàn toàn miễn phí nếu khối lượng tải thực tế vẫn ở mức thông thường).
                        </li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Visual warning limit explanation if not reached yet */}
              {!isNearLimit && (
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-sans justify-between bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-3xs">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Hệ thống hoạt động an toàn. Cảnh báo tự động báo động khi dung lượng đạt <strong>80% (819.2 MB)</strong>.</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">STATUS: SAFE</span>
                </div>
              )}

              {/* INTERACTIVE CONTROLLER FOR DEMO PURPOSES (What-if Test trigger) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                <div className="space-y-0.5">
                  <div className="text-[10.5px] font-black text-slate-700 dark:text-slate-350 flex items-center gap-1.5 uppercase font-mono">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    <span>Thanh Kiểm Định Cảnh Báo Trực Quan (Simulator)</span>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-sans leading-normal">
                    Kéo chỉnh phần trăm để kiểm duyệt giao diện cảnh báo &gt;= 80% hoạt động thực tế.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={() => setIsQuotaSimEnabled(!isQuotaSimEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wider font-mono shadow-3xs transition cursor-pointer ${
                      isQuotaSimEnabled 
                        ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300'
                    }`}
                  >
                    {isQuotaSimEnabled ? 'Tắt kiểm thử' : 'Thử mô phỏng'}
                  </button>
                  
                  {isQuotaSimEnabled && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={simulatedQuotaPercent}
                        onChange={(e) => setSimulatedQuotaPercent(parseInt(e.target.value) || 0)}
                        className="w-24 accent-indigo-650 dark:accent-indigo-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[11px] font-bold font-mono text-slate-800 dark:text-slate-100 min-w-[32px] text-right">
                        {simulatedQuotaPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {/* 1. REALTIME METRICS GRID - HIGHLY DETAILED */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Invoices (Bills) Storage Box */}
          <div className="p-4 bg-slate-50 dark:bg-[#0f1424] rounded-2xl border border-slate-150 dark:border-slate-800/80 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="space-y-1 z-10">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">Bảng kê hoá đơn</span>
                <h4 className="text-xl font-black text-slate-900 dark:text-white font-mono">{storageStats.billsCount.toLocaleString()} HĐ</h4>
                <div className="text-slate-450 dark:text-slate-400 text-[11px] font-mono">
                  Dung lượng: <strong className="text-slate-705 dark:text-slate-200">{formatSize(storageStats.billsSize)}</strong>
                </div>
              </div>
              <div className="p-2 bg-indigo-100/40 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 flex justify-between items-center bg-white/40 dark:bg-black/10 p-1.5 rounded-lg font-mono">
              <span>Độ lớn bình quân:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatSize(Math.round(storageStats.avgBillSize))} / bill</span>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition" />
          </div>

          {/* Imports Storage Box */}
          <div className="p-4 bg-slate-50 dark:bg-[#0f1424] rounded-2xl border border-slate-150 dark:border-slate-800/80 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="space-y-1 z-10">
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono">Hàng nhập xưởng lẻ</span>
                <h4 className="text-xl font-black text-slate-900 dark:text-white font-mono">{storageStats.importsCount.toLocaleString()} Phự</h4>
                <div className="text-slate-450 dark:text-slate-400 text-[11px] font-mono">
                  Dung lượng: <strong className="text-slate-705 dark:text-slate-200">{formatSize(storageStats.importsSize)}</strong>
                </div>
              </div>
              <div className="p-2 bg-emerald-100/40 dark:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 rounded-xl">
                <HardDrive className="w-5 h-5" />
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 flex justify-between items-center bg-white/40 dark:bg-black/10 p-1.5 rounded-lg font-mono">
              <span>Độ lớn bình quân:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatSize(Math.round(storageStats.avgImportSize))} / mẫu</span>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition" />
          </div>

          {/* Captured Photos Storage Box */}
          <div className="p-4 bg-slate-50 dark:bg-[#0f1424] rounded-2xl border border-slate-150 dark:border-slate-800/80 relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div className="space-y-1 z-10">
                <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest font-mono">Hình mẫu & Chứng từ</span>
                <h4 className="text-xl font-black text-slate-900 dark:text-white font-mono">{storageStats.photosCount.toLocaleString()} Ảnh</h4>
                <div className="text-slate-450 dark:text-slate-400 text-[11px] font-mono">
                  Dung lượng: <strong className="text-slate-705 dark:text-sky-305">{formatSize(storageStats.photosSize)}</strong>
                </div>
              </div>
              <div className="p-2 bg-sky-100/40 dark:bg-sky-950/30 text-sky-655 dark:text-sky-400 rounded-xl">
                <Camera className="w-5 h-5 text-sky-505" />
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 flex justify-between items-center bg-white/40 dark:bg-black/10 p-1.5 rounded-lg font-mono">
              <span>Độ lớn bình quân:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatSize(Math.round(storageStats.avgPhotoSize))} / ảnh</span>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition" />
          </div>

        </div>

        {/* 2. DENSITY REFERENCE ROW - EXPLAINING 1 MEGABYTE STORAGE METRICS */}
        <div className="p-4 rounded-2xl border border-indigo-150 dark:border-indigo-950/50 bg-gradient-to-r from-indigo-50/30 to-sky-50/20 dark:from-indigo-950/10 dark:to-transparent text-xs space-y-3">
          <div className="flex items-center gap-1.5 uppercase tracking-wide text-indigo-700 dark:text-indigo-400 font-extrabold text-[10px] font-mono">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Mật độ lưu trữ chuẩn: Có gì trong 1 Megabyte (1 MB)?</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-normal text-[11px]">
            Bộ nhớ <strong className="text-slate-700 dark:text-slate-300">1 MB (1,024 KB)</strong> chứa một khối lượng thông tin khổng lồ nếu tối ưu hóa tốt. Hãy xem số lượng bản ghi tối đa có thể xếp vừa vặn vào 1 MB:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-650 dark:text-indigo-400 text-[10px] font-black flex items-center justify-center font-mono">1</span>
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">~{Math.floor(1024 * 1024 / storageStats.avgBillSize).toLocaleString()} Bản Hoá đơn</div>
                <div className="text-[9.5px] text-slate-450 font-mono">Dữ liệu chữ & Số</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-650 dark:text-emerald-400 text-[10px] font-black flex items-center justify-center font-mono">2</span>
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">~{Math.floor(1024 * 1024 / storageStats.avgImportSize).toLocaleString()} Bản Nhập hàng</div>
                <div className="text-[9.5px] text-slate-450 font-mono">Sổ sách thợ may</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
              <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-650 dark:text-sky-400 text-[10px] font-black flex items-center justify-center font-mono">3</span>
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">~{Math.floor(1024 * 1024 / storageStats.avgPhotoSize).toLocaleString()} Hình mẫu</div>
                <div className="text-[9.5px] text-slate-450 font-mono">Ảnh nén tối ưu</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. DYNAMIC WHAT-IF ESTIMATOR CALCULATOR */}
        <div className="p-5 bg-slate-50 dark:bg-[#0d111e] rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-505" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest font-mono">Dự phóng tương lai (What-if Storage Calculator)</h4>
          </div>
          
          <p className="text-[11.5px] text-slate-500 dark:text-slate-455 leading-normal">
            Nhập hoặc căn chỉnh số lượng hoá đơn nợ sỉ, số phiếu nhập may thợ và số ảnh chụp mẫu chuẩn dưới đây để tìm ra tổng dung lượng lưu trữ dự tính:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Input 1: Invoices */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">Số Bills mới:</label>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setEstBills(prev => Math.max(0, prev - 50))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  -
                </button>
                <input
                  type="number"
                  value={estBills}
                  onChange={(e) => setEstBills(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center outline-none bg-transparent font-bold font-mono text-xs text-slate-800 dark:text-slate-105"
                />
                <button
                  type="button"
                  onClick={() => setEstBills(prev => prev + 50)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  +
                </button>
              </div>
            </div>

            {/* Input 2: Import items */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">Số hàng nhập mới:</label>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setEstImports(prev => Math.max(0, prev - 20))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  -
                </button>
                <input
                  type="number"
                  value={estImports}
                  onChange={(e) => setEstImports(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center outline-none bg-transparent font-bold font-mono text-xs text-slate-800 dark:text-slate-105"
                />
                <button
                  type="button"
                  onClick={() => setEstImports(prev => prev + 20)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  +
                </button>
              </div>
            </div>

            {/* Input 3: Captured Photos */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">Số Ảnh chụp mới:</label>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setEstPhotos(prev => Math.max(0, prev - 5))}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  -
                </button>
                <input
                  type="number"
                  value={estPhotos}
                  onChange={(e) => setEstPhotos(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center outline-none bg-transparent font-bold font-mono text-xs text-slate-800 dark:text-slate-105"
                />
                <button
                  type="button"
                  onClick={() => setEstPhotos(prev => prev + 5)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition flex items-center justify-center cursor-pointer font-mono"
                >
                  +
                </button>
              </div>
            </div>

          </div>

          {/* CALCULATED PROJECTED TOTAL RESULT HEADER */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8] font-mono">
                Tổng Dung lượng Dự kiến Tải thêm:
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400 font-mono tracking-tight">
                  {formatSize(estBills * storageStats.avgBillSize + estImports * storageStats.avgImportSize + estPhotos * storageStats.avgPhotoSize)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold font-mono uppercase bg-emerald-500/10 py-0.5 px-2 rounded-md">
                  Rất nhẹ
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/15 border border-indigo-150/40 dark:border-indigo-900/40 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
              💡 <strong>Lưu ý:</strong> Cơ sở dữ liệu cục bộ SQLite/Firestore nén thông tin cực tốt. Kể cả hoạt động trong nhiều năm liên tục, dữ liệu hóa đơn của bạn vẫn chạy nhanh tức thì 0ms ở dưới ngưỡng 5 MB!
            </div>
          </div>
        </div>

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
