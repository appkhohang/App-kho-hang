/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Sun, Moon, Smartphone, Download, Upload, Trash2, HelpCircle, FileText, CalendarCheck, Shield, Database, Cloud, Info, Lock, Key, Eye, EyeOff, UserPlus, Users, ToggleLeft, ToggleRight, UserX, Check } from 'lucide-react';
import { AppSettings, ImportItem, Customer, UserProfile } from '../types';
import { auth, db } from '../utils/firebase';
import { updatePassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as logoutTemp } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

interface SettingsTabProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  exportDatabasePackage: () => void;
  onImportBackup: (content: string) => void;
  items: ImportItem[];
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
  const [createUserRole, setCreateUserRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [selectedAllowedTabs, setSelectedAllowedTabs] = useState<string[]>(['home', 'import', 'invoices', 'production', 'report', 'settings']);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');

  const currentUser = auth.currentUser;
  const isGoogleUser = currentUser?.providerData.some(p => p.providerId === 'google.com');

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
          const filtered = prev.filter(p => p.email.toLowerCase() !== email);
          return [newProfile, ...filtered];
        });
      }

      if (isExistingAuthUser) {
        setCreateSuccess(`🎉 Địa chỉ email (${email}) đã tồn tại trong hệ thống xác thực. Hồ sơ phân quyền và các trang được phép sử dụng của người dùng đã được thiết lập/cập nhật thành công! Phân quyền: ${createUserRole === 'admin' ? 'Quản trị viên' : createUserRole === 'staff' ? 'Nhân viên nhập liệu' : 'Độc giả chỉ xem'}.`);
      } else {
        setCreateSuccess(`🎉 Tạo tài khoản (${email}) thành công! Phân quyền là: ${createUserRole === 'admin' ? 'Quản trị viên' : createUserRole === 'staff' ? 'Nhân viên nhập liệu' : 'Độc giả chỉ xem'}.`);
      }
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserDisplayName('');
      setSelectedAllowedTabs(['home', 'import', 'invoices', 'production', 'report', 'settings']);
    } catch (err: any) {
      console.error("Error registering user: ", err);
      let errorMsg = err.message || 'Mất kết nối máy chủ Firebase.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Địa chỉ email này đã được đăng ký và sử dụng trên hệ thống.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Địa chỉ email không đúng định dạng.';
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
    if (email.toLowerCase() === 'vukuli.123@gmail.com') {
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
        setUserProfiles(prev => prev.map(p => p.email === email ? { ...p, role: newRole } : p));
      }
      alert(`🎉 Đã đổi phân vai trò tài khoản ${email} thành ${newRole === 'admin' ? 'Quản trị viên' : newRole === 'staff' ? 'Nhân viên sỉ' : 'Ủy viên chỉ xem'} thành công!`);
    } catch (err: any) {
      alert(`⚠️ Không thể đổi phân quyền: ${err.message}`);
    }
  };

  const handleUpdateUserTabs = async (email: string, nextTabs: string[]) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com') {
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
        setUserProfiles(prev => prev.map(p => p.email === email ? { ...p, allowedTabs: nextTabs } : p));
      }
    } catch (err: any) {
      alert(`⚠️ Không thể thay đổi trang được cấp phép: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (email: string, currentStatus: boolean) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com') {
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
        setUserProfiles(prev => prev.map(p => p.email === email ? { ...p, active: !currentStatus } : p));
      }
      alert(`🎉 Cập nhật trạng thái hoạt động của tài khoản ${email} thành công!`);
    } catch (err: any) {
      alert(`⚠️ Không thể thay đổi trạng thái tài khoản: ${err.message}`);
    }
  };

  const handleDeleteUserProfile = async (email: string) => {
    if (email.toLowerCase() === 'vukuli.123@gmail.com') {
      alert("⚠️ Không thể xóa Quản trị viên tối cao!");
      return;
    }
    if (!confirm(`🚨 Bạn có chắc muốn XÓA PHÂN QUYỀN của tài khoản (${email}) không?\n\nNgười dùng này sẽ bị chặn đăng nhập ngay lập tức.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'user_profiles', email));
      if (setUserProfiles) {
        setUserProfiles(prev => prev.filter(p => p.email !== email));
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

          <hr className="border-slate-150 dark:border-slate-800/80 my-1" />

          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
              <span className="w-3.5 h-3.5 rounded-full bg-brand-primary block shadow-sm border border-white/20 animate-pulse" />
              <span>Màu sắc chủ đạo (6 Màu)</span>
            </h3>
            <p className="text-[11px] text-slate-450 mt-1">Đổi toàn bộ giao diện sang tông màu chính thích hợp với thị hiếu.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'green', name: 'Xanh lá', bg: 'bg-[#10b981]' },
              { id: 'blue', name: 'Xanh dương', bg: 'bg-[#3b82f6]' },
              { id: 'purple', name: 'Tím', bg: 'bg-[#a855f7]' },
              { id: 'red', name: 'Đỏ hồng', bg: 'bg-[#f43f5e]' },
              { id: 'orange', name: 'Cam', bg: 'bg-[#f97316]' },
              { id: 'cyan', name: 'Xanh lơ', bg: 'bg-[#06b6d4]' }
            ].map(col => {
              const isActive = (settings.primaryColor || 'blue') === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setSettings(prev => ({ ...prev, primaryColor: col.id as any }))}
                  className={`p-2 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer text-xs ${isActive ? 'border-brand-primary bg-brand-glow text-brand-primary font-bold' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${col.bg} border border-white/20 shadow-xs`} />
                  <span className="text-[10.5px] font-bold">{col.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Database backup restore operations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Quản lý cơ sở dữ liệu</span>
            </h3>
            <p className="text-[11px] text-slate-450 mt-1">Lưu trữ dự phòng hoặc luân chuyển dữ liệu sang thiết bị mới.</p>
          </div>

          <div className="space-y-2.5">
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
          </div>
        </div>
      </div>

      {/* Firebase Cloud Sync Control panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-800 pb-3">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <Cloud className="w-5 h-5 text-indigo-500" />
              <span>Đồng bộ hóa đám mây Google Firestore</span>
              <button
                type="button"
                onClick={() => setShowCloudInfo(!showCloudInfo)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-indigo-600 dark:text-indigo-400 text-[10px] font-sans font-bold cursor-pointer transition active:scale-95 border border-slate-200 dark:border-slate-700"
              >
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Cơ chế bộ nhớ & Chi phí</span>
              </button>
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400">
              Sao lưu dự phòng an tâm và kết xuất các máy khác nhanh chóng, chính xác.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'syncing' ? 'bg-orange-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[10.5px] font-bold text-slate-550 dark:text-slate-400 font-mono uppercase">
              {syncStatus === 'syncing' ? 'Đang đồng bộ...' : syncStatus === 'error' ? 'Ghi nhận lỗi' : 'Hệ thống sẵn sàng'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
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
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[10.5px] text-amber-800 dark:text-amber-400 leading-normal flex items-start gap-2">
              <span className="shrink-0 text-amber-500 font-bold">⚠️</span>
              <span>Tài khoản hiện quy định chế độ <strong>{userRole === 'staff' ? 'Nhân viên nhập thợ' : 'Chỉ xem'}</strong>. Phân quyền này chỉ dùng để cập nhật nghiệp vụ hàng ngày cục bộ, không thể ghi đè sao lưu trực tiếp lên cơ sở dữ liệu tổng của xưởng trên nền đám mây.</span>
            </div>
          )}
        </div>
      </div>
 
      {/* Change Password for Manager Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-150 dark:border-slate-800 pb-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Lock className="w-5 h-5 animate-pulse" />
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

        {isGoogleUser ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                  >
                    {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
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
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-650 dark:text-red-400 font-medium flex items-start gap-2">
                <span className="shrink-0 text-red-500 font-bold">⚠️</span>
                <span>{pwdErrorMsg}</span>
              </div>
            )}

            {pwdSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-650 dark:text-emerald-400 font-semibold flex items-start gap-2">
                <span className="shrink-0 text-emerald-500 font-bold">✓</span>
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
      </div>

      {/* Dynamic Account Creation and Roles Management - ONLY FOR ADMINISTRATORS */}
      {userRole === 'admin' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-150 dark:border-slate-800 pb-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                Quản lý Tài khoản & Phân quyền thành viên
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-400">
                Tạo tài khoản mới (hỗ trợ cả các email ảo như <span className="underline font-bold text-indigo-505">xuongan@an.com</span>) và phân quyền chi tiết.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form to Register New User */}
            <form onSubmit={handleCreateUser} className="lg:col-span-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/45 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5 font-sans mb-1">
                <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Tạo tài khoản mới</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên hiển thị (Họ tên thợ/nhân viên)</label>
                  <input
                    type="text"
                    value={createUserDisplayName}
                    onChange={(e) => setCreateUserDisplayName(e.target.value)}
                    placeholder="Ví dụ: An May Sườn, Bình Cắt Vải"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg py-1.5 px-3 text-xs outline-none transition text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email đăng nhập (Có thể sử dụng email ảo)</label>
                  <input
                    type="email"
                    value={createUserEmail}
                    onChange={(e) => setCreateUserEmail(e.target.value)}
                    placeholder="Ví dụ: xuongan@an.com hoặc staff1@gmail.com"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg py-1.5 px-3 text-xs outline-none transition text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mật khẩu ban đầu (Tối thiểu 6 ký tự)</label>
                  <input
                    type="text"
                    value={createUserPassword}
                    onChange={(e) => setCreateUserPassword(e.target.value)}
                    placeholder="Nhập mật khẩu cho tài khoản này"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg py-1.5 px-3 text-xs outline-none transition text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân quyền chức vụ</label>
                  <select
                    value={createUserRole}
                    onChange={(e) => setCreateUserRole(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg py-1.5 px-2.5 text-xs outline-none transition font-sans text-slate-800 dark:text-slate-200"
                  >
                    <option value="staff">Nhân viên sỉ (Có quyền thêm sửa hàng/nợ)</option>
                    <option value="viewer">Chỉ xem dữ liệu (Không được lưu sửa hoặc thay đổi)</option>
                    <option value="admin">Quản trị viên (Toàn quyền hệ thống/sao lưu đám mây)</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-100/40 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-850 rounded-lg space-y-2">
                  <label className="block text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">Trang được phép truy cập & sử dụng</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'home', label: 'Trang chủ' },
                      { id: 'import', label: '1. Nhập Hàng' },
                      { id: 'invoices', label: '2. Viết Hóa đơn' },
                      { id: 'production', label: '3. QL Sản xuất' },
                      { id: 'report', label: 'Thống kê & Báo cáo' },
                      { id: 'settings', label: 'Cài đặt hệ thống' }
                    ].map(tab => (
                      <label key={tab.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 font-sans select-none">
                        <input
                          type="checkbox"
                          checked={selectedAllowedTabs.includes(tab.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAllowedTabs([...selectedAllowedTabs, tab.id]);
                            } else {
                              setSelectedAllowedTabs(selectedAllowedTabs.filter(t => t !== tab.id));
                            }
                          }}
                          className="rounded border-slate-350 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span>{tab.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {createError && (
                <div className="p-2 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium leading-normal">
                  ⚠️ {createError}
                </div>
              )}

              {createSuccess && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-250 dark:border-emerald-900/40 rounded-lg text-xs text-emerald-650 dark:text-emerald-400 font-semibold leading-normal">
                  {createSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                {isCreatingUser ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-indigo-250" />
                    <span>Kích hoạt Tài khoản này</span>
                  </>
                )}
              </button>
            </form>

            {/* List of Registered Users */}
            <div className="lg:col-span-7 space-y-3.5">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5 font-sans mb-1">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <span>Danh sách tài khoản phụ ({userProfiles.length + 1})</span>
              </h4>

              <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
                {/* 1. Master Administrator Row (vukuli.123@gmail.com - always exists) */}
                <div className="p-3.5 bg-indigo-550/5 dark:bg-indigo-950/15 border border-indigo-150 dark:border-indigo-900/30 rounded-xl relative group shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Quản trị viên tối cao</span>
                        <span className="px-1.5 py-0.5 rounded-sm bg-indigo-600 text-white text-[8px] font-bold uppercase tracking-wider">Chủ xưởng An</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">vukuli.123@gmail.com</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] border border-emerald-100 dark:border-transparent">✓ Nhà sáng lập</span>
                  </div>
                </div>

                {/* 2. Synced Profiles */}
                {userProfiles.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 dark:text-slate-500 italic text-[11px] bg-slate-50/30 dark:bg-[#0f1322]/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-850">
                    Chưa có tài khoản phụ được phân quyền. Sếp có thể tự do điền thông tin cấp quyền phía bên trái.
                  </p>
                ) : (
                  userProfiles.map(profile => (
                    <div
                      key={profile.id}
                      className="p-3.5 bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-850 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition shadow-2xs space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-850 dark:text-slate-200">{profile.displayName}</span>
                            <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-wider ${
                              profile.role === 'admin' 
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400' 
                                : profile.role === 'staff'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-450'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400'
                            }`}>
                              {profile.role === 'admin' ? 'Quản trị' : profile.role === 'staff' ? 'Nhân viên' : 'Chỉ xem'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-1">{profile.email}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Role Selection Dropdown */}
                          <select
                            value={profile.role}
                            onChange={(e) => handleUpdateUserRole(profile.email, e.target.value as any)}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-1.5 text-[10.5px] font-medium outline-none transition font-sans cursor-pointer text-slate-800 dark:text-slate-200"
                          >
                            <option value="staff">Nhân viên</option>
                            <option value="viewer">Chỉ xem</option>
                            <option value="admin">Quản trị viên</option>
                          </select>

                          {/* Block/Unblock toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(profile.email, profile.active ?? true)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                              profile.active !== false
                                ? 'border-emerald-200/60 text-emerald-600 bg-emerald-50/25 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-450 dark:bg-emerald-950/10'
                                : 'border-amber-250/60 text-amber-600 bg-amber-50/25 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-450 dark:bg-amber-950/10'
                            }`}
                            title={profile.active !== false ? "Khóa tài khoản" : "Mở khóa hoạt động"}
                          >
                            {profile.active !== false ? (
                              <ToggleRight className="w-4.5 h-4.5" />
                            ) : (
                              <ToggleLeft className="w-4.5 h-4.5" />
                            )}
                          </button>

                          {/* Delete Account Profile */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUserProfile(profile.email)}
                            className="p-1.5 rounded-lg border border-red-200/55 text-red-600 bg-red-50/25 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:bg-red-955/10 transition cursor-pointer flex items-center justify-center"
                            title="Xóa tài khoản vĩnh viễn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Configurable tab permissions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 space-y-1.5">
                        <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Các trang được phép truy cập và sử dụng:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2.5 gap-y-1.5 p-2 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-850 rounded-lg">
                          {[
                            { id: 'home', label: 'Trang chủ' },
                            { id: 'import', label: '1. Nhập Hàng' },
                            { id: 'invoices', label: '2. Viết Hóa đơn' },
                            { id: 'production', label: '3. QL Sản xuất' },
                            { id: 'report', label: 'Báo cáo & TK' },
                            { id: 'settings', label: 'Cài đặt' }
                          ].map(tab => {
                            const currentAllowed = profile.allowedTabs ?? ['home', 'import', 'invoices', 'production', 'report', 'settings'];
                            const isAllowed = currentAllowed.includes(tab.id);
                            return (
                              <label key={tab.id} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-750 dark:text-slate-350 select-none">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={async (e) => {
                                    let nextTabs: string[];
                                    if (e.target.checked) {
                                      nextTabs = [...currentAllowed, tab.id];
                                    } else {
                                      nextTabs = currentAllowed.filter(t => t !== tab.id);
                                    }
                                    await handleUpdateUserTabs(profile.email, nextTabs);
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                                />
                                <span className={isAllowed ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}>{tab.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-sans italic">
                * Lưu ý: Nút gạt xanh/cam dùng để khóa/mở khóa nhanh trạng thái đăng nhập của nhân sự mà không cần xóa tài khoản.
              </p>
            </div>
          </div>
        </div>
      )}

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
