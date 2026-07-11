/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderPlus, Image as ImageIcon, Plus, Trash2, Folder, ExternalLink, 
  Settings, Eye, Info, ChevronRight, X, AlertCircle, Sparkles, Filter, 
  Upload, Download, Copy, Check, EyeOff, Loader2, DollarSign, Tag, 
  FileText, ArrowRight, RotateCw, Trash, Calendar, Edit2, Share2, ZoomIn, ShieldCheck,
  Maximize2, ChevronLeft, ZoomOut, LayoutGrid, Square, SquareCheck, Users, Cloud, Lock, Unlock, RefreshCw
} from 'lucide-react';
import { ModelSample, B2Config, Customer } from '../types';
import { db, getNamespaceCollection, isUsingCustomFirebase, uploadImageToFirebase, deleteImageFromFirebase } from '../utils/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { B2Service, base64ToBlob } from '../utils/b2Service';
import { compressBase64Image } from '../utils/imageUtils';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { Share } from '@capacitor/share';
import { 
  GDriveAccount, 
  authenticateGDriveAccount, 
  createGDriveFolder, 
  uploadBase64ToGDrive, 
  deleteFileFromGDrive, 
  getCachedAccessToken, 
  cacheAccessToken,
  clearCachedAccessToken,
  getGDriveStorageQuota
} from '../utils/gdriveService';

// --- Lazy-loaded Image with Shimmer/Skeleton Placeholder Component ---
function ModelImage({ 
  src, 
  thumbnailSrc,
  alt, 
  className, 
  layout 
}: { 
  src: string; 
  thumbnailSrc?: string;
  alt: string; 
  className?: string; 
  layout: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
      {!loaded && thumbnailSrc && (
        <img 
          src={thumbnailSrc} 
          alt="thumbnail"
          className={`${className} filter blur-[4px] opacity-70 scale-100 transition-opacity duration-300`}
        />
      )}
      {!loaded && !thumbnailSrc && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-emerald-950/20 animate-pulse flex flex-col items-center justify-center gap-1.5 p-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="text-[8px] font-mono font-bold uppercase text-slate-400 dark:text-[#527065] tracking-wider text-center">
            Đang tải...
          </span>
        </div>
      )}
      <img 
        src={src} 
        alt={alt} 
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        className={`${className} transition-all duration-300 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute'}`}
        loading="lazy"
      />
    </div>
  );
}

interface ModelGalleryTabProps {
  resolvedTheme?: 'light' | 'dark';
  isQuickEditMode?: boolean;
  onChangeQuickEditMode?: (val: boolean) => void;
  customers?: Customer[];
}

export default function ModelGalleryTab({ 
  resolvedTheme = 'light',
  isQuickEditMode,
  onChangeQuickEditMode,
  customers = []
}: ModelGalleryTabProps) {
  const isDark = resolvedTheme === 'dark';

  // --- States ---
  const [samples, setSamples] = useState<ModelSample[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_model_samples');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as ModelSample[];
      const seen = new Set<string>();
      return parsed.filter(s => {
        if (!s || !s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    } catch {
      return [];
    }
  });

  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_model_folders');
      return saved ? JSON.parse(saved) : ['Áo thun', 'Đầm váy', 'Áo khoác', 'Quần', 'Đồ bộ', 'Chưa phân loại'];
    } catch {
      return ['Áo thun', 'Đầm váy', 'Áo khoác', 'Quần', 'Đồ bộ', 'Chưa phân loại'];
    }
  });

  const [b2Config, setB2Config] = useState<B2Config>(() => {
    try {
      const saved = localStorage.getItem('xuongan_b2_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          applicationKeyId: parsed.applicationKeyId || '005251130ea50380000000001',
          applicationKey: parsed.applicationKey || 'K005iZwTYwOzUWgGhTE4ZJtaJdPYjI0',
          bucketId: parsed.bucketId || '02a5a151e3e00e7a95f00318',
          bucketName: parsed.bucketName || 'anh-mau-xuong-an',
          configured: parsed.configured !== undefined ? parsed.configured : true
        };
      }
    } catch {}
    return {
      applicationKeyId: '005251130ea50380000000001',
      applicationKey: 'K005iZwTYwOzUWgGhTE4ZJtaJdPYjI0',
      bucketId: '02a5a151e3e00e7a95f00318',
      bucketName: 'anh-mau-xuong-an',
      configured: true
    };
  });

  // UI state
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [b2Status, setB2Status] = useState<'not_configured' | 'connected' | 'error'>('not_configured');
  const [b2ErrorMsg, setB2ErrorMsg] = useState('');

  // --- Google Drive States ---
  const [gdriveAccounts, setGDriveAccounts] = useState<GDriveAccount[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_gdrive_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showGDriveModal, setShowGDriveModal] = useState(false);
  const [linkingGDrive, setLinkingGDrive] = useState(false);
  const [authEmailNeeded, setAuthEmailNeeded] = useState<string | null>(null);
  const [refreshingQuotaId, setRefreshingQuotaId] = useState<string | null>(null);

  // B2 Storage metrics & warnings
  const [b2StorageUsed, setB2StorageUsed] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_b2_storage_used') || '0');
  });
  const [b2FileCount, setB2FileCount] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_b2_file_count') || '0');
  });
  const [loadingStorageInfo, setLoadingStorageInfo] = useState<boolean>(false);

  // --- Folder hierarchy navigation states ---
  const [currentLevel, setCurrentLevel] = useState<'customers' | 'models' | 'photos'>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Custom customer folders created directly in gallery
  const [customCustomerFolders, setCustomCustomerFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_custom_customer_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Bulk selection and deletion states
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Add/Edit Model Sample Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSample, setEditingSample] = useState<ModelSample | null>(null);
  const [formData, setFormData] = useState({
    modelName: '',
    folder: 'Chưa phân loại',
    price: '',
    material: '',
    description: '',
    photo: '',
    customerName: 'Khách hàng chung'
  });
  const [customFolderName, setCustomFolderName] = useState('');
  const [customCustomerInput, setCustomCustomerInput] = useState('');

  // Multiple images state
  const [batchFiles, setBatchFiles] = useState<{ name: string; base64: string }[]>([]);

  // Folder Delete Mode state
  const [isDeleteFolderMode, setIsDeleteFolderMode] = useState(false);

  // Quick Edit Mode state
  const [localQuickEditMode, setLocalQuickEditMode] = useState(false);
  const quickEditEnabled = isQuickEditMode !== undefined ? isQuickEditMode : localQuickEditMode;
  const setQuickEditEnabled = onChangeQuickEditMode !== undefined ? onChangeQuickEditMode : setLocalQuickEditMode;

  // Grid Columns layout state (2, 4, 6, 8 columns)
  const [gridCols, setGridCols] = useState<2 | 4 | 6 | 8>(() => {
    const saved = localStorage.getItem('xuongan_model_grid_cols');
    return saved ? (Number(saved) as 2 | 4 | 6 | 8) : 4;
  });

  useEffect(() => {
    localStorage.setItem('xuongan_model_grid_cols', String(gridCols));
  }, [gridCols]);

  // Gallery layout aspect ratio state: square (1:1), portrait (3:4), natural (masonry)
  const [galleryLayout, setGalleryLayout] = useState<'square' | 'portrait' | 'natural'>(() => {
    const saved = localStorage.getItem('xuongan_model_gallery_layout');
    return (saved as 'square' | 'portrait' | 'natural') || 'square';
  });

  useEffect(() => {
    localStorage.setItem('xuongan_model_gallery_layout', galleryLayout);
  }, [galleryLayout]);

  // Upload/Progress State
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'compressing' | 'authorizing' | 'uploading' | 'saving' | 'success' | 'error'>('idle');
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  
  // Lightbox view state
  const [selectedSample, setSelectedSample] = useState<ModelSample | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  // Share modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingIds, setSharingIds] = useState<string[]>([]);
  const [sharingStatus, setSharingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [shareProgressMsg, setShareProgressMsg] = useState('');
  const [copiedLinks, setCopiedLinks] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Android hardware back button support
  useAndroidBack(selectedSample !== null, () => setSelectedSample(null));
  useAndroidBack(showAddModal, () => setShowAddModal(false));
  useAndroidBack(showConfig, () => setShowConfig(false));
  useAndroidBack(showShareModal, () => setShowShareModal(false));
  useAndroidBack(showCustomerDialog, () => setShowCustomerDialog(false));
  useAndroidBack(showFolderDialog, () => setShowFolderDialog(false));

  const handleOpenShareModal = (ids: string[]) => {
    setSharingIds(ids);
    setSharingStatus('idle');
    setShareProgressMsg('');
    setCopiedLinks(false);
    setShowShareModal(true);
  };

  const handleCopyShareLinks = () => {
    const selectedSamples = samples.filter(s => sharingIds.includes(s.id));
    const links = selectedSamples
      .map(s => {
        if (s.b2Url) {
          return `${s.modelName}: ${s.b2Url}`;
        } else {
          return `${s.modelName}: (Ảnh offline, chưa tải lên đám mây)`;
        }
      })
      .join('\n');

    navigator.clipboard.writeText(links)
      .then(() => {
        setCopiedLinks(true);
        setTimeout(() => setCopiedLinks(false), 2000);
      })
      .catch(err => {
        alert('Không thể sao chép liên kết: ' + (err instanceof Error ? err.message : String(err)));
      });
  };

  const handleDownloadShareImages = async () => {
    setSharingStatus('processing');
    setShareProgressMsg('Đang chuẩn bị tải ảnh...');
    
    const selectedSamples = samples.filter(s => sharingIds.includes(s.id));
    let count = 0;
    
    for (const sample of selectedSamples) {
      count++;
      setShareProgressMsg(`Đang tải ảnh ${count}/${selectedSamples.length}: ${sample.modelName}...`);
      
      const url = sample.b2Url || sample.localBase64;
      if (!url) continue;
      
      try {
        let downloadUrl = url;
        
        if (url.startsWith('http')) {
          const res = await fetch(url);
          const blob = await res.blob();
          downloadUrl = URL.createObjectURL(blob);
        }
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${sample.modelName}_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (url.startsWith('http')) {
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.warn('Lỗi khi tải ảnh:', sample.modelName, err);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `${sample.modelName}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
    
    setSharingStatus('success');
    setShareProgressMsg(`Đã tải thành công ${selectedSamples.length} ảnh! Bạn hãy mở Zalo, Messenger,... và chọn đính kèm các ảnh vừa tải về.`);
    setTimeout(() => setSharingStatus('idle'), 4000);
  };

  const handleSystemShare = async () => {
    setSharingStatus('processing');
    setShareProgressMsg('Đang khởi động công cụ chia sẻ hệ thống...');
    
    const selectedSamples = samples.filter(s => sharingIds.includes(s.id));
    if (selectedSamples.length === 0) return;
    
    if (selectedSamples.length === 1) {
      const sample = selectedSamples[0];
      const shareText = `Mẫu thiết kế: ${sample.modelName}\n${sample.price ? `Giá: ${sample.price.toLocaleString()}đ\n` : ''}${sample.material ? `Chất liệu: ${sample.material}\n` : ''}${sample.description ? `Ghi chú: ${sample.description}\n` : ''}`;
      
      try {
        const canShareNative = await Share.canShare();
        if (canShareNative.value) {
          await Share.share({
            title: `Chia sẻ mẫu ${sample.modelName}`,
            text: shareText,
            url: sample.b2Url || undefined,
            dialogTitle: 'Chia sẻ mẫu thiết kế',
          });
          setSharingStatus('success');
          setShareProgressMsg('Chia sẻ thành công!');
          setTimeout(() => setSharingStatus('idle'), 2000);
          return;
        }
      } catch (err) {
        console.warn('Native single share not available:', err);
      }
      
      if (navigator.share) {
        try {
          const shareData: ShareData = {
            title: `Mẫu thiết kế ${sample.modelName}`,
            text: shareText,
          };
          
          if (sample.b2Url) {
            shareData.url = sample.b2Url;
          }
          
          try {
            const url = sample.b2Url || sample.localBase64;
            if (url) {
              const blob = url.startsWith('data:') 
                ? base64ToBlob(url) 
                : await fetch(url).then(r => r.blob());
              const file = new File([blob], `${sample.modelName}.jpg`, { type: blob.type || 'image/jpeg' });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                shareData.files = [file];
              }
            }
          } catch (fErr) {
            console.warn('Could not attach file to browser share:', fErr);
          }
          
          await navigator.share(shareData);
          setSharingStatus('success');
          setShareProgressMsg('Chia sẻ thành công!');
          setTimeout(() => setSharingStatus('idle'), 2000);
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Browser share error:', err);
          } else {
            setSharingStatus('idle');
            return;
          }
        }
      }
    } else {
      const shareText = `Chia sẻ ${selectedSamples.length} mẫu thiết kế từ Kho Hình Mẫu:\n` + 
        selectedSamples.map((s, idx) => `${idx + 1}. Mẫu ${s.modelName}${s.price ? ` (${s.price.toLocaleString()}đ)` : ''}`).join('\n');
      
      try {
        const canShareNative = await Share.canShare();
        if (canShareNative.value) {
          const linksList = selectedSamples.map(s => s.b2Url).filter(Boolean).join('\n');
          await Share.share({
            title: `Chia sẻ ${selectedSamples.length} mẫu thiết kế`,
            text: `${shareText}\n\nLiên kết ảnh:\n${linksList}`,
            dialogTitle: 'Chia sẻ các mẫu thiết kế',
          });
          setSharingStatus('success');
          setShareProgressMsg('Chia sẻ thành công!');
          setTimeout(() => setSharingStatus('idle'), 2000);
          return;
        }
      } catch (err) {
        console.warn('Native bulk share not available:', err);
      }
      
      if (navigator.share) {
        try {
          const linksList = selectedSamples.map(s => s.b2Url).filter(Boolean).join('\n');
          const filesToShare: File[] = [];
          
          try {
            for (const s of selectedSamples) {
              const url = s.b2Url || s.localBase64;
              if (url) {
                const blob = url.startsWith('data:') 
                  ? base64ToBlob(url) 
                  : await fetch(url).then(r => r.blob());
                const file = new File([blob], `${s.modelName}.jpg`, { type: blob.type || 'image/jpeg' });
                filesToShare.push(file);
              }
            }
          } catch (fErr) {
            console.warn('Could not compile files list for browser share:', fErr);
          }
          
          const shareData: ShareData = {
            title: `Chia sẻ ${selectedSamples.length} mẫu thiết kế`,
            text: `${shareText}\n\n${linksList}`,
          };
          
          if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
            shareData.files = filesToShare;
          }
          
          await navigator.share(shareData);
          setSharingStatus('success');
          setShareProgressMsg('Chia sẻ thành công!');
          setTimeout(() => setSharingStatus('idle'), 2000);
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Browser share error:', err);
          } else {
            setSharingStatus('idle');
            return;
          }
        }
      }
    }
    
    // Fallback: Copy to clipboard
    const selectedSamplesList = samples.filter(s => sharingIds.includes(s.id));
    const linksList = selectedSamplesList.map(s => `${s.modelName}: ${s.b2Url || '(Ảnh offline)'}`).join('\n');
    
    try {
      await navigator.clipboard.writeText(linksList);
      setSharingStatus('success');
      setShareProgressMsg('Trình duyệt không hỗ trợ chia sẻ trực tiếp. Đã tự động sao chép danh sách liên kết ảnh mẫu vào bộ nhớ tạm. Hãy dán (Ctrl+V) vào ô chat Zalo/Messenger để gửi!');
      setTimeout(() => setSharingStatus('idle'), 5000);
    } catch (clipErr) {
      setSharingStatus('error');
      setShareProgressMsg('Không hỗ trợ chia sẻ trực tiếp hoặc sao chép.');
    }
  };

  // --- Real-time Firestore Sync for Metadata ---
  useEffect(() => {
    const collName = getNamespaceCollection('model_samples');
    const unsubscribe = onSnapshot(collection(db, collName), (snapshot) => {
      const list: ModelSample[] = [];
      const seen = new Set<string>();
      snapshot.forEach((doc) => {
        const id = doc.id;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({ id, ...doc.data() } as ModelSample);
        }
      });
      // Sort by creation time descending
      list.sort((a, b) => b.createdAt - a.createdAt);
      setSamples(list);
      localStorage.setItem('xuongan_model_samples', JSON.stringify(list));
    }, (error) => {
      console.warn('Firestore sub error for model_samples, using offline state:', error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for Google Drive Accounts
  useEffect(() => {
    const collName = getNamespaceCollection('gdrive_accounts');
    const unsubscribe = onSnapshot(collection(db, collName), (snapshot) => {
      const list: GDriveAccount[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as GDriveAccount);
      });
      // Sort by creation time descending
      list.sort((a, b) => b.createdAt - a.createdAt);
      setGDriveAccounts(list);
      localStorage.setItem('xuongan_gdrive_accounts', JSON.stringify(list));
    }, (error) => {
      console.warn('Firestore sub error for gdrive_accounts:', error);
    });

    return () => unsubscribe();
  }, []);

  // Sync folders to local storage
  useEffect(() => {
    localStorage.setItem('xuongan_model_folders', JSON.stringify(folders));
  }, [folders]);

  // --- Google Drive Storage Actions ---
  const handleLinkNewGDriveAccount = async () => {
    setLinkingGDrive(true);
    try {
      const authResult = await authenticateGDriveAccount();
      const folderName = `XuongAn_Kho_Mau_Det`;
      const folderId = await createGDriveFolder(authResult.token, folderName);
      
      let initialQuota = null;
      try {
        initialQuota = await getGDriveStorageQuota(authResult.token);
      } catch (quotaErr) {
        console.warn('Could not fetch initial storage quota:', quotaErr);
      }

      const newAccount: GDriveAccount = {
        id: 'gdrive_' + Date.now(),
        email: authResult.email,
        folderId: folderId,
        folderName: folderName,
        isActive: true, // Make newly linked account active automatically
        isLocked: false,
        createdAt: Date.now(),
        warningThresholdGb: 14, // default warning threshold is 14 GB
        stopUploadOnWarning: false,
        ...(initialQuota ? {
          storageLimit: initialQuota.limit,
          storageUsage: initialQuota.usage,
          lastQuotaUpdate: Date.now()
        } : {})
      };

      // Set other accounts to active = false using a batch
      const batch = writeBatch(db);
      gdriveAccounts.forEach(acc => {
        const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), acc.id);
        batch.update(docRef, { isActive: false });
      });

      // Add the new account document
      const newDocRef = doc(db, getNamespaceCollection('gdrive_accounts'), newAccount.id);
      batch.set(newDocRef, newAccount);
      await batch.commit();

      alert(`✨ Đã liên kết tài khoản Google Drive (${authResult.email}) và tạo thư mục "${folderName}" thành công!`);
    } catch (err: any) {
      console.error('Failed to link Google Drive account:', err);
      alert(`❌ Không thể liên kết Google Drive: ${err.message}`);
    } finally {
      setLinkingGDrive(false);
    }
  };

  const handleSetActiveGDriveAccount = async (selectedId: string) => {
    try {
      const selectedAcc = gdriveAccounts.find(acc => acc.id === selectedId);
      if (!selectedAcc) return;
      if (selectedAcc.isLocked) {
        alert('⚠️ Tài khoản này đang bị khóa, không thể đặt làm thư mục tải lên hoạt động.');
        return;
      }

      const batch = writeBatch(db);
      gdriveAccounts.forEach(acc => {
        const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), acc.id);
        batch.update(docRef, { isActive: acc.id === selectedId });
      });
      await batch.commit();
      
      alert(`🔄 Đã chuyển tài khoản tải lên hoạt động sang: ${selectedAcc.email}`);
    } catch (err: any) {
      console.error('Failed to set active account:', err);
      alert(`Lỗi khi đổi tài khoản hoạt động: ${err.message}`);
    }
  };

  const handleToggleLockGDriveAccount = async (accId: string, currentLocked: boolean) => {
    try {
      const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), accId);
      const updates: any = { isLocked: !currentLocked };
      
      // If we are locking the active account, make sure we deactivate it
      if (!currentLocked) {
        updates.isActive = false;
      }
      
      await setDoc(docRef, updates, { merge: true });
      alert(currentLocked ? '🔓 Đã mở khóa tài khoản!' : '🔒 Đã khóa tài khoản (Chỉ đọc)!');
    } catch (err: any) {
      console.error('Failed to toggle lock:', err);
      alert(`Lỗi khi thay đổi trạng thái khóa: ${err.message}`);
    }
  };

  const handleUnlinkGDriveAccount = async (accId: string, email: string) => {
    if (!confirm(`Bạn có chắc muốn hủy liên kết tài khoản Google Drive (${email})? Ảnh đã tải lên tài khoản này vẫn xem được bình thường nhưng thông tin tài khoản này sẽ biến mất khỏi danh sách quản lý.`)) {
      return;
    }
    try {
      const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), accId);
      await deleteDoc(docRef);
      clearCachedAccessToken(email);
      alert('Đã xóa liên kết tài khoản Google Drive thành công.');
    } catch (err: any) {
      console.error('Failed to unlink account:', err);
      alert(`Lỗi khi xóa liên kết: ${err.message}`);
    }
  };

  const handleRefreshGDriveQuota = async (acc: GDriveAccount) => {
    setRefreshingQuotaId(acc.id);
    try {
      let token = getCachedAccessToken(acc.email);
      if (!token) {
        const authResult = await authenticateGDriveAccount(acc.email);
        token = authResult.token;
      }
      
      const quota = await getGDriveStorageQuota(token);
      const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), acc.id);
      await setDoc(docRef, {
        storageLimit: quota.limit,
        storageUsage: quota.usage,
        lastQuotaUpdate: Date.now()
      }, { merge: true });
      
      alert(`✨ Đã cập nhật dung lượng Drive (${acc.email}) thành công!`);
    } catch (err: any) {
      console.error('Failed to refresh GDrive quota:', err);
      alert(`❌ Không thể cập nhật dung lượng: ${err.message}`);
    } finally {
      setRefreshingQuotaId(null);
    }
  };

  const handleUpdateGDriveWarningSettings = async (
    accId: string, 
    warningThresholdGb: number, 
    stopUploadOnWarning: boolean
  ) => {
    try {
      const docRef = doc(db, getNamespaceCollection('gdrive_accounts'), accId);
      await setDoc(docRef, {
        warningThresholdGb,
        stopUploadOnWarning
      }, { merge: true });
    } catch (err: any) {
      console.error('Failed to update GDrive warning settings:', err);
    }
  };

  // --- B2 Helper Methods ---
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const fetchB2StorageInfo = async (config: B2Config) => {
    if (!config.configured) return;
    setLoadingStorageInfo(true);
    try {
      const info = await B2Service.getBucketSize(config);
      setB2StorageUsed(info.totalSize);
      setB2FileCount(info.fileCount);
      localStorage.setItem('xuongan_b2_storage_used', String(info.totalSize));
      localStorage.setItem('xuongan_b2_file_count', String(info.fileCount));
    } catch (err) {
      console.warn('Error fetching B2 storage info:', err);
    } finally {
      setLoadingStorageInfo(false);
    }
  };

  const testB2Connection = async (config: B2Config, silent = false): Promise<boolean> => {
    if (!silent) {
      setTestingConnection(true);
      setB2ErrorMsg('');
    }
    try {
      await B2Service.authorize(config);
      setB2Status('connected');
      if (!silent) {
        alert('✨ Kết nối Backblaze B2 thành công! Ứng dụng đã sẵn sàng lưu trữ ảnh mẫu.');
        fetchB2StorageInfo(config);
      }
      return true;
    } catch (err: any) {
      console.error(err);
      setB2Status('error');
      
      let rawMsg = err.message || 'Lỗi không xác định.';
      let displayMsg = rawMsg;
      
      // Provide user-friendly troubleshooting guide for "Failed to fetch" errors
      if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('networkerror')) {
        displayMsg = `${rawMsg}\n\n💡 GỢI Ý KHẮC PHỤC:\n1. Tắt Brave Shields (nếu dùng trình duyệt Brave) hoặc các tiện ích chặn quảng cáo (Adblocker).\n2. Nếu bạn đang cấu hình thủ công "Máy chủ API" trong phần Cài đặt, hãy đảm bảo máy chủ đó đang hoạt động và địa chỉ chính xác.\n3. Nếu chạy bản web thông thường, hãy đặt "Máy chủ API" về "Tự động" trong Cài đặt để ứng dụng tự động gọi về đúng địa chỉ web hiện tại.`;
      }
      
      setB2ErrorMsg(displayMsg);
      if (!silent) {
        alert(`❌ Kết nối thất bại: ${displayMsg}`);
      }
      return false;
    } finally {
      if (!silent) {
        setTestingConnection(false);
      }
    }
  };

  const handleSaveConfig = () => {
    if (!b2Config.applicationKeyId || !b2Config.applicationKey || !b2Config.bucketId || !b2Config.bucketName) {
      alert('Vui lòng điền đầy đủ các trường thông tin cấu hình B2.');
      return;
    }

    const updatedConfig = { ...b2Config, configured: true };
    setB2Config(updatedConfig);
    localStorage.setItem('xuongan_b2_config', JSON.stringify(updatedConfig));
    testB2Connection(updatedConfig);
    setShowConfig(false);
  };

  const handleClearConfig = () => {
    if (confirm('Bạn có chắc chắn muốn xóa cấu hình Backblaze B2 hiện tại?')) {
      const emptyConfig = {
        applicationKeyId: '',
        applicationKey: '',
        bucketId: '',
        bucketName: '',
        configured: false
      };
      setB2Config(emptyConfig);
      localStorage.removeItem('xuongan_b2_config');
      localStorage.removeItem('xuongan_b2_storage_used');
      localStorage.removeItem('xuongan_b2_file_count');
      setB2Status('not_configured');
      setB2ErrorMsg('');
      setB2StorageUsed(0);
      setB2FileCount(0);
    }
  };

  // --- Image Processing & Drag-Drop ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (editingSample) {
        processFile(files[0]);
      } else {
        processMultipleFiles(Array.from(files));
      }
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file hình ảnh!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormData(prev => ({ ...prev, photo: event.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const processMultipleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Chỉ hỗ trợ các file hình ảnh!');
      return;
    }

    const loadedFiles: { name: string; base64: string }[] = [];
    let processedCount = 0;

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          // Remove extension from name
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          loadedFiles.push({
            name: baseName,
            base64: event.target.result as string
          });
        }
        processedCount++;
        if (processedCount === imageFiles.length) {
          setBatchFiles(prev => [...prev, ...loadedFiles]);
          if (loadedFiles.length > 0) {
            setFormData(prev => ({ 
              ...prev, 
              photo: prev.photo || loadedFiles[0].base64,
              modelName: prev.modelName || loadedFiles[0].name 
            }));
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (editingSample) {
        processFile(files[0]);
      } else {
        processMultipleFiles(Array.from(files));
      }
    }
  };

  // --- Add / Edit Sample Operation ---
  const handleOpenAddModal = () => {
    setEditingSample(null);
    setBatchFiles([]);
    setFormData({
      modelName: selectedModel || '',
      folder: selectedFolder !== 'all' ? selectedFolder : folders[0] || 'Chưa phân loại',
      price: '',
      material: '',
      description: '',
      photo: '',
      customerName: selectedCustomer || 'Khách hàng chung'
    });
    setCustomFolderName('');
    setUploadProgress('idle');
    setUploadStatusMsg('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (sample: ModelSample, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSample(sample);
    setBatchFiles([]);
    setFormData({
      modelName: sample.modelName,
      folder: sample.folder,
      price: sample.price ? String(sample.price) : '',
      material: sample.material || '',
      description: sample.description || '',
      photo: sample.b2Url || sample.localBase64 || '',
      customerName: sample.customerName || 'Khách hàng chung'
    });
    setCustomFolderName('');
    setUploadProgress('idle');
    setUploadStatusMsg('');
    setSelectedSample(null); // Close Lightbox first if open
    setShowAddModal(true);
  };

  const handleSaveSample = async () => {
    try {
      let finalFolder = formData.folder;
      if (formData.folder === '__new__') {
        const trimmedCustom = customFolderName.trim();
        if (!trimmedCustom) {
          alert('Vui lòng nhập tên thư mục mới.');
          return;
        }
        finalFolder = trimmedCustom;
        // If it's a new folder, add to the folders state
        if (!folders.includes(finalFolder)) {
          setFolders(prev => {
            const next = [...prev.filter(f => f !== 'Chưa phân loại'), finalFolder, 'Chưa phân loại'];
            localStorage.setItem('xuongan_model_folders', JSON.stringify(next));
            return next;
          });
        }
      }

      let finalCustomer = formData.customerName || 'Khách hàng chung';
      if (formData.customerName === '__new_customer__') {
        const trimmedCustomCustomer = customCustomerInput.trim();
        if (!trimmedCustomCustomer) {
          alert('Vui lòng nhập tên khách hàng mới.');
          return;
        }
        finalCustomer = trimmedCustomCustomer;
        
        // Add to customCustomerFolders state if not exists
        if (!customCustomerFolders.map(f => f.toLowerCase()).includes(finalCustomer.toLowerCase())) {
          setCustomCustomerFolders(prev => {
            const next = [...prev, finalCustomer];
            localStorage.setItem('xuongan_custom_customer_folders', JSON.stringify(next));
            return next;
          });
        }
      }

      const itemsToSave = (editingSample === null && batchFiles.length > 0) 
        ? batchFiles 
        : [{ name: formData.modelName.trim(), base64: formData.photo }];

      if (itemsToSave.length === 0 || !itemsToSave[0].base64) {
        alert('Vui lòng chụp ảnh hoặc tải lên ít nhất 1 ảnh mẫu.');
        return;
      }

      // Check name for each if single mode, or prefix check
      if (editingSample !== null || batchFiles.length === 0) {
        if (!formData.modelName.trim()) {
          alert('Vui lòng nhập Mã/Tên mẫu.');
          return;
        }
      }

      // --- Check & Authenticate Google Drive ---
      const activeAccount = gdriveAccounts.find(acc => acc.isActive);
      if (!activeAccount) {
        alert('⚠️ Bạn chưa cấu hình tài khoản lưu trữ Google Drive hoặc chưa đặt tài khoản nào hoạt động. Vui lòng bấm vào nút "DRIVE" ở góc trên bên phải để thiết lập.');
        return;
      }

      if (activeAccount.isLocked) {
        alert('⚠️ Tài khoản Google Drive hiện tại đang bị khóa (Chỉ đọc). Vui lòng cấu hình tài khoản mới hoạt động để tải ảnh lên.');
        return;
      }

      // Check storage warning & stop upload threshold
      const warningThresholdBytes = (activeAccount.warningThresholdGb ?? 14) * 1024 * 1024 * 1024;
      const currentUsageBytes = activeAccount.storageUsage ?? 0;

      if (activeAccount.stopUploadOnWarning && currentUsageBytes >= warningThresholdBytes) {
        const usageGb = (currentUsageBytes / (1024 * 1024 * 1024)).toFixed(2);
        const thresholdGb = (activeAccount.warningThresholdGb ?? 14).toFixed(1);
        alert(`❌ Ngưng tải lên: Dung lượng Drive hiện tại (${usageGb} GB) đã vượt quá mức cảnh báo ngưng cập nhật (${thresholdGb} GB) đã đặt cho tài khoản ${activeAccount.email}. Vui lòng giải phóng dung lượng Drive, tắt tùy chọn ngưng tải lên hoặc nâng giới hạn cảnh báo trong phần quản lý Drive.`);
        return;
      }

      let token = getCachedAccessToken(activeAccount.email);
      if (!token) {
        try {
          setUploadProgress('uploading');
          setUploadStatusMsg(`Vui lòng xác thực Google Drive cho tài khoản ${activeAccount.email} trong cửa sổ pop-up vừa hiện...`);
          const authResult = await authenticateGDriveAccount(activeAccount.email);
          token = authResult.token;
        } catch (authErr: any) {
          console.error('Google Drive Auth failed:', authErr);
          alert(`❌ Xác thực Google Drive thất bại: ${authErr.message}. Vui lòng thử lại.`);
          setUploadProgress('idle');
          return;
        }
      }

      setUploadProgress('compressing');
      const savedSamplesList: ModelSample[] = [];

      for (let i = 0; i < itemsToSave.length; i++) {
        const item = itemsToSave[i];
        const stepNum = i + 1;
        const totalSteps = itemsToSave.length;
        
        // Define name for this sample
        let finalModelName = item.name.trim();
        if (editingSample !== null) {
          finalModelName = formData.modelName.trim();
        } else if (batchFiles.length > 0) {
          // If batch mode and prefix is provided, combine them
          const prefix = formData.modelName.trim();
          if (prefix) {
            finalModelName = `${prefix} - ${item.name.trim()}`;
          }
        }

        if (!finalModelName) {
          finalModelName = `Mẫu thiết kế ${Date.now()}_${i + 1}`;
        }

        setUploadStatusMsg(`[${stepNum}/${totalSteps}] Đang tối ưu ảnh mẫu: ${finalModelName}...`);

        const sampleId = (editingSample && i === 0) ? editingSample.id : 'sample_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        const isNewUploadNeeded = item.base64.startsWith('data:image');

        let finalB2Url = (editingSample && i === 0) ? (editingSample.b2Url || '') : '';
        let finalB2FileId = (editingSample && i === 0) ? (editingSample.b2FileId || '') : '';
        let finalB2FilePath = (editingSample && i === 0) ? (editingSample.b2FilePath || '') : '';
        let finalLocalBase64 = (editingSample && i === 0) ? (editingSample.localBase64 || item.base64) : item.base64;

        if (isNewUploadNeeded) {
          // Compress image to around 800px max dimensions for efficient storage & ultra-fast upload speed
          const compressedBase64 = await compressBase64Image(item.base64, 800, 800, 0.70);
          finalLocalBase64 = compressedBase64;

          try {
            setUploadProgress('uploading');
            setUploadStatusMsg(`[${stepNum}/${totalSteps}] Đang tải ảnh trực tiếp lên Google Drive (${activeAccount.email})...`);
            
            const cleanFileName = finalModelName.replace(/[^a-zA-Z0-9-_.]/g, '_');
            const uploadResult = await uploadBase64ToGDrive(
              token!,
              compressedBase64,
              `${cleanFileName}_${Date.now()}.jpg`,
              activeAccount.folderId
            );

            finalB2Url = uploadResult.viewUrl;
            finalB2FileId = uploadResult.fileId;
            finalB2FilePath = `gdrive_storage|${activeAccount.email}`;
            
            // Store highly compressed thumbnail locally
            try {
              finalLocalBase64 = await compressBase64Image(compressedBase64, 150, 150, 0.5);
            } catch {
              finalLocalBase64 = '';
            }

            // Clean up old Google Drive file if editing and a new photo was uploaded
            if (editingSample && editingSample.b2FilePath?.startsWith('gdrive_storage') && editingSample.b2FileId && i === 0) {
              const oldEmail = editingSample.b2FilePath.split('|')[1];
              const oldToken = getCachedAccessToken(oldEmail);
              if (oldToken) {
                deleteFileFromGDrive(oldToken, editingSample.b2FileId).catch(err => {
                  console.warn('Could not clean up old Google Drive file version:', err);
                });
              }
            }
            
            // Clean up old Firebase Storage file if it was on Firebase
            if (editingSample && editingSample.b2FilePath && editingSample.b2FileId === 'firebase_storage' && i === 0) {
              deleteImageFromFirebase(editingSample.b2FilePath).catch(err => {
                console.warn('Could not clean up old Firebase Storage file version:', err);
              });
            }

            // Refresh storage quota after successful upload and update Firestore
            try {
              const freshQuota = await getGDriveStorageQuota(token!);
              const quotaDocRef = doc(db, getNamespaceCollection('gdrive_accounts'), activeAccount.id);
              await setDoc(quotaDocRef, {
                storageLimit: freshQuota.limit,
                storageUsage: freshQuota.usage,
                lastQuotaUpdate: Date.now()
              }, { merge: true });
            } catch (quotaErr) {
              console.warn('Could not refresh storage quota after upload:', quotaErr);
            }
          } catch (uploadErr: any) {
            console.error('Google Drive Upload failure, falling back to database-only storage:', uploadErr);
            if (totalSteps === 1) {
              alert(`⚠️ Không thể tải lên Google Drive: ${uploadErr.message}. Ảnh mẫu sẽ tạm thời được lưu trữ ngoại tuyến trên thiết bị.`);
            }
            finalB2Url = '';
            finalB2FileId = '';
            finalB2FilePath = '';
          }
        }

        // Save metadata to Firestore and Local Storage
        setUploadProgress('saving');
        setUploadStatusMsg(`[${stepNum}/${totalSteps}] Đang lưu thông tin mẫu thiết kế...`);

        const sampleObj: ModelSample = {
          id: sampleId,
          modelName: finalModelName,
          folder: finalFolder,
          customerName: finalCustomer,
          price: formData.price ? Number(formData.price) : undefined,
          material: formData.material.trim() || undefined,
          description: formData.description.trim() || undefined,
          b2Url: finalB2Url || undefined,
          b2FileId: finalB2FileId || undefined,
          b2FilePath: finalB2FilePath || undefined,
          localBase64: finalLocalBase64,
          createdAt: (editingSample && i === 0) ? editingSample.createdAt : Date.now(),
          updatedAt: Date.now()
        };

        // Write to Firestore namespace
        const cleanSampleObj = Object.fromEntries(
          Object.entries(sampleObj).filter(([_, v]) => v !== undefined)
        );
        const docRef = doc(db, getNamespaceCollection('model_samples'), sampleId);
        await setDoc(docRef, cleanSampleObj);

        savedSamplesList.push(sampleObj);
      }

      // Success
      setUploadProgress('success');
      setUploadStatusMsg(`Đã lưu thành công ${savedSamplesList.length} mẫu thiết kế!`);
      
      // Update selected folder to the saved folder so it's active immediately
      if (finalFolder) {
        setSelectedFolder(finalFolder);
      }

      // Update local state immediately
      setSamples(prev => {
        const savedIds = savedSamplesList.map(s => s.id);
        const filtered = prev.filter(s => !savedIds.includes(s.id));
        const result = [...savedSamplesList, ...filtered];
        localStorage.setItem('xuongan_model_samples', JSON.stringify(result));
        return result;
      });

      // Refresh B2 capacity info
      if (b2Config.configured) {
        fetchB2StorageInfo(b2Config);
      }

      setTimeout(() => {
        setShowAddModal(false);
        setUploadProgress('idle');
        setBatchFiles([]);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setUploadProgress('error');
      setUploadStatusMsg(`Lỗi khi lưu: ${err.message}`);
    }
  };

  const handleDeleteSample = async (sample: ModelSample, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa ảnh mẫu thiết kế "${sample.modelName}"? Hành động này sẽ xóa vĩnh viễn dữ liệu.`)) {
      return;
    }

    try {
      // 1. Delete on Firebase Storage or Backblaze B2 if configured
      // 1. Delete on Firebase Storage, Backblaze B2, or Google Drive if configured
      if (sample.b2FilePath) {
        if (sample.b2FilePath.startsWith('gdrive_storage')) {
          const email = sample.b2FilePath.split('|')[1];
          const token = getCachedAccessToken(email);
          if (token && sample.b2FileId) {
            try {
              await deleteFileFromGDrive(token, sample.b2FileId);
              console.log('Successfully deleted file on Google Drive:', sample.b2FileId);
            } catch (driveErr) {
              console.warn('Failed to delete file on Google Drive:', driveErr);
            }
          } else {
            console.log('Access token not cached for Google Drive deletion of file:', sample.b2FileId);
          }
        } else if (sample.b2FileId === 'firebase_storage') {
          try {
            await deleteImageFromFirebase(sample.b2FilePath);
            console.log('Successfully deleted file on Firebase Storage:', sample.b2FilePath);
          } catch (storageErr) {
            console.warn('Failed to delete file on Firebase Storage:', storageErr);
          }
        } else if (sample.b2FileId && b2Config.configured) {
          try {
            await B2Service.deleteFile(b2Config, sample.b2FileId, sample.b2FilePath);
            console.log('Successfully deleted file on B2:', sample.b2FilePath);
          } catch (b2Err) {
            console.warn('Failed to delete file on B2 (might already be deleted):', b2Err);
          }
        }
      }

      // 2. Delete in Firestore
      const docRef = doc(db, getNamespaceCollection('model_samples'), sample.id);
      await deleteDoc(docRef);

      // Update local state
      setSamples(prev => {
        const filtered = prev.filter(s => s.id !== sample.id);
        localStorage.setItem('xuongan_model_samples', JSON.stringify(filtered));
        return filtered;
      });

      // Refresh B2 capacity info
      if (b2Config.configured) {
        fetchB2StorageInfo(b2Config);
      }

      setSelectedSample(null);
      alert('Đã xóa mẫu thiết kế thành công.');
    } catch (err: any) {
      console.error(err);
      alert(`Lỗi khi xóa mẫu: ${err.message}`);
    }
  };

  const handleBulkDeleteSamples = async () => {
    if (selectedSampleIds.length === 0) {
      alert('Vui lòng chọn ít nhất một ảnh mẫu để xóa.');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedSampleIds.length} ảnh mẫu đã chọn? Hành động này sẽ xóa vĩnh viễn dữ liệu trên thiết bị và Backblaze B2.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const selectedSamples = samples.filter(s => selectedSampleIds.includes(s.id));
      
      // 1. Delete on Firebase Storage, Backblaze B2, or Google Drive for all selected samples
      for (const sample of selectedSamples) {
        if (sample.b2FilePath) {
          if (sample.b2FilePath.startsWith('gdrive_storage')) {
            const email = sample.b2FilePath.split('|')[1];
            const token = getCachedAccessToken(email);
            if (token && sample.b2FileId) {
              try {
                await deleteFileFromGDrive(token, sample.b2FileId);
                console.log('Successfully deleted Google Drive file in bulk:', sample.b2FileId);
              } catch (driveErr) {
                console.warn('Failed to delete Google Drive file in bulk:', driveErr);
              }
            }
          } else if (sample.b2FileId === 'firebase_storage') {
            try {
              await deleteImageFromFirebase(sample.b2FilePath);
              console.log('Successfully deleted Firebase Storage file in bulk:', sample.b2FilePath);
            } catch (storageErr) {
              console.warn(`Failed to delete Firebase Storage file for sample ${sample.id}:`, storageErr);
            }
          } else if (sample.b2FileId && b2Config.configured) {
            try {
              await B2Service.deleteFile(b2Config, sample.b2FileId, sample.b2FilePath);
              console.log('Successfully deleted B2 file in bulk:', sample.b2FilePath);
            } catch (b2Err) {
              console.warn(`Failed to delete B2 file for sample ${sample.id} (${sample.modelName}):`, b2Err);
            }
          }
        }
      }

      // 2. Delete in Firestore
      for (const sample of selectedSamples) {
        try {
          const docRef = doc(db, getNamespaceCollection('model_samples'), sample.id);
          await deleteDoc(docRef);
        } catch (dbErr) {
          console.error(`Failed to delete Firestore doc for sample ${sample.id}:`, dbErr);
        }
      }

      // Update local state
      setSamples(prev => {
        const filtered = prev.filter(s => !selectedSampleIds.includes(s.id));
        localStorage.setItem('xuongan_model_samples', JSON.stringify(filtered));
        return filtered;
      });

      // Refresh B2 capacity info
      if (b2Config.configured) {
        fetchB2StorageInfo(b2Config);
      }

      setSelectedSample(null);
      setSelectedSampleIds([]);
      setBulkSelectMode(false);
      alert('Đã xóa hàng loạt các mẫu thiết kế thành công.');
    } catch (err: any) {
      console.error(err);
      alert(`Lỗi khi xóa hàng loạt mẫu: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  // --- Folder Management ---
  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.includes(name)) {
      alert('Thư mục này đã tồn tại!');
      return;
    }

    setFolders(prev => [...prev, name]);
    setNewFolderName('');
    setShowAddFolder(false);
  };

  const handleDeleteFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folderName === 'Chưa phân loại') {
      alert('Không thể xóa thư mục mặc định!');
      return;
    }

    const linkedSamplesCount = samples.filter(s => s.folder === folderName).length;
    if (linkedSamplesCount > 0) {
      if (!confirm(`Thư mục "${folderName}" đang chứa ${linkedSamplesCount} ảnh mẫu. Nếu xóa, các mẫu này sẽ được chuyển về "Chưa phân loại". Bạn vẫn muốn xóa?`)) {
        return;
      }

      // Bulk update in Firestore
      const batch = writeBatch(db);
      const collName = getNamespaceCollection('model_samples');
      samples.forEach(s => {
        if (s.folder === folderName) {
          const docRef = doc(db, collName, s.id);
          batch.update(docRef, { folder: 'Chưa phân loại' });
        }
      });
      batch.commit().catch(console.error);

      // Local update as well
      setSamples(prev => prev.map(s => s.folder === folderName ? { ...s, folder: 'Chưa phân loại' } : s));
    }

    setFolders(prev => prev.filter(f => f !== folderName));
    if (selectedFolder === folderName) {
      setSelectedFolder('all');
    }
  };

  // --- Customer & Model Folder Dynamic Lists ---
  // Dynamically compute all customer folders from customers list + samples customerName field
  const customerFolders = useMemo(() => {
    const names = new Set<string>();
    
    // 1. Add official customer names from App
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        if (c.name) names.add(c.name.trim());
      });
    }
    
    // 2. Add custom customer names from existing samples
    samples.forEach(s => {
      const name = s.customerName?.trim() || 'Khách hàng chung';
      names.add(name);
    });

    // 3. Add custom customer folders added via the UI
    customCustomerFolders.forEach(folder => {
      if (folder && folder.trim()) names.add(folder.trim());
    });
    
    // Always guarantee 'Khách hàng chung' exists
    names.add('Khách hàng chung');
    
    return Array.from(names).sort((a, b) => {
      if (a === 'Khách hàng chung') return -1;
      if (b === 'Khách hàng chung') return 1;
      return a.localeCompare(b, 'vi');
    });
  }, [customers, samples, customCustomerFolders]);

  // Group samples of the selected customer by modelName (mẫu)
  const modelsForSelectedCustomer = useMemo(() => {
    if (!selectedCustomer) return [];
    
    const customerSamples = samples.filter(s => {
      const cName = s.customerName || 'Khách hàng chung';
      return cName.toLowerCase().trim() === selectedCustomer.toLowerCase().trim();
    });
    
    const groups: Record<string, {
      modelName: string;
      samples: ModelSample[];
      latestSample: ModelSample;
    }> = {};
    
    customerSamples.forEach(s => {
      const mName = s.modelName?.trim() || 'Mẫu chưa đặt tên';
      if (!groups[mName]) {
        groups[mName] = {
          modelName: mName,
          samples: [],
          latestSample: s
        };
      }
      groups[mName].samples.push(s);
      if (s.createdAt > groups[mName].latestSample.createdAt) {
        groups[mName].latestSample = s;
      }
    });
    
    return Object.values(groups).sort((a, b) => b.latestSample.createdAt - a.latestSample.createdAt);
  }, [samples, selectedCustomer]);

  // Navigation handlers
  const enterCustomer = (customerName: string) => {
    setSelectedCustomer(customerName);
    setSelectedModel(null);
    setCurrentLevel('models');
  };

  const enterModel = (modelName: string) => {
    setSelectedModel(modelName);
    setCurrentLevel('photos');
  };

  const goBackToCustomers = () => {
    setSelectedCustomer(null);
    setSelectedModel(null);
    setCurrentLevel('customers');
  };

  const goBackToModels = () => {
    setSelectedModel(null);
    setCurrentLevel('models');
  };

  const handleAddCustomerFolder = () => {
    const name = newCustomerName.trim();
    if (!name) {
      alert('Vui lòng nhập tên khách hàng.');
      return;
    }
    if (customerFolders.map(f => f.toLowerCase()).includes(name.toLowerCase())) {
      alert('Tên khách hàng/Thư mục này đã tồn tại.');
      return;
    }
    
    const updated = [...customCustomerFolders, name];
    setCustomCustomerFolders(updated);
    localStorage.setItem('xuongan_custom_customer_folders', JSON.stringify(updated));
    setNewCustomerName('');
    setShowAddCustomer(false);
    
    // Instantly go inside this customer folder
    enterCustomer(name);
  };

  const handleDeleteCustomerFolder = (customerName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (customerName === 'Khách hàng chung') {
      alert('Không thể xoá thư mục Khách hàng chung.');
      return;
    }
    
    const hasSamples = samples.some(s => {
      const cName = s.customerName || 'Khách hàng chung';
      return cName.toLowerCase().trim() === customerName.toLowerCase().trim();
    });
    
    if (hasSamples) {
      alert('Thư mục này đang chứa hình ảnh mẫu. Vui lòng xoá hoặc di chuyển tất cả hình ảnh mẫu trước khi xoá thư mục.');
      return;
    }
    
    if (confirm(`Bạn có chắc muốn xoá thư mục khách "${customerName}"?`)) {
      const updated = customCustomerFolders.filter(f => f.toLowerCase() !== customerName.toLowerCase());
      setCustomCustomerFolders(updated);
      localStorage.setItem('xuongan_custom_customer_folders', JSON.stringify(updated));
      
      if (selectedCustomer === customerName) {
        goBackToCustomers();
      }
    }
  };

  // --- Filtering & Sorting ---
  const filteredSamples = useMemo(() => {
    const seen = new Set<string>();
    return samples.filter(sample => {
      if (!sample || !sample.id || seen.has(sample.id)) return false;
      seen.add(sample.id);
      
      // Filter by category folder if selectedFolder !== 'all'
      const matchFolder = selectedFolder === 'all' || sample.folder === selectedFolder;
      
      // Filter by selectedCustomer if inside models or photos level
      const sampleCustomer = sample.customerName || 'Khách hàng chung';
      const matchCustomer = !selectedCustomer || sampleCustomer.toLowerCase().trim() === selectedCustomer.toLowerCase().trim();
      
      // Filter by selectedModel if inside photos level
      const sampleModel = sample.modelName || 'Mẫu chưa đặt tên';
      const matchModel = !selectedModel || sampleModel.toLowerCase().trim() === selectedModel.toLowerCase().trim();
      
      // Filter by search term
      const matchSearch = !searchTerm || 
                          sample.modelName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sampleCustomer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sample.description && sample.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (sample.material && sample.material.toLowerCase().includes(searchTerm.toLowerCase()));
                          
      return matchFolder && matchCustomer && matchModel && matchSearch;
    });
  }, [samples, selectedFolder, selectedCustomer, selectedModel, searchTerm]);

  // Fullscreen expand state
  const [fullscreenSample, setFullscreenSample] = useState<ModelSample | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenRotation, setFullscreenRotation] = useState(0);

  const handleFullscreenPrev = () => {
    if (!fullscreenSample || filteredSamples.length <= 1) return;
    const currentIndex = filteredSamples.findIndex(s => s.id === fullscreenSample.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + filteredSamples.length) % filteredSamples.length;
    setFullscreenSample(filteredSamples[prevIndex]);
    setFullscreenZoom(1);
    setFullscreenRotation(0);
  };

  const handleFullscreenNext = () => {
    if (!fullscreenSample || filteredSamples.length <= 1) return;
    const currentIndex = filteredSamples.findIndex(s => s.id === fullscreenSample.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % filteredSamples.length;
    setFullscreenSample(filteredSamples[nextIndex]);
    setFullscreenZoom(1);
    setFullscreenRotation(0);
  };

  // Keyboard navigation for full-screen viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullscreenSample) return;
      if (e.key === 'Escape') {
        setFullscreenSample(null);
        setFullscreenZoom(1);
        setFullscreenRotation(0);
      } else if (e.key === 'ArrowLeft') {
        handleFullscreenPrev();
      } else if (e.key === 'ArrowRight') {
        handleFullscreenNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenSample, filteredSamples]);

  useAndroidBack(fullscreenSample !== null, () => {
    setFullscreenSample(null);
    setFullscreenZoom(1);
    setFullscreenRotation(0);
  });

  // Statistics
  const folderStats = useMemo(() => {
    const stats: Record<string, number> = {};
    samples.forEach(s => {
      stats[s.folder] = (stats[s.folder] || 0) + 1;
    });
    return stats;
  }, [samples]);

  const renderBreadcrumbs = () => {
    return (
      <div className="flex items-center flex-wrap gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111c18]/30 border border-slate-200/50 dark:border-[#1c2d27]/40 text-[11px] font-medium text-slate-500 dark:text-[#657f76]">
        <button 
          onClick={goBackToCustomers}
          className="hover:text-indigo-600 dark:hover:text-[#818cf8] font-bold transition flex items-center gap-1 cursor-pointer"
        >
          📁 Thư mục khách hàng
        </button>
        {selectedCustomer && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-350" />
            <button 
              onClick={goBackToModels}
              className={`hover:text-indigo-600 dark:hover:text-[#818cf8] font-bold transition flex items-center gap-1 cursor-pointer ${!selectedModel ? 'text-indigo-600 dark:text-[#818cf8]' : ''}`}
            >
              👤 {selectedCustomer}
            </button>
          </>
        )}
        {selectedModel && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-350" />
            <span className="text-slate-800 dark:text-slate-200 font-extrabold flex items-center gap-1">
              🏷️ {selectedModel}
            </span>
          </>
        )}
      </div>
    );
  };

  const renderCustomerFolderCard = (folderName: string) => {
    // Find latest sample for cover image
    const customerSamples = samples.filter(s => {
      const cName = s.customerName || 'Khách hàng chung';
      return cName.toLowerCase().trim() === folderName.toLowerCase().trim();
    });
    
    const uniqueModelCount = new Set(customerSamples.map(s => s.modelName)).size;
    const totalPhotos = customerSamples.length;
    const latestSample = customerSamples.length > 0 ? customerSamples[0] : null;
    const coverImg = latestSample ? (latestSample.b2Url || latestSample.localBase64 || '') : '';
    const isCustom = customCustomerFolders.includes(folderName);

    return (
      <motion.div
        key={folderName}
        whileHover={{ scale: 1.02, y: -2 }}
        onClick={() => enterCustomer(folderName)}
        className="group relative bg-white dark:bg-[#0c1310] rounded-2xl border border-slate-200/75 dark:border-[#1c2d27]/70 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-44"
      >
        {/* Cover image thumbnail or folder icon */}
        <div className="relative h-24 bg-slate-50 dark:bg-emerald-950/10 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-[#1c2d27]/40">
          {coverImg ? (
            <div className="absolute inset-0 w-full h-full">
              <img 
                src={coverImg} 
                alt={folderName} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-95 dark:brightness-90"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/20 flex items-center justify-center text-indigo-500">
              <Folder className="w-6 h-6 fill-indigo-100 dark:fill-indigo-950/10" />
            </div>
          )}
          
          {/* Folder tag overlay */}
          <div className="absolute top-2.5 left-2.5 bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <Folder className="w-3 h-3 fill-white/20" />
            <span>Thư mục</span>
          </div>

          {/* Delete custom folder (only if empty and is custom) */}
          {isCustom && totalPhotos === 0 && (
            <button
              onClick={(e) => handleDeleteCustomerFolder(folderName, e)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/95 border border-rose-200/50 dark:border-rose-900/40 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-10"
              title="Xoá thư mục trống"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Folder Meta Details */}
        <div className="p-3.5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-xs text-slate-850 dark:text-slate-150 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
              {folderName}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-[#657f76] mt-0.5">
              Khách hàng
            </p>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-450 dark:text-[#527065] border-t border-slate-100/60 dark:border-[#1c2d27]/30 pt-2 mt-1">
            <span className="flex items-center gap-0.5">🏷️ {uniqueModelCount} mẫu</span>
            <span className="flex items-center gap-0.5">🖼️ {totalPhotos} ảnh</span>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderModelFolderCard = (model: {
    modelName: string;
    samples: ModelSample[];
    latestSample: ModelSample;
  }) => {
    const coverImg = model.latestSample.b2Url || model.latestSample.localBase64 || '';
    const totalPhotos = model.samples.length;
    const latestPrice = model.latestSample.price;
    const latestMaterial = model.latestSample.material;

    return (
      <motion.div
        key={model.modelName}
        whileHover={{ scale: 1.02, y: -2 }}
        onClick={() => enterModel(model.modelName)}
        className="group relative bg-white dark:bg-[#0c1310] rounded-2xl border border-slate-200/75 dark:border-[#1c2d27]/70 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-48"
      >
        {/* Cover image (mỗi folder hiển thị hình ảnh đại cho 1 folder) */}
        <div className="relative h-28 bg-slate-50 dark:bg-emerald-950/10 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-[#1c2d27]/40">
          {coverImg ? (
            <div className="absolute inset-0 w-full h-full">
              <img 
                src={coverImg} 
                alt={model.modelName} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-95 dark:brightness-90"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-emerald-950/20 flex items-center justify-center text-amber-500">
              <Folder className="w-6 h-6 fill-amber-100 dark:fill-amber-950/10" />
            </div>
          )}

          {/* Tag badge overlay */}
          <div className="absolute top-2.5 left-2.5 bg-indigo-600 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <span>🏷️ Mẫu rập</span>
          </div>

          {/* Model info price on cover if exists */}
          {latestPrice && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-xs">
              {latestPrice.toLocaleString()}đ
            </div>
          )}
        </div>

        {/* Model Meta Details */}
        <div className="p-3.5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-xs text-slate-850 dark:text-slate-150 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
              {model.modelName}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-[#657f76] mt-0.5 truncate">
              {latestMaterial ? `Vải: ${latestMaterial}` : 'Chưa nhập chất liệu'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-450 dark:text-[#527065] border-t border-slate-100/60 dark:border-[#1c2d27]/30 pt-2 mt-1">
            <span className="flex items-center gap-0.5">🖼️ {totalPhotos} hình ảnh</span>
            <span className="text-teal-600 dark:text-[#10b981] font-extrabold">Xem Album →</span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5 pb-24 font-sans text-xs text-slate-800 dark:text-slate-100">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-2xl border bg-white dark:bg-[#0c1310] border-slate-200/60 dark:border-[#1c2d27]/60 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-36 h-36 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-[#818cf8]">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight uppercase text-slate-900 dark:text-white">Kho hình mẫu</h1>
            <p className="text-[10px] text-slate-400 dark:text-[#657f76]">
              Lưu trữ mẫu rập dệt, catalog, ảnh thợ may dệt trực tiếp lên <span className="font-bold text-blue-600 dark:text-blue-450">Google Drive</span> và đồng bộ thời gian thực.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Drive Status & Config Button */}
          <button 
            onClick={() => setShowGDriveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition cursor-pointer"
            title="Quản lý tài khoản lưu trữ Google Drive"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            <span>Drive: {gdriveAccounts.length > 0 ? (gdriveAccounts.find(a => a.isActive)?.email || 'Chưa chọn TK') : 'Chưa liên kết'}</span>
          </button>

          {/* Plus icon button inside the header */}
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600 dark:bg-emerald-600 hover:bg-teal-700 dark:hover:bg-emerald-700 text-white font-extrabold shadow-xs transition cursor-pointer"
            title="Thêm ảnh mẫu"
          >
            <Plus className="w-4 h-4 font-black" />
          </button>
        </div>
      </div>

      {/* 3. Main Catalog View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
        
        {/* Sidebar categories / folders */}
        <div className="space-y-3 lg:col-span-1">
          
          {/* Custom Compact Categories & Customer Dialog Selectors */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1310] border border-slate-200/60 dark:border-[#1c2d27]/60 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-[#1c2d27]/40">
              <span className="font-mono text-[9.5px] font-extrabold uppercase text-slate-400 dark:text-[#657f76] tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Bộ lọc & Phân loại
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Customer Selector Icon Button */}
              <button
                onClick={() => setShowCustomerDialog(true)}
                className={`relative group p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  selectedCustomer !== null
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-[#818cf8]'
                    : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/45 border-slate-150 dark:border-[#1c2d27]/60 text-slate-500 dark:text-slate-400'
                }`}
                title="Bấm để chọn thư mục khách hàng"
              >
                <div className={`p-2.5 rounded-xl transition-all ${
                  selectedCustomer !== null
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-[#818cf8]'
                    : 'bg-slate-100 dark:bg-[#0e1613] text-slate-400'
                } mb-1.5 group-hover:scale-115 duration-250`}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide truncate max-w-full">
                  Khách hàng
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#556b62] mt-0.5 truncate max-w-full">
                  {selectedCustomer || 'Tất cả khách'}
                </span>
                {selectedCustomer !== null && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-indigo-650 text-white font-mono text-[9px] font-black flex items-center justify-center shadow-xs">
                    {samples.filter(s => {
                      const cName = s.customerName || 'Khách hàng chung';
                      return cName.toLowerCase().trim() === selectedCustomer.toLowerCase().trim();
                    }).length}
                  </span>
                )}
              </button>

              {/* Folder Selector Icon Button */}
              <button
                onClick={() => setShowFolderDialog(true)}
                className={`relative group p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  selectedFolder !== 'all'
                    ? 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/50 text-teal-600 dark:text-[#10b981]'
                    : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/45 border-slate-150 dark:border-[#1c2d27]/60 text-slate-500 dark:text-slate-400'
                }`}
                title="Bấm để chọn nhóm phân loại mẫu"
              >
                <div className={`p-2.5 rounded-xl transition-all ${
                  selectedFolder !== 'all'
                    ? 'bg-teal-500/15 text-teal-600 dark:text-[#10b981]'
                    : 'bg-slate-100 dark:bg-[#0e1613] text-slate-400'
                } mb-1.5 group-hover:scale-115 duration-250`}>
                  <Folder className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide truncate max-w-full">
                  Phân loại
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#556b62] mt-0.5 truncate max-w-full">
                  {selectedFolder === 'all' ? 'Tất cả nhóm' : selectedFolder}
                </span>
                {selectedFolder !== 'all' && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-teal-650 text-white font-mono text-[9px] font-black flex items-center justify-center shadow-xs">
                    {folderStats[selectedFolder] || 0}
                  </span>
                )}
              </button>
            </div>
            
            {/* Quick action helper/clear filters */}
            {(selectedCustomer !== null || selectedFolder !== 'all') && (
              <div className="pt-2 border-t border-dashed border-slate-100 dark:border-[#1c2d27]/40 flex justify-between items-center">
                <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Đang lọc mẫu dệt
                </span>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSelectedFolder('all');
                    setCurrentLevel('customers');
                  }}
                  className="text-[8.5px] font-black text-rose-500 hover:text-rose-600 transition cursor-pointer flex items-center gap-0.5 hover:underline uppercase"
                >
                  <X className="w-2.5 h-2.5" /> Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gallery Grid Section */}
        <div className="space-y-4 lg:col-span-3">
          
          {/* Search and stats bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#0c1310] border border-slate-200/60 dark:border-[#1c2d27]/60 shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm tên mẫu, chất liệu, mô tả..."
                className="w-full pl-8 pr-3 py-1.5 border rounded-xl text-[11px] focus:outline-hidden focus:border-teal-500 dark:bg-[#0e1613] dark:border-[#1c2d27]"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-450 dark:text-[#657f76]">
                <span>Hiển thị: <b>{filteredSamples.length}</b> / <b>{samples.length}</b> mẫu</span>
                <span className="h-3.5 w-px bg-slate-200 dark:bg-[#1c2d27]" />
                <span>Thư mục: <b>{folders.length}</b> nhóm</span>
              </div>

              {/* Grid Column Selector (2-4-6-8 columns) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-[#111c18]/40 border border-slate-200 dark:border-[#1c2d27]/75 rounded-xl">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-[#657f76] px-1.5 font-mono flex items-center gap-1 shrink-0">
                  <LayoutGrid className="w-3 h-3 text-slate-400 dark:text-[#657f76]" />
                  Cột:
                </span>
                <div className="flex items-center gap-0.5">
                  {([2, 4, 6, 8] as const).map((col) => (
                    <button
                      key={col}
                      onClick={() => setGridCols(col)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${
                        gridCols === col
                          ? 'bg-teal-600 dark:bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 dark:text-[#657f76] hover:bg-slate-150/70 dark:hover:bg-[#111c18]'
                      }`}
                      title={`Xem dạng ${col} cột`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gallery Layout Mode selector (Square, Portrait, Natural/Masonry) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-[#111c18]/40 border border-slate-200 dark:border-[#1c2d27]/75 rounded-xl">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-[#657f76] px-1.5 font-mono flex items-center gap-1 shrink-0">
                  <span>📐</span>
                  Tỷ lệ:
                </span>
                <div className="flex items-center gap-0.5">
                  {(['square', 'portrait', 'natural'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setGalleryLayout(mode)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${
                        galleryLayout === mode
                          ? 'bg-teal-600 dark:bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 dark:text-[#657f76] hover:bg-slate-150/70 dark:hover:bg-[#111c18]'
                      }`}
                      title={
                        mode === 'square'
                          ? 'Tỷ lệ vuông 1:1'
                          : mode === 'portrait'
                          ? 'Tỷ lệ dọc 3:4 (Phù hợp thời trang)'
                          : 'Tự do (Thác nước Masonry - Pinterest)'
                      }
                    >
                      {mode === 'square' ? '1:1' : mode === 'portrait' ? '3:4' : 'Thác nước'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Edit Toggle button */}
              <button
                onClick={() => {
                  setQuickEditEnabled(!quickEditEnabled);
                  setBulkSelectMode(false);
                  setSelectedSampleIds([]);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-bold text-[9px] md:text-[10px] uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  quickEditEnabled
                    ? 'bg-amber-500 border-amber-500 text-white shadow-xs hover:bg-amber-600'
                    : 'bg-slate-50 dark:bg-[#111c18]/40 border-slate-200 dark:border-[#1c2d27]/75 text-slate-500 dark:text-[#657f76] hover:bg-slate-100 dark:hover:bg-[#111c18]/65'
                }`}
                title="Bật/Tắt chế độ chỉnh sửa nhanh trực tiếp trên danh sách"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{quickEditEnabled ? 'Tắt sửa nhanh' : 'Sửa nhanh'}</span>
              </button>

              {/* Bulk Select Mode toggle button */}
              <button
                onClick={() => {
                  setBulkSelectMode(!bulkSelectMode);
                  setSelectedSampleIds([]);
                  setQuickEditEnabled(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-bold text-[9px] md:text-[10px] uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  bulkSelectMode
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs hover:bg-rose-700'
                    : 'bg-slate-50 dark:bg-[#111c18]/40 border-slate-200 dark:border-[#1c2d27]/75 text-slate-500 dark:text-[#657f76] hover:bg-slate-100 dark:hover:bg-[#111c18]/65'
                }`}
                title="Bật/Tắt chế độ chọn xóa hàng loạt mẫu thiết kế"
              >
                {bulkSelectMode ? <SquareCheck className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{bulkSelectMode ? 'Hủy chọn nhiều' : 'Chọn nhiều'}</span>
              </button>

              <button 
                onClick={handleOpenAddModal}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-600 dark:bg-emerald-600 hover:bg-teal-700 dark:hover:bg-emerald-700 text-white font-black shadow-xs hover:shadow-md transition cursor-pointer shrink-0"
                title="Thêm ảnh mẫu"
              >
                <Plus className="w-4 h-4 font-black" />
              </button>
            </div>
          </div>

          {quickEditEnabled && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-400 text-[11px] font-semibold"
            >
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 shrink-0 text-amber-500" />
                <span><b>Chế độ Sửa nhanh Đang Bật</b>: Bạn có thể sửa thông tin hoặc xóa từng mẫu trực tiếp bằng các nút trên từng thẻ ảnh.</span>
              </div>
              <button 
                onClick={() => setQuickEditEnabled(false)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer transition-all shrink-0 text-[10px] uppercase tracking-wide"
              >
                Thoát chế độ
              </button>
            </motion.div>
          )}

          {bulkSelectMode && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/25 text-teal-850 dark:text-teal-400 text-[11px] font-semibold text-left"
            >
              <div className="flex items-center gap-2">
                <SquareCheck className="w-4 h-4 shrink-0 text-teal-600 dark:text-emerald-500" />
                <span>
                  <b>Chế độ chọn hàng loạt Đang Bật</b>: Bạn đã chọn{' '}
                  <span className="font-mono bg-teal-600 text-white dark:bg-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 mr-1">
                    {selectedSampleIds.length}
                  </span>{' '}
                  mẫu.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => {
                    const allFilteredIds = filteredSamples.map(s => s.id);
                    const allSelected = allFilteredIds.every(id => selectedSampleIds.includes(id));
                    if (allSelected) {
                      setSelectedSampleIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                    } else {
                      setSelectedSampleIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition font-bold text-[10px] cursor-pointer"
                >
                  {filteredSamples.every(s => selectedSampleIds.includes(s.id)) ? 'Hủy chọn tất cả' : 'Chọn tất cả'}
                </button>
                <button 
                  onClick={() => handleOpenShareModal(selectedSampleIds)}
                  disabled={selectedSampleIds.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  Chia sẻ ({selectedSampleIds.length})
                </button>
                <button 
                  onClick={handleBulkDeleteSamples}
                  disabled={selectedSampleIds.length === 0 || bulkDeleting}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {bulkDeleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Xóa hàng loạt ({selectedSampleIds.length})
                </button>
                <button 
                  onClick={() => {
                    setBulkSelectMode(false);
                    setSelectedSampleIds([]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-[#1a2d25] text-slate-700 dark:text-[#a3b8cc] hover:bg-slate-300 dark:hover:bg-[#253e33] transition font-bold text-[10px] cursor-pointer"
                >
                  Thoát
                </button>
              </div>
            </motion.div>
          )}

          {/* Breadcrumbs for navigation */}
          <div className="mb-4">
            {renderBreadcrumbs()}
          </div>

          {/* Grid display */}
          {currentLevel === 'customers' && (
            customerFolders.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-[#1c2d27] rounded-3xl p-10 bg-white dark:bg-[#0c1310]/50 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111c18]/10 flex items-center justify-center mx-auto text-indigo-500 mb-4">
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-700 dark:text-slate-300">Chưa có thư mục khách hàng nào</h3>
                <p className="text-[10px] text-slate-400 dark:text-[#556b62] mt-1 max-w-xs mx-auto">
                  Hãy bấm nút tạo ở thanh bên hoặc thêm mẫu mới và nhập tên khách hàng mới để tạo thư mục riêng cho từng khách hàng.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
                {customerFolders.map(folder => renderCustomerFolderCard(folder))}
              </div>
            )
          )}

          {currentLevel === 'models' && (
            modelsForSelectedCustomer.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-[#1c2d27] rounded-3xl p-10 bg-white dark:bg-[#0c1310]/50 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111c18]/10 flex items-center justify-center mx-auto text-amber-500 mb-4">
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-700 dark:text-slate-300">Khách hàng chưa có mẫu rập nào</h3>
                <p className="text-[10px] text-slate-400 dark:text-[#556b62] mt-1 max-w-xs mx-auto">
                  Nhấn nút thêm mẫu thiết kế (+) và gắn tên khách hàng này để phân loại ảnh mẫu theo folder mẫu.
                </p>
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                >
                  + Thêm mẫu đầu tiên cho khách này
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
                {modelsForSelectedCustomer.map(model => renderModelFolderCard(model))}
              </div>
            )
          )}

          {currentLevel === 'photos' && (
            filteredSamples.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-[#1c2d27] rounded-3xl p-10 bg-white dark:bg-[#0c1310]/50 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111c18] flex items-center justify-center mx-auto text-slate-400 mb-4 animate-pulse">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-700 dark:text-slate-300">Không tìm thấy ảnh mẫu</h3>
                <p className="text-[10px] text-slate-400 dark:text-[#556b62] mt-1 max-w-xs mx-auto">
                  Chưa có ảnh mẫu nào được lưu trữ trong mẫu thiết kế này hoặc không khớp với từ khóa tìm kiếm.
                </p>
              </div>
            ) : (
            (() => {
              // Internal Card Renderer Helper for both grid and masonry layouts
              const renderCard = (sample: ModelSample) => {
                const imgSource = sample.b2Url || sample.localBase64 || '';
                const isCloud = !!sample.b2Url;

                // Dynamic styles based on column count (2, 4, 6, 8 columns)
                const cardPadding = gridCols === 2 
                  ? 'p-3.5 sm:p-4' 
                  : gridCols === 4 
                    ? 'p-3' 
                    : gridCols === 6 
                      ? 'p-2' 
                      : 'p-1.5';

                const titleSize = gridCols === 2 
                  ? 'text-xs sm:text-sm' 
                  : gridCols === 4 
                    ? 'text-[11px] sm:text-xs' 
                    : gridCols === 6 
                      ? 'text-[10px]' 
                      : 'text-[9px]';

                const subSize = gridCols === 2 
                  ? 'text-[10px] sm:text-[11px]' 
                  : gridCols === 4 
                    ? 'text-[9px] sm:text-[9.5px]' 
                    : gridCols === 6 
                      ? 'text-[8.5px]' 
                      : 'text-[7.5px]';

                const priceSize = gridCols === 2 
                  ? 'text-xs sm:text-sm' 
                  : gridCols === 4 
                    ? 'text-[10.5px] sm:text-[11.5px]' 
                    : gridCols === 6 
                      ? 'text-[9.5px]' 
                      : 'text-[8.5px]';

                const badgeSpacing = gridCols >= 6 ? 'top-1 left-1 gap-0.5' : 'top-2 left-2 gap-1';
                const isSelected = selectedSampleIds.includes(sample.id);

                return (
                  <motion.div
                    key={sample.id}
                    layoutId={`sample-card-${sample.id}`}
                    onClick={(e) => {
                      if (bulkSelectMode) {
                        e.stopPropagation();
                        setSelectedSampleIds(prev => 
                          prev.includes(sample.id)
                            ? prev.filter(id => id !== sample.id)
                            : [...prev, sample.id]
                        );
                      } else {
                        setSelectedSample(sample);
                      }
                    }}
                    className={`group bg-white dark:bg-[#0c1310] rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col relative w-full ${
                      bulkSelectMode
                        ? isSelected
                          ? 'border-teal-600 dark:border-emerald-500 ring-2 ring-teal-500/20 dark:ring-emerald-500/20 scale-102 shadow-md'
                          : 'border-slate-200/75 dark:border-[#1c2d27]/70 opacity-80 hover:opacity-100 hover:border-slate-350 dark:hover:border-[#1c2d27] hover:scale-101'
                        : 'border-slate-200/75 dark:border-[#1c2d27]/70 shadow-xs hover:shadow-lg hover:scale-103 hover:border-teal-500/40 dark:hover:border-emerald-500/40'
                    }`}
                  >
                    {/* B2 Cloud badge flag or Quick Edit flag or Bulk Select checkbox */}
                    <div className={`absolute z-10 flex flex-col items-start ${badgeSpacing}`}>
                      {bulkSelectMode ? (
                        <div 
                          className={`p-1 rounded-xl border bg-white dark:bg-slate-900 shadow-md transition-all duration-200 ${
                            isSelected 
                              ? 'border-teal-500 text-teal-600 dark:border-emerald-500 dark:text-emerald-500 bg-teal-50 dark:bg-emerald-950/20 scale-110' 
                              : 'border-slate-250 dark:border-[#1c2d27] text-slate-400 hover:scale-110'
                          }`}
                        >
                          {isSelected ? (
                            <SquareCheck className="w-4 h-4 font-black" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </div>
                      ) : (
                        <>
                          <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-mono font-bold uppercase tracking-wider text-white shadow-xs ${
                            isCloud ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-500/85'
                          }`}>
                            {isCloud ? 'Firebase' : 'Offline'}
                          </span>
                          {quickEditEnabled && (
                            <span className="px-1.5 py-0.5 rounded-full text-[7px] font-mono font-bold uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                              <Edit2 className="w-1.5 h-1.5 animate-pulse" />
                              Sửa
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Quick Edit Action Buttons (Top-Right on card) */}
                    {quickEditEnabled && !bulkSelectMode && (
                      <div className={`absolute z-20 flex gap-1 bg-white/95 dark:bg-slate-900/95 p-0.5 rounded-lg shadow-md border border-amber-500/30 ${gridCols >= 6 ? 'top-1 right-1' : 'top-2 right-2'}`}>
                        <button
                          title="Sửa mẫu thiết kế"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(sample, e);
                          }}
                          className="p-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-all scale-100 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
                        >
                          <Edit2 className="w-2.5 h-2.5 font-bold" />
                        </button>
                        <button
                          title="Xóa mẫu thiết kế"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSample(sample, e);
                          }}
                          className="p-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white transition-all scale-100 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
                        >
                          <Trash className="w-2.5 h-2.5 font-bold" />
                        </button>
                      </div>
                    )}

                    {/* Image canvas with configurable aspect ratio */}
                    <div className={`relative w-full bg-slate-50 dark:bg-[#070b09] overflow-hidden flex items-center justify-center border-b border-slate-150 dark:border-[#1c2d27]/70 ${
                      galleryLayout === 'square'
                        ? 'aspect-square'
                        : galleryLayout === 'portrait'
                        ? 'aspect-[3/4]'
                        : 'h-auto'
                    }`}>
                      {imgSource ? (
                        <ModelImage 
                          src={imgSource} 
                          thumbnailSrc={sample.b2Url ? sample.localBase64 : undefined}
                          alt={sample.modelName} 
                          layout={galleryLayout}
                          className={`w-full transition-transform duration-300 group-hover:scale-106 ${
                            galleryLayout === 'natural' 
                              ? 'h-auto max-h-[350px] object-cover' 
                              : 'h-full object-cover'
                          }`}
                        />
                      ) : (
                        <div className="text-slate-350 dark:text-slate-600 text-center flex flex-col items-center p-4">
                          <ImageIcon className="w-6 h-6 opacity-45 mb-1" />
                          <span className="text-[8px]">Lỗi tải ảnh</span>
                        </div>
                      )}
                      
                      {/* Action hover overlay */}
                      <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5">
                        <button
                          title="Phóng to ảnh"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenSample(sample);
                          }}
                          className="p-1.5 rounded-full bg-white text-slate-800 shadow-xs hover:scale-115 active:scale-95 transition z-10 cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-slate-700" />
                        </button>
                        <button
                          title="Chia sẻ ảnh"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenShareModal([sample.id]);
                          }}
                          className="p-1.5 rounded-full bg-white text-slate-800 shadow-xs hover:scale-115 active:scale-95 transition z-10 cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-700" />
                        </button>
                        <button
                          title="Xem chi tiết"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSample(sample);
                          }}
                          className="p-1.5 rounded-full bg-white text-slate-800 shadow-xs hover:scale-115 active:scale-95 transition z-10 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-700" />
                        </button>
                      </div>

                      {/* Floating, easy-tap Expand button on bottom-right of image */}
                      {imgSource && (
                        <button
                          title="Phóng to"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenSample(sample);
                          }}
                          className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-slate-900/60 hover:bg-slate-950 text-white backdrop-blur-xs shadow-xs hover:scale-105 active:scale-95 transition z-10 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Metadata details block */}
                    <div className={`${cardPadding} flex-grow flex flex-col justify-between space-y-1`}>
                      <div>
                        <h4 className={`font-black text-slate-900 dark:text-white truncate ${titleSize} leading-tight group-hover:text-teal-600 dark:group-hover:text-[#10b981] transition`} title={sample.modelName}>
                          {sample.modelName}
                        </h4>
                        
                        <div className={`flex items-center gap-1 mt-0.5 ${subSize} text-slate-450 dark:text-[#556d62] font-semibold`}>
                          <span>📂</span>
                          <span className="truncate">{sample.folder}</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-[#1c2d27]/50 flex justify-between items-center">
                        {sample.price ? (
                          <span className={`font-mono font-black text-teal-600 dark:text-[#10b981] ${priceSize}`}>
                            {sample.price.toLocaleString()}đ
                          </span>
                        ) : (
                          <span className={`italic text-slate-400 font-medium ${subSize}`}>Chưa báo giá</span>
                        )}
                        
                        {sample.material && gridCols < 8 && (
                          <span className={`px-1 py-0.5 rounded bg-slate-100 dark:bg-[#111c18] font-mono ${subSize} text-slate-500 font-bold truncate max-w-[55px]`} title={sample.material}>
                            {sample.material}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              };

              // Decide between True Masonry (using CSS columns) and standard CSS Grid
              if (galleryLayout === 'natural') {
                const colsClass = gridCols === 2
                  ? "columns-2 gap-3 sm:gap-4"
                  : gridCols === 4
                  ? "columns-3 sm:columns-4 gap-2.5 sm:gap-4"
                  : gridCols === 6
                  ? "columns-4 sm:columns-5 md:columns-6 gap-2 sm:gap-3 lg:gap-4"
                  : "columns-5 sm:columns-6 md:columns-7 lg:columns-8 gap-1.5 sm:gap-2 lg:gap-3";
                  
                return (
                  <div className={`${colsClass} w-full`}>
                    {filteredSamples.map(sample => (
                      <div key={sample.id} className="break-inside-avoid mb-3 sm:mb-4 w-full">
                        {renderCard(sample)}
                      </div>
                    ))}
                  </div>
                );
              } else {
                return (
                  <div className={
                    gridCols === 2
                      ? "grid grid-cols-2 gap-3 sm:gap-4"
                      : gridCols === 6
                      ? "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3 md:gap-4"
                      : gridCols === 8
                      ? "grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-1.5 sm:gap-2 md:gap-3"
                      : "grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-4"
                  }>
                    {filteredSamples.map(renderCard)}
                  </div>
                );
              }
            })()
          ))}

        </div>
      </div>

      {/* --- Modals --- */}

      {/* A. Add/Edit Model Sample Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="absolute inset-0" onClick={() => uploadProgress === 'idle' && setShowAddModal(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white dark:bg-[#0e1613] border border-slate-200 dark:border-[#1c2d27] z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="pb-3 border-b border-slate-150 dark:border-[#1c2d27] flex justify-between items-center shrink-0">
                <span className="font-extrabold uppercase font-mono tracking-wider text-sm flex items-center gap-2">
                  <Plus className="w-5 h-5 text-teal-600 dark:text-emerald-500" />
                  {editingSample ? 'Sửa thông tin mẫu thiết kế' : 'Thêm mẫu thiết kế mới'}
                </span>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-[#1a2d25]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {uploadProgress !== 'idle' && uploadProgress !== 'success' && uploadProgress !== 'error' ? (
                // LOADING / UPLOADING DISPLAY
                <div className="flex-grow flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-teal-600 dark:text-[#10b981] animate-spin" />
                    <RotateCw className="w-5 h-5 text-teal-500 absolute animate-reverse-spin" />
                  </div>
                  <div>
                    <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-400 tracking-wider">Trình xử lý tải lên Backblaze</h4>
                    <p className="font-bold text-slate-800 dark:text-white mt-1.5 animate-pulse text-xs">{uploadStatusMsg}</p>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#111c18] rounded-full h-1.5 max-w-xs overflow-hidden relative border border-slate-200/50 dark:border-[#1c2d27]">
                    <div className="h-full bg-teal-500 rounded-full animate-marquee-progress w-2/5" />
                  </div>
                </div>
              ) : (
                // FORM INPUTS
                <div className="flex-grow overflow-y-auto pr-1 py-4 space-y-4 text-slate-800 dark:text-slate-100">
                  
                  {/* Photo upload box */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1.5">
                      {editingSample ? "Hình ảnh mẫu mã *" : "Hình ảnh mẫu mã (Hỗ trợ chọn nhiều) *"}
                    </label>

                    {/* If we are adding and have batch files */}
                    {editingSample === null && batchFiles.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto p-2 bg-slate-50 dark:bg-[#0a0f0d] rounded-xl border border-slate-200 dark:border-[#1c2d27]">
                          {batchFiles.map((file, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-[#1c2d27] group">
                              <img 
                                src={file.base64} 
                                alt={file.name} 
                                className="w-full h-full object-cover"
                              />
                              {/* Remove individual photo button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBatchFiles(prev => {
                                    const next = prev.filter((_, i) => i !== idx);
                                    // Update formData.photo and modelName to next first file if any
                                    if (next.length > 0) {
                                      setFormData(f => ({ ...f, photo: next[0].base64, modelName: f.modelName || next[0].name }));
                                    } else {
                                      setFormData(f => ({ ...f, photo: '' }));
                                    }
                                    return next;
                                  });
                                }}
                                className="absolute top-1 right-1 p-1 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xs cursor-pointer active:scale-90 transition"
                                title="Xóa ảnh này"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                              <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[8px] text-white font-mono px-1 truncate text-center">
                                {file.name}
                              </div>
                            </div>
                          ))}

                          {/* Add more inside grid button */}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border border-dashed border-slate-350 dark:border-[#1c2d27] hover:border-teal-500 hover:bg-teal-500/5 transition flex flex-col items-center justify-center text-slate-400 hover:text-teal-500 cursor-pointer"
                          >
                            <Plus className="w-5 h-5 mb-0.5" />
                            <span className="text-[9px] font-bold">Thêm ảnh</span>
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>🔥 Đã chọn <b>{batchFiles.length}</b> hình ảnh</span>
                          <button
                            type="button"
                            onClick={() => {
                              setBatchFiles([]);
                              setFormData(prev => ({ ...prev, photo: '' }));
                            }}
                            className="text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Xóa tất cả
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard single photo box */
                      <div 
                        ref={dragRef}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative aspect-square w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group bg-slate-50 dark:bg-[#0a0f0d] ${
                          isDragging ? 'border-teal-500 bg-teal-500/5' : 'border-slate-250 dark:border-[#1c2d27] hover:border-teal-500 hover:bg-slate-50/50 dark:hover:bg-[#111c18]/50'
                        }`}
                      >
                        {formData.photo ? (
                          <>
                            <img 
                              src={formData.photo} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition duration-150 flex flex-col items-center justify-center text-white text-[11px] font-bold">
                              <Upload className="w-5 h-5 mb-1" />
                              Thay đổi ảnh mẫu
                            </div>
                          </>
                        ) : (
                          <div className="p-6 text-center text-slate-450 dark:text-[#657f76]">
                            <Upload className="w-8 h-8 mx-auto opacity-55 mb-2 animate-bounce" />
                            <p className="font-bold text-xs">Nhấn để chụp hoặc tải ảnh lên</p>
                            <p className="text-[9px] text-slate-400 mt-1">
                              {editingSample ? "Hoặc kéo thả file ảnh mẫu vào ô này" : "Hoặc kéo thả một hoặc nhiều ảnh mẫu vào đây"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      multiple={editingSample === null}
                      capture={editingSample !== null ? "environment" : undefined}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">
                        {batchFiles.length > 0 ? "Tiền tố tên mẫu (Tùy chọn)" : "Mã mẫu / Tên mẫu *"}
                      </label>
                      <input 
                        type="text" 
                        value={formData.modelName}
                        onChange={e => setFormData(prev => ({ ...prev, modelName: e.target.value }))}
                        placeholder={batchFiles.length > 0 ? "Mặc định lấy tên file ảnh" : "Ví dụ: Váy hoa tulip"}
                        className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">Thư mục phân loại *</label>
                      <select 
                        value={formData.folder}
                        onChange={e => {
                          setFormData(prev => ({ ...prev, folder: e.target.value }));
                          if (e.target.value !== '__new__') {
                            setCustomFolderName('');
                          }
                        }}
                        className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27] font-bold"
                      >
                        {folders.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__new__" className="text-teal-600 dark:text-emerald-400 font-extrabold">+ Tạo thư mục mới...</option>
                      </select>
                    </div>
                  </div>

                  {formData.folder === '__new__' && (
                    <div className="animate-fade-in p-3 bg-teal-500/5 dark:bg-[#14b8a6]/5 border border-teal-500/20 dark:border-[#14b8a6]/20 rounded-xl">
                      <label className="block text-[10px] font-extrabold uppercase text-teal-600 dark:text-emerald-400 font-mono mb-1 flex items-center gap-1">
                        ✨ Tên thư mục mới *
                      </label>
                      <input 
                        type="text" 
                        value={customFolderName}
                        onChange={e => setCustomFolderName(e.target.value)}
                        placeholder="Nhập tên thư mục mới, ví dụ: Váy chống nắng, Áo len..."
                        className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27] font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">Khách hàng liên kết *</label>
                    <select 
                      value={formData.customerName || 'Khách hàng chung'}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, customerName: val }));
                        if (val !== '__new_customer__') {
                          setCustomCustomerInput('');
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27] font-bold text-indigo-650 dark:text-indigo-400"
                    >
                      {customerFolders.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__new_customer__" className="text-teal-600 dark:text-[#10b981] font-extrabold">+ Thêm khách hàng mới...</option>
                    </select>
                  </div>

                  {formData.customerName === '__new_customer__' && (
                    <div className="animate-fade-in p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                      <label className="block text-[10px] font-extrabold uppercase text-indigo-500 font-mono mb-1">
                        👤 Tên khách hàng mới *
                      </label>
                      <input 
                        type="text" 
                        value={customCustomerInput}
                        onChange={e => setCustomCustomerInput(e.target.value)}
                        placeholder="Nhập tên khách hàng mới, ví dụ: Khách C..."
                        className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-indigo-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27] font-bold"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">Giá dự kiến (đ)</label>
                      <input 
                        type="number" 
                        value={formData.price}
                        onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="Ví dụ: 125000"
                        className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-teal-600 focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">Chất liệu / Phụ liệu</label>
                      <input 
                        type="text" 
                        value={formData.material}
                        onChange={e => setFormData(prev => ({ ...prev, material: e.target.value }))}
                        placeholder="Ví dụ: Thun tăm, cúc gỗ"
                        className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 font-mono mb-1">Mô tả / Ghi chú mẫu mã</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Mô tả kỹ thuật may dệt, định lượng chỉ hoặc thông tin bổ sung..."
                      rows={2}
                      className="w-full px-3 py-2 border rounded-xl focus:outline-hidden focus:border-teal-500 dark:bg-[#0a0f0d] dark:border-[#1c2d27]"
                    />
                  </div>

                </div>
              )}

              {/* Status footer message */}
              {uploadProgress === 'success' && (
                <div className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-center font-bold rounded-xl animate-pulse text-[11px] mb-3">
                  🎉 {uploadStatusMsg}
                </div>
              )}
              {uploadProgress === 'error' && (
                <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-center font-bold rounded-xl text-[11px] mb-3">
                  ⚠️ {uploadStatusMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-150 dark:border-[#1c2d27] flex justify-end gap-2 shrink-0">
                <button 
                  onClick={() => setShowAddModal(false)}
                  disabled={uploadProgress !== 'idle' && uploadProgress !== 'success' && uploadProgress !== 'error'}
                  className="px-4 py-2 border bg-slate-50 hover:bg-slate-100 dark:bg-[#111c18] rounded-xl font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                {uploadProgress === 'idle' && (
                  <button 
                    onClick={handleSaveSample}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-emerald-600 text-white font-extrabold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    {editingSample ? 'Cập nhật mẫu' : 'Lưu mẫu thiết kế'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. Lightbox Detailed Viewer */}
      <AnimatePresence>
        {selectedSample && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="absolute inset-0" onClick={() => setSelectedSample(null)} />
            
            <motion.div 
              layoutId={`sample-card-${selectedSample.id}`}
              className="w-full max-w-2xl bg-white dark:bg-[#0e1613] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1c2d27] z-10 flex flex-col md:flex-row max-h-[85vh] overflow-hidden"
            >
              {/* Image side */}
              <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto bg-slate-950 flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 dark:border-[#1c2d27]">
                <img 
                  src={selectedSample.b2Url || selectedSample.localBase64 || ''} 
                  alt={selectedSample.modelName} 
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-contain transition-transform duration-300 ${
                    isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                  }`}
                  onClick={() => setIsZoomed(!isZoomed)}
                />

                <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                  <button 
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-950 transition shadow-xs cursor-pointer flex items-center justify-center"
                    title="Zoom ảnh"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setFullscreenSample(selectedSample)}
                    className="p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-950 transition shadow-xs cursor-pointer flex items-center justify-center"
                    title="Mở toàn màn hình"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Specs / Details side */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  {/* Title and category */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-150 dark:border-[#1c2d27]/70">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                        {selectedSample.folder}
                      </span>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
                        {selectedSample.modelName}
                      </h2>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedSample(null)}
                      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-[#1a2d25]"
                    >
                      <X className="w-5 h-5 text-slate-400 hover:text-slate-700" />
                    </button>
                  </div>

                  {/* Detail specs table */}
                  <div className="space-y-2.5 font-sans">
                    {(() => {
                      const rows: ({ label: string; value: React.ReactNode } | null)[] = [
                        selectedSample.price ? {
                          label: 'Giá ước tính:',
                          value: (
                            <span className="font-mono font-black text-teal-600 dark:text-[#10b981] text-xs">
                              {selectedSample.price.toLocaleString()}đ
                            </span>
                          )
                        } : null,
                        selectedSample.material ? {
                          label: 'Chất liệu:',
                          value: (
                            <span className="font-bold text-slate-800 dark:text-white">
                              {selectedSample.material}
                            </span>
                          )
                        } : null,
                        {
                          label: 'Nơi lưu trữ:',
                          value: (
                            <span className="font-mono font-bold text-[9px] text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              {selectedSample.b2Url ? '☁️ Backblaze B2' : '💾 Thiết bị (Offline)'}
                            </span>
                          )
                        },
                        {
                          label: 'Ngày tạo:',
                          value: (
                            <span className="text-slate-500 font-mono font-bold">
                              {new Date(selectedSample.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          )
                        }
                      ];

                      const activeRows = rows.filter((row): row is { label: string; value: React.ReactNode } => row !== null);

                      return activeRows.map((row, index) => (
                        <div 
                          key={row.label} 
                          className={`flex justify-between items-center text-[11px] py-1 ${
                            index > 0 ? 'border-t border-slate-100 dark:border-[#1c2d27]/40' : ''
                          }`}
                        >
                          <span className="text-slate-400 font-mono uppercase tracking-wider text-[9px]">{row.label}</span>
                          {row.value}
                        </div>
                      ));
                    })()}

                    {selectedSample.b2FilePath && (
                      <div className="pt-2">
                        <label className="block text-slate-400 font-mono uppercase tracking-wider text-[8px] mb-0.5">B2 Path / File ID:</label>
                        <code className="block p-1.5 rounded bg-slate-55 dark:bg-[#111c18] text-[8px] text-slate-500 dark:text-slate-400 font-mono truncate select-all">
                          {selectedSample.b2FilePath}
                        </code>
                      </div>
                    )}

                    {selectedSample.description && (
                      <div className="pt-2">
                        <label className="block text-slate-400 font-mono uppercase tracking-wider text-[9px] mb-1">Ghi chú thiết kế:</label>
                        <p className="p-3 bg-slate-50 dark:bg-[#111c18]/30 rounded-xl text-slate-650 dark:text-slate-300 italic text-[10.5px] leading-relaxed border border-slate-150 dark:border-[#1c2d27]/40">
                          "{selectedSample.description}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations footer buttons */}
                <div className="pt-6 border-t border-slate-150 dark:border-[#1c2d27] space-y-2 shrink-0">
                  <button 
                    onClick={() => handleOpenShareModal([selectedSample.id])}
                    className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Chia sẻ ảnh mẫu này
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => handleOpenEditModal(selectedSample, e)}
                      className="flex-1 py-2 border border-slate-200 dark:border-[#1c2d27] hover:bg-slate-50 dark:hover:bg-[#111c18] rounded-xl font-bold text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Sửa chi tiết
                    </button>

                    <button 
                      onClick={(e) => handleDeleteSample(selectedSample, e)}
                      className="py-2 px-3 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 rounded-xl font-bold transition cursor-pointer"
                      title="Xóa vĩnh viễn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedSample.b2Url && (
                    <a 
                      href={selectedSample.b2Url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-slate-100 hover:bg-slate-150 dark:bg-[#111c18] rounded-xl font-bold text-slate-800 dark:text-slate-200 transition flex items-center justify-center gap-1 text-[11px] text-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở liên kết ảnh gốc B2
                    </a>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. Immersive Full-screen Image Detail Modal */}
      <AnimatePresence>
        {fullscreenSample && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between"
          >
            {/* 1. Header Toolbar */}
            <div className="p-4 bg-slate-900/40 border-b border-white/5 flex items-center justify-between backdrop-blur-md z-10 shrink-0 select-none">
              <div className="text-left min-w-0 pr-4">
                <span className="text-[9px] font-extrabold uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400">
                  {fullscreenSample.folder}
                </span>
                <h3 className="text-xs font-black text-white mt-1 tracking-tight truncate max-w-sm sm:max-w-md">
                  {fullscreenSample.modelName}
                </h3>
              </div>

              {/* Action Cluster */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Zoom out button */}
                <button
                  disabled={fullscreenZoom <= 0.5}
                  onClick={() => setFullscreenZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-40 flex items-center justify-center"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                {/* Zoom text indicator */}
                <span className="text-[9px] font-mono text-slate-400 min-w-[32px] text-center">
                  {Math.round(fullscreenZoom * 100)}%
                </span>

                {/* Zoom in button */}
                <button
                  disabled={fullscreenZoom >= 4}
                  onClick={() => setFullscreenZoom(prev => Math.min(4, prev + 0.25))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-40 flex items-center justify-center"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                {/* Rotate button */}
                <button
                  onClick={() => setFullscreenRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center"
                  title="Xoay ảnh"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                {/* Reset Zoom & Rotation button */}
                {(fullscreenZoom !== 1 || fullscreenRotation !== 0) && (
                  <button
                    onClick={() => {
                      setFullscreenZoom(1);
                      setFullscreenRotation(0);
                    }}
                    className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 transition cursor-pointer"
                    title="Đặt lại zoom và xoay"
                  >
                    Reset
                  </button>
                )}

                <span className="h-4 w-px bg-white/10 mx-1" />

                {/* External link / original URL link */}
                {(fullscreenSample.b2Url || fullscreenSample.localBase64) && (
                  <a
                    href={fullscreenSample.b2Url || fullscreenSample.localBase64}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center"
                    title="Mở liên kết gốc"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Share Button */}
                <button
                  onClick={() => handleOpenShareModal([fullscreenSample.id])}
                  className="p-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-white transition cursor-pointer flex items-center justify-center gap-1 text-[10px] font-bold px-2.5"
                  title="Chia sẻ ảnh mẫu này"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    setFullscreenSample(null);
                    setFullscreenZoom(1);
                    setFullscreenRotation(0);
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition cursor-pointer flex items-center justify-center"
                  title="Đóng toàn màn hình (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Main Stage - holds the image & slide navigation */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
              {/* Overlay background clicks to close */}
              <div 
                className="absolute inset-0 z-0 cursor-zoom-out" 
                onClick={() => {
                  setFullscreenSample(null);
                  setFullscreenZoom(1);
                  setFullscreenRotation(0);
                }} 
              />

              {/* Prev Slide Navigation Button (Only if there are multiple images) */}
              {filteredSamples.length > 1 && (
                <button
                  onClick={handleFullscreenPrev}
                  className="absolute left-4 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-xs border border-white/5 flex items-center justify-center"
                  title="Ảnh trước (Arrow Left)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Dynamic Image Wrapper for Zoom and Rotation */}
              <motion.div
                key={fullscreenSample.id}
                layoutId={`fullscreen-img-${fullscreenSample.id}`}
                className="z-1 select-none pointer-events-none transition-transform duration-300 ease-out"
                style={{
                  transform: `scale(${fullscreenZoom}) rotate(${fullscreenRotation}deg)`
                }}
              >
                <img
                  src={fullscreenSample.b2Url || fullscreenSample.localBase64 || ''}
                  alt={fullscreenSample.modelName}
                  referrerPolicy="no-referrer"
                  className="max-h-[80vh] max-w-[85vw] object-contain shadow-2xl rounded-lg pointer-events-auto select-none"
                  draggable={false}
                />
              </motion.div>

              {/* Next Slide Navigation Button */}
              {filteredSamples.length > 1 && (
                <button
                  onClick={handleFullscreenNext}
                  className="absolute right-4 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-xs border border-white/5 flex items-center justify-center"
                  title="Ảnh sau (Arrow Right)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* 3. Footer Stats / Helpers */}
            <div className="p-3 bg-slate-900/40 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 shrink-0 z-10 select-none">
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <span>📂 <b>{fullscreenSample.folder}</b></span>
                {fullscreenSample.material && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-650" />
                    <span>Chất liệu: <b>{fullscreenSample.material}</b></span>
                  </>
                )}
                {fullscreenSample.price && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-650" />
                    <span className="text-teal-400 font-mono">Giá ước tính: <b>{fullscreenSample.price.toLocaleString()}đ</b></span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono text-[9px]">
                <span className="text-slate-500">Mẫu ID: {fullscreenSample.id}</span>
                <span className="text-slate-500">Dùng phím <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-white border border-white/10 select-none">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-white border border-white/10 select-none">→</kbd> để di chuyển, <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-white border border-white/10 select-none">Esc</kbd> để đóng</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* D. Share Modal Overlay */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="absolute inset-0" onClick={() => setShowShareModal(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-[#0e1613] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1c2d27] z-10 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-150 dark:border-[#1c2d27]/70 flex justify-between items-center bg-slate-50 dark:bg-[#111c18]/40 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                      CHIA SỂ HÌNH ẢNH MẪU
                    </h3>
                    <p className="text-[9px] text-slate-450 dark:text-slate-450 font-bold">
                      Bạn đã chọn <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs">{sharingIds.length}</span> ảnh mẫu thiết kế
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-[#1a2d25] transition"
                >
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-750" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Micro Thumbnail Grid of selected items */}
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 font-mono mb-1.5">Ảnh mẫu đã chọn ({sharingIds.length})</label>
                  <div className="flex flex-wrap gap-1.5 max-h-[90px] overflow-y-auto p-2 bg-slate-50 dark:bg-[#111c18]/25 rounded-xl border border-slate-150 dark:border-[#1c2d27]/40">
                    {samples.filter(s => sharingIds.includes(s.id)).map(sample => {
                      const imgSource = sample.b2Url || sample.localBase64;
                      return (
                        <div key={sample.id} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-[#1c2d27] bg-slate-100 group shadow-xs shrink-0" title={sample.modelName}>
                          {imgSource ? (
                            <img src={imgSource} alt={sample.modelName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400 m-auto absolute inset-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main Sharing Options Grid */}
                <div className="grid grid-cols-1 gap-3.5">
                  {/* Option 1: Copy links list */}
                  <button
                    onClick={handleCopyShareLinks}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500/50 dark:border-[#1c2d27] hover:bg-indigo-500/5 dark:hover:bg-indigo-950/10 transition-all group flex gap-3 cursor-pointer"
                  >
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center justify-center group-hover:scale-105 transition-all">
                      {copiedLinks ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="block text-[11px] font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
                        {copiedLinks ? 'ĐÃ SAO CHÉP LIÊN KẾT!' : 'SAO CHÉP LIÊN KẾT ẢNH'}
                      </span>
                      <span className="block text-[9.5px] text-slate-450 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Sao chép danh sách link ảnh đám mây để gửi nhanh trực tiếp vào tin nhắn cho khách hàng trên Zalo, Messenger,...
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Download files directly */}
                  <button
                    onClick={handleDownloadShareImages}
                    disabled={sharingStatus === 'processing'}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-teal-500/50 dark:border-[#1c2d27] hover:bg-teal-500/5 dark:hover:bg-teal-950/10 transition-all group flex gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 flex items-center justify-center group-hover:scale-105 transition-all">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-extrabold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-[#10b981] transition-colors uppercase tracking-tight">
                        TẢI ẢNH VỀ MÁY
                      </span>
                      <span className="block text-[9.5px] text-slate-450 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Tải tất cả file ảnh mẫu đã chọn về thiết bị của bạn. Rất thích hợp để kéo thả đăng bài hoặc gửi album trên máy tính.
                      </span>
                    </div>
                  </button>

                  {/* Option 3: System / Native Share */}
                  <button
                    onClick={handleSystemShare}
                    disabled={sharingStatus === 'processing'}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-pink-500/50 dark:border-[#1c2d27] hover:bg-pink-500/5 dark:hover:bg-pink-950/10 transition-all group flex gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 shrink-0 flex items-center justify-center group-hover:scale-105 transition-all">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-extrabold text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors uppercase tracking-tight">
                        CHIA SẺ HỆ THỐNG
                      </span>
                      <span className="block text-[9.5px] text-slate-450 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Sử dụng tính năng chia sẻ gốc của Điện thoại / Máy tính để chia sẻ trực tiếp qua ứng dụng Zalo, Messenger, Gmail...
                      </span>
                    </div>
                  </button>
                </div>

                {/* Progress Status Message */}
                {sharingStatus === 'processing' && (
                  <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-center font-bold rounded-xl flex items-center justify-center gap-2 text-[10px] animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{shareProgressMsg}</span>
                  </div>
                )}
                {sharingStatus === 'success' && (
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-center font-bold rounded-xl text-[10.5px]">
                    🎉 {shareProgressMsg}
                  </div>
                )}
                {sharingStatus === 'error' && (
                  <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-center font-bold rounded-xl text-[10.5px]">
                    ⚠️ {shareProgressMsg}
                  </div>
                )}

                {/* Tips & Guides Section */}
                <div className="p-3 bg-slate-50 dark:bg-[#111c18]/15 rounded-xl border border-slate-150 dark:border-[#1c2d27]/40 text-[9.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 flex items-center gap-1">
                    💡 HƯỚNG DẪN GỬI CHAT CHUYÊN NGHIỆP:
                  </span>
                  <ul className="list-disc pl-3.5 space-y-1 font-bold">
                    <li><b>Gửi qua Zalo trên máy tính:</b> Bấm <b>Tải ảnh về máy</b> rồi kéo thả các tệp ảnh vừa tải vào ô chat Zalo. Đây là cách nhanh nhất để gửi ảnh giữ nguyên chất lượng HD gốc.</li>
                    <li><b>Gửi qua Điện thoại:</b> Bấm <b>Chia sẻ Hệ thống</b> và chọn ứng dụng Zalo/Messenger, sau đó chọn khách hàng hoặc nhóm muốn gửi.</li>
                    <li><b>Gửi bằng liên kết ảnh:</b> Chọn <b>Sao chép liên kết</b> rồi dán trực tiếp (Ctrl+V) vào ô chat của khách hàng, giúp tiết kiệm dung lượng thiết bị của họ.</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-150 dark:border-[#1c2d27] bg-slate-50 dark:bg-[#111c18]/40 rounded-b-2xl flex justify-end shrink-0">
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-1.5 bg-slate-200 dark:bg-[#1c2d27] hover:bg-slate-300 hover:text-slate-900 rounded-xl font-extrabold text-[11px] transition cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Selector Dialog Overlay */}
      <AnimatePresence>
        {showCustomerDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setShowCustomerDialog(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md h-[75vh] flex flex-col bg-white dark:bg-[#0c1310] border border-slate-200 dark:border-[#1c2d27] rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-150 dark:border-[#1c2d27]/70 flex items-center justify-between bg-slate-50/50 dark:bg-[#111c18]/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-[#818cf8] rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Danh sách Khách hàng</h3>
                    <p className="text-[10px] text-slate-450 dark:text-[#556b62]">
                      Chọn một khách hàng để lọc kho mẫu dệt
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerDialog(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2d25] text-slate-400 hover:text-slate-600 dark:text-[#556b62] dark:hover:text-[#a3b8cc] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Add Customer Bar */}
              <div className="p-4 border-b border-dashed border-slate-150 dark:border-[#1c2d27]/60 space-y-3 shrink-0 bg-slate-50/20 dark:bg-[#111c18]/5">
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm khách hàng..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-[#1c2d27]/70 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 dark:bg-[#0e1613]"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-455 text-xs">🔍</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Thêm khách hàng mới..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomerFolder()}
                    className="flex-1 px-3 py-1.5 border border-dashed border-slate-200 dark:border-[#1c2d27]/70 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 dark:bg-[#0e1613]"
                  />
                  <button
                    onClick={handleAddCustomerFolder}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tạo
                  </button>
                </div>
              </div>

              {/* Scrollable Customer List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCurrentLevel('customers');
                    setShowCustomerDialog(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-2xl font-bold flex justify-between items-center transition cursor-pointer border ${
                    selectedCustomer === null
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-[#818cf8]'
                      : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/40 border-slate-100 dark:border-transparent text-slate-600 dark:text-slate-350'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    👥 Tất cả khách hàng
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#111c18] text-slate-500">
                    {samples.length} mẫu
                  </span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-[#1c2d27]/40 my-2" />

                {(() => {
                  const filtered = customerFolders.filter(f => 
                    f.toLowerCase().includes(customerSearchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400 dark:text-[#556b62] text-xs font-bold">
                        Không tìm thấy khách hàng nào khớp
                      </div>
                    );
                  }

                  return filtered.map(folder => {
                    const count = samples.filter(s => {
                      const cName = s.customerName || 'Khách hàng chung';
                      return cName.toLowerCase().trim() === folder.toLowerCase().trim();
                    }).length;

                    const isSelected = selectedCustomer?.toLowerCase().trim() === folder.toLowerCase().trim();

                    return (
                      <button
                        key={folder}
                        onClick={() => {
                          enterCustomer(folder);
                          setShowCustomerDialog(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-2xl font-bold flex justify-between items-center transition cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-[#818cf8]'
                            : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/40 border-slate-100 dark:border-transparent text-slate-600 dark:text-slate-350'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          👤 {folder}
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#111c18] text-slate-450 font-bold shrink-0">
                          {count} mẫu
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-150 dark:border-[#1c2d27] bg-slate-50 dark:bg-[#111c18]/30 flex justify-end shrink-0">
                <button
                  onClick={() => setShowCustomerDialog(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#1c2d27] dark:hover:bg-[#253e33] rounded-xl font-extrabold text-xs transition cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Folder Selector Dialog Overlay */}
      <AnimatePresence>
        {showFolderDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setShowFolderDialog(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md h-[75vh] flex flex-col bg-white dark:bg-[#0c1310] border border-slate-200 dark:border-[#1c2d27] rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-150 dark:border-[#1c2d27]/70 flex items-center justify-between bg-slate-50/50 dark:bg-[#111c18]/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-[#10b981] rounded-xl">
                    <Folder className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Nhóm phân loại mẫu</h3>
                    <p className="text-[10px] text-slate-450 dark:text-[#556b62]">
                      Chọn hoặc quản lý nhóm phân loại mẫu dệt
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Delete Mode Toggle inside modal */}
                  <button 
                    onClick={() => setIsDeleteFolderMode(!isDeleteFolderMode)}
                    className={`p-1.5 rounded-lg transition border cursor-pointer flex items-center justify-center ${
                      isDeleteFolderMode 
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 shadow-xs scale-105' 
                        : 'bg-slate-50 dark:bg-[#111c18] hover:bg-slate-100 dark:hover:bg-[#1a2d25] border-slate-200/50 dark:border-[#1c2d27]/50 text-slate-400 hover:text-rose-500'
                    }`}
                    title={isDeleteFolderMode ? "Tắt chế độ xóa thư mục" : "Bật chế độ xóa thư mục"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowFolderDialog(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2d25] text-slate-400 hover:text-slate-600 dark:text-[#556b62] dark:hover:text-[#a3b8cc] transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add Folder Section inside Modal */}
              <div className="p-4 border-b border-dashed border-slate-150 dark:border-[#1c2d27]/60 space-y-2 shrink-0 bg-slate-50/20 dark:bg-[#111c18]/5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Thêm nhóm mới (ví dụ: Áo thun, Đầm váy...)"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                    className="flex-1 px-3 py-1.5 border border-dashed border-slate-200 dark:border-[#1c2d27]/70 rounded-xl text-xs focus:outline-hidden focus:border-teal-500 dark:bg-[#0e1613]"
                  />
                  <button
                    onClick={handleAddFolder}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm
                  </button>
                </div>
              </div>

              {/* Scrollable Folder List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                <button
                  onClick={() => {
                    setSelectedFolder('all');
                    setShowFolderDialog(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-2xl font-bold flex justify-between items-center transition cursor-pointer border ${
                    selectedFolder === 'all'
                      ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-950/20 dark:border-teal-900/40 dark:text-[#10b981]'
                      : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/40 border-slate-100 dark:border-transparent text-slate-600 dark:text-slate-350'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📁</span> Tất cả mẫu thiết kế
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#111c18] text-slate-500">
                    {samples.length} mẫu
                  </span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-[#1c2d27]/40 my-2" />

                {folders.map(folder => {
                  const count = folderStats[folder] || 0;
                  const isSelected = selectedFolder === folder;

                  return (
                    <div
                      key={folder}
                      className={`w-full rounded-2xl flex justify-between items-center transition border ${
                        isSelected
                          ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-950/20 dark:border-teal-900/40 dark:text-[#10b981]'
                          : isDeleteFolderMode && folder !== 'Chưa phân loại'
                            ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-600'
                            : 'bg-slate-50/50 hover:bg-slate-100 dark:bg-[#111c18]/20 dark:hover:bg-[#111c18]/40 border-slate-100 dark:border-transparent text-slate-600 dark:text-slate-350'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedFolder(folder);
                          setShowFolderDialog(false);
                        }}
                        className="flex-1 text-left px-4 py-2.5 font-bold flex justify-between items-center cursor-pointer min-w-0"
                      >
                        <span className="truncate flex items-center gap-2">
                          <span>📂</span> {folder}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 pr-3 shrink-0">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-[#111c18] text-slate-450 font-bold">
                          {count}
                        </span>
                        {folder !== 'Chưa phân loại' && (
                          <button 
                            onClick={(e) => handleDeleteFolder(folder, e)}
                            className={`p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                              isDeleteFolderMode 
                                ? 'opacity-100 bg-rose-500/10 ring-1 ring-rose-500/30' 
                                : 'opacity-30 hover:opacity-100'
                            }`}
                            title="Xóa thư mục"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-150 dark:border-[#1c2d27] bg-slate-50 dark:bg-[#111c18]/30 flex justify-end shrink-0">
                <button
                  onClick={() => setShowFolderDialog(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#1c2d27] dark:hover:bg-[#253e33] rounded-xl font-extrabold text-xs transition cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google Drive Storage Manager Dialog Overlay */}
      <AnimatePresence>
        {showGDriveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setShowGDriveModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg h-[80vh] flex flex-col bg-white dark:bg-[#0c1310] border border-slate-200 dark:border-[#1c2d27] rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-150 dark:border-[#1c2d27]/70 flex items-center justify-between bg-slate-50/50 dark:bg-[#111c18]/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-[#60a5fa] rounded-xl">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Cấu hình Google Drive</h3>
                    <p className="text-[10px] text-slate-450 dark:text-[#556b62]">
                      Quản lý tài khoản và thư mục lưu trữ ảnh mẫu dệt
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGDriveModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2d25] text-slate-400 hover:text-slate-600 dark:text-[#556b62] dark:hover:text-[#a3b8cc] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1 text-left">
                {/* Description and storage explanation */}
                <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <p className="font-extrabold text-blue-800 dark:text-[#60a5fa] mb-1 font-sans">
                    💡 Hướng dẫn xoay vòng tài khoản (Khi đầy bộ nhớ):
                  </p>
                  <p>
                    Khi tài khoản hiện tại đầy dung lượng (15 GB miễn phí), bạn chỉ cần nhấn <b>"Khóa tài khoản"</b>. 
                    Sau đó bấm <b>"Thêm tài khoản Google Drive mới"</b> để đăng nhập tài khoản Google thứ 2, thứ 3,... 
                    Hệ thống sẽ tạo thư mục mới và tự động sử dụng tài khoản mới để lưu ảnh tiếp theo.
                  </p>
                  <p className="mt-1">
                    Các ảnh đã lưu trên tài khoản cũ <b>vẫn hiển thị và tải xuống bình thường</b> vì chúng đã được chia sẻ công khai!
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9.5px] font-extrabold uppercase text-slate-400 dark:text-[#657f76] tracking-wider">
                      Danh sách tài khoản ({gdriveAccounts.length})
                    </span>
                  </div>

                  {gdriveAccounts.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-[#1c2d27]/60 rounded-2xl">
                      <Cloud className="w-8 h-8 text-slate-350 dark:text-[#253e33] mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Chưa có tài khoản Google Drive nào được liên kết</p>
                      <p className="text-[10px] text-slate-400 dark:text-[#556b62] mt-0.5">Bấm nút bên dưới để đăng nhập và bắt đầu sử dụng</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {gdriveAccounts.map((acc) => (
                        <div 
                          key={acc.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                            acc.isActive 
                              ? 'bg-emerald-50/20 dark:bg-[#111c18]/15 border-emerald-500/30 dark:border-emerald-500/30' 
                              : acc.isLocked
                                ? 'bg-amber-50/10 dark:bg-amber-950/5 border-amber-500/20 dark:border-amber-900/30 opacity-75'
                                : 'bg-slate-50/50 dark:bg-[#111c18]/5 border-slate-150 dark:border-[#1c2d27]/40'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">{acc.email}</span>
                                {acc.isActive && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[8px] font-black uppercase tracking-wider shrink-0">
                                    Đang hoạt động
                                  </span>
                                )}
                                {acc.isLocked && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[8px] font-black uppercase tracking-wider shrink-0">
                                    Đã khóa (Chỉ đọc)
                                  </span>
                                )}
                              </div>
                              <div className="text-[9.5px] text-slate-400 dark:text-[#556b62] font-mono flex items-center gap-1">
                                <span>📁 Thư mục:</span>
                                <span className="font-bold underline text-blue-500 truncate max-w-[150px]">{acc.folderName}</span>
                                <span className="text-slate-300 dark:text-[#1c2d27]">|</span>
                                <span className="shrink-0">ID: {acc.folderId.substring(0, 8)}...</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                              {!acc.isActive && !acc.isLocked && (
                                <button
                                  onClick={() => handleSetActiveGDriveAccount(acc.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] tracking-wide transition cursor-pointer"
                                >
                                  Sử dụng tải lên
                                </button>
                              )}

                              <button
                                onClick={() => handleRefreshGDriveQuota(acc)}
                                disabled={refreshingQuotaId === acc.id}
                                className="p-1.5 rounded-lg transition-all border bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2d25] dark:hover:bg-[#253e33] border-slate-200 dark:border-[#1c2d27] text-slate-500 dark:text-[#a3b8cc] cursor-pointer"
                                title="Cập nhật dung lượng bộ nhớ"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshingQuotaId === acc.id ? 'animate-spin' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleToggleLockGDriveAccount(acc.id, acc.isLocked)}
                                className={`p-1.5 rounded-lg transition-all border cursor-pointer ${
                                  acc.isLocked
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2d25] dark:hover:bg-[#253e33] border-slate-200 dark:border-[#1c2d27] text-slate-500 dark:text-[#a3b8cc]'
                                }`}
                                title={acc.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản (Chỉ đọc)'}
                              >
                                {acc.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => handleUnlinkGDriveAccount(acc.id, acc.email)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                title="Hủy liên kết tài khoản"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Storage & Limits Section */}
                          <div className="pt-2 border-t border-dashed border-slate-200 dark:border-[#1c2d27] space-y-2 text-xs">
                            {/* Storage usage display */}
                            <div className="flex justify-between items-center text-[10px] text-slate-550 dark:text-[#657f76]">
                              <span className="font-bold uppercase tracking-wider font-sans">
                                Dung lượng bộ nhớ:
                              </span>
                              <span>
                                {acc.storageUsage !== undefined && acc.storageLimit !== undefined ? (
                                  <>
                                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                      {(acc.storageUsage / (1024 * 1024 * 1024)).toFixed(2)} GB
                                    </span>
                                    <span> / </span>
                                    <span>
                                      {(acc.storageLimit / (1024 * 1024 * 1024)).toFixed(1)} GB
                                    </span>
                                    <span className="font-bold ml-1.5 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900">
                                      {((acc.storageUsage / acc.storageLimit) * 100).toFixed(1)}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="italic text-slate-400">Chưa tải dữ liệu bộ nhớ</span>
                                )}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            {acc.storageUsage !== undefined && acc.storageLimit !== undefined && (
                              <div className="w-full bg-slate-100 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    (acc.storageUsage / (1024 * 1024 * 1024)) >= (acc.warningThresholdGb ?? 14)
                                      ? 'bg-rose-500' 
                                      : (acc.storageUsage / acc.storageLimit) >= 0.8
                                        ? 'bg-amber-500' 
                                        : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (acc.storageUsage / acc.storageLimit) * 100)}%` }}
                                />
                              </div>
                            )}

                            {/* Warning threshold settings panel */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5">
                              {/* Warning limit in GB */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#556b62]">
                                  Mức cảnh báo bộ nhớ (GB)
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={acc.warningThresholdGb ?? 14}
                                    onChange={(e) => {
                                      const val = Math.max(1, Number(e.target.value));
                                      handleUpdateGDriveWarningSettings(acc.id, val, !!acc.stopUploadOnWarning);
                                    }}
                                    className="w-full text-[11px] border border-slate-200 dark:border-[#1c2d27] rounded-lg px-2 py-1 bg-slate-50/50 dark:bg-[#111c18]/20 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">GB</span>
                                </div>
                              </div>

                              {/* Stop updates checkbox */}
                              <div className="flex items-center gap-2 sm:pt-4">
                                <input 
                                  type="checkbox"
                                  id={`stop_${acc.id}`}
                                  checked={!!acc.stopUploadOnWarning}
                                  onChange={(e) => {
                                    handleUpdateGDriveWarningSettings(acc.id, acc.warningThresholdGb ?? 14, e.target.checked);
                                  }}
                                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 dark:bg-[#111c18]/20 border-slate-300 dark:border-[#1c2d27] cursor-pointer"
                                />
                                <label 
                                  htmlFor={`stop_${acc.id}`}
                                  className="text-[10px] font-medium text-slate-650 dark:text-[#8ba39a] leading-tight cursor-pointer select-none"
                                >
                                  Ngưng tải lên khi vượt ngưỡng cảnh báo
                                </label>
                              </div>
                            </div>

                            {/* Display visual warning if exceeded */}
                            {acc.storageUsage !== undefined && acc.storageLimit !== undefined && (acc.storageUsage / (1024 * 1024 * 1024)) >= (acc.warningThresholdGb ?? 14) && (
                              <div className={`p-2 rounded-xl text-[10px] leading-snug flex items-start gap-1.5 ${
                                acc.stopUploadOnWarning 
                                  ? 'bg-rose-500/10 text-rose-650 dark:text-rose-400 border border-rose-500/20' 
                                  : 'bg-amber-500/10 text-amber-650 dark:text-amber-400 border border-amber-500/20'
                              }`}>
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Cảnh báo: </span>
                                  <span>Dung lượng đã vượt mức {(acc.warningThresholdGb ?? 14)} GB.</span>
                                  {acc.stopUploadOnWarning ? (
                                    <span className="font-extrabold block mt-0.5">⚠️ ĐÃ KHÓA TẢI LÊN cho tài khoản này!</span>
                                  ) : (
                                    <span className="block mt-0.5">Bạn nên khóa tài khoản này và liên kết tài khoản mới.</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-150 dark:border-[#1c2d27] bg-slate-50 dark:bg-[#111c18]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 rounded-b-3xl">
                <button
                  onClick={handleLinkNewGDriveAccount}
                  disabled={linkingGDrive}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {linkingGDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang liên kết...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 font-black" />
                      <span>Thêm tài khoản Google Drive mới</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setShowGDriveModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-[#1c2d27] dark:hover:bg-[#253e33] rounded-xl font-extrabold text-xs transition cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
