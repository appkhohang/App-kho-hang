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
  Maximize2, ChevronLeft, ZoomOut, LayoutGrid, Square, SquareCheck
} from 'lucide-react';
import { ModelSample, B2Config } from '../types';
import { db, getNamespaceCollection, isUsingCustomFirebase, uploadImageToFirebase, deleteImageFromFirebase } from '../utils/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { B2Service, base64ToBlob } from '../utils/b2Service';
import { compressBase64Image } from '../utils/imageUtils';
import { useAndroidBack } from '../hooks/useAndroidBack';

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
}

export default function ModelGalleryTab({ 
  resolvedTheme = 'light',
  isQuickEditMode,
  onChangeQuickEditMode
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

  // B2 Storage metrics & warnings
  const [b2StorageUsed, setB2StorageUsed] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_b2_storage_used') || '0');
  });
  const [b2FileCount, setB2FileCount] = useState<number>(() => {
    return Number(localStorage.getItem('xuongan_b2_file_count') || '0');
  });
  const [loadingStorageInfo, setLoadingStorageInfo] = useState<boolean>(false);

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
    photo: ''
  });
  const [customFolderName, setCustomFolderName] = useState('');

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

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Android hardware back button support
  useAndroidBack(selectedSample !== null, () => setSelectedSample(null));
  useAndroidBack(showAddModal, () => setShowAddModal(false));
  useAndroidBack(showConfig, () => setShowConfig(false));

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

  // Sync folders to local storage
  useEffect(() => {
    localStorage.setItem('xuongan_model_folders', JSON.stringify(folders));
  }, [folders]);

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
      modelName: '',
      folder: selectedFolder !== 'all' ? selectedFolder : folders[0] || 'Chưa phân loại',
      price: '',
      material: '',
      description: '',
      photo: ''
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
      photo: sample.b2Url || sample.localBase64 || ''
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
            const isCustom = isUsingCustomFirebase;
            setUploadStatusMsg(`[${stepNum}/${totalSteps}] Đang tải ảnh trực tiếp lên ${isCustom ? 'Firebase 2' : 'Firebase 1'} Cloud Storage...`);
            
            const cleanFileName = finalModelName.replace(/[^a-zA-Z0-9-_.]/g, '_');
            const uploadResult = await uploadImageToFirebase(
              compressedBase64,
              `${cleanFileName}_${Date.now()}.jpg`
            );

            finalB2Url = uploadResult.fileUrl;
            finalB2FileId = 'firebase_storage'; // Marker for firebase storage deletion
            finalB2FilePath = uploadResult.filePath;
            
            // Store highly compressed thumbnail locally
            try {
              finalLocalBase64 = await compressBase64Image(compressedBase64, 150, 150, 0.5);
            } catch {
              finalLocalBase64 = '';
            }

            // Clean up old Firebase Storage file if editing and a new photo was uploaded
            if (editingSample && editingSample.b2FilePath && editingSample.b2FileId === 'firebase_storage' && i === 0) {
              deleteImageFromFirebase(editingSample.b2FilePath).catch(err => {
                console.warn('Could not clean up old Firebase Storage file version:', err);
              });
            }
          } catch (uploadErr: any) {
            console.error('Firebase Storage Upload failure, falling back to database-only storage:', uploadErr);
            if (totalSteps === 1) {
              alert(`⚠️ Không thể tải lên Firebase Storage: ${uploadErr.message}. Ảnh mẫu sẽ tạm thời được lưu trữ ngoại tuyến trên thiết bị.`);
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
      if (sample.b2FilePath) {
        if (sample.b2FileId === 'firebase_storage') {
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
      
      // 1. Delete on Firebase Storage or Backblaze B2 for all selected samples
      for (const sample of selectedSamples) {
        if (sample.b2FilePath) {
          if (sample.b2FileId === 'firebase_storage') {
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

  // --- Filtering & Sorting ---
  const filteredSamples = useMemo(() => {
    const seen = new Set<string>();
    return samples.filter(sample => {
      if (!sample || !sample.id || seen.has(sample.id)) return false;
      seen.add(sample.id);
      const matchFolder = selectedFolder === 'all' || sample.folder === selectedFolder;
      const matchSearch = sample.modelName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (sample.description && sample.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (sample.material && sample.material.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchFolder && matchSearch;
    });
  }, [samples, selectedFolder, searchTerm]);

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
              Lưu trữ mẫu rập dệt, catalog, ảnh thợ may dệt trực tiếp lên <span className="font-bold text-indigo-600 dark:text-indigo-450">Firebase Cloud Storage</span> và đồng bộ thời gian thực.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Lưu trữ: {isUsingCustomFirebase ? 'Firebase 2 (Riêng)' : 'Firebase 1 (Mặc định)'}
          </div>

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
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1310] border border-slate-200/60 dark:border-[#1c2d27]/60 shadow-xs space-y-3.5">
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-[#1c2d27]/50 pb-2">
              <span className="font-extrabold uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500" />
                Thư mục mẫu
              </span>
              <div className="flex items-center gap-1">
                {/* Delete Folder Mode Toggle */}
                <button 
                  onClick={() => setIsDeleteFolderMode(!isDeleteFolderMode)}
                  className={`p-1.5 rounded-lg transition border cursor-pointer flex items-center justify-center ${
                    isDeleteFolderMode 
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 shadow-xs' 
                      : 'bg-slate-50 dark:bg-[#111c18] hover:bg-slate-100 dark:hover:bg-[#1a2d25] border-slate-250/50 dark:border-[#1c2d27]/50 text-slate-500 dark:text-slate-400'
                  }`}
                  title={isDeleteFolderMode ? "Tắt chế độ xóa thư mục" : "Bật chế độ xóa thư mục"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Add Folder Button */}
                <button 
                  onClick={() => setShowAddFolder(!showAddFolder)}
                  className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#111c18] hover:bg-slate-100 dark:hover:bg-[#1a2d25] transition border border-slate-250/50 dark:border-[#1c2d27]/50 text-teal-600 dark:text-[#10b981] cursor-pointer flex items-center justify-center"
                  title="Thêm thư mục mới"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline create folder */}
            <AnimatePresence>
              {showAddFolder && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 pb-2 border-b border-dashed border-slate-200 dark:border-[#1c2d27]"
                >
                  <input 
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Nhập tên thư mục mới..."
                    onKeyDown={e => e.key === 'Enter' && handleAddFolder()}
                    className="w-full px-2.5 py-1.5 border rounded-lg focus:outline-hidden focus:border-teal-500 text-[11px] dark:bg-[#0e1613] dark:border-[#1c2d27]"
                  />
                  <div className="flex justify-end gap-1.5 text-[10px]">
                    <button 
                      onClick={() => setShowAddFolder(false)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-[#111c18] rounded-md font-bold text-slate-500 hover:bg-slate-150"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleAddFolder}
                      className="px-3 py-1 bg-teal-600 text-white rounded-md font-extrabold hover:bg-teal-700"
                    >
                      Thêm
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedFolder('all')}
                className={`w-full text-left px-3 py-2 rounded-xl font-bold flex justify-between items-center transition cursor-pointer ${
                  selectedFolder === 'all' 
                    ? 'bg-teal-500/10 text-teal-600 dark:text-[#10b981]' 
                    : 'hover:bg-slate-50 dark:hover:bg-[#111c18]/50'
                }`}
              >
                <span>📁 Tất cả mẫu thiết kế</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#111c18] text-slate-500">
                  {samples.length}
                </span>
              </button>

              {folders.map(folder => {
                const count = folderStats[folder] || 0;
                return (
                  <div 
                    key={folder}
                    className={`group w-full rounded-xl flex justify-between items-center transition ${
                      selectedFolder === folder 
                        ? 'bg-teal-500/10 text-teal-600 dark:text-[#10b981]' 
                        : isDeleteFolderMode && folder !== 'Chưa phân loại'
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-[#111c18]/50'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedFolder(folder)}
                      className="flex-1 text-left px-3 py-2 font-bold flex justify-between items-center cursor-pointer min-w-0"
                    >
                      <span className="truncate">📂 {folder}</span>
                    </button>
                    
                    <div className="flex items-center gap-1 pr-2 shrink-0">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#111c18] text-slate-500">
                        {count}
                      </span>
                      {folder !== 'Chưa phân loại' && (
                        <button 
                          onClick={(e) => handleDeleteFolder(folder, e)}
                          className={`p-1 rounded-md text-rose-500 hover:bg-rose-500/15 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer ${
                            isDeleteFolderMode 
                              ? 'opacity-100 bg-rose-500/10 scale-110 ring-1 ring-rose-500/30' 
                              : 'opacity-0 group-hover:opacity-100'
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

          {/* Grid display */}
          {filteredSamples.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-[#1c2d27] rounded-3xl p-10 bg-white dark:bg-[#0c1310]/50">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111c18] flex items-center justify-center mx-auto text-slate-400 mb-4 animate-pulse">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-700 dark:text-slate-300">Không tìm thấy ảnh mẫu</h3>
              <p className="text-[10px] text-slate-400 dark:text-[#556b62] mt-1 max-w-xs mx-auto">
                Chưa có ảnh mẫu nào được lưu trữ trong nhóm này hoặc không khớp với từ khóa tìm kiếm. Sử dụng nút dấu cộng (+) ở góc dưới bên phải màn hình để thêm mẫu mới.
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
          )}

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

    </div>
  );
}
