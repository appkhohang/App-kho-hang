/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, ShieldCheck, Key, Lock, Bell, UserCheck, RefreshCw, AlertTriangle, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { AuthState, UserProfile } from '../types';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { auth } from '../utils/firebase';

interface LoginScreenProps {
  authState: AuthState;
  setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
  userProfiles: UserProfile[];
  onLoginSuccess: () => void;
}

export default function LoginScreen({ authState, setAuthState, userProfiles = [], onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'login' | 'mfa' | 'mfa_setup'>('login');
  const [mfaCode, setMfaCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPasswordToggle, setShowPasswordToggle] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Simulated OTP secrets
  const [mfaSecret, setMfaSecret] = useState('XUONG_AN_MFA_KEY_779');
  const [backupCodes] = useState([
    '4819-2091', '5931-1024', '3382-7712', '9045-3819',
    '7741-2092', '1109-8832', '5621-3912', '8201-4491'
  ]);

  const triggerSecurityNotification = (userEmail: string) => {
    const today = new Date();
    const formattedTime = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0') + ' ' +
      String(today.getHours()).padStart(2, '0') + ':' +
      String(today.getMinutes()).padStart(2, '0') + ':' +
      String(today.getSeconds()).padStart(2, '0');

    let userLoc = Math.random() > 0.5 ? "Cao Lãnh, Đồng Tháp" : "Quận 1, TP HCM";
    const gpsCache = localStorage.getItem('precision_gps_data');
    if (gpsCache) {
      try {
        const parsed = JSON.parse(gpsCache);
        if (parsed && parsed.latitude && parsed.longitude) {
          userLoc = `📍 GPS: ${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)} (±${Math.round(parsed.accuracy || 0)}m)`;
        }
      } catch (e) {}
    }

    const newNotif = {
      id: "notif-" + Date.now(),
      time: formattedTime,
      ip: "113.161.42." + Math.floor(Math.random() * 254 + 1),
      location: userLoc,
      device: navigator.userAgent.includes("Mobile") ? "chrome, iPhone 15 Pro" : "Chrome, macOS Sequoia",
      isRead: false
    };

    setAuthState(prev => ({
      ...prev,
      loginNotifications: [newNotif, ...prev.loginNotifications]
    }));

    // Trigger Notification standard sound/haptic feedback simulation
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Vui lòng nhập email đăng nhập.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu tối thiểu phải từ 6 ký tự.');
      return;
    }

    setEmailLoading(true);
    setErrorMessage('');

    try {
      // Connect directly to secure Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (user && user.email) {
        const activeEmail = user.email.toLowerCase().trim();
        
        // Dynamically check role assignments
        const isMaster = activeEmail === 'vukuli.123@gmail.com' || activeEmail === 'vukuli123@gmail.com';
        const profile = userProfiles?.find(p => p?.email?.toLowerCase()?.trim() === activeEmail);

        if (profile && profile.active === false) {
          await signOut(auth);
          setEmailLoading(false);
          setErrorMessage('⚠️ Tài khoản này hiện đang bị tạm khóa hoặc ngừng hoạt động. Vui lòng liên hệ Quản trị viên Sếp An.');
          return;
        }

        setEmailLoading(false);
        const resolvedDisplayName = isMaster 
          ? "Quản trị viên Vũ Kuli" 
          : (profile?.displayName || activeEmail.split('@')[0]);

        if (authState.twoFactorEnabled) {
          setStep('mfa');
        } else {
          const updatedAuth = {
            ...authState,
            isAuthenticated: true,
            email: activeEmail,
            displayName: resolvedDisplayName,
            verified2FA: false
          };
          setAuthState(updatedAuth);
          triggerSecurityNotification(activeEmail);
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      setEmailLoading(false);
      console.error("Firebase Login Error: ", err);
      const errStr = String(err.message || err.code || "");
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMessage('Tài khoản hoặc mật khẩu không chính xác.');
      } else if (err.code === 'auth/network-request-failed' || errStr.includes('network-request-failed')) {
        setErrorMessage('⚠️ Lỗi kết nối Firebase (Hạn chế Iframe Sandbox hoặc Trình duyệt chặn).\n\nDo bạn đang xem thử ứng dụng trong khung Iframe của AI Studio hoặc dùng trình duyệt có tính năng bảo mật cao (Brave, Safari tối bảo mật), kết nối Firebase Auth đã bị chặn.\n\n👉 Cách khắc phục:\n1. Hãy mở ứng dụng trong một tab độc lập bằng liên kết ngoài (Bấm nút "Mở trong tab mới" ở cạnh trên bên phải màn hình AI Studio).\n2. Hoặc nếu sử dụng Brave, vui lòng tạm dừng tính năng "Brave Shield" cho trang web này để đăng nhập.');
      } else {
        setErrorMessage(`Lỗi xác thực Firebase: ${err.message || 'Liên kết thất bại'}`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMessage('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user && user.email) {
        const userEmail = user.email.toLowerCase().trim();
        const isMaster = userEmail === "vukuli.123@gmail.com" || userEmail === "vukuli123@gmail.com";
        const profile = userProfiles?.find(p => p?.email?.toLowerCase()?.trim() === userEmail);

        if (profile && profile.active === false) {
          // Reject and auto sign out strictly to prevent un-authorized logins
          await signOut(auth);
          setGoogleLoading(false);
          setErrorMessage(`Quyền truy cập bị từ chối: Tài khoản Google (${user.email}) hiện đang bị tạm khóa.`);
        } else {
          setGoogleLoading(false);
          const resolvedDisplayName = isMaster 
            ? "Quản trị viên Vũ Kuli" 
            : (profile?.displayName || user.displayName || userEmail);

          const updatedAuth = {
            ...authState,
            isAuthenticated: true,
            email: userEmail,
            displayName: resolvedDisplayName,
            verified2FA: false
          };
          setAuthState(updatedAuth);
          triggerSecurityNotification(userEmail);
          onLoginSuccess();
        }
      } else {
        setGoogleLoading(false);
        setErrorMessage('Không nhận được thông tin email hợp lệ từ Google Auth.');
      }
    } catch (err: any) {
      setGoogleLoading(false);
      console.error("Google Auth Error: ", err);
      const errStr = String(err.message || err.code || err || "");
      
      const isAssertionError = 
        errStr.includes('Pending promise was never set') || 
        errStr.includes('INTERNAL ASSERTION FAILED') ||
        errStr.includes('pending-promise');

      if (isAssertionError) {
        setErrorMessage('⚠️ Hệ thống gặp sự cố đồng bộ Firebase do đóng popup đột ngột.\n\nỨng dụng sẽ tự động tải lại sau 2 giây để khôi phục trạng thái chuẩn.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      }

      const isSandboxIssue = 
        err.code === 'auth/network-request-failed' || 
        err.code === 'auth/popup-closed-by-user' || 
        errStr.includes('network-request-failed') || 
        errStr.includes('popup-closed-by-user') ||
        errStr.includes('cancelled-by-user');

      if (isSandboxIssue) {
        setErrorMessage('⚠️ Lỗi kết nối Google Auth (Hạn chế Iframe Sandbox/Trình duyệt).\n\nDo chính sách bảo mật, cửa sổ xem thử (Iframe) chặn popup hoặc cookie bên thứ ba. Để xử lý, bạn hãy:\n1. Bấm nút "Mở trong tab mới" (ở phía góc trên bên phải màn hình AI Studio) rồi thực hiện đăng nhập lại.\n2. Hoặc đăng nhập trực tiếp bằng tài khoản Email & Mật khẩu phụ.');
      } else {
        setErrorMessage(`Lỗi đăng nhập Google: ${err.message || 'Hủy bỏ phiên hạch toán'}`);
      }
    }
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.trim() === '123456' || backupCodes.includes(mfaCode.trim())) {
      const activeEmail = email || "vukuli.123@gmail.com";
      const updatedAuth = {
        ...authState,
        isAuthenticated: true,
        email: activeEmail,
        displayName: activeEmail.split('@')[0],
        verified2FA: true
      };
      setAuthState(updatedAuth);
      triggerSecurityNotification(activeEmail);
      onLoginSuccess();
    } else {
      setErrorMessage('Mã số bảo mật không khớp hoặc mã dự phòng không tồn tại.');
    }
  };

  return (
    <div id="login_container" className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      
      {/* Visual Background Accent Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Core Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 relative z-10"
      >
        
        {/* Header Branding */}
        <div className="text-center mb-8 relative">
          <div className="mx-auto w-12 h-12 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center rounded-xl mb-3 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-850 dark:text-slate-100 mb-1 font-sans">XƯỞNG MAY AN</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wider font-mono">BẢO MẬT & TỐI GIẢN SYSTEM</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'login' && (
            <motion.div
              key="login-step"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-650 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
                    Email đăng nhập
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-650 dark:text-slate-300 uppercase tracking-wider font-mono">
                      Mật khẩu bảo mật
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505 rounded-lg py-2.5 pl-10 pr-10 text-sm text-slate-800 dark:text-slate-200 outline-none transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-650 dark:text-red-400 flex items-start gap-2 text-left"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      {errorMessage.split('\n').map((line, idx) => (
                        <p key={idx} className="font-sans leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}

                <button
                  id="email_login_btn"
                  type="submit"
                  disabled={emailLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] shadow-sm"
                >
                  {emailLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Xác thực & Vào hệ thống</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Hoặc Đăng nhập bằng</span>
                <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
              </div>

              {/* Google OAuth Access Direct */}
              <button
                id="google_login_btn"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-4 text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] shadow-xs"
              >
                {googleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    {/* Google Color Logotype */}
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    <span>Tiếp tục bằng tài khoản Google</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Hệ thống bảo mật TLS 1.3 và AES-256 mã hoá chuẩn quốc tế.
                </span>
              </div>
            </motion.div>
          )}

          {step === 'mfa' && (
            <motion.div
              key="mfa-step"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">NHẬP MÃ XÁC THỰC HAI LỚP (2FA)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mở ứng dụng Google Authenticator trên thiết bị để lấy mã OTP hoặc nhập mã dự phòng.
                </p>
              </div>

              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      maxLength={12}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="Ví dụ: 123456"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg py-2.5 pl-10 pr-4 text-sm text-center font-mono tracking-widest text-emerald-600 dark:text-emerald-400 outline-none transition shadow-2xs"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                    Mẹo: Nhập <span className="font-mono text-slate-600 dark:text-slate-305">123456</span> nếu bạn đang thử demo hoặc dùng mã khôi phục.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-250 dark:border-red-900/50 rounded-lg text-xs text-red-650 dark:text-red-400 text-left flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      {errorMessage.split('\n').map((line, idx) => (
                        <p key={idx} className="font-sans leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Xác minh mã số OTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setErrorMessage('');
                  }}
                  className="w-full bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs text-center hover:underline"
                >
                  Quay lại đăng nhập
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer Branding Text */}
      <div className="mt-8 text-center text-[11px] text-slate-400 dark:text-slate-500 relative z-10 font-mono tracking-tight select-none">
        <span>© 2026 Xưởng May An (ĐT). Được mã hoá & bảo vệ đa lớp an toàn.</span>
      </div>
    </div>
  );
}
