/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Scissors, Users, Package, Plus, Trash2, Edit, Check, Calendar, 
  AlertTriangle, Eye, Layers, DollarSign, Archive, RefreshCw, FileText, 
  ChevronRight, AlertCircle, ShoppingBag, TrendingUp, CheckSquare, Square, X,
  FileSpreadsheet, Settings, ArrowUp, ArrowDown, PlusCircle, ListOrdered, Tag, Search
} from 'lucide-react';
import { 
  ModelOperationBreakdown, Worker, WorkerJob, RawMaterial, 
  ModelMaterialRecipe, ProductionBatch, MaterialReimport, AppSettings, LaborPayment, TaskType 
} from '../types';
import { formatVietnameseDate, getCurrentDateStr, getVietnameseWeekKey } from '../utils/dateUtils';
import { useAndroidBack } from '../hooks/useAndroidBack';

interface ProductionTabProps {
  operationBreakdowns: ModelOperationBreakdown[];
  setOperationBreakdowns: React.Dispatch<React.SetStateAction<ModelOperationBreakdown[]>>;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  tasks: TaskType[];
  setTasks: React.Dispatch<React.SetStateAction<TaskType[]>>;
  workerJobs: WorkerJob[];
  setWorkerJobs: React.Dispatch<React.SetStateAction<WorkerJob[]>>;
  rawMaterials: RawMaterial[];
  setRawMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  materialRecipes: ModelMaterialRecipe[];
  setMaterialRecipes: React.Dispatch<React.SetStateAction<ModelMaterialRecipe[]>>;
  productionBatches: ProductionBatch[];
  setProductionBatches: React.Dispatch<React.SetStateAction<ProductionBatch[]>>;
  materialReimports: MaterialReimport[];
  setMaterialReimports: React.Dispatch<React.SetStateAction<MaterialReimport[]>>;
  materialLogs: any[];
  setMaterialLogs: React.Dispatch<React.SetStateAction<any[]>>;
  authState: any;
  laborPayments: LaborPayment[];
  setLaborPayments: React.Dispatch<React.SetStateAction<LaborPayment[]>>;
  settings: AppSettings;
  userRole?: 'admin' | 'staff' | 'viewer';
  initialSubTab?: 'breakdown' | 'materials';
  onSubTabChange?: (tab: 'breakdown' | 'materials') => void;
}

export default function ProductionTab({
  operationBreakdowns,
  setOperationBreakdowns: rawSetOperationBreakdowns,
  workers,
  setWorkers: rawSetWorkers,
  tasks,
  setTasks: rawSetTasks,
  workerJobs,
  setWorkerJobs: rawSetWorkerJobs,
  rawMaterials,
  setRawMaterials: rawSetRawMaterials,
  materialRecipes,
  setMaterialRecipes: rawSetMaterialRecipes,
  productionBatches,
  setProductionBatches: rawSetProductionBatches,
  materialReimports,
  setMaterialReimports: rawSetMaterialReimports,
  materialLogs,
  setMaterialLogs: rawSetMaterialLogs,
  authState,
  laborPayments,
  setLaborPayments: rawSetLaborPayments,
  settings,
  userRole = 'viewer',
  initialSubTab,
  onSubTabChange
}: ProductionTabProps) {
  const isViewer = false;

  // Intercept state setters for complete read-only safety
  const guard = <T,>(originalSetter: React.Dispatch<React.SetStateAction<T>>) => {
    return (updater: React.SetStateAction<T>) => {
      if (isViewer) {
        alert("⚠️ Thao tác bị khước từ: Tài khoản của bạn là CHỈ XEM, không được sửa đổi sổ sách sản xuất này.");
        return;
      }
      originalSetter(updater);
    };
  };

  const setOperationBreakdowns = guard(rawSetOperationBreakdowns);
  const setWorkers = guard(rawSetWorkers);
  const setTasks = guard(rawSetTasks);
  const setWorkerJobs = guard(rawSetWorkerJobs);
  const setRawMaterials = guard(rawSetRawMaterials);
  const setMaterialRecipes = guard(rawSetMaterialRecipes);
  const setProductionBatches = guard(rawSetProductionBatches);
  const setMaterialReimports = guard(rawSetMaterialReimports);
  const setMaterialLogs = guard(rawSetMaterialLogs);
  const setLaborPayments = guard(rawSetLaborPayments);

  // Current active sub-tab inside Quality Management
  const [subTab, setSubTab] = useState<'breakdown' | 'materials'>(initialSubTab || 'breakdown');
  const [materialSubTab, setMaterialSubTab] = useState<'inventory' | 'fluctuation'>('inventory');
  const [fluctSearch, setFluctSearch] = useState('');
  const [fluctMatFilter, setFluctMatFilter] = useState('');
  const [fluctTypeFilter, setFluctTypeFilter] = useState<'all' | 'nhap' | 'xuat'>('all');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSetSubTab = (tab: 'breakdown' | 'materials') => {
    setSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Bento selection tiles
  const [activeBdId, setActiveBdId] = useState<string | null>(null);
  const [activeWorkerId, setActiveWorkerId] = useState<string | null>(null);
  const [previewWorkerId, setPreviewWorkerId] = useState<string | null>(null);

  // States for Batch Job assignment & Allocation
  const [isMultipleWorkers, setIsMultipleWorkers] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [workerQuantities, setWorkerQuantities] = useState<Record<string, number>>({});
  const [workerCheckedOps, setWorkerCheckedOps] = useState<Record<string, string[]>>({});
  const [workerOpPrices, setWorkerOpPrices] = useState<Record<string, Record<string, number>>>({});
  const [expandedWorkerSettings, setExpandedWorkerSettings] = useState<string | null>(null);

  // Modal triggers
  const [showAddBreakdown, setShowAddBreakdown] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [showRunProduction, setShowRunProduction] = useState(false);
  const [showReplenishMaterial, setShowReplenishMaterial] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Form states - Operation breakdowns
  const [newModelName, setNewModelName] = useState('');
  const [tempOps, setTempOps] = useState<{ name: string; price: number; multiplier?: number; defaultWorkerId?: string }[]>([
    { name: 'Cắt vải', price: 1500, multiplier: 1 },
    { name: 'Ráp sườn', price: 3000, multiplier: 1 },
    { name: 'May cổ', price: 2500, multiplier: 1 },
    { name: 'Lên lai', price: 1500, multiplier: 1 },
    { name: 'Tra khóa sườn', price: 2000, multiplier: 1 },
    { name: 'Ủi xếp & Chỉ thừa', price: 1000, multiplier: 1 },
    { name: 'Đóng gói', price: 800, multiplier: 1 }
  ]);
  const [newOpName, setNewOpName] = useState('');
  const [newOpPrice, setNewOpPrice] = useState<number>(1000);
  const [newOpMultiplier, setNewOpMultiplier] = useState<number>(1);
  const [newOpDefaultWorkerId, setNewOpDefaultWorkerId] = useState<string>('');

  // Form states - Workers
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedTaskIdsForNewWorker, setSelectedTaskIdsForNewWorker] = useState<string[]>([]);
  const [isEditingWorkerTasks, setIsEditingWorkerTasks] = useState(false);
  const [editingWorkerTaskIds, setEditingWorkerTaskIds] = useState<string[]>([]);

  // Active Worker personal page states
  const [workerActiveTab, setWorkerActiveTab] = useState<'jobs' | 'payments'>('jobs');
  const [wkJobModel, setWkJobModel] = useState('');
  const [wkJobQty, setWkJobQty] = useState<number>(100);
  const [wkJobOps, setWkJobOps] = useState<string[]>([]);
  const [wkJobCustomPrices, setWkJobCustomPrices] = useState<Record<string, number>>({});
  const [wkJobDate, setWkJobDate] = useState(getCurrentDateStr());
  const [wkPayAmount, setWkPayAmount] = useState<number>(0);
  const [wkPayNote, setWkPayNote] = useState('');
  const [wkPayDate, setWkPayDate] = useState(getCurrentDateStr());

  // Form states - View, Edit, Delete Production Batch
  const [selectedBatchForView, setSelectedBatchForView] = useState<ProductionBatch | null>(null);
  const [selectedBatchForEdit, setSelectedBatchForEdit] = useState<ProductionBatch | null>(null);

  // Android Back button wiring for ProductionTab Overlays
  useAndroidBack(showAddBreakdown, () => setShowAddBreakdown(false));
  useAndroidBack(showAddWorker, () => setShowAddWorker(false));
  useAndroidBack(showAddJob, () => setShowAddJob(false));
  useAndroidBack(showAddMaterial, () => setShowAddMaterial(false));
  useAndroidBack(showAddRecipe, () => setShowAddRecipe(false));
  useAndroidBack(showRunProduction, () => setShowRunProduction(false));
  useAndroidBack(showReplenishMaterial, () => setShowReplenishMaterial(false));
  useAndroidBack(showAddTaskModal, () => setShowAddTaskModal(false));
  useAndroidBack(!!selectedBatchForView, () => setSelectedBatchForView(null));
  useAndroidBack(!!selectedBatchForEdit, () => setSelectedBatchForEdit(null));

  // Form states - Worker Jobs Matching
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedModelForJob, setSelectedModelForJob] = useState('');
  const [jobCheckedOps, setJobCheckedOps] = useState<string[]>([]);
  const [customOpPrices, setCustomOpPrices] = useState<Record<string, number>>({});
  const [jobQuantity, setJobQuantity] = useState<number>(100);
  const [jobDate, setJobDate] = useState(getCurrentDateStr());

  const [assignmentMode, setAssignmentMode] = useState<'single' | 'bulk_split' | 'op_template'>('op_template');
  const [opAssignments, setOpAssignments] = useState<Record<string, { workerId: string; quantity: number; price: number }[]>>({});

  // Form states - Raw Materials
  const [materialName, setMaterialName] = useState('');
  const [materialUnit, setMaterialUnit] = useState('Mét');
  const [materialInitStock, setMaterialInitStock] = useState<number>(200);
  const [materialAlertLevel, setMaterialAlertLevel] = useState<number>(30);

  // Form states - Material Replenishing
  const [replenishId, setReplenishId] = useState('');
  const [replenishQty, setReplenishQty] = useState<number>(100);
  const [replenishNote, setReplenishNote] = useState('Nhập thêm lô nguyên liệu mới');

  // Form states - Material Formulas (Recipes)
  const [recipeModel, setRecipeModel] = useState('');
  const [recipeItems, setRecipeItems] = useState<{ materialId: string; consumptionRate: number }[]>([]);

  // Form states - Run Production Batch
  const [prodModel, setProdModel] = useState('');
  const [prodQty, setProdQty] = useState<number>(500);
  const [prodDate, setProdDate] = useState(getCurrentDateStr());

  // Expanded job rows and inline payment inputs
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});
  const [payInputs, setPayInputs] = useState<Record<string, string>>({});
  const [overallPayAmount, setOverallPayAmount] = useState<string>('');
  const [showOverallPayPanel, setShowOverallPayPanel] = useState<boolean>(false);

  // Form states - View, Edit, Delete Production Batch
  const [editBatchModel, setEditBatchModel] = useState('');
  const [editBatchQty, setEditBatchQty] = useState<number>(0);
  const [editBatchDate, setEditBatchDate] = useState('');



  // Quick stats
  const totalWorkers = workers.length;
  const totalMaterials = rawMaterials.length;
  const lowStockMaterials = rawMaterials.filter(m => m.currentStock <= m.minAlertLevel);
  const totalLaborCostAccumulated = workerJobs.reduce((sum, j) => sum + j.totalAmount, 0);
  const totalPaidAccumulated = workerJobs.reduce((sum, j) => sum + (j.paidAmount || 0), 0);
  const totalLaborCostRemaining = workerJobs.reduce((sum, j) => sum + (j.totalAmount - (j.paidAmount || 0)), 0);

  // Form Ops functions
  const addTempOp = () => {
    if (!newOpName.trim()) return;
    setTempOps([...tempOps, { 
      name: newOpName.trim(), 
      price: newOpPrice, 
      multiplier: newOpMultiplier, 
      defaultWorkerId: newOpDefaultWorkerId || undefined 
    }]);
    setNewOpName('');
    setNewOpPrice(1000);
    setNewOpMultiplier(1);
    setNewOpDefaultWorkerId('');
  };

  const removeTempOp = (index: number) => {
    setTempOps(tempOps.filter((_, i) => i !== index));
  };

  const moveTempOpUp = (index: number) => {
    if (index === 0) return;
    const updated = [...tempOps];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setTempOps(updated);
  };

  const moveTempOpDown = (index: number) => {
    if (index === tempOps.length - 1) return;
    const updated = [...tempOps];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setTempOps(updated);
  };

  const handleCreateBreakdown = () => {
    if (!newModelName.trim()) {
      alert('Vui lòng nhập tên mã hàng / mẫu mã!');
      return;
    }
    if (tempOps.length === 0) {
      alert('Vui lòng thêm ít nhất một công đoạn!');
      return;
    }

    const newBreakdown: ModelOperationBreakdown = {
      id: 'bd_' + Date.now(),
      modelName: newModelName.trim(),
      operations: tempOps.map((op, i) => ({
        id: `op_${Date.now()}_${i}`,
        name: op.name,
        price: op.price,
        multiplier: op.multiplier || 1,
        defaultWorkerId: op.defaultWorkerId || ''
      })),
      createdAt: Date.now()
    };

    setOperationBreakdowns([...operationBreakdowns, newBreakdown]);
    setNewModelName('');
    setTempOps([
      { name: 'Cắt vải', price: 1500, multiplier: 1 },
      { name: 'Ráp sườn', price: 3000, multiplier: 1 },
      { name: 'May cổ', price: 2500, multiplier: 1 },
      { name: 'Lên lai', price: 1500, multiplier: 1 },
      { name: 'Tra khóa sườn', price: 2000, multiplier: 1 },
      { name: 'Ủi xếp & Chỉ thừa', price: 1000, multiplier: 1 },
      { name: 'Đóng gói', price: 800, multiplier: 1 }
    ]);
    setShowAddBreakdown(false);
  };

  // Add Worker Function
  const handleCreateWorker = () => {
    if (!workerName.trim()) {
      alert('Vui lòng nhập tên thợ!');
      return;
    }
    const newWorker: Worker = {
      id: 'wk_' + Date.now(),
      name: workerName.trim(),
      phone: workerPhone.trim() || undefined,
      createdAt: Date.now(),
      taskIds: selectedTaskIdsForNewWorker
    };
    setWorkers([...workers, newWorker]);
    setWorkerName('');
    setWorkerPhone('');
    setSelectedTaskIdsForNewWorker([]);
    setShowAddWorker(false);
  };

  // Create Custom Task
  const handleCreateTask = () => {
    if (!newTaskName.trim()) {
      alert('Vui lòng nhập tên công việc!');
      return;
    }
    const isDuplicate = tasks.some(t => t.name.toLowerCase() === newTaskName.trim().toLowerCase());
    if (isDuplicate) {
      alert('Công việc này đã tồn tại trong danh sách mẫu!');
      return;
    }
    const newTask: TaskType = {
      id: 'task_' + Date.now(),
      name: newTaskName.trim(),
      createdAt: Date.now()
    };
    setTasks([...tasks, newTask]);
    setNewTaskName('');
  };

  // Delete Custom Task
  const handleDeleteTask = (id: string, name: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa công việc "${name}"? Thợ đang liên kết với công việc này sẽ được cập nhật lại.`)) {
      setTasks(tasks.filter(t => t.id !== id));
      // Dọn dẹp taskIds của các thợ hiện tại
      const updatedWorkers = workers.map(w => {
        if (w.taskIds && w.taskIds.includes(id)) {
          return {
            ...w,
            taskIds: w.taskIds.filter(tid => tid !== id)
          };
        }
        return w;
      });
      setWorkers(updatedWorkers);
    }
  };

  // Save Worker Tasks mapping changes
  const handleSaveWorkerTasks = (workerId: string) => {
    const updated = workers.map(w => {
      if (w.id === workerId) {
        return {
          ...w,
          taskIds: editingWorkerTaskIds
        };
      }
      return w;
    });
    setWorkers(updated);
    setIsEditingWorkerTasks(false);
  };

  // Multi-worker auto division helper
  const distributeQuantityEvenly = (totalQty: number, ids: string[]) => {
    if (ids.length === 0) return;
    const base = Math.floor(totalQty / ids.length);
    const extra = totalQty % ids.length;
    const newQuants: Record<string, number> = {};
    ids.forEach((id, idx) => {
      newQuants[id] = base + (idx < extra ? 1 : 0);
    });
    setWorkerQuantities(newQuants);
  };

  const handleToggleBatchWorker = (workerId: string) => {
    let newIds: string[] = [];
    if (selectedWorkerIds.includes(workerId)) {
      newIds = selectedWorkerIds.filter(id => id !== workerId);
    } else {
      newIds = [...selectedWorkerIds, workerId];
    }
    setSelectedWorkerIds(newIds);
    distributeQuantityEvenly(jobQuantity, newIds);

    // Initialize operations and unit prices for the added worker if newly selected
    if (!selectedWorkerIds.includes(workerId)) {
      const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
      if (selectedBd) {
        setWorkerCheckedOps(prev => ({
          ...prev,
          [workerId]: selectedBd.operations.map(o => o.id)
        }));
        const initialPrices: Record<string, number> = {};
        selectedBd.operations.forEach(o => {
          initialPrices[o.id] = o.price;
        });
        setWorkerOpPrices(prev => ({
          ...prev,
          [workerId]: initialPrices
        }));
      }
    }
  };

  const handleBulkQuantityChange = (newQty: number) => {
    setJobQuantity(newQty);
    distributeQuantityEvenly(newQty, selectedWorkerIds);
  };

  const handleIndividualWorkerQtyChange = (workerId: string, val: number) => {
    const updated = { ...workerQuantities, [workerId]: val };
    setWorkerQuantities(updated);
    const sum = Object.values(updated).reduce((s: number, q: unknown) => s + Number(q), 0);
    setJobQuantity(sum);
  };

  const getMatchingWorkersForOp = (opName: string): Worker[] => {
    const matchedTasks = tasks.filter(t => 
      t.name.toLowerCase().trim() === opName.toLowerCase().trim() ||
      opName.toLowerCase().trim().includes(t.name.toLowerCase().trim()) ||
      t.name.toLowerCase().trim().includes(opName.toLowerCase().trim())
    );
    const matchedTaskIds = matchedTasks.map(t => t.id);
    
    return workers.filter(w => 
      w.taskIds && w.taskIds.some(id => matchedTaskIds.includes(id))
    );
  };

  const initOpAssignments = (modelName: string, totalQty: number) => {
    const selectedBd = operationBreakdowns.find(bd => bd.modelName === modelName);
    if (!selectedBd) return;
    const newAssignments: Record<string, { workerId: string; quantity: number; price: number }[]> = {};
    selectedBd.operations.forEach(op => {
      const mult = op.multiplier || 1;
      const targetQty = totalQty * mult;
      
      const matchedWorkers = getMatchingWorkersForOp(op.name);
      if (matchedWorkers.length > 0) {
        const count = matchedWorkers.length;
        newAssignments[op.id] = matchedWorkers.map(w => ({
          workerId: w.id,
          quantity: Math.round(targetQty / count),
          price: op.price
        }));
      } else {
        newAssignments[op.id] = [
          { workerId: op.defaultWorkerId || '', quantity: targetQty, price: op.price }
        ];
      }
    });
    setOpAssignments(newAssignments);
  };

  const handleOpTemplateQuantityChange = (totalQty: number) => {
    setJobQuantity(totalQty);
    const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
    if (!selectedBd) return;
    setOpAssignments(prev => {
      const updated = { ...prev };
      selectedBd.operations.forEach(op => {
        const mult = op.multiplier || 1;
        const targetQty = totalQty * mult;
        const rows = prev[op.id] || [];
        if (rows.length <= 1) {
          updated[op.id] = [
            { 
              workerId: rows[0]?.workerId || '', 
              quantity: targetQty, 
              price: rows[0]?.price !== undefined ? rows[0].price : op.price 
            }
          ];
        } else {
          const currentSum = rows.reduce((s, r) => s + r.quantity, 0) || 1;
          updated[op.id] = rows.map(r => ({
            ...r,
            quantity: Math.round((r.quantity / currentSum) * targetQty)
          }));
        }
      });
      return updated;
    });
  };

  // Worker Job Add
  const handleSelectModelForJob = (modelName: string) => {
    setSelectedModelForJob(modelName);
    const selectedBd = operationBreakdowns.find(bd => bd.modelName === modelName);
    if (selectedBd) {
      setJobCheckedOps(selectedBd.operations.map(o => o.id)); // Default tick all
      const initialPrices: Record<string, number> = {};
      selectedBd.operations.forEach(o => {
        initialPrices[o.id] = o.price;
      });
      setCustomOpPrices(initialPrices);

      // Also reset batch structures for all selected workers in bulk mode
      const newBatchCheckedOps: Record<string, string[]> = {};
      const newBatchPrices: Record<string, Record<string, number>> = {};
      selectedWorkerIds.forEach(id => {
        newBatchCheckedOps[id] = selectedBd.operations.map(o => o.id);
        const prices: Record<string, number> = {};
        selectedBd.operations.forEach(o => {
          prices[o.id] = o.price;
        });
        newBatchPrices[id] = prices;
      });
      setWorkerCheckedOps(newBatchCheckedOps);
      setWorkerOpPrices(newBatchPrices);

      // Initialize template op assignments
      initOpAssignments(modelName, jobQuantity);
    } else {
      setJobCheckedOps([]);
      setCustomOpPrices({});
      setWorkerCheckedOps({});
      setWorkerOpPrices({});
      setOpAssignments({});
    }
  };

  const handleToggleJobOp = (opId: string) => {
    if (jobCheckedOps.includes(opId)) {
      setJobCheckedOps(jobCheckedOps.filter(id => id !== opId));
    } else {
      setJobCheckedOps([...jobCheckedOps, opId]);
    }
  };

  const handleCreateJob = () => {
    if (!selectedModelForJob) {
      alert('Vui lòng chọn mẫu mã sản phẩm!');
      return;
    }

    const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
    if (!selectedBd) {
      alert('Không tìm thấy cấu trúc công đoạn của mẫu mã đã chọn!');
      return;
    }

    if (assignmentMode === 'op_template') {
      const newJobs: WorkerJob[] = [];
      let index = 0;
      
      Object.entries(opAssignments).forEach(([opId, unknownAssignments]) => {
        const assignments = unknownAssignments as { workerId: string; quantity: number; price: number }[];
        const op = selectedBd.operations.find(o => o.id === opId);
        if (!op) return;

        assignments.forEach(assign => {
          if (!assign.workerId) return; // skip lines without worker selected
          if (assign.quantity <= 0) return; // skip non-positive quantities

          const worker = workers.find(w => w.id === assign.workerId);
          if (!worker) return;

          const customPricesMap = { [opId]: assign.price };

          newJobs.push({
            id: `job_${Date.now()}_opt_${opId}_${assign.workerId}_${index}`,
            workerId: assign.workerId,
            workerName: worker.name,
            modelName: selectedModelForJob,
            quantity: assign.quantity,
            selectedOperationIds: [opId],
            unitPrice: assign.price,
            totalAmount: assign.quantity * assign.price,
            date: jobDate,
            createdAt: Date.now() + index,
            customPrices: customPricesMap
          });
          index++;
        });
      });

      if (newJobs.length === 0) {
        alert('Vui lòng phân công ít nhất một công đoạn cho một thợ!');
        return;
      }

      setWorkerJobs([...newJobs, ...workerJobs]);

      // Reset template assignment fields
      setSelectedModelForJob('');
      setOpAssignments({});
      setJobQuantity(100);
      setShowAddJob(false);
      alert(`Đã hoàn thành tự động phân chia nhanh theo mẫu định mức cho ${newJobs.length} thợ!`);
      return;
    }

    if (isMultipleWorkers) {
      if (selectedWorkerIds.length === 0) {
        alert('Vui lòng chọn ít nhất một thợ gia công để phân chia công việc!');
        return;
      }

      // Validate quantities and operations for each selected worker
      const invalidWorker = selectedWorkerIds.find(id => {
        const qty = workerQuantities[id] || 0;
        const ops = workerCheckedOps[id] || [];
        return qty <= 0 || ops.length === 0;
      });

      if (invalidWorker) {
        const w = workers.find(work => work.id === invalidWorker);
        alert(`Thợ ${w ? w.name : invalidWorker} phải có số lượng gia công lớn hơn 0 và được phân công ít nhất 1 công đoạn!`);
        return;
      }

      const newJobs: WorkerJob[] = selectedWorkerIds.map((id, index) => {
        const worker = workers.find(w => w.id === id);
        const qty = workerQuantities[id] || 0;
        const checkedOps = workerCheckedOps[id] || [];
        const customPricesMap = workerOpPrices[id] || {};

        const opPricesSum = selectedBd.operations
          .filter(op => checkedOps.includes(op.id))
          .reduce((sum, op) => {
            const price = customPricesMap[op.id] !== undefined ? customPricesMap[op.id] : op.price;
            return sum + price;
          }, 0);

        const totalAmount = qty * opPricesSum;

        return {
          id: `job_${Date.now()}_bg_${index}`,
          workerId: id,
          workerName: worker ? worker.name : 'Thợ chưa rõ',
          modelName: selectedModelForJob,
          quantity: qty,
          selectedOperationIds: checkedOps,
          unitPrice: opPricesSum,
          totalAmount,
          date: jobDate,
          createdAt: Date.now() + index,
          customPrices: { ...customPricesMap }
        };
      });

      setWorkerJobs([...newJobs, ...workerJobs]);

      // Reset batch state fields
      setSelectedWorkerIds([]);
      setWorkerQuantities({});
      setWorkerCheckedOps({});
      setWorkerOpPrices({});
      setSelectedModelForJob('');
      setJobQuantity(100);
      setShowAddJob(false);
      alert(`Đã tự động phân chia công việc & thành công tạo ${newJobs.length} phiếu nhật ký giao thợ!`);
    } else {
      // Single worker mode
      if (!selectedWorkerId) {
        alert('Vui lòng chọn thợ gia công!');
        return;
      }
      if (jobCheckedOps.length === 0) {
        alert('Thợ phải đảm nhận ít nhất 1 công đoạn!');
        return;
      }
      if (jobQuantity <= 0) {
        alert('Số lượng gia công phải lớn hơn 0!');
        return;
      }

      const worker = workers.find(w => w.id === selectedWorkerId);
      if (!worker) return;

      const opPricesSum = selectedBd.operations
        .filter(op => jobCheckedOps.includes(op.id))
        .reduce((sum, op) => {
          const price = customOpPrices[op.id] !== undefined ? customOpPrices[op.id] : op.price;
          return sum + price;
        }, 0);

      const totalAmount = jobQuantity * opPricesSum;

      const newJob: WorkerJob = {
        id: 'job_' + Date.now(),
        workerId: selectedWorkerId,
        workerName: worker.name,
        modelName: selectedModelForJob,
        quantity: jobQuantity,
        selectedOperationIds: jobCheckedOps,
        unitPrice: opPricesSum,
        totalAmount,
        date: jobDate,
        createdAt: Date.now(),
        customPrices: { ...customOpPrices }
      };

      setWorkerJobs([newJob, ...workerJobs]);

      // Reset single worker state fields
      setSelectedWorkerId('');
      setSelectedModelForJob('');
      setJobCheckedOps([]);
      setCustomOpPrices({});
      setJobQuantity(100);
      setShowAddJob(false);
      alert('Giao việc và lưu sổ nhật ký công thợ thành công!');
    }
  };

  // Add Labor Payment Voucher quickly inside Invoices-styled history
  const triggerQuickPay = (job: WorkerJob) => {
    const confirmation = confirm(`Xác nhận chi trả nhanh tiền công thợ "${job.workerName}" cho đợt hàng ${job.quantity} cái ${job.modelName}? Số tiền: ${job.totalAmount.toLocaleString()}đ.`);
    if (!confirmation) return;

    const newPayment: LaborPayment = {
      id: 'pay_' + Date.now(),
      weekKey: getVietnameseWeekKey(getCurrentDateStr()),
      amount: job.totalAmount,
      date: getCurrentDateStr(),
      note: `Chi lương thợ ${job.workerName} - ${job.quantity} cái ${job.modelName} (Đơn giá công đoạn: ${job.unitPrice.toLocaleString()}đ)`,
      createdAt: Date.now()
    };

    setLaborPayments([newPayment, ...laborPayments]);
    alert(`Đã lập phiếu thanh toán chi lương thợ ${job.workerName} thành công!`);
  };

  // EXCEL LABOR COSTS REPORT EXPORTER
  const exportWorkerJobsToExcel = () => {
    if (workerJobs.length === 0) {
      alert('Không có dữ liệu nhật ký giao việc thợ may để xuất Excel!');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const sheetData: any[] = [];

    // Main Title
    sheetData.push(["XƯỞNG AN - BÁO CÁO PHÂN CÔNG & LƯƠNG NHÂN CÔNG CHI TIẾT"]);
    sheetData.push([`Ngày xuất báo cáo: ${formatVietnameseDate(getCurrentDateStr())}`]);
    sheetData.push([]); // blank row

    // Summary Analytics block
    const sumQty = workerJobs.reduce((acc, curr) => acc + curr.quantity, 0);
    const sumAmount = workerJobs.reduce((acc, curr) => acc + curr.totalAmount, 0);
    sheetData.push(["THỐNG KÊ CHUNG"]);
    sheetData.push(["Tổng số phiếu giao việc:", workerJobs.length]);
    sheetData.push(["Tổng số lượng sản phẩm may:", sumQty]);
    sheetData.push(["Tổng quỹ lương nhân công:", `${sumAmount.toLocaleString()} đ`]);
    sheetData.push([]); // blank row

    // Section 1: Detailed ledger table
    sheetData.push(["================================================================"]);
    sheetData.push(["DANH SÁCH CHI TIẾT PHIẾU GIAO VIỆC & NHẬN HÀNG GIA CÔNG"]);
    sheetData.push(["================================================================"]);
    sheetData.push([
      "STT", 
      "Ngày giao việc", 
      "Thợ đảm nhận", 
      "Mẫu sản phẩm", 
      "Số lượng (Cái)", 
      "Công đoạn & Đơn giá chi tiết chi công thợ", 
      "Tổng đơn giá (đ/Cái)", 
      "Thành tiền lương (đ)"
    ]);

    workerJobs.forEach((job, index) => {
      const breakdown = operationBreakdowns.find(bd => bd.modelName === job.modelName);
      const opsText = job.selectedOperationIds.map(opId => {
        const op = breakdown?.operations.find(o => o.id === opId);
        const name = op ? op.name : opId;
        const price = job.customPrices?.[opId] !== undefined ? job.customPrices[opId] : (op?.price || 0);
        return `${name}: ${price.toLocaleString()}đ`;
      }).join("; ");

      sheetData.push([
        index + 1,
        formatVietnameseDate(job.date),
        job.workerName,
        job.modelName,
        job.quantity,
        opsText,
        job.unitPrice,
        job.totalAmount
      ]);
    });

    // Section 2: Worker Aggregation / Accumulated Wages
    sheetData.push([]);
    sheetData.push([]);
    sheetData.push(["================================================================"]);
    sheetData.push(["BẢNG TỔNG HỢP TIỀN CÔNG LŨY KẾ THEO TỪNG THỢ MAY"]);
    sheetData.push(["================================================================"]);
    sheetData.push([
      "STT", 
      "Tên thợ may", 
      "Tổng số phiếu đã nhận", 
      "Tổng số lượng sản phẩm hoàn thành (Cái)", 
      "Tổng tiền lương lũy kế (đ)"
    ]);

    // Aggregate by worker
    const workerAggr: Record<string, { name: string; jobsCount: number; qtyCount: number; amountSum: number }> = {};
    workers.forEach(w => {
      workerAggr[w.id] = { name: w.name, jobsCount: 0, qtyCount: 0, amountSum: 0 };
    });

    workerJobs.forEach(job => {
      const wId = job.workerId;
      if (!workerAggr[wId]) {
        // Fallback if worker profile was deleted
        workerAggr[wId] = { name: job.workerName, jobsCount: 0, qtyCount: 0, amountSum: 0 };
      }
      workerAggr[wId].jobsCount += 1;
      workerAggr[wId].qtyCount += job.quantity;
      workerAggr[wId].amountSum += job.totalAmount;
    });

    Object.values(workerAggr)
      .filter(w => w.jobsCount > 0) // only active workers in this period
      .forEach((w, idx) => {
        sheetData.push([
          idx + 1,
          w.name,
          w.jobsCount,
          w.qtyCount,
          w.amountSum
        ]);
      });

    // Write to spreadsheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bảng_Lương_Nhân_Công");
    
    // Auto-fit column widths for high polish!
    worksheet["!cols"] = [
      { wch: 6 },  // STT
      { wch: 15 }, // Ngày giao việc
      { wch: 25 }, // Thợ đảm nhận
      { wch: 18 }, // Mẫu sản phẩm
      { wch: 15 }, // Số lượng (Cái)
      { wch: 60 }, // Công đoạn & Đơn giá chi tiết chi công thợ
      { wch: 22 }, // Tổng đơn giá (đ/Cái)
      { wch: 22 }, // Thành tiền lương (đ)
    ];

    XLSX.writeFile(workbook, `Bang_Luong_Nhan_Cong_Xuong_An_${getCurrentDateStr()}.xlsx`);
  };

  // Delete states
  const deleteBreakdown = (id: string, name: string) => {
    if (confirm(`Bạn chắc chắn muốn xóa cấu trúc công đoạn mẫu mã "${name}"?`)) {
      setOperationBreakdowns(operationBreakdowns.filter(b => b.id !== id));
    }
  };

  const deleteWorker = (id: string, name: string) => {
    if (confirm(`Bạn chắc chắn muốn xóa thợ "${name}" khỏi danh bạ?`)) {
      setWorkers(workers.filter(w => w.id !== id));
      if (activeWorkerId === id) {
        setActiveWorkerId(null);
      }
    }
  };

  const deleteJob = (id: string) => {
    if (confirm(`Xóa ghi nhận công thợ này?`)) {
      setWorkerJobs(workerJobs.filter(j => j.id !== id));
    }
  };

  // Material Ops
  const handleCreateMaterial = () => {
    if (!materialName.trim()) {
      alert('Vui lòng nhập tên nguyên liệu!');
      return;
    }
    const newMat: RawMaterial = {
      id: 'mat_' + Date.now(),
      name: materialName.trim(),
      unit: materialUnit,
      currentStock: materialInitStock,
      minAlertLevel: materialAlertLevel,
      createdAt: Date.now()
    };

    setRawMaterials([...rawMaterials, newMat]);
    
    // Log creation
    if (materialInitStock > 0) {
      const operatorName = authState?.displayName || 'Kế toán viên';
      const newLog = {
        id: 'log_' + Date.now(),
        materialId: newMat.id,
        materialName: newMat.name,
        type: 'nhap' as const,
        quantity: materialInitStock,
        balanceBefore: 0,
        balanceAfter: materialInitStock,
        operator: operatorName,
        date: getCurrentDateStr(),
        note: 'Khởi tạo kho vật tư ban đầu',
        createdAt: Date.now()
      };
      setMaterialLogs([newLog, ...materialLogs]);
    }

    setMaterialName('');
    setMaterialInitStock(200);
    setMaterialAlertLevel(30);
    setShowAddMaterial(false);
  };

  // Replenish Material
  const handleReplenish = () => {
    if (!replenishId) {
      alert('Vui lòng chọn nguyên liệu!');
      return;
    }
    if (replenishQty <= 0) {
      alert('Số lượng nhập kho phải lớn hơn 0!');
      return;
    }

    const material = rawMaterials.find(m => m.id === replenishId);
    if (!material) return;

    // Log reimport
    const reimport: MaterialReimport = {
      id: 'reimp_' + Date.now(),
      materialId: replenishId,
      materialName: material.name,
      quantityAdded: replenishQty,
      date: getCurrentDateStr(),
      note: replenishNote.trim() || undefined,
      createdAt: Date.now()
    };

    setMaterialReimports([reimport, ...materialReimports]);

    // Log fluctuation
    const operatorName = authState?.displayName || 'Kế toán viên';
    const newLog = {
      id: 'log_' + Date.now(),
      materialId: replenishId,
      materialName: material.name,
      type: 'nhap' as const,
      quantity: replenishQty,
      balanceBefore: material.currentStock,
      balanceAfter: material.currentStock + replenishQty,
      operator: operatorName,
      date: getCurrentDateStr(),
      note: replenishNote.trim() || 'Nhập thêm vật tư',
      createdAt: Date.now()
    };
    setMaterialLogs([newLog, ...materialLogs]);

    // Update stock
    setRawMaterials(rawMaterials.map(m => {
      if (m.id === replenishId) {
        return { ...m, currentStock: m.currentStock + replenishQty };
      }
      return m;
    }));

    setReplenishId('');
    setReplenishQty(100);
    setReplenishNote('Nhập thêm lô nguyên liệu mới');
    setShowReplenishMaterial(false);
  };

  // Formulas Definition (Recipe)
  const addRecipeRow = (materialId: string, rate: number) => {
    if (!materialId) return;
    if (recipeItems.some(i => i.materialId === materialId)) return;
    setRecipeItems([...recipeItems, { materialId, consumptionRate: rate }]);
  };

  const removeRecipeRow = (materialId: string) => {
    setRecipeItems(recipeItems.filter(i => i.materialId !== materialId));
  };

  const handleCreateRecipe = () => {
    if (!recipeModel) {
      alert('Vui lòng chọn mẫu mã hàng thiết kế!');
      return;
    }
    if (recipeItems.length === 0) {
      alert('Vui lòng thêm ít nhất một nguyên liệu tiêu hao cho mẫu!');
      return;
    }

    // Upsert Recipe
    const existIndex = materialRecipes.findIndex(r => r.modelName === recipeModel);
    const newRecipe: ModelMaterialRecipe = {
      id: existIndex !== -1 ? materialRecipes[existIndex].id : 'rec_' + Date.now(),
      modelName: recipeModel,
      items: recipeItems,
      createdAt: Date.now()
    };

    if (existIndex !== -1) {
      const copy = [...materialRecipes];
      copy[existIndex] = newRecipe;
      setMaterialRecipes(copy);
    } else {
      setMaterialRecipes([...materialRecipes, newRecipe]);
    }

    setRecipeModel('');
    setRecipeItems([]);
    setShowAddRecipe(false);
  };

  const startEditRecipe = (recipe: ModelMaterialRecipe) => {
    setRecipeModel(recipe.modelName);
    setRecipeItems(recipe.items);
    setShowAddRecipe(true);
  };

  // Run Production Work order to deduct stock
  const calculateRequiredMaterials = (modelName: string, quantity: number) => {
    const recipe = materialRecipes.find(r => r.modelName === modelName);
    if (!recipe) return [];

    return recipe.items.map(item => {
      const mat = rawMaterials.find(m => m.id === item.materialId);
      const totalRequired = item.consumptionRate * quantity;
      return {
        materialId: item.materialId,
        materialName: mat ? mat.name : 'Chưa rõ',
        materialUnit: mat ? mat.unit : 'đơn vị',
        amountUsed: totalRequired,
        currentStock: mat ? mat.currentStock : 0,
        insufficient: mat ? mat.currentStock < totalRequired : true
      };
    });
  };

  const handleRunProduction = () => {
    if (!prodModel) {
      alert('Vui lòng chọn mẫu mã tiến hành sản xuất!');
      return;
    }
    if (prodQty <= 0) {
      alert('Số lượng đợt sản xuất phải lớn hơn 0!');
      return;
    }

    const requirements = calculateRequiredMaterials(prodModel, prodQty);
    const isShortage = requirements.some(r => r.insufficient);

    if (isShortage) {
      const proceed = confirm('CẢNH BÁO TIÊU HAO: Kho nguyên liệu đang không đủ đáp ứng đợt hàng này. Giao dịch vẫn sẽ tiếp tục trừ âm kho. Bạn có đồng ý trừ kho ngay không?');
      if (!proceed) return;
    }

    // Deduct stock
    setRawMaterials(rawMaterials.map(m => {
      const req = requirements.find(r => r.materialId === m.id);
      if (req) {
        return { ...m, currentStock: Math.max(0, m.currentStock - req.amountUsed) };
      }
      return m;
    }));

    // Log fluctuations
    const operatorName = authState?.displayName || 'Kế toán viên';
    const newLogs = requirements.filter(r => r.amountUsed > 0).map((req, idx) => {
      const mat = rawMaterials.find(m => m.id === req.materialId);
      const before = mat ? mat.currentStock : 0;
      const after = Math.max(0, before - req.amountUsed);
      return {
        id: `log_prod_${Date.now()}_${idx}`,
        materialId: req.materialId,
        materialName: req.materialName,
        type: 'xuat' as const,
        quantity: req.amountUsed,
        balanceBefore: before,
        balanceAfter: after,
        operator: operatorName,
        date: prodDate,
        note: `Xuất sản xuất mã hàng ${prodModel} (SL: ${prodQty.toLocaleString()})`,
        createdAt: Date.now() + idx
      };
    });
    setMaterialLogs([...newLogs, ...materialLogs]);

    // Save batch record
    const newBatch: ProductionBatch = {
      id: 'bat_' + Date.now(),
      modelName: prodModel,
      targetQuantity: prodQty,
      date: prodDate,
      materialsUsed: requirements.map(r => ({
        materialId: r.materialId,
        materialName: r.materialName,
        materialUnit: r.materialUnit,
        amountUsed: r.amountUsed,
        insufficient: r.insufficient
      })),
      createdAt: Date.now()
    };

    setProductionBatches([newBatch, ...productionBatches]);
    setProdModel('');
    setProdQty(500);
    setShowRunProduction(false);
    alert('Khởi chạy đợt hàng sản xuất mộc và cập nhật kho nguyên liệu tự động thành công!');
  };

  const handleViewBatch = (batch: ProductionBatch) => {
    setSelectedBatchForView(batch);
  };

  const handleStartEditBatch = (batch: ProductionBatch) => {
    setSelectedBatchForEdit(batch);
    setEditBatchModel(batch.modelName);
    setEditBatchQty(batch.targetQuantity);
    setEditBatchDate(batch.date);
  };

  const handleSaveEditBatch = () => {
    const oldBatch = selectedBatchForEdit;
    if (!oldBatch) return;

    if (!editBatchModel) {
      alert('Vui lòng chọn hoặc nhập mã hàng!');
      return;
    }
    if (editBatchQty <= 0) {
      alert('Số lượng đợt sản xuất phải lớn hơn 0!');
      return;
    }

    const newRequirements = calculateRequiredMaterials(editBatchModel, editBatchQty);
    const isShortage = newRequirements.some(r => {
      const mat = rawMaterials.find(m => m.id === r.materialId);
      const oldUsage = oldBatch.materialsUsed.find(om => om.materialId === r.materialId)?.amountUsed || 0;
      const revertedStock = (mat ? mat.currentStock : 0) + oldUsage;
      return revertedStock < r.amountUsed;
    });

    if (isShortage) {
      const proceed = confirm('CẢNH BÁO TIÊU HAO: Kho nguyên liệu (sau khi hoàn trả đợt cũ) không đủ đáp ứng đợt hàng mới này. Bạn có đồng ý trừ âm kho không?');
      if (!proceed) return;
    }

    // Update raw materials stock: add back the old, then subtract the new
    setRawMaterials(prevMaterials => prevMaterials.map(m => {
      const oldUsage = oldBatch.materialsUsed.find(om => om.materialId === m.id)?.amountUsed || 0;
      const newUsage = newRequirements.find(nr => nr.materialId === m.id)?.amountUsed || 0;
      const newStock = Math.max(0, m.currentStock + oldUsage - newUsage);
      return { ...m, currentStock: newStock };
    }));

    // Log edit fluctuations
    const operatorName = authState?.displayName || 'Kế toán viên';
    const editLogs: any[] = [];
    newRequirements.forEach((nr, idx) => {
      const oldUsage = oldBatch.materialsUsed.find(om => om.materialId === nr.materialId)?.amountUsed || 0;
      if (oldUsage !== nr.amountUsed) {
        const mat = rawMaterials.find(m => m.id === nr.materialId);
        const before = mat ? mat.currentStock : 0;
        const netChange = nr.amountUsed - oldUsage; // positive means used more (xuat), negative means returned (nhap)
        const after = Math.max(0, before - netChange);
        editLogs.push({
          id: `log_edit_${Date.now()}_${idx}`,
          materialId: nr.materialId,
          materialName: nr.materialName,
          type: netChange > 0 ? ('xuat' as const) : ('nhap' as const),
          quantity: Math.abs(netChange),
          balanceBefore: before,
          balanceAfter: after,
          operator: operatorName,
          date: editBatchDate,
          note: netChange > 0 
            ? `Xuất thêm do sửa đợt hàng ${editBatchModel} (cũ: ${oldBatch.targetQuantity.toLocaleString()} -> mới: ${editBatchQty.toLocaleString()})`
            : `Nhập lại do sửa đợt hàng ${editBatchModel} (cũ: ${oldBatch.targetQuantity.toLocaleString()} -> mới: ${editBatchQty.toLocaleString()})`,
          createdAt: Date.now() + idx
        });
      }
    });
    oldBatch.materialsUsed.forEach((om, idx) => {
      const hasInNew = newRequirements.some(nr => nr.materialId === om.materialId);
      if (!hasInNew && om.amountUsed > 0) {
        const mat = rawMaterials.find(m => m.id === om.materialId);
        const before = mat ? mat.currentStock : 0;
        const after = before + om.amountUsed;
        editLogs.push({
          id: `log_edit_del_${Date.now()}_${idx}`,
          materialId: om.materialId,
          materialName: om.materialName,
          type: 'nhap' as const,
          quantity: om.amountUsed,
          balanceBefore: before,
          balanceAfter: after,
          operator: operatorName,
          date: editBatchDate,
          note: `Nhập lại do sửa đổi đợt sản xuất ${editBatchModel}`,
          createdAt: Date.now() + 100 + idx
        });
      }
    });

    if (editLogs.length > 0) {
      setMaterialLogs([...editLogs, ...materialLogs]);
    }

    // Update production batch list
    setProductionBatches(prevBatches => prevBatches.map(b => {
      if (b.id === oldBatch.id) {
        return {
          ...b,
          modelName: editBatchModel,
          targetQuantity: editBatchQty,
          date: editBatchDate,
          materialsUsed: newRequirements.map(r => ({
            materialId: r.materialId,
            materialName: r.materialName,
            materialUnit: r.materialUnit,
            amountUsed: r.amountUsed,
            insufficient: r.insufficient
          }))
        };
      }
      return b;
    }));

    setSelectedBatchForEdit(null);
    alert('Cập nhật nhật ký sản xuất và điều chỉnh kho vật tư thành công!');
  };

  const handleDeleteBatch = (batch: ProductionBatch) => {
    const proceed = confirm(`XÁC NHẬN XOÁ: Bạn có chắc chắn muốn xoá đợt sản xuất của mẫu "${batch.modelName}" (${batch.targetQuantity.toLocaleString()} cái) lúc ${formatVietnameseDate(batch.date)}?\n\nToàn bộ nguyên liệu tiêu hao của đợt này sẽ được hoàn trả lại vào kho.`);
    if (!proceed) return;

    // Return materials consumed by this batch back to stock
    setRawMaterials(prevMaterials => prevMaterials.map(m => {
      const oldUsage = batch.materialsUsed.find(om => om.materialId === m.id)?.amountUsed || 0;
      return { ...m, currentStock: m.currentStock + oldUsage };
    }));

    // Log deletion fluctuations
    const operatorName = authState?.displayName || 'Kế toán viên';
    const delLogs = batch.materialsUsed.filter(om => om.amountUsed > 0).map((om, idx) => {
      const mat = rawMaterials.find(m => m.id === om.materialId);
      const before = mat ? mat.currentStock : 0;
      const after = before + om.amountUsed;
      return {
        id: `log_del_${Date.now()}_${idx}`,
        materialId: om.materialId,
        materialName: om.materialName,
        type: 'nhap' as const,
        quantity: om.amountUsed,
        balanceBefore: before,
        balanceAfter: after,
        operator: operatorName,
        date: getCurrentDateStr(),
        note: `Nhập trả kho do xóa đợt sản xuất ${batch.modelName}`,
        createdAt: Date.now() + idx
      };
    });
    setMaterialLogs([...delLogs, ...materialLogs]);

    // Delete the batch
    setProductionBatches(prevBatches => prevBatches.filter(b => b.id !== batch.id));
    alert('Đã xoá nhật ký sản xuất và hoàn trả nguyên liệu vào kho thành công!');
  };

  // Render the dedicated personal page for each worker
  const renderActiveWorkerPage = () => {
    const activeWorker = workers.find(w => w.id === activeWorkerId);
    if (!activeWorker) return null;

    const matchedJobs = workerJobs.filter(j => j.workerId === activeWorker.id);
    const totalQuantity = matchedJobs.reduce((sum, j) => sum + j.quantity, 0);
    const totalEarned = matchedJobs.reduce((sum, j) => sum + j.totalAmount, 0);

    // Filter matching payments
    const matchedPayments = laborPayments.filter(p => 
      p.note.toLowerCase().includes(activeWorker.name.toLowerCase())
    );
    const totalPaid = matchedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDebt = totalEarned - totalPaid;

    return (
      <div className="bg-white dark:bg-zinc-900/95 border-2 border-slate-300 dark:border-zinc-805 p-6 md:p-8 rounded-3xl shadow-md space-y-8">
        {/* Back header line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-205 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveWorkerId(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-750 border border-indigo-700 rounded-xl text-xs md:text-sm font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
            >
              ← QUAY LẠI QUẢN LÝ CHUNG
            </button>
            <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700 hidden sm:block" />
            <div>
              <span className="text-xs uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 block mb-0.5">SỔ TÍNH LƯƠNG GIA CÔNG CHI TIẾT</span>
              <h2 className="text-base md:text-lg font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                THỢ GIA CÔNG: {activeWorker.name}
              </h2>
            </div>
          </div>


        </div>

        {/* Worker Info, Phone, and Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="md:col-span-1 bg-slate-100/70 dark:bg-zinc-950/40 border-2 border-slate-200 dark:border-zinc-800 p-5 rounded-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg tracking-widest shrink-0 uppercase shadow-lg select-none">
                  {activeWorker.name.substring(0, 2)}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base uppercase leading-normal">{activeWorker.name}</h4>
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-md inline-block mt-1 uppercase tracking-wide">
                    Thợ mộc phụ trách
                  </span>
                </div>
              </div>
              
              <div className="pt-3 border-t-2 border-dashed border-slate-300 dark:border-zinc-800 text-xs md:text-sm space-y-2 text-slate-900 dark:text-slate-100">
                <p className="flex items-center justify-between font-sans">
                  <span className="font-black text-slate-600 dark:text-slate-400">Số Điện Thoại:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{activeWorker.phone || 'Chưa có SĐT'}</span>
                </p>
                <p className="flex items-center justify-between font-sans">
                  <span className="font-black text-slate-600 dark:text-slate-400">Tham gia:</span>
                  <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">{formatVietnameseDate(activeWorker.createdAt ? new Date(activeWorker.createdAt).toISOString().split('T')[0] : getCurrentDateStr())}</span>
                </p>
              </div>
            </div>

            {/* Editing worker skills checklist */}
            <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-300 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-1 select-none">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> Tay nghề nhận:
                </span>
                {!isEditingWorkerTasks ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingWorkerTasks(true);
                      setEditingWorkerTaskIds(activeWorker.taskIds || []);
                    }}
                    className="text-xs font-black text-indigo-600 dark:text-indigo-400 underline hover:no-underline cursor-pointer"
                  >
                    SỬA ĐỔI
                  </button>
                ) : (
                  <div className="flex gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSaveWorkerTasks(activeWorker.id)}
                      className="text-emerald-600 font-extrabold hover:underline cursor-pointer"
                    >
                      LƯU
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingWorkerTasks(false)}
                      className="text-slate-500 font-extrabold hover:underline cursor-pointer"
                    >
                      HỦY
                    </button>
                  </div>
                )}
              </div>

              {!isEditingWorkerTasks ? (
                <div className="flex flex-wrap gap-1.55">
                  {(!activeWorker.taskIds || activeWorker.taskIds.length === 0) ? (
                    <span className="text-xs text-slate-500 italic font-bold">Chưa gán tay nghề</span>
                  ) : (
                    activeWorker.taskIds.map(tId => {
                      const t = tasks.find(tk => tk.id === tId);
                      if (!t) return null;
                      return (
                        <span key={tId} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-850 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-lg font-extrabold border border-indigo-200">
                          {t.name}
                        </span>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {tasks.map(task => {
                    const isChecked = editingWorkerTaskIds.includes(task.id);
                    return (
                      <label
                        key={task.id}
                        className={`flex items-start gap-2 p-2 rounded-lg text-xs font-black cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200 border border-indigo-300'
                            : 'text-slate-705 hover:bg-slate-200 dark:hover:bg-zinc-800 bg-slate-100 dark:bg-zinc-900 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditingWorkerTaskIds(editingWorkerTaskIds.filter(id => id !== task.id));
                            } else {
                              setEditingWorkerTaskIds([...editingWorkerTaskIds, task.id]);
                            }
                          }}
                          className="mt-0.5 rounded border-slate-300 accent-indigo-650 scale-90 cursor-pointer"
                        />
                        <span className="truncate" title={task.name}>{task.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Statistical KPI Blocks */}
          <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-indigo-50/50 dark:bg-zinc-950/40 border-2 border-indigo-200 dark:border-zinc-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-xs">
              <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wide block">Tổng đợt may:</span>
              <div className="mt-2.5">
                <span className="font-mono text-3xl font-black text-indigo-700 dark:text-indigo-400 block">{matchedJobs.length}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-extrabold block mt-1 uppercase">Mẻ công nhận</span>
              </div>
            </div>

            <div className="bg-sky-50/50 dark:bg-zinc-950/40 border-2 border-sky-200 dark:border-zinc-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-xs">
              <span className="text-xs font-black uppercase text-sky-900 dark:text-sky-300 tracking-wide block">Sản lượng mộc:</span>
              <div className="mt-2.5">
                <span className="font-mono text-3xl font-black text-sky-700 dark:text-sky-400 block">{totalQuantity.toLocaleString()}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-extrabold block mt-1 uppercase">Sản phẩm tích luỹ</span>
              </div>
            </div>

            <div className="bg-emerald-50/50 dark:bg-zinc-950/40 border-2 border-emerald-205 dark:border-zinc-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-xs">
              <span className="text-xs font-black uppercase text-emerald-950 dark:text-emerald-300 tracking-wide block">Lương tích lũy:</span>
              <div className="mt-2.5">
                <span className="font-mono text-2xl lg:text-3xl font-black text-emerald-700 dark:text-emerald-400 block">+{totalEarned.toLocaleString()}đ</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-extrabold block mt-1 uppercase">Tiền công quỹ gốc</span>
              </div>
            </div>

            <div className={`border-2 rounded-2xl p-4.5 flex flex-col justify-between shadow-xs ${
              remainingDebt > 0 
                ? 'bg-rose-50/85 dark:bg-rose-950/20 border-rose-400' 
                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300'
            }`}>
              <span className="text-xs font-black uppercase tracking-wide block text-slate-900 dark:text-slate-300">NỢ LƯƠNG HIỆN TẠI:</span>
              <div className="mt-2.5">
                <span className={`font-mono text-2xl lg:text-3xl font-black block ${remainingDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {remainingDebt.toLocaleString()}đ
                </span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold block mt-1 uppercase">Dư nợ sổ chi thợ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Main split layout */}
        {false && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column inside page */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Quick Payment or Salary Advance form */}
              <div className="bg-white dark:bg-zinc-950/80 border-2 border-slate-300 dark:border-zinc-800 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="pb-3 border-b-2 border-slate-200 dark:border-zinc-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-605 text-white flex items-center justify-center shrink-0 bg-emerald-600">
                    <DollarSign className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                      CHI LƯƠNG & CHUYỂN KHOẢN
                    </h4>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-normal">
                      Lập phiếu chi trả tiền công hoặc tạm ứng cho {activeWorker.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Số tiền chi trả lẻ (VNĐ):</label>
                    <input
                      type="number"
                      value={wkPayAmount === 0 ? '' : wkPayAmount}
                      onChange={(e) => setWkPayAmount(Number(e.target.value))}
                      placeholder="Nhập số tiền VNĐ. VD: 1500000"
                      className="w-full text-sm font-mono font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Ngày chi ghi nhận:</label>
                    <input
                      type="date"
                      value={wkPayDate}
                      onChange={(e) => setWkPayDate(e.target.value)}
                      className="w-full text-sm font-mono font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none text-slate-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Nội dung chi tiền:</label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setWkPayNote("Thanh toán lương may")}
                          className="text-xs bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/80 font-black px-2 py-1 rounded-md text-indigo-805 dark:text-indigo-300 cursor-pointer transition"
                        >
                          MAY CÔNG
                        </button>
                        <button
                          type="button"
                          onClick={() => setWkPayNote("Tạm ứng tiền công")}
                          className="text-xs bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 font-black px-2 py-1 rounded-md text-rose-800 dark:text-rose-300 cursor-pointer transition"
                        >
                          ỨNG TRƯỚC
                        </button>
                      </div>
                    </div>
                  <input
                    type="text"
                    value={wkPayNote}
                    onChange={(e) => setWkPayNote(e.target.value)}
                    placeholder="VD: Chi trả dồn lương tuần qua"
                    className="w-full text-sm font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (wkPayAmount <= 0) {
                      alert("Vui lòng nhập số tiền thanh toán hợp lệ!");
                      return;
                    }
                    const noteStr = wkPayNote.trim() || 'Trả lương may';
                    const newPayment: LaborPayment = {
                      id: 'pay_' + Date.now(),
                      weekKey: getVietnameseWeekKey(wkPayDate || getCurrentDateStr()),
                      amount: wkPayAmount,
                      date: wkPayDate || getCurrentDateStr(),
                      note: `Chi lương thợ ${activeWorker.name} - ${noteStr}`,
                      createdAt: Date.now()
                    };
                    setLaborPayments([newPayment, ...laborPayments]);
                    setWkPayAmount(0);
                    setWkPayNote('');
                    alert(`Đã hoàn tất lập phiếu chi dồn lương ${wkPayAmount.toLocaleString()}đ cho thợ ${activeWorker.name}!`);
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>XÁC NHẬN GIAO TIỀN CHI TRẢ</span>
                </button>
              </div>
            </div>

            {/* Quick assignment form */}
            <div className="bg-white dark:bg-zinc-950/80 border-2 border-slate-300 dark:border-zinc-800 rounded-2xl p-5 space-y-5 shadow-sm">
              <div className="pb-3 border-b-2 border-slate-200 dark:border-zinc-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-650 text-white flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                    GIAO MẺ CHẾ TÁC MỚI
                  </h4>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-normal">
                    Phân bổ trực tiếp đợt hàng may công đoạn cho thợ
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Chọn mẫu mộc sản phẩm:</label>
                  <select
                    value={wkJobModel}
                    onChange={(e) => {
                      const model = e.target.value;
                      setWkJobModel(model);
                      const assoc = operationBreakdowns.find(bd => bd.modelName === model);
                      if (assoc) {
                        setWkJobOps(assoc.operations.map(o => o.id));
                        setWkJobCustomPrices({});
                      } else {
                        setWkJobOps([]);
                        setWkJobCustomPrices({});
                      }
                    }}
                    className="w-full text-sm font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none text-slate-900 dark:text-zinc-100"
                  >
                    <option value="">-- CLICK CHỌN MẪU --</option>
                    {operationBreakdowns.map(bd => (
                      <option key={bd.id} value={bd.modelName}>{bd.modelName.toUpperCase()} ({bd.operations.length} công đoạn)</option>
                    ))}
                  </select>
                </div>

                {wkJobModel && (
                  <div className="space-y-3 bg-slate-100/50 dark:bg-zinc-900 p-3 border-2 border-slate-200 dark:border-zinc-800 rounded-xl">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-wider block">
                      CÁC CÔNG ĐOẠN MAY / GIA CÔNG:
                    </span>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                      {(() => {
                        const assoc = operationBreakdowns.find(bd => bd.modelName === wkJobModel);
                        if (!assoc) return null;
                        return assoc.operations.map(o => {
                          const isChecked = wkJobOps.includes(o.id);
                          const currentVal = wkJobCustomPrices[o.id] !== undefined ? wkJobCustomPrices[o.id] : o.price;
                          return (
                            <div key={o.id} className="flex items-center justify-between gap-1.5 p-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200 min-w-0 flex-1 select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setWkJobOps(wkJobOps.filter(id => id !== o.id));
                                    } else {
                                      setWkJobOps([...wkJobOps, o.id]);
                                    }
                                  }}
                                  className="rounded border-slate-300 accent-indigo-600 scale-100"
                                />
                                <span className="truncate">{o.name}</span>
                              </label>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  value={currentVal}
                                  onChange={(e) => {
                                    setWkJobCustomPrices({
                                      ...wkJobCustomPrices,
                                      [o.id]: Number(e.target.value)
                                    });
                                  }}
                                  className="w-18 text-xs font-mono font-black text-right p-1 border-2 border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-zinc-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                                <span className="text-xs text-slate-500 font-extrabold">đ</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Số lượng mộc:</label>
                    <input
                      type="number"
                      value={wkJobQty}
                      onChange={(e) => setWkJobQty(Number(e.target.value))}
                      className="w-full text-sm font-mono font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none text-slate-900 dark:text-zinc-100"
                      min={1}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800 dark:text-slate-300 uppercase block">Ngày giao việc:</label>
                    <input
                      type="date"
                      value={wkJobDate}
                      onChange={(e) => setWkJobDate(e.target.value)}
                      className="w-full text-sm font-mono font-black p-3 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-800 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!wkJobModel) {
                      alert("Vui lòng chọn mẫu sản phẩm trước!");
                      return;
                    }
                    if (wkJobOps.length === 0) {
                      alert("Vui lòng tick chọn ít nhất 1 công đoạn!");
                      return;
                    }
                    if (wkJobQty <= 0) {
                      alert("Vui lòng nhập số lượng hợp lệ (> 0)!");
                      return;
                    }
                    
                    const assoc = operationBreakdowns.find(b => b.modelName === wkJobModel);
                    if (!assoc) return;

                    const sumUnitPrice = assoc.operations
                      .filter(o => wkJobOps.includes(o.id))
                      .reduce((sum, o) => {
                        const customizedPrice = wkJobCustomPrices[o.id];
                        return sum + (customizedPrice !== undefined ? customizedPrice : o.price);
                      }, 0);

                    const totalAmount = sumUnitPrice * wkJobQty;

                    const newJob: WorkerJob = {
                      id: 'job_' + Date.now(),
                      workerId: activeWorker.id,
                      workerName: activeWorker.name,
                      modelName: wkJobModel,
                      quantity: wkJobQty,
                      selectedOperationIds: [...wkJobOps],
                      unitPrice: sumUnitPrice,
                      totalAmount,
                      date: wkJobDate || getCurrentDateStr(),
                      createdAt: Date.now(),
                      customPrices: { ...wkJobCustomPrices }
                    };

                    setWorkerJobs([newJob, ...workerJobs]);
                    
                    // Reset
                    setWkJobModel('');
                    setWkJobOps([]);
                    setWkJobCustomPrices({});
                    setWkJobQty(100);
                    alert(`Giao mẻ may cho thợ ${activeWorker.name} thành công! Công tích dồn thêm: ${totalAmount.toLocaleString()}đ.`);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  <PlusCircle className="w-4 h-4 stroke-[3]" />
                  <span>Xác nhận giao mẻ việc</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right Column inside page: Tabs list history */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Tab selection design */}
            <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl w-fit select-none">
              <button
                onClick={() => setWorkerActiveTab('jobs')}
                className={`py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  workerActiveTab === 'jobs'
                    ? 'bg-indigo-600 text-white dark:bg-indigo-600 shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-805'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="font-extrabold text-xs md:text-sm">SỐ MẺ HÀNG ({matchedJobs.length})</span>
              </button>
              <button
                onClick={() => setWorkerActiveTab('payments')}
                className={`py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  workerActiveTab === 'payments'
                    ? 'bg-indigo-600 text-white dark:bg-indigo-600 shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-805 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-4 h-4 stroke-[2.5]" />
                <span className="font-extrabold text-xs md:text-sm">PHIẾU ĐÃ NHẬN TIỀN ({matchedPayments.length})</span>
              </button>
            </div>

            {/* Sub-tab view panel */}
            {workerActiveTab === 'jobs' ? (
              <div className="bg-white dark:bg-zinc-950 border-2 border-slate-300 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-5">
                <div className="flex justify-between items-center pb-3 border-b-2 border-slate-200 dark:border-zinc-800">
                  <h4 className="font-black text-sm text-indigo-950 dark:text-indigo-400 uppercase tracking-tight">SỔ PHÂN CÔNG GIA CÔNG CHI TIẾT</h4>
                  <span className="text-xs text-slate-505 dark:text-slate-400 font-black uppercase tracking-wider">LỊCH SỬ</span>
                </div>

                {matchedJobs.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm space-y-3">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-650" />
                    <p className="font-extrabold text-slate-600 dark:text-slate-400">Chưa có mẻ gia công nào được ghi nhận cho thợ này.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1.5 scrollbar-thin">
                    {matchedJobs.map(job => {
                      const associatedBd = operationBreakdowns.find(bd => bd.modelName === job.modelName);
                      const opNamesCombined = associatedBd && associatedBd.operations
                        .filter(o => job.selectedOperationIds.includes(o.id))
                        .map(o => o.name)
                        .join(', ') || 'Công đoạn gia công';
                      return (
                        <div key={job.id} className="p-4 bg-slate-50 dark:bg-zinc-900/60 border-2 border-slate-250 dark:border-zinc-800 rounded-xl space-y-4 hover:bg-slate-100/50 transition shadow-xs">
                          
                          {/* Formal ticket layout explicitly answering request details */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white dark:bg-zinc-950 p-4 rounded-xl border-2 border-slate-200 dark:border-zinc-800 shadow-sm">
                            <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-zinc-800 pb-2 sm:pb-0 sm:pr-3">
                              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-400 block">👤 Tên Thợ</span>
                              <span className="text-sm font-black text-slate-900 dark:text-white uppercase block mt-1">{activeWorker.name}</span>
                            </div>
                            
                            <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-zinc-800 pb-2 sm:pb-0 sm:pr-3">
                              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-400 block">👕 Sản Phẩm</span>
                              <div className="space-y-1 mt-1">
                                <span className="text-sm font-black text-indigo-805 dark:text-indigo-400 block uppercase leading-none">{job.modelName}</span>
                                <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-300 block">SL: <span className="text-sm font-black text-slate-900 dark:text-white">{job.quantity.toLocaleString()}</span> cái</span>
                              </div>
                            </div>

                            <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-zinc-800 pb-2 sm:pb-0 sm:pr-3 col-span-1">
                              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-400 block">💸 Số Tiền Công</span>
                              <div className="mt-1">
                                <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400 block">+{job.totalAmount.toLocaleString()}đ</span>
                                <span className="text-[10px] text-slate-500 font-mono font-bold block mt-0.5">Giá mẻ: {job.unitPrice.toLocaleString()}đ/c</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-700 dark:text-indigo-400 block">🔧 Tên Công Việc</span>
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 block line-clamp-3 mt-1 leading-normal" title={opNamesCombined}>
                                {opNamesCombined}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-zinc-800 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold">
                              <Calendar className="w-3.5 h-3.5" />
                              Ngày phân việc: {formatVietnameseDate(job.date)}
                            </span>
                          </div>

                          {/* Tag of active operations for the job */}
                          <div className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                            <span className="text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 rounded-md inline-block">
                              Đơn giá chi tiết từng công đoạn trong mẻ may:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                              {associatedBd && associatedBd.operations
                                .filter(o => job.selectedOperationIds.includes(o.id))
                                .map(o => {
                                  const opPriceInDoc = (job.customPrices && job.customPrices[o.id] !== undefined) ? job.customPrices[o.id] : o.price;
                                  return (
                                    <div key={o.id} className="flex justify-between items-center border-b border-dashed border-slate-100 dark:border-zinc-900 pb-1">
                                      <span className="truncate text-slate-800 dark:text-slate-200 font-extrabold">• {o.name}:</span>
                                      <span className="font-mono text-xs font-black text-slate-900 dark:text-white shrink-0">
                                        {(opPriceInDoc * job.quantity).toLocaleString()}đ
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Quick Pay on individual job click */}
                          <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-300 dark:border-zinc-800">
                            <button
                              type="button"
                              onClick={() => triggerQuickPay(job)}
                              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-805 dark:text-emerald-450 rounded-xl text-xs font-black border border-emerald-200 transition cursor-pointer flex items-center gap-1 select-none"
                            >
                              <DollarSign className="w-4 h-4 stroke-[2.5]" />
                              <span>Tạm ứng lương nhanh đợt may này</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const confirmDelete = confirm("Bạn chắc chắn muốn huỷ mẻ hàng may này?");
                                if (confirmDelete) {
                                  setWorkerJobs(workerJobs.filter(j => j.id !== job.id));
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                              title="Xóa mẻ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-950 border-2 border-slate-300 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-5">
                <div className="flex justify-between items-center pb-3 border-b-2 border-slate-205 dark:border-zinc-800">
                  <h4 className="font-black text-sm text-emerald-950 dark:text-emerald-400 uppercase tracking-tight">NHẬT KÝ CHI TRẢ LƯƠNG & CHUYỂN KHOẢN</h4>
                  <span className="text-xs text-slate-450 font-black uppercase">ĐỐI CHIẾU</span>
                </div>

                {matchedPayments.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 dark:text-slate-450 text-sm space-y-3">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-650" />
                    <p className="font-extrabold text-slate-600 dark:text-slate-400">Chưa có ghi chép tạm ứng hay hoàn tất tiền lương nào.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1.5 scrollbar-thin">
                    {matchedPayments.map(pay => (
                      <div key={pay.id} className="p-3.5 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-250 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs hover:bg-slate-100/50 transition">
                        <div className="min-w-0 pr-2">
                          <p className="font-black text-slate-900 dark:text-slate-100 text-sm truncate">
                            {pay.note.replace(`Chi lương thợ ${activeWorker.name} -`, '').trim()}
                          </p>
                          <div className="flex justify-start items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-slate-500 font-bold">Mã phiếu: {pay.id}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-200 bg-slate-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">{formatVietnameseDate(pay.date)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-sm font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-md">-{pay.amount.toLocaleString()}đ</span>
                          <button
                            type="button"
                            onClick={() => {
                              const confirmDel = confirm(`Huỷ bỏ ghi chép chi lương mã ${pay.id}? Khoản lương tương ứng sẽ được trả về sổ nợ.`);
                              if (confirmDel) {
                                setLaborPayments(laborPayments.filter(p => p.id !== pay.id));
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                            title="Xóa ghi chi"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
        )}

      </div>
    );
  };

  return (
    <div className="space-y-6" id="production_container">
      {isViewer && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-2">
          <span>⚠️ Sếp đang đăng nhập dưới chế độ <strong>CHỈ XEM (VIEWER)</strong>. Toàn bộ tính năng phân bổ thợ, ghi chép công đoạn, và xuất nhập kho nguyên liệu đã bị tạm khóa để bảo vệ dữ liệu gốc.</span>
        </div>
      )}

      {/* Sub tabs header selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 backdrop-blur-xs select-none">
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full">
          <button
            onClick={() => handleSetSubTab('breakdown')}
            className={`flex-grow py-2.5 px-5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              subTab === 'breakdown'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm font-black'
                : 'text-slate-550 dark:text-slate-400 hover:text-slate-800 font-bold'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Phân Bổ Công Đoạn & Giao Việc</span>
          </button>
          <button
            onClick={() => handleSetSubTab('materials')}
            className={`flex-grow py-2.5 px-5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              subTab === 'materials'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm font-black'
                : 'text-slate-550 dark:text-slate-400 hover:text-slate-800 font-bold'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Kho Nguyên Liệu & Định Mức</span>
          </button>
        </div>
      </div>

      {subTab === 'materials' && (
        <div className="flex bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/50 dark:border-slate-800 p-1 rounded-xl w-full max-w-xs sm:max-w-sm select-none gap-1">
          <button
            onClick={() => setMaterialSubTab('inventory')}
            className={`flex-grow py-2 px-3 sm:px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              materialSubTab === 'inventory'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm font-black'
                : 'text-slate-550 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Sổ kho & Định mức</span>
          </button>
          <button
            onClick={() => setMaterialSubTab('fluctuation')}
            className={`flex-grow py-2 px-3 sm:px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              materialSubTab === 'fluctuation'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm font-black'
                : 'text-slate-550 dark:text-slate-400 hover:text-slate-850'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Nhật ký biến động</span>
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {subTab === 'breakdown' ? (
          activeWorkerId ? (
            <motion.div
              key="active-worker-profile-page"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {renderActiveWorkerPage()}
            </motion.div>
          ) : (
            <motion.div
              key="sub-breakdown-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
            {/* Left side: Setup configurations & directories */}
            <div className="lg:col-span-1 space-y-6">
              {/* Directory 1: Process Breakdowns per Model Name */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4.5 h-4.5 text-indigo-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">Cơ cấu công đoạn</h3>
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 font-mono text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                    {operationBreakdowns.length} Mẫu
                  </span>
                </div>

                {operationBreakdowns.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-350 dark:text-slate-650 mb-2" />
                    <p>Chưa có cấu trúc công đoạn mẫu mã nào.</p>
                    <p className="mt-1 text-[10px]">Tạo bảng công đoạn để bắt đầu phân chia tự động.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Chọn mẫu (bấm dòng để xem công đoạn):</p>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                      {operationBreakdowns.map(bd => {
                        const isSelected = activeBdId === bd.id;
                        const totalModelPay = bd.operations.reduce((s, o) => s + o.price, 0);
                        return (
                          <div 
                            key={bd.id}
                            onClick={() => setActiveBdId(isSelected ? null : bd.id)}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer select-none transition duration-150 ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-400 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-300 ring-2 ring-indigo-500/10'
                                : 'bg-slate-50 border-slate-150 hover:bg-slate-100/75 dark:bg-zinc-900/50 dark:border-slate-800 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}>
                                <Scissors className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px] leading-tight tracking-tight uppercase truncate">
                                  {bd.modelName}
                                </p>
                                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">{bd.operations.length} công đoạn</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2.5 shrink-0 pl-1">
                              <span className="text-[10px] font-mono font-black text-rose-500">{totalModelPay.toLocaleString()}đ</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-indigo-600 border-indigo-650' : 'border-slate-300 dark:border-slate-700'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed info preview for clicked breakdown model */}
                    {(() => {
                      const activeBd = operationBreakdowns.find(bd => bd.id === activeBdId);
                      if (!activeBd) return null;
                      const totalModelPay = activeBd.operations.reduce((s, o) => s + o.price, 0);
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-150/40 dark:border-indigo-900/30 rounded-2xl p-4.5 space-y-2.5"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-dashed border-indigo-100 dark:border-indigo-900/40">
                            <p className="font-extrabold text-xs text-indigo-950 dark:text-indigo-300 uppercase tracking-tight truncate max-w-[170px]">
                              {activeBd.modelName}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBreakdown(activeBd.id, activeBd.modelName);
                              }}
                              className="text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-900 p-1 rounded-lg transition"
                              title="Xóa cấu trúc mẫu này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                            {activeBd.operations.map((op, idx) => {
                              const workerOpt = workers.find(w => w.id === op.defaultWorkerId);
                              return (
                                <div key={op.id} className="flex justify-between items-center text-[11px] text-slate-700 dark:text-slate-300 pb-1.5 border-b border-slate-100/50 dark:border-zinc-850 font-semibold gap-2">
                                  <div className="flex items-center gap-1 shrink-0 truncate max-w-[155px]">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                                    <span className="truncate text-slate-850 dark:text-slate-100 font-extrabold">{op.name}</span>
                                    <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded font-mono shrink-0">
                                      x{op.multiplier || 1}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {workerOpt && (
                                      <span className="text-[9.5px] font-extrabold text-indigo-650 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-sm max-w-[70px] truncate">
                                        👤 {workerOpt.name}
                                      </span>
                                    )}
                                    <span className="font-mono text-slate-900 dark:text-slate-105 font-black shrink-0">+{op.price.toLocaleString()}đ</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="pt-2 font-black text-rose-500 text-xs flex justify-between items-center bg-white dark:bg-zinc-950 p-2.5 rounded-xl border border-rose-100/40 dark:border-rose-955/20">
                            <span>TỔNG ĐƠN GIÁ CHI CÔNG:</span>
                            <span className="font-mono text-[13px]">{totalModelPay.toLocaleString()}đ</span>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Directory 2: Worker Directory */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-650" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">Danh sách thợ gia công</h3>
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 font-mono text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                    {workers.length} Thợ
                  </span>
                </div>

                {workers.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                    <p>Chưa có thông tin danh sách thợ may.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 px-1 bg-slate-50/50 dark:bg-slate-900/50 py-1 rounded-lg">
                      <span className="text-slate-500 dark:text-slate-400">Danh bạ thợ may</span>
                      <span className="text-rose-500 dark:text-rose-455 font-black text-[9px] lowercase tracking-normal flex items-center gap-0.5">Gạt sang trái (←) để xoá</span>
                    </div>

                    <div className="hide-scrollbar space-y-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                      {workers.map(wk => {
                        const isSelected = activeWorkerId === wk.id;
                        const workerJobQuantity = workerJobs.filter(j => j.workerId === wk.id).reduce((sum, j) => sum + j.quantity, 0);
                        const totalAcc = workerJobs.filter(j => j.workerId === wk.id).reduce((sum, j) => sum + j.totalAmount, 0);
                        return (
                          <div key={wk.id} className="relative overflow-hidden rounded-xl">
                            {/* Swipe left to delete background element */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWorker(wk.id, wk.name);
                              }}
                              className="absolute right-0 top-0 bottom-0 w-[80px] bg-red-600 dark:bg-rose-700 text-white flex flex-col items-center justify-center cursor-pointer z-0 select-none hover:bg-red-700 transition"
                            >
                              <Trash2 className="w-4 h-4 mb-0.5 text-white animate-pulse" />
                              <span className="text-[9.5px] font-black uppercase tracking-wider text-center px-1">Xoá Thợ</span>
                            </div>

                            <motion.div 
                              drag="x"
                              dragConstraints={{ left: -80, right: 0 }}
                              dragElastic={{ left: 0.1, right: 0.5 }}
                              onDragEnd={(e, info) => {
                                if (info.offset.x < -65) {
                                  deleteWorker(wk.id, wk.name);
                                }
                              }}
                              onClick={() => {
                                setActiveWorkerId(wk.id);
                                setWorkerActiveTab('jobs');
                                setWkJobModel('');
                                setWkJobOps([]);
                                setWkJobCustomPrices({});
                                setWkJobQty(100);
                                setWkPayAmount(0);
                                setWkPayNote('');
                                setWkPayDate(getCurrentDateStr());
                                setWkJobDate(getCurrentDateStr());
                              }}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer select-none transition duration-150 relative z-10 bg-white dark:bg-slate-900 ${
                                isSelected
                                  ? 'bg-indigo-50/75 border-indigo-400 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-300 ring-2 ring-indigo-500/10'
                                  : 'bg-slate-50 border-slate-150 hover:bg-slate-100/75 dark:bg-zinc-900/50 dark:border-slate-800 text-slate-700 hover:border-slate-300'
                              }`}
                              style={{ x: 0 }}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                  isSelected ? 'bg-indigo-650 text-white shadow-xs' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                }`}>
                                  <Users className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px] leading-tight tracking-tight uppercase truncate">
                                    {wk.name}
                                  </p>
                                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">{workerJobQuantity.toLocaleString()} sản phẩm</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2.5 shrink-0 pl-1 pointer-events-none">
                                <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">{totalAcc.toLocaleString()}đ</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected ? 'bg-indigo-600 border-indigo-650' : 'border-slate-300 dark:border-slate-700'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />}
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Highly polished preview details card displayed immediately for chosen worker */}
                    {(() => {
                      const activeWorker = workers.find(w => w.id === previewWorkerId);
                      if (!activeWorker) return null;
                      const workerJobQuantity = workerJobs.filter(j => j.workerId === activeWorker.id).reduce((sum, j) => sum + j.quantity, 0);
                      const totalAcc = workerJobs.filter(j => j.workerId === activeWorker.id).reduce((sum, j) => sum + j.totalAmount, 0);
                      const matchedJobs = workerJobs.filter(j => j.workerId === activeWorker.id);
                      
                      // Calculate unique products
                      const uniqueProducts = Array.from(new Set(matchedJobs.map(j => j.modelName)));

                      // Get assigned operation names
                      const assignedTasks = (activeWorker.taskIds || []).map(tId => {
                        const t = tasks.find(tk => tk.id === tId);
                        return t ? t.name : '';
                      }).filter(Boolean);

                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 bg-slate-50 dark:bg-zinc-900/60 border border-slate-150 dark:border-slate-800/85 rounded-2xl p-4 space-y-3.5 shadow-sm"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200 dark:border-slate-800">
                            <div>
                              <p className="text-[9px] uppercase font-black tracking-tight text-slate-400 block">👤 THỢ MAY ĐANG CHỌN</p>
                              <p className="font-extrabold text-xs text-indigo-950 dark:text-slate-200 uppercase tracking-tight">
                                {activeWorker.name}
                              </p>
                              {activeWorker.phone && (
                                <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">SĐT: {activeWorker.phone}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            <div className="bg-white dark:bg-zinc-950 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                              <span className="text-[8.5px] text-slate-455 uppercase font-extrabold block">TỔNG SẢN LƯỢNG</span>
                              <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">{workerJobQuantity.toLocaleString()} cái</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-950 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                              <span className="text-[8.5px] text-slate-455 uppercase font-extrabold block">SỐ TIỀN CÔNG</span>
                              <span className="font-mono text-xs font-black text-rose-500">+{totalAcc.toLocaleString()}đ</span>
                            </div>
                          </div>

                          {/* Sản phẩm */}
                          <div className="bg-white dark:bg-zinc-950 p-3 border border-slate-100 dark:border-slate-850 rounded-xl space-y-1.5">
                            <span className="text-[8.5px] text-slate-455 uppercase font-extrabold block">👕 SẢN PHẨM KHAI THÁC</span>
                            <div className="flex flex-wrap gap-1">
                              {uniqueProducts.length === 0 ? (
                                <span className="text-[9.5px] text-slate-400 italic">Chưa phát sinh sản phẩm gia công</span>
                              ) : (
                                uniqueProducts.map(pName => (
                                  <span key={pName} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded font-extrabold border border-emerald-100/30 uppercase">
                                    {pName}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Công việc đảm nhận */}
                          <div className="bg-white dark:bg-zinc-950 p-3 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-[8.5px] font-extrabold text-slate-455 uppercase mb-0.5">
                              <span>🔧 CÔNG VIỆC/CÔNG ĐOẠN ĐẢM NHẬN</span>
                              {!isEditingWorkerTasks ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingWorkerTasks(true);
                                    setEditingWorkerTaskIds(activeWorker.taskIds || []);
                                  }}
                                  className="text-indigo-650 dark:text-indigo-400 font-extrabold hover:underline flex items-center gap-0.5 cursor-pointer text-[9px]"
                                >
                                  <Edit className="w-2.5 h-2.5" />
                                  <span>Gán việc</span>
                                </button>
                              ) : (
                                <div className="flex gap-2 text-[9px]">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveWorkerTasks(activeWorker.id)}
                                    className="text-emerald-600 font-bold hover:underline cursor-pointer"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingWorkerTasks(false)}
                                    className="text-slate-400 font-bold hover:underline cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              )}
                            </div>

                            {!isEditingWorkerTasks ? (
                              <div className="flex flex-wrap gap-1">
                                {assignedTasks.length === 0 ? (
                                  <span className="text-[9.5px] text-slate-400 italic">Chưa gán công việc hay tay nghề chi tiết</span>
                                ) : (
                                  assignedTasks.map(name => (
                                    <span key={name} className="bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-655 dark:text-indigo-450 text-[9px] px-2 py-0.5 rounded-md font-bold border border-indigo-100/10">
                                      {name}
                                    </span>
                                  ))
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                                {tasks.map(task => {
                                  const isChecked = editingWorkerTaskIds.includes(task.id);
                                  return (
                                    <label
                                      key={task.id}
                                      className={`flex items-start gap-1 p-1.5 rounded-md text-[9.5px] font-bold cursor-pointer transition select-none ${
                                        isChecked
                                          ? 'bg-indigo-50/60 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-855 bg-slate-50 dark:bg-zinc-900'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setEditingWorkerTaskIds(editingWorkerTaskIds.filter(id => id !== task.id));
                                          } else {
                                            setEditingWorkerTaskIds([...editingWorkerTaskIds, task.id]);
                                          }
                                        }}
                                        className="mt-0.5 rounded border-slate-300 accent-indigo-600 scale-90 cursor-pointer"
                                      />
                                      <span className="truncate" title={task.name}>{task.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Quick details about recent assigned jobs with required formatting */}
                          <div className="bg-white dark:bg-zinc-950 p-3 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2">
                            <span className="text-[8.5px] text-slate-455 uppercase font-extrabold block">📋 NHẬT KÝ LÀM VIỆC GẦN ĐÂY</span>
                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                              {matchedJobs.length === 0 ? (
                                <p className="text-[9.5px] text-slate-400 italic text-center py-1">Chưa có mẻ hàng gia công nào</p>
                              ) : (
                                matchedJobs.slice(0, 3).map(j => {
                                  const associatedBd = operationBreakdowns.find(bd => bd.modelName === j.modelName);
                                  const opNames = associatedBd
                                    ? associatedBd.operations
                                        .filter(o => j.selectedOperationIds.includes(o.id))
                                        .map(o => o.name)
                                        .join(', ')
                                    : 'Công đoạn';
                                  return (
                                    <div key={j.id} className="text-[9.5px] border-b border-slate-100 dark:border-slate-850 pb-1.5 last:border-0 last:pb-0">
                                      <div className="flex justify-between items-center text-slate-500">
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">Sản phẩm: {j.modelName} ({j.quantity}c)</span>
                                        <span className="font-mono text-indigo-600">+{j.totalAmount.toLocaleString()}đ</span>
                                      </div>
                                      <p className="text-slate-400 font-medium truncate mt-0.5" title={opNames}>• Công việc: {opNames}</p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Navigation button to open the full detailed records page */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWorkerId(activeWorker.id);
                                setWorkerActiveTab('jobs');
                                setWkJobModel('');
                                setWkJobOps([]);
                                setWkJobCustomPrices({});
                                setWkJobQty(100);
                                setWkPayAmount(0);
                                setWkPayNote('');
                                setWkPayDate(getCurrentDateStr());
                                setWkJobDate(getCurrentDateStr());
                              }}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10.5px] font-black uppercase text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Layers className="w-4 h-4" />
                              <span>Mở sổ giao việc & trả lương thợ chi tiết →</span>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Worker Jobs Work Ticket ledger log */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs h-full flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">NHẬT KÝ CHI TIẾT CÔNG THỢ GIA CÔNG</h3>
                    <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                      Bảng theo dõi các đợt nhận hàng sản xuất mộc theo công đoạn chi tiết
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-black">Đã thanh toán:</p>
                      <p className="text-sm font-black text-emerald-600 font-mono bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl inline-block mt-0.5 shadow-2xs">
                        {totalPaidAccumulated.toLocaleString()}đ
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-rose-700 dark:text-rose-400 uppercase tracking-wider font-black">Tiền công:</p>
                      <p className="text-sm font-bold text-rose-600 font-mono bg-rose-50/80 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl inline-block mt-0.5 border border-rose-200/50 dark:border-rose-900/30 shadow-2xs">
                        {totalLaborCostRemaining.toLocaleString()}đ
                      </p>
                    </div>
                  </div>
                </div>

                {workerJobs.length > 0 && totalLaborCostRemaining > 0 && (
                  <div className="mt-4 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-extrabold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider block">Thanh toán dồn tổng công thợ</span>
                        <p className="text-xs text-slate-500">Hệ thống sẽ tự động trừ dồn số tiền vào các đợt công thợ chưa trả xong (từ cũ đến mới)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOverallPayPanel(!showOverallPayPanel);
                          setOverallPayAmount(totalLaborCostRemaining.toString());
                        }}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-750 text-white text-[11px] font-bold rounded-lg cursor-pointer transition shrink-0 flex items-center gap-1.5 shadow-xs"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Thanh toán tổng nhanh</span>
                      </button>
                    </div>

                    {showOverallPayPanel && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800/80 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Số tiền thanh toán (đ)</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                placeholder="Nhập số tiền trả dồn..."
                                value={overallPayAmount}
                                onChange={(e) => setOverallPayAmount(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 text-slate-800 dark:text-slate-200 rounded-lg p-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => setOverallPayAmount(totalLaborCostRemaining.toString())}
                                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-250 transition cursor-pointer"
                              >
                                Trả hết
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Thao tác</label>
                            <button
                              type="button"
                              onClick={() => {
                                const amt = parseInt(overallPayAmount);
                                if (isNaN(amt) || amt <= 0) {
                                  alert('Vui lòng nhập số tiền thanh toán hợp lệ lớn hơn 0!');
                                  return;
                                }
                                if (amt > totalLaborCostRemaining) {
                                  alert(`Số tiền nhập (${amt.toLocaleString()}đ) lớn hơn tổng nợ công thợ hiện tại (${totalLaborCostRemaining.toLocaleString()}đ)!`);
                                  return;
                                }

                                let remainingToDistribute = amt;
                                const jobsWithDebt = workerJobs
                                  .map((j, originalIndex) => ({
                                    ...j,
                                    originalIndex,
                                    debt: j.totalAmount - (j.paidAmount || 0),
                                  }))
                                  .filter(j => j.debt > 0)
                                  .sort((a, b) => a.createdAt - b.createdAt);

                                const paymentsToCreate: LaborPayment[] = [];
                                const updatedJobs = [...workerJobs];

                                for (const j of jobsWithDebt) {
                                  if (remainingToDistribute <= 0) break;
                                  
                                  const payForThisJob = Math.min(j.debt, remainingToDistribute);
                                  remainingToDistribute -= payForThisJob;

                                  const originalJob = { ...updatedJobs[j.originalIndex] };
                                  originalJob.paidAmount = (originalJob.paidAmount || 0) + payForThisJob;
                                  updatedJobs[j.originalIndex] = originalJob;

                                  paymentsToCreate.push({
                                    id: 'pay_overall_' + Date.now() + '_' + originalJob.id + '_' + Math.random().toString(36).substr(2, 5),
                                    weekKey: getVietnameseWeekKey(getCurrentDateStr()),
                                    amount: payForThisJob,
                                    date: getCurrentDateStr(),
                                    note: `Thanh toán dồn tổng: trừ ${payForThisJob.toLocaleString()}đ vào đợt ${originalJob.workerName} (${originalJob.quantity} cái ${originalJob.modelName})`,
                                    createdAt: Date.now()
                                  });
                                }

                                setWorkerJobs(updatedJobs);
                                setLaborPayments([...paymentsToCreate, ...laborPayments]);

                                alert(`Đã thanh toán dồn tổng ${amt.toLocaleString()}đ thành công và tự động trừ dồn vào ${paymentsToCreate.length} đợt công thợ chưa thanh toán!`);
                                setOverallPayAmount('');
                                setShowOverallPayPanel(false);
                              }}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg tracking-wider transition active:scale-98 cursor-pointer flex items-center justify-center gap-1 shadow-sm mt-0.5 sm:mt-5"
                            >
                              <span>Xác Nhận Nộp</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {workerJobs.length === 0 ? (
                  <div className="text-center py-20 text-slate-450 dark:text-slate-500 space-y-3 flex-grow flex flex-col justify-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-350 dark:text-slate-650" />
                    <p className="text-sm">Chưa có nhật ký ghi nhận công thợ phân bổ nào.</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Quy trình: Bấm nút "Giao việc / Nhật ký công thợ" ở trên, chọn thợ, chọn mẫu, hệ thống sẽ mở bảng công đoạn cho bạn chỉ việc tick chọn cực kỳ chuyên nghiệp!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-grow max-h-[550px] overflow-y-auto mt-4 scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-55 dark:bg-zinc-900/60 text-slate-500 border-b border-slate-100 dark:border-slate-800 font-bold uppercase text-[8.5px] tracking-wider">
                          <th className="py-1.5 px-2 text-center w-10 text-slate-450">Stt</th>
                          <th className="py-1.5 px-2">Thợ Gia Công</th>
                          <th className="py-1.5 px-2">Mã hàng (Mẫu)</th>
                          <th className="py-1.5 px-2">Công đoạn</th>
                          <th className="py-1.5 px-2 text-center w-16">SL (Cái)</th>
                          <th className="py-1.5 px-2 text-right">Đơn giá</th>
                          <th className="py-1.5 px-2 text-right">Thành Tiền</th>
                          <th className="py-1.5 px-2 text-center w-24">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                        {workerJobs.map((job, idx) => {
                          const associatedBd = operationBreakdowns.find(bd => bd.modelName === job.modelName);
                          const totalBdOps = associatedBd ? associatedBd.operations.length : 0;
                          const activeCount = job.selectedOperationIds.length;
                          const isExpanded = !!expandedJobIds[job.id];
                          const remainingAmount = job.totalAmount - (job.paidAmount || 0);

                          return (
                            <React.Fragment key={job.id}>
                              <tr 
                                className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-all duration-150 text-[11px] ${isExpanded ? 'bg-indigo-50/10 dark:bg-indigo-950/10' : ''}`}
                              >
                                <td className="py-1 px-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                <td className="py-1 px-2">
                                  <span className="font-extrabold text-slate-850 dark:text-slate-100 block leading-tight">{job.workerName}</span>
                                  <span className="text-[9px] text-slate-400 font-mono leading-none block mt-0.5">{formatVietnameseDate(job.date)}</span>
                                </td>
                                <td className="py-1 px-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 block leading-tight">{job.modelName}</span>
                                  <span className="text-[9px] text-slate-400 leading-none block mt-0.5">Mộc</span>
                                </td>
                                <td className="py-1 px-2">
                                  <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-1.5 py-0.5 rounded-full inline-block">
                                    {activeCount}/{totalBdOps} việc
                                  </span>
                                </td>
                                <td className="py-1 px-2 text-center font-mono font-bold text-slate-755 dark:text-slate-300">
                                  {job.quantity.toLocaleString()}
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {job.unitPrice.toLocaleString()}đ
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-black text-rose-600">
                                  <div className="flex flex-col items-end leading-tight">
                                    <span>{job.totalAmount.toLocaleString()}đ</span>
                                    {job.paidAmount && job.paidAmount > 0 ? (
                                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.1 rounded mt-0.5">
                                        Đã trả: {job.paidAmount.toLocaleString()}đ
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nowExpanded = !isExpanded;
                                        setExpandedJobIds({
                                          ...expandedJobIds,
                                          [job.id]: nowExpanded
                                        });
                                        if (nowExpanded) {
                                          setPayInputs({
                                            ...payInputs,
                                            [job.id]: remainingAmount > 0 ? remainingAmount.toString() : ''
                                          });
                                        }
                                      }}
                                      className={`px-1.5 py-0.5 ${isExpanded ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-205'} rounded-md text-[9px] font-bold transition cursor-pointer`}
                                    >
                                      {isExpanded ? "Ẩn" : "Hiện"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteJob(job.id)}
                                      className="p-0.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded panel for selected details & payment */}
                              {isExpanded && (
                                <tr className="bg-slate-50/50 dark:bg-zinc-950/20 border-b border-indigo-100/50 dark:border-indigo-900/20">
                                  <td colSpan={8} className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Left sub-details */}
                                      <div className="space-y-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-xl p-3">
                                        <p className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                          Danh sách công đoạn đã làm:
                                        </p>
                                        {associatedBd ? (
                                          <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                            {associatedBd.operations
                                              .filter(o => job.selectedOperationIds.includes(o.id))
                                              .map(o => {
                                                const price = (job.customPrices && job.customPrices[o.id] !== undefined) ? job.customPrices[o.id] : o.price;
                                                return (
                                                  <div key={o.id} className="flex justify-between items-center text-[11px] border-b border-dashed border-slate-100 dark:border-zinc-800 pb-1 text-slate-600 dark:text-slate-300">
                                                    <span>• {o.name}:</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                      {price.toLocaleString()}đ × {job.quantity.toLocaleString()} = {(price * job.quantity).toLocaleString()}đ
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-slate-400 italic">Không tìm thấy thông tin định mức mẫu.</p>
                                        )}
                                      </div>

                                      {/* Right direct payments */}
                                      <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-xs">
                                        <div>
                                          <div className="flex items-center justify-between border-b pb-1.5 border-slate-100 dark:border-zinc-800 mb-2">
                                            <span className="text-[10px] font-extrabold text-rose-650 dark:text-rose-400 uppercase tracking-wider">Thanh toán tiền thợ</span>
                                            <span className="text-[10px] bg-indigo-50 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded">
                                              Tổng: {job.totalAmount.toLocaleString()}đ
                                            </span>
                                          </div>

                                          <div className="space-y-1 text-xs mb-3">
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                                              <span>Đã trả: <strong className="text-emerald-600 font-mono">{(job.paidAmount || 0).toLocaleString()}đ</strong></span>
                                              <span>Còn nợ: <strong className="text-rose-600 font-mono">{remainingAmount.toLocaleString()}đ</strong></span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, ((job.paidAmount || 0) / job.totalAmount) * 100)}%` }}
                                              />
                                            </div>
                                          </div>

                                          {remainingAmount > 0 ? (
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-1.5">
                                                <input
                                                  type="number"
                                                  placeholder="Nhập số tiền trả thợ..."
                                                  value={payInputs[job.id] || ''}
                                                  onChange={(e) => {
                                                    setPayInputs({
                                                      ...payInputs,
                                                      [job.id]: e.target.value
                                                    });
                                                  }}
                                                  className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-indigo-500 font-mono"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPayInputs({
                                                      ...payInputs,
                                                      [job.id]: remainingAmount.toString()
                                                    });
                                                  }}
                                                  className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-[10px] font-bold border border-indigo-200/50 cursor-pointer text-center"
                                                >
                                                  Trả hết
                                                </button>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const inputVal = payInputs[job.id] || '';
                                                  const amt = parseInt(inputVal);
                                                  if (isNaN(amt) || amt <= 0) {
                                                    alert('Vui lòng nhập số tiền thanh toán hợp lệ lớn hơn 0!');
                                                    return;
                                                  }
                                                  if (amt > remainingAmount) {
                                                    alert(`Số tiền nhập (${amt.toLocaleString()}đ) lớn hơn số nợ còn lại của đợt này (${remainingAmount.toLocaleString()}đ)!`);
                                                    return;
                                                  }

                                                  const updatedJobs = workerJobs.map(j => {
                                                    if (j.id === job.id) {
                                                      const currentPaid = j.paidAmount || 0;
                                                      return {
                                                        ...j,
                                                        paidAmount: currentPaid + amt
                                                      };
                                                    }
                                                    return j;
                                                  });
                                                  setWorkerJobs(updatedJobs);

                                                  // Log payment to general list
                                                  const newPayment: LaborPayment = {
                                                    id: 'pay_job_' + Date.now() + '_' + job.id,
                                                    weekKey: getVietnameseWeekKey(getCurrentDateStr()),
                                                    amount: amt,
                                                    date: getCurrentDateStr(),
                                                    note: `Thanh toán ${job.workerName} - ${job.quantity} cái ${job.modelName} (Thuộc đợt việc ngày ${job.date})`,
                                                    createdAt: Date.now()
                                                  };

                                                  setLaborPayments([newPayment, ...laborPayments]);
                                                  alert(`Đã thanh toán thành công ${amt.toLocaleString()}đ và trừ vào tiền công của đợt này!`);
                                                  
                                                  const nextRemaining = remainingAmount - amt;
                                                  if (nextRemaining <= 0) {
                                                    setExpandedJobIds({
                                                      ...expandedJobIds,
                                                      [job.id]: false
                                                    });
                                                  } else {
                                                    setPayInputs({
                                                      ...payInputs,
                                                      [job.id]: nextRemaining.toString()
                                                    });
                                                  }
                                                }}
                                                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg tracking-wider transition active:scale-98 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                              >
                                                <span>XÁC NHẬN THANH TOÁN TIỀN CÔNG</span>
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 p-3 rounded-lg text-xs font-black border border-emerald-250/25">
                                              <span>✓ ĐÃ THANH TOÁN TOÀN BỘ ĐỢT NÀY!</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          )
        ) : (
          materialSubTab === 'fluctuation' ? (
            <motion.div
              key="materials-fluctuation"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 w-full"
            >
              {(() => {
                // Filter logs matches
                const filteredLogs = (materialLogs || []).filter(log => {
                  if (!log) return false;
                  const matchesSearch = !fluctSearch.trim() || 
                    (log.materialName && log.materialName.toLowerCase().includes(fluctSearch.toLowerCase())) ||
                    (log.note && log.note.toLowerCase().includes(fluctSearch.toLowerCase())) ||
                    (log.operator && log.operator.toLowerCase().includes(fluctSearch.toLowerCase()));
                  const matchesMat = !fluctMatFilter || log.materialId === fluctMatFilter;
                  const matchesType = fluctTypeFilter === 'all' || log.type === fluctTypeFilter;
                  return matchesSearch && matchesMat && matchesType;
                });

                // Calculate stats on filtered or all logs
                const totalTransactions = (materialLogs || []).length;
                const totalNhap = (materialLogs || []).filter(l => l.type === 'nhap').reduce((sum, l) => sum + (l.quantity || 0), 0);
                const totalXuat = (materialLogs || []).filter(l => l.type === 'xuat').reduce((sum, l) => sum + (l.quantity || 0), 0);

                return (
                  <div className="space-y-6 col-span-12">
                    {/* KPI Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 block">Tổng số giao dịch</span>
                          <span className="text-2xl font-black font-mono mt-1 block dark:text-white">
                            {totalTransactions.toLocaleString()} <span className="text-xs font-sans font-medium text-slate-400">lần</span>
                          </span>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-650 dark:text-indigo-400">
                          <ListOrdered className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-650 dark:text-emerald-400 block">Tổng Nhập kho</span>
                          <span className="text-2xl font-black font-mono mt-1 block text-emerald-650 dark:text-emerald-400">
                            +{totalNhap.toLocaleString()} <span className="text-xs font-sans font-medium text-slate-400">đv</span>
                          </span>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-650 dark:text-emerald-400">
                          <ArrowUp className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-wider text-rose-650 dark:text-rose-400 block">Tổng Xuất kho</span>
                          <span className="text-2xl font-black font-mono mt-1 block text-rose-650 dark:text-rose-400">
                            -{totalXuat.toLocaleString()} <span className="text-xs font-sans font-medium text-slate-400">đv</span>
                          </span>
                        </div>
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-650 dark:text-rose-455">
                          <ArrowDown className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Filter Controls Component */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Archive className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                            Bộ lọc nhật ký biến động
                          </h4>
                        </div>
                        <span className="text-[10.5px] font-bold text-slate-450 uppercase">{filteredLogs.length} kết quả</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Search Query */}
                        <div className="md:col-span-5 relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            value={fluctSearch}
                            onChange={(e) => setFluctSearch(e.target.value)}
                            placeholder="Tìm ghi chú, nguyên liệu, người làm..."
                            className="w-full text-xs font-bold pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                          />
                        </div>

                        {/* Material Filter */}
                        <div className="md:col-span-4">
                          <select
                            value={fluctMatFilter}
                            onChange={(e) => setFluctMatFilter(e.target.value)}
                            className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                          >
                            <option value="">-- Tất cả nguyên liệu --</option>
                            {rawMaterials.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Operation Type Filter */}
                        <div className="md:col-span-3">
                          <select
                            value={fluctTypeFilter}
                            onChange={(e) => setFluctTypeFilter(e.target.value as any)}
                            className="w-full text-xs font-bold p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                          >
                            <option value="all">Tất cả biến động</option>
                            <option value="nhap">Nhập kho (+)</option>
                            <option value="xuat">Xuất kho (-)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Ledger History List Table */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">SỔ NHẬT KÝ CHI TIẾT BIẾN ĐỘNG (NHẬP/XUẤT)</h4>
                      </div>

                      {filteredLogs.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs">
                          <AlertCircle className="w-10 h-10 mx-auto text-slate-350 dark:text-slate-650 mb-2" />
                          <p>Không có dữ liệu biến động kho nào khớp với điều kiện lọc.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-zinc-900/60 text-slate-400 border-b border-slate-150 dark:border-slate-800 uppercase font-black text-[9.5px] tracking-wider">
                                <th className="py-3 px-4">Thời gian</th>
                                <th className="py-3 px-4">Nguyên liệu</th>
                                <th className="py-3 px-4 text-center">Giao dịch</th>
                                <th className="py-3 px-4 text-right">Lượng biến động</th>
                                <th className="py-3 px-4 text-right">Tồn kho cũ → mới</th>
                                <th className="py-3 px-4">Người thực hiện</th>
                                <th className="py-3 px-4">Chi tiết ghi chú</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-700 dark:text-slate-300">
                              {filteredLogs.map(log => {
                                const isNhap = log.type === 'nhap';
                                return (
                                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/10 transition">
                                    <td className="py-3 px-4 text-slate-450 dark:text-slate-500 font-mono whitespace-nowrap text-[11px]">
                                      {formatVietnameseDate(log.date)}
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="font-extrabold text-slate-900 dark:text-white block">{log.materialName}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-nowrap">
                                      {isNhap ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-450 uppercase border border-emerald-200/50 dark:border-emerald-900/30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          Nhập kho
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-650 dark:text-rose-450 uppercase border border-rose-200/50 dark:border-rose-900/30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                          Xuất kho
                                        </span>
                                      )}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-black font-mono text-sm whitespace-nowrap ${isNhap ? 'text-emerald-650 dark:text-emerald-450' : 'text-rose-650 dark:text-rose-450'}`}>
                                      {isNhap ? '+' : '-'}{(log.quantity || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-450 dark:text-slate-500 whitespace-nowrap">
                                      {(log.balanceBefore || 0).toLocaleString()} → <span className="font-black text-slate-800 dark:text-indigo-300">{(log.balanceAfter || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="px-2 py-1 bg-slate-50 dark:bg-zinc-800 rounded-md text-[11px] text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-zinc-700 font-bold whitespace-nowrap">
                                        {log.operator}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[220px] truncate" title={log.note || ''}>
                                      {log.note || '--'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : (
            <motion.div
              key="sub-materials-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Stock card grids section */}
            <div className="lg:col-span-8 space-y-6">
              {/* Material Inventory Stock overview */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Archive className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">KHO VẬT TƯ & VẢI NGUYÊN LIỆU ĐẦU VÀO</h3>
                  </div>
                  {lowStockMaterials.length > 0 && (
                    <span className="text-[9.5px] bg-red-50 dark:bg-red-950 font-bold text-red-650 dark:text-red-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      {lowStockMaterials.length} Đang Sắp Hết Vải
                    </span>
                  )}
                </div>

                {rawMaterials.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-350 dark:text-slate-650 mb-2" />
                    <p>Kho nguyên liệu đang trống.</p>
                    <p className="mt-1 text-[11px] text-slate-400">Bấm "Thêm loại vải/vật tư" để nhập vốn kho khởi nguồn!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rawMaterials.map(mat => {
                      const isLow = mat.currentStock <= mat.minAlertLevel;
                      // Find model recipes using this
                      const associatedRecipes = materialRecipes.filter(r => r.items.some(it => it.materialId === mat.id));

                      return (
                        <div 
                          key={mat.id}
                          className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                            isLow 
                              ? 'bg-rose-50/20 border-red-200/60 dark:bg-red-950/5 dark:border-red-900/30' 
                              : 'bg-slate-50/50 border-slate-150 dark:bg-zinc-900/30 dark:border-slate-800/80 hover:border-emerald-500/20 dark:hover:border-emerald-950/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="px-2 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 font-mono text-[9px] rounded-md font-bold text-slate-500 uppercase tracking-tight">Vật tư sỉ</span>
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-2 tracking-tight">{mat.name}</h4>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm(`Bạn chắc chắn muốn xóa nguyên vật liệu "${mat.name}"?`)) {
                                  setRawMaterials(rawMaterials.filter(m => m.id !== mat.id));
                                  // Clean up recipe associations
                                  setMaterialRecipes(materialRecipes.map(r => ({
                                    ...r,
                                    items: r.items.filter(i => i.materialId !== mat.id)
                                  })));
                                }
                              }}
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 hover:shadow-xs transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mt-4 flex items-end justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div>
                              <p className="text-[10px] text-slate-450 dark:text-slate-500">
                                Trữ lượng định mức tối thiểu: <span className="font-bold">{mat.minAlertLevel.toLocaleString()} {mat.unit}</span>
                              </p>
                              {isLow ? (
                                <p className="text-[9.5px] font-bold text-red-600 mt-1.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Yêu cầu bổ sung kho gấp!
                                </p>
                              ) : (
                                <p className="text-[9.5px] font-medium text-emerald-600 mt-1.5 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Lượng tồn kho an toàn
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">Tồn kho hiện tại:</p>
                              <p className={`text-lg font-black font-mono leading-none mt-1 ${isLow ? 'text-red-650' : 'text-emerald-650'}`}>
                                {mat.currentStock.toLocaleString()} <span className="text-xs font-serif font-medium">{mat.unit}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Material Reimport ledger logs */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">NHẬT KÝ NHẬP THÊM KHU KHO NGUYÊN LIỆU</h3>
                  </div>
                </div>

                {materialReimports.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">Chưa có lịch sử nhập thêm mộc kho vật liệu nào.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[220px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-900/60 text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase font-bold text-[9px] tracking-wider py-1">
                          <th className="py-2 px-3">Ngày nhập</th>
                          <th className="py-2 px-3">Nguyên liệu</th>
                          <th className="py-2 px-3 text-right">Lượng dồn thêm</th>
                          <th className="py-2 px-3">Ghi chú vận hành</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-350">
                        {materialReimports.map(ri => (
                          <tr key={ri.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/10 transition">
                            <td className="py-2 px-3 text-slate-450 dark:text-slate-500 font-mono">{formatVietnameseDate(ri.date)}</td>
                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{ri.materialName}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-650 font-mono">+{ri.quantityAdded.toLocaleString()}</td>
                            <td className="py-2 px-3 text-[11px] text-slate-400 truncate max-w-[170px]" title={ri.note}>{ri.note || "Vật tư định kỳ"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right details section: Consumption Recipe formulas & Production runs log */}
            <div className="lg:col-span-4 space-y-6">
              {/* Formulas configuration & Recipes */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">Định mức tiêu hao</h3>
                  </div>
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 font-mono text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    {materialRecipes.length} Kiểu mẫu
                  </span>
                </div>

                {materialRecipes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    <p>Chưa định nghĩa định mức tiêu hao.</p>
                    <p className="mt-1 text-[10px]">Định lượng lượng vải cần dùng để tự động cảnh báo vật phẩm sản lượng!</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {materialRecipes.map(recipe => (
                      <div 
                        key={recipe.id}
                        className="p-3 bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100/50 dark:hover:bg-zinc-900 border border-slate-150 dark:border-slate-800/80 rounded-xl transition"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200 tracking-tight">{recipe.modelName}</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditRecipe(recipe)}
                              className="text-slate-400 hover:text-indigo-650 p-1 rounded-md hover:bg-white dark:hover:bg-zinc-800 transition"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Bạn muốn hủy bảng định mức của mẫu "${recipe.modelName}"?`)) {
                                  setMaterialRecipes(materialRecipes.filter(r => r.id !== recipe.id));
                                }
                              }}
                              className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-white dark:hover:bg-zinc-800 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 bg-white dark:bg-zinc-950 p-2 rounded-lg space-y-1.5 text-[10px] border border-slate-100 dark:border-slate-850">
                          {recipe.items.map(item => {
                            const matchingMat = rawMaterials.find(m => m.id === item.materialId);
                            return (
                              <div key={item.materialId} className="flex justify-between text-slate-650 dark:text-slate-400">
                                <span>• {matchingMat ? matchingMat.name : "Nguyên liệu đã bị xóa"}</span>
                                <span className="font-mono text-slate-850 dark:text-slate-200 font-bold">
                                  {item.consumptionRate.toLocaleString()} {matchingMat ? matchingMat.unit : "mét"}/cái
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historic production runs log */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">Nhật ký đợt sản xuất</h3>
                  </div>
                  <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 font-mono text-slate-500 px-2 py-0.5 rounded-full font-bold">
                    {productionBatches.length} Đợt
                  </span>
                </div>

                {productionBatches.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">Chưa có nhật ký lệnh sản xuất.</p>
                ) : (
                  <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                    {productionBatches.map(batch => (
                      <div 
                        key={batch.id} 
                        className="p-3 bg-slate-50 dark:bg-zinc-900/15 border border-slate-150 dark:border-slate-800/60 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 block">{batch.modelName}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{formatVietnameseDate(batch.date)}</span>
                          </div>
                          <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-black px-2 py-0.5 rounded-lg font-mono text-[11.5px]">
                            {batch.targetQuantity.toLocaleString()} cái
                          </span>
                        </div>

                        <div className="bg-white dark:bg-zinc-950/70 p-2 rounded-lg text-[10px] space-y-1">
                          <p className="font-bold text-slate-400 uppercase text-[8px] mb-1 tracking-wider">Nguyên liệu đã khấu trừ kho:</p>
                          {batch.materialsUsed.map(m => (
                            <div key={m.materialId} className="flex justify-between text-slate-650 dark:text-slate-400">
                              <span>• {m.materialName}</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                                -{m.amountUsed.toLocaleString()} {m.materialUnit}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Actions bar for viewing, editing, and deleting */}
                        <div className="flex justify-end gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/40">
                          <button
                            onClick={() => handleViewBatch(batch)}
                            className="px-2.5 py-1 bg-indigo-50/55 hover:bg-indigo-100/70 text-indigo-650 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-[10px]"
                          >
                            <Eye className="w-3 h-3" /> Xem
                          </button>
                          <button
                            onClick={() => handleStartEditBatch(batch)}
                            className="px-2.5 py-1 bg-amber-50/55 hover:bg-amber-100/70 text-amber-650 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 dark:text-amber-400 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-[10px]"
                          >
                            <Edit className="w-3.5 h-3.5" /> Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(batch)}
                            className="px-2.5 py-1 bg-rose-50/55 hover:bg-rose-100/70 text-rose-650 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 dark:text-rose-400 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-[10px]"
                          >
                            <Trash2 className="w-3 h-3" /> Xoá
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          )
        )}
      </AnimatePresence>

      {/* ---------------- MODALS & SLIDERS ---------------- */}

      {/* Modal: View Details of Production Batch */}
      {selectedBatchForView && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-5"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                <span>Chi tiết đợt sản xuất</span>
              </h3>
              <button 
                onClick={() => setSelectedBatchForView(null)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Mã hàng (Mẫu):</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 block mt-1">{selectedBatchForView.modelName}</span>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Số lượng:</span>
                  <span className="text-sm font-black text-emerald-650 dark:text-emerald-400 block mt-1">{selectedBatchForView.targetQuantity.toLocaleString()} cái</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Ngày sản xuất:</span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 block mt-1">{formatVietnameseDate(selectedBatchForView.date)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Mã Đợt:</span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-350 block mt-1">{selectedBatchForView.id}</span>
                </div>
              </div>

              <div className="bg-slate-50/70 dark:bg-zinc-950/45 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                <p className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1">
                  <Archive className="w-4 h-4 text-emerald-600" />
                  <span>Nguyên liệu đã khấu trừ:</span>
                </p>
                <div className="space-y-2">
                  {selectedBatchForView.materialsUsed.map((m, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-1.5 border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                      <span className="font-medium text-slate-650 dark:text-slate-350">{m.materialName}</span>
                      <div className="flex items-center gap-2">
                        {m.insufficient && (
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-md">
                            Hụt kho
                          </span>
                        )}
                        <span className="font-mono font-black text-rose-600 dark:text-rose-450">
                          -{m.amountUsed.toLocaleString()} {m.materialUnit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedBatchForView(null)}
                className="w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-slate-300 font-bold rounded-xl transition cursor-pointer text-xs"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Edit Production Batch */}
      {selectedBatchForEdit && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                <span>Chỉnh sửa đợt sản xuất</span>
              </h3>
              <button 
                onClick={() => setSelectedBatchForEdit(null)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Model / Pattern selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Mã hàng cần sản xuất:</span>
                </label>
                <select
                  value={editBatchModel}
                  onChange={e => setEditBatchModel(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer text-slate-850 dark:text-slate-150"
                >
                  <option value="">-- Chọn mã rập cần cắt rã --</option>
                  {materialRecipes.map(recipe => (
                    <option key={recipe.id} value={recipe.modelName}>
                      {recipe.modelName}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Target Quantity */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Số lượng cần sản xuất mộc (cái):</span>
                </label>
                <input 
                  type="number" 
                  min={1}
                  value={editBatchQty || ''} 
                  onChange={e => setEditBatchQty(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Ví dụ: 500"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* 3. Production Date */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ngày chạy đợt sản xuất:</span>
                </label>
                <input 
                  type="date" 
                  value={editBatchDate} 
                  onChange={e => setEditBatchDate(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* Real-time Material Estimation Preview */}
              {editBatchModel && editBatchQty > 0 && (
                <div className="bg-amber-50/40 dark:bg-amber-955/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30 text-[10.5px]">
                  <p className="font-black text-amber-850 dark:text-amber-400 uppercase text-[9px] mb-1.5 flex items-center gap-1">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Dự báo tiêu hao khấu kho:</span>
                  </p>
                  <div className="space-y-1">
                    {calculateRequiredMaterials(editBatchModel, editBatchQty).map(req => {
                      const oldBatch = selectedBatchForEdit;
                      const mat = rawMaterials.find(m => m.id === req.materialId);
                      const oldUsage = oldBatch.materialsUsed.find(om => om.materialId === req.materialId)?.amountUsed || 0;
                      const revertedStock = (mat ? mat.currentStock : 0) + oldUsage;
                      const isInsuf = revertedStock < req.amountUsed;

                      return (
                        <div key={req.materialId} className="flex justify-between items-center text-slate-650 dark:text-slate-400 border-b border-dashed border-slate-200/50 dark:border-slate-800/50 py-1 last:border-0">
                          <span>• {req.materialName}:</span>
                          <span className="font-semibold text-slate-850 dark:text-slate-200 font-mono">
                            {req.amountUsed.toLocaleString()} / {revertedStock.toLocaleString()} {req.materialUnit}
                            {isInsuf && (
                              <span className="ml-1 text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/40 px-1 rounded">
                                Thiếu âm kho
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end">
              <button
                onClick={() => setSelectedBatchForEdit(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-slate-400 font-bold rounded-xl transition cursor-pointer text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEditBatch}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 font-bold text-white shadow-xs rounded-xl transition cursor-pointer text-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Lưu thay đổi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ---------------- MODALS & SLIDERS ---------------- */}

      {/* Modal 1: Add operation breakdown */}
      {showAddBreakdown && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800 space-y-5 scrollbar-thin"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-2">
                <Scissors className="w-5 h-5 text-indigo-600" />
                <span>Thiết lập công đoạn mẫu mã</span>
              </h3>
              <button 
                onClick={() => setShowAddBreakdown(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Mã hàng input */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Mã hàng:</span>
                </label>
                <input 
                  type="text" 
                  value={newModelName} 
                  onChange={e => setNewModelName(e.target.value)}
                  placeholder="Ví dụ: Đầm Sọc Eo Khóa Thơ"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* 2. Form thêm hàng công đoạn */}
              <div className="bg-slate-50/70 dark:bg-zinc-950/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Thêm hàng công đoạn</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400 italic">Thêm lần lượt theo thứ tự</span>
                </div>

                {/* Chọn loại công việc */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase">Chọn loại công việc:</label>
                    <button
                      type="button"
                      onClick={() => setShowAddTaskModal(true)}
                      className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      + Thêm danh mục việc
                    </button>
                  </div>
                  <select
                    value={tasks.some(t => t.name === newOpName) ? newOpName : (newOpName ? '__custom__' : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setNewOpName('');
                      } else {
                        setNewOpName(val);
                      }
                    }}
                    className="w-full text-xs font-bold bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer text-slate-850 dark:text-slate-150"
                  >
                    <option value="">-- Click chọn công việc mẫu --</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                    <option value="__custom__">✍️ [ Tự nhập công việc khác ... ]</option>
                  </select>
                  
                  {(!tasks.some(t => t.name === newOpName) || newOpName === '') && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text" 
                        value={newOpName} 
                        onChange={e => setNewOpName(e.target.value)}
                        placeholder="Nhập tên việc tự do, ví dụ: Ủi xếp, Làm khuy..."
                        className="w-full text-xs bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs text-slate-800 dark:text-white font-semibold"
                      />
                    </div>
                  )}
                </div>

                {/* Đơn giá - Số lượng */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-550 dark:text-slate-400 uppercase">Đơn giá (đ):</label>
                    <input 
                      type="number" 
                      value={newOpPrice} 
                      onChange={e => setNewOpPrice(Number(e.target.value))}
                      placeholder="Nhập giá tiền ví dụ: 2000"
                      className="w-full text-xs font-mono font-bold bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs text-emerald-600 dark:text-emerald-450 focus:text-indigo-600 text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-550 dark:text-slate-400 uppercase">Số lượng:</label>
                    <div className="flex gap-1">
                      <input 
                        type="number" 
                        step="any"
                        value={newOpMultiplier} 
                        onChange={e => setNewOpMultiplier(Number(e.target.value))}
                        placeholder="SL"
                        className="w-12 text-xs font-mono font-bold bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-white text-center shrink-0"
                      />
                      <div className="flex gap-0.5 flex-1 shrink-0">
                        {[1, 2, 4].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewOpMultiplier(num)}
                            className={`flex-1 text-[10px] font-mono font-black rounded-lg transition-all border ${
                              newOpMultiplier === num 
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs' 
                                : 'bg-white dark:bg-zinc-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-slate-150 dark:border-slate-800'
                            }`}
                          >
                            x{num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thợ phụ trách mặc định */}
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-550 dark:text-slate-400 uppercase">Thợ mặc định phụ trách (Tùy chọn):</label>
                  <select
                    value={newOpDefaultWorkerId}
                    onChange={e => setNewOpDefaultWorkerId(e.target.value)}
                    className="w-full text-xs font-semibold bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                  >
                    <option value="">-- Chọn Thợ phụ trách chính (Nếu có) --</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>👤 {w.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="button"
                  onClick={addTempOp}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex justify-center items-center gap-1 cursor-pointer shadow-md shadow-indigo-200/10 dark:shadow-none"
                >
                  <PlusCircle className="w-4 h-4 text-white" />
                  <span>Thêm công đoạn vào bảng mẫu</span>
                </button>
              </div>

              {/* 3. Danh sách các hàng công đoạn đã thêm */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-indigo-505" />
                    <span>Hàng công đoạn đã thêm ({tempOps.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400 italic font-medium">Bấm 🔼/🔽 để xếp thứ tự</span>
                </div>

                {tempOps.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl text-slate-400 italic text-xs font-bold">
                    Danh sách đang trống. Điền form trên và bấm "Thêm công đoạn" để thêm theo tuần tự.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 select-none scrollbar-thin">
                    {tempOps.map((op, idx) => {
                      const matchedWorker = workers.find(w => w.id === op.defaultWorkerId);
                      return (
                        <div 
                          key={idx} 
                          className="flex justify-between items-center text-xs bg-slate-50/60 dark:bg-zinc-950/40 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl font-bold hover:bg-slate-100/50 transition"
                        >
                          <div className="flex items-center gap-2 truncate whitespace-nowrap min-w-0">
                            <span className="text-indigo-650 dark:text-indigo-400 font-extrabold text-[11px] bg-indigo-50 dark:bg-indigo-950/40 shrink-0 w-6 h-6 flex items-center justify-center rounded-lg">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                                <span>{op.name}</span>
                                <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/45 px-1 py-0.2 rounded font-black shrink-0">
                                  SL: {op.multiplier || 1}
                                </span>
                              </p>
                              {matchedWorker && (
                                <p className="text-[9.5px] text-emerald-600 dark:text-emerald-450 mt-0.5 flex items-center gap-0.5 font-bold">
                                  <span>👤 Thợ mặc định: {matchedWorker.name}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 pl-1">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-xs">
                              {op.price.toLocaleString()}đ
                            </span>
                            
                            {/* Controls sắp xếp và xóa */}
                            <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-800 pl-2">
                              <button 
                                type="button"
                                onClick={() => moveTempOpUp(idx)}
                                disabled={idx === 0}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-855 rounded-lg disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                                title="Di chuyển lên"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => moveTempOpDown(idx)}
                                disabled={idx === tempOps.length - 1}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-855 rounded-lg disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                                title="Di chuyển xuống"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => removeTempOp(idx)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/10 rounded-lg transition text-red-500/80 cursor-pointer"
                                title="Xóa hàng công đoạn này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                type="button"
                onClick={() => setShowAddBreakdown(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={handleCreateBreakdown}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold text-white shadow-lg shadow-indigo-505/10 rounded-xl text-xs transition cursor-pointer"
              >
                Xác nhận tạo
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 2: Add Worker profile */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Thêm thợ may gia công</span>
              </h3>
              <button 
                onClick={() => setShowAddWorker(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên thợ may:</label>
                <input 
                  type="text" 
                  value={workerName} 
                  onChange={e => setWorkerName(e.target.value)}
                  placeholder="Ví dụ: Chị Lan Tiền Giang"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số điện thoại liên lạc (Nếu có):</label>
                <input 
                  type="text" 
                  value={workerPhone} 
                  onChange={e => setWorkerPhone(e.target.value)}
                  placeholder="Ví dụ: 0929 111 222"
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* Giao diện tick chọn công việc */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Công việc đảm nhận (Tick chọn):</label>
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(true)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black hover:underline cursor-pointer"
                  >
                    + Tạo nhanh công việc
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-600 italic py-2 font-bold text-center bg-slate-50 dark:bg-zinc-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    Chưa có công việc nào. Hãy click nút ở trên để tạo nhanh!
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 scrollbar-thin">
                    {tasks.map(task => {
                      const isChecked = selectedTaskIdsForNewWorker.includes(task.id);
                      return (
                        <label 
                          key={task.id} 
                          className={`flex items-start gap-2 p-2 rounded-lg text-[10.5px] font-bold cursor-pointer transition select-none border border-transparent ${
                            isChecked 
                              ? 'bg-indigo-50/70 border-indigo-100/60 text-indigo-750 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300' 
                              : 'hover:bg-slate-100/85 dark:hover:bg-zinc-850/50 text-slate-600 dark:text-slate-400 bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-850'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedTaskIdsForNewWorker(selectedTaskIdsForNewWorker.filter(id => id !== task.id));
                              } else {
                                setSelectedTaskIdsForNewWorker([...selectedTaskIdsForNewWorker, task.id]);
                              }
                            }}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                          />
                          <span className="truncate" title={task.name}>{task.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                type="button"
                onClick={() => {
                  setSelectedTaskIdsForNewWorker([]);
                  setShowAddWorker(false);
                }}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={handleCreateWorker}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold text-white shadow-lg rounded-xl text-xs transition cursor-pointer"
              >
                Lưu hồ sơ thợ
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Quản lý công việc mẫu (Task types directory) */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                <span>Quản lý danh mục Công việc</span>
              </h3>
              <button 
                onClick={() => setShowAddTaskModal(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form tạo mới công việc */}
            <div className="bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-2">
              <label className="block text-[10px] font-bold text-slate-450 uppercase mb-0.5">Tên công việc mới:</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTaskName} 
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="Ví dụ: Ráp tay áo, Tra khóa sườn, Lên lai..."
                  className="flex-1 text-xs font-bold bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs text-slate-800 dark:text-white"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTask();
                    }
                  }}
                />
                <button 
                  type="button"
                  onClick={handleCreateTask}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
                >
                  Tạo mới
                </button>
              </div>
            </div>

            {/* Danh sách công việc hiện tại */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Danh sách công việc đang có ({tasks.length}):</label>
              
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-600 italic text-center py-6 font-medium bg-slate-50 dark:bg-zinc-950 rounded-xl">Chưa có công việc nào được định nghĩa mẫu.</p>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                  {tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="flex justify-between items-center text-xs bg-slate-50/50 dark:bg-zinc-900 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl font-bold"
                    >
                      <span className="text-slate-800 dark:text-slate-200">{task.name}</span>
                      <button 
                        type="button"
                        onClick={() => handleDeleteTask(task.id, task.name)}
                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                        title="Xóa công việc khỏi danh sách"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 3: Add Job - Assign operations checkpoint */}
      {showAddJob && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>GIAO VIỆC & PHÂN CHIA CÔNG THỢ</span>
              </h3>
              <button 
                onClick={() => setShowAddJob(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>



            <div className="space-y-4">
              {/* Product list selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mẫu mã sản phẩm:</label>
                <select
                  value={selectedModelForJob}
                  onChange={e => handleSelectModelForJob(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white focus:border-indigo-500"
                >
                  <option value="">-- Chọn Mẫu --</option>
                  {operationBreakdowns.map(bd => (
                    <option key={bd.id} value={bd.modelName}>{bd.modelName}</option>
                  ))}
                </select>
              </div>

              {assignmentMode === 'single' ? (
                // 1. SINGLE WORKER MODE UI
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Thợ May Gia Công:</label>
                      <select
                        value={selectedWorkerId}
                        onChange={e => setSelectedWorkerId(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                      >
                        <option value="">-- Chọn Thợ May --</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số lượng hàng (Cái):</label>
                      <input 
                        type="number" 
                        value={jobQuantity} 
                        onChange={e => setJobQuantity(Number(e.target.value))}
                        className="w-full text-xs font-mono font-extrabold text-center bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-indigo-500 dark:text-white"
                      />
                    </div>
                  </div>

                  {selectedModelForJob && (
                    <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
                      <p className="text-xs font-extrabold text-slate-750 dark:text-slate-350 uppercase mb-2">Đánh dấu công đoạn đảm nhiệm & đơn giá:</p>
                      
                      <div className="grid grid-cols-1 gap-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                        {operationBreakdowns.find(bd => bd.modelName === selectedModelForJob)?.operations.map(op => {
                          const isChecked = jobCheckedOps.includes(op.id);
                          return (
                            <div
                              key={op.id}
                              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition ${
                                isChecked 
                                  ? 'bg-indigo-50/70 border-indigo-250 text-indigo-950 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300' 
                                  : 'bg-white border-slate-200 text-slate-505 dark:bg-zinc-900 dark:border-zinc-805'
                              }`}
                            >
                              <div
                                onClick={() => handleToggleJobOp(op.id)}
                                className="flex items-center gap-2 flex-grow cursor-pointer select-none py-1.5"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                                ) : (
                                  <Square className="w-4.5 h-4.5 text-slate-300 dark:text-zinc-700 shrink-0" />
                                )}
                                <span className="truncate text-slate-800 dark:text-slate-200">{op.name}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0" onClick={ev => ev.stopPropagation()}>
                                <span className="text-[10px] text-slate-400 font-normal uppercase">Lương:</span>
                                <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 shadow-xs focus-within:border-emerald-500">
                                  <input 
                                    type="number" 
                                    value={customOpPrices[op.id] !== undefined ? customOpPrices[op.id] : op.price}
                                    onChange={e => {
                                      const val = Number(e.target.value);
                                      setCustomOpPrices(prev => ({
                                        ...prev,
                                        [op.id]: val >= 0 ? val : 0
                                      }));
                                    }}
                                    className="w-16 text-right bg-transparent font-mono text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 outline-none border-none py-0.5"
                                  />
                                  <span className="text-[10px] text-slate-400 font-mono ml-0.5">đ</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-805 flex justify-between items-center text-xs font-bold mt-2 text-indigo-700 dark:text-indigo-400 uppercase">
                        <span>Đơn giá tích lũy:</span>
                        <span className="font-mono font-black text-sm text-rose-600">
                          {operationBreakdowns.find(bd => bd.modelName === selectedModelForJob)?.operations
                            .filter(o => jobCheckedOps.includes(o.id))
                            .reduce((sum, o) => {
                              const price = customOpPrices[o.id] !== undefined ? customOpPrices[o.id] : o.price;
                              return sum + price;
                            }, 0).toLocaleString()}đ / cái
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedWorkerId && selectedModelForJob && (
                    <div className="p-3 bg-gradient-to-r from-emerald-50/50 to-indigo-50/50 dark:from-zinc-900/50 dark:to-zinc-950 rounded-xl border border-indigo-100/55 dark:border-indigo-950/30 space-y-2 text-xs">
                      <p className="text-[9px] uppercase font-black tracking-tight text-emerald-600 dark:text-emerald-450 flex items-center gap-1 leading-none">
                        <span>🏷️ VÉ PHÂN CÔNG GIA CÔNG CHI TIẾT ĐÃ CHỌN</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] leading-relaxed">
                        <div className="bg-white dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-850">
                          <span className="text-slate-450 font-mono block text-[8px] uppercase">Thợ May Gia Công:</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">
                            {workers.find(w => w.id === selectedWorkerId)?.name || 'N/A'}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-850">
                          <span className="text-slate-455 font-mono block text-[8px] uppercase">Mẫu Sản Phẩm:</span>
                          <span className="font-extrabold text-indigo-700 dark:text-indigo-400 uppercase">
                            {selectedModelForJob} ({jobQuantity} cái)
                          </span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-850">
                        <span className="text-slate-455 font-mono block text-[8px] uppercase">Các Công Việc Thực Hiện:</span>
                        <span className="font-extrabold text-slate-750 dark:text-slate-300">
                          {operationBreakdowns.find(bd => bd.modelName === selectedModelForJob)?.operations
                            .filter(o => jobCheckedOps.includes(o.id))
                            .map(o => o.name)
                            .join(', ') || 'Chưa tích chọn công đoạn nào'}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-zinc-950 p-2 rounded-lg border border-slate-100 dark:border-zinc-850 flex justify-between items-center">
                        <span className="text-slate-455 font-mono text-[8px] uppercase">Tổng Tiền Công Ước Tính:</span>
                        <span className="font-mono text-xs font-black text-rose-500">
                          {(() => {
                            const unitPriceSum = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob)?.operations
                              .filter(o => jobCheckedOps.includes(o.id))
                              .reduce((sum, o) => {
                                const price = customOpPrices[o.id] !== undefined ? customOpPrices[o.id] : o.price;
                                return sum + price;
                              }, 0) || 0;
                            return (unitPriceSum * jobQuantity).toLocaleString();
                          })()}đ
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : assignmentMode === 'bulk_split' ? (
                // 2. MULTIPLE WORKERS BULK AUTO-DIVISION MODE
                <>
                  <div className="bg-amber-50/45 dark:bg-amber-950/10 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-[11px] text-amber-900 dark:text-amber-300 font-semibold leading-relaxed">
                    🌟 <strong>Hướng dẫn:</strong> Nhập tổng số lượng mẫu mã cần gia công. Tích chọn các thợ đảm trách. Hệ thống sẽ tự động bốc và chia mẫu đều cho từng thợ. Bạn cũng có thể mở rộng⚙️ cấu hình công đoạn và đơn giá chi tiết cho từng thợ nếu muốn!
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">TỔNG SỐ LƯỢNG MẪU MÃ PHÂN PHỐI (Cái):</label>
                      <input 
                        type="number" 
                        value={jobQuantity} 
                        onChange={e => handleBulkQuantityChange(Number(e.target.value))}
                        className="w-full text-xs font-mono font-black text-center bg-indigo-50/20 dark:bg-zinc-950 p-3 border border-indigo-200 dark:border-indigo-900/40 rounded-xl outline-xs focus:bg-white dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tải danh sách các thợ may tham gia:</label>
                    <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1 mt-1 scrollbar-thin">
                      {workers.map(w => {
                        const isChecked = selectedWorkerIds.includes(w.id);
                        return (
                          <div
                            key={w.id}
                            onClick={() => handleToggleBatchWorker(w.id)}
                            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer select-none transition ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950 dark:bg-indigo-950/25 dark:border-indigo-900/40 dark:text-indigo-300'
                                : 'bg-white border-slate-205 text-slate-705 dark:bg-zinc-900 dark:border-zinc-805'
                            }`}
                          >
                            <span className="truncate">{w.name}</span>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                              isChecked ? 'bg-indigo-600 border-indigo-650 text-white' : 'border-slate-300 dark:border-zinc-700'
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedWorkerIds.length > 0 && selectedModelForJob && (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex justify-between items-center bg-slate-100 dark:bg-zinc-950 p-2.5 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Danh sách thợ & Số lượng phân chia:</span>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 font-bold px-2 py-0.5 rounded-md text-indigo-650 dark:text-indigo-400 font-mono">
                          {selectedWorkerIds.length} thợ tham gia
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                        {(() => {
                          const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
                          return selectedWorkerIds.map(id => {
                            const worker = workers.find(w => w.id === id);
                            if (!worker) return null;
                            const isExpanded = expandedWorkerSettings === id;
                            const qty = workerQuantities[id] || 0;
                            const checkedOps = workerCheckedOps[id] || [];
                            const customPricesMap = workerOpPrices[id] || {};

                            const opPricesSum = selectedBd ? selectedBd.operations
                              .filter(o => checkedOps.includes(o.id))
                              .reduce((s, o) => s + (customPricesMap[o.id] !== undefined ? customPricesMap[o.id] : o.price), 0) : 0;
                            
                            const estimatedTotal = qty * opPricesSum;

                            return (
                              <div key={id} className="bg-slate-50 dark:bg-zinc-950/60 p-3.5 border border-slate-200 dark:border-slate-850 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase">{worker.name}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">May sỉ:</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs px-2 py-0.5">
                                      <input
                                        type="number"
                                        value={qty}
                                        onChange={e => handleIndividualWorkerQtyChange(id, Number(e.target.value))}
                                        className="w-16 text-center font-mono font-extrabold text-xs py-1 border-none focus:outline-none bg-transparent"
                                      />
                                      <span className="text-[10px] text-slate-400 ml-0.5">cái</span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedWorkerSettings(isExpanded ? null : id)}
                                      className={`p-1.5 rounded-lg border transition ${
                                        isExpanded 
                                          ? 'bg-indigo-50 border-indigo-200 text-indigo-650 dark:bg-indigo-950/20' 
                                          : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600'
                                      }`}
                                      title="Cấu hình nhanh công đoạn thành viên"
                                    >
                                      <Settings className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && selectedBd && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-150 dark:border-zinc-800 space-y-2 mt-2"
                                  >
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Tùy biến công đoạn của thợ:</p>
                                    <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                                      {selectedBd.operations.map(op => {
                                        const isChecked = checkedOps.includes(op.id);
                                        return (
                                          <div key={op.id} className="flex justify-between items-center text-[10px] font-bold border-b border-slate-50 dark:border-zinc-850 pb-1 mt-1">
                                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 flex-grow py-1">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                  const nextOps = isChecked
                                                    ? checkedOps.filter(oid => oid !== op.id)
                                                    : [...checkedOps, op.id];
                                                  setWorkerCheckedOps(prev => ({
                                                    ...prev,
                                                    [id]: nextOps
                                                  }));
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                                              />
                                              <span>{op.name}</span>
                                            </label>

                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                value={customPricesMap[op.id] !== undefined ? customPricesMap[op.id] : op.price}
                                                onChange={e => {
                                                  const val = Number(e.target.value);
                                                  setWorkerOpPrices(prev => ({
                                                    ...prev,
                                                    [id]: {
                                                      ...(prev[id] || {}),
                                                      [op.id]: val >= 0 ? val : 0
                                                    }
                                                  }));
                                                }}
                                                className="w-14 font-mono text-[10px] font-extrabold text-emerald-600 text-right border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5"
                                              />
                                              <span className="text-[9px] text-slate-400">đ</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}

                                <div className="flex justify-between items-center text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-slate-100 dark:border-slate-850 p-2 rounded-xl">
                                  <span className="text-slate-450">Lũy kế đơn giá: <strong className="font-mono text-indigo-650">{opPricesSum.toLocaleString()}đ</strong></span>
                                  <span className="font-mono text-rose-500 font-extrabold">Tính lương công: +{estimatedTotal.toLocaleString()}đ</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // 3. OP TEMPLATE ASSIGNMENT MODE (Hệ số định mức tỉ lệ)
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">TỔNG SỐ LƯỢNG SẢN PHẨM PHÂN PHỐI (Cái):</label>
                    <input 
                      type="number" 
                      value={jobQuantity} 
                      onChange={e => handleOpTemplateQuantityChange(Number(e.target.value))}
                      className="w-full text-xs font-mono font-black text-center bg-indigo-50/20 dark:bg-zinc-950 p-3 border border-indigo-200 dark:border-indigo-900/40 rounded-xl outline-xs focus:bg-white dark:text-white"
                    />
                  </div>

                  {selectedModelForJob && (
                    <div className="space-y-4 pt-1 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                      <div className="bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-[10.5px] text-amber-900 dark:text-amber-300 font-semibold leading-normal flex items-start gap-1.5">
                        <span>⚙️</span>
                        <span>
                          <strong>Định mức tự động đề xuất:</strong> Số lượng cần may sẽ tự động nhân với hệ số định mức (ví dụ: Ráp tay x2 sẽ là {jobQuantity * 2} cái). Bạn có thể phân công cho các thợ khác nhau và tự chọn số lượng cụ thể!
                        </span>
                      </div>

                      {(() => {
                        const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
                        if (!selectedBd) return null;

                        return selectedBd.operations.map(op => {
                          const mult = op.multiplier || 1;
                          const totalRequired = jobQuantity * mult;
                          const currentAssignments = opAssignments[op.id] || [];
                          const currentSum = currentAssignments.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
                          const isMismatched = currentSum !== totalRequired;

                          return (
                            <div key={op.id} className="bg-slate-50 dark:bg-zinc-950/50 p-3 border border-slate-205 dark:border-slate-850 rounded-2xl space-y-2.5">
                              {/* Header: Operation Name & Target Info */}
                              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                                <div>
                                  <span className="font-extrabold text-xs text-slate-850 dark:text-slate-150 uppercase">{op.name}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                    Đơn giá gốc: <strong className="font-mono text-emerald-600">{op.price.toLocaleString()}đ</strong>
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="bg-indigo-50 dark:bg-indigo-950/45 text-indigo-650 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-lg text-[10px] font-mono inline-block">
                                    x{mult} (SL: {totalRequired})
                                  </span>
                                  {isMismatched && (
                                    <span className="text-[9px] text-amber-500 block font-semibold mt-0.5">
                                      Chia: {currentSum} / {totalRequired}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Assignment Rows list */}
                              <div className="space-y-1.5">
                                {currentAssignments.map((assign, aIdx) => (
                                  <div key={aIdx} className="grid grid-cols-12 gap-1.5 items-center bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800/60 p-1.5 rounded-xl">
                                    {/* Select Thợ */}
                                    <div className="col-span-12 sm:col-span-5">
                                      <select
                                        value={assign.workerId}
                                        onChange={e => {
                                          const newWorkers = [...currentAssignments];
                                          newWorkers[aIdx].workerId = e.target.value;
                                          setOpAssignments(prev => ({ ...prev, [op.id]: newWorkers }));
                                        }}
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-1.5 border border-slate-205 dark:border-slate-800 rounded-lg outline-none cursor-pointer text-slate-800 dark:text-white"
                                      >
                                        <option value="">-- Chọn Thợ --</option>
                                        {workers.map(w => (
                                          <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Quantity */}
                                    <div className="col-span-6 sm:col-span-3">
                                      <div className="flex items-center bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1">
                                        <span className="text-[10px] text-slate-400 font-bold mr-1 shrink-0">SL:</span>
                                        <input
                                          type="number"
                                          placeholder="SL"
                                          value={assign.quantity}
                                          onChange={e => {
                                            const newWorkers = [...currentAssignments];
                                            newWorkers[aIdx].quantity = Number(e.target.value);
                                            setOpAssignments(prev => ({ ...prev, [op.id]: newWorkers }));
                                          }}
                                          className="w-full text-center font-mono font-bold text-xs py-1 outline-none bg-transparent focus:text-indigo-650"
                                        />
                                      </div>
                                    </div>

                                    {/* Custom Price */}
                                    <div className="col-span-5 sm:col-span-3">
                                      <div className="flex items-center bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-lg px-1">
                                        <span className="text-[10px] text-slate-400 font-bold mr-1 shrink-0">Giá:</span>
                                        <input
                                          type="number"
                                          placeholder="Giá"
                                          value={assign.price}
                                          onChange={e => {
                                            const newWorkers = [...currentAssignments];
                                            newWorkers[aIdx].price = Number(e.target.value);
                                            setOpAssignments(prev => ({ ...prev, [op.id]: newWorkers }));
                                          }}
                                          className="w-full text-right font-mono text-[10.5px] py-1 font-extrabold text-emerald-600 dark:text-emerald-400 outline-none bg-transparent"
                                        />
                                      </div>
                                    </div>

                                    {/* Delete row button */}
                                    <div className="col-span-1 text-center">
                                      <button
                                        type="button"
                                        disabled={currentAssignments.length === 1}
                                        onClick={() => {
                                          const newWorkers = currentAssignments.filter((_, idx) => idx !== aIdx);
                                          setOpAssignments(prev => ({ ...prev, [op.id]: newWorkers }));
                                        }}
                                        className="text-slate-350 hover:text-red-500 disabled:opacity-30 p-1 rounded-lg cursor-pointer transition"
                                        title="Xóa dòng phân thợ"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Action buttons and item total */}
                              <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-850">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const alreadyAllocated = currentAssignments.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
                                    const remaining = Math.max(0, totalRequired - alreadyAllocated);
                                    const newWorkers = [
                                      ...currentAssignments,
                                      { workerId: '', quantity: remaining, price: op.price }
                                    ];
                                    setOpAssignments(prev => ({ ...prev, [op.id]: newWorkers }));
                                  }}
                                  className="text-[10px] text-indigo-650 hover:text-indigo-700 font-extrabold flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-lg"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Chia thêm thợ</span>
                                </button>
                                
                                <span className="text-[10px] text-slate-500">
                                  Tổng: <strong className="font-mono text-rose-500">{currentAssignments.reduce((s, a) => s + ((Number(a.quantity) || 0) * (Number(a.price) || 0)), 0).toLocaleString()}đ</strong>
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* General Date Config */}
              <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày phân bổ giao việc:</label>
                <input 
                  type="date" 
                  value={jobDate} 
                  onChange={e => setJobDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-indigo-500 dark:text-white"
                />
              </div>

              {/* Real-time calculated overall total for single worker mode */}
              {!isMultipleWorkers && selectedModelForJob && jobCheckedOps.length > 0 && (
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-dashed border-indigo-200 dark:border-indigo-900/40 text-indigo-950 dark:text-indigo-300 text-xs font-black">
                    <Scissors className="w-4 h-4 text-indigo-500" />
                    <span>LƯƠNG ĐƠN GIAO THỢ TẠM TÍNH ({jobQuantity.toLocaleString()} cái):</span>
                  </div>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {(() => {
                      const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
                      if (!selectedBd) return null;
                      return selectedBd.operations
                        .filter(op => jobCheckedOps.includes(op.id))
                        .map(op => {
                          const price = customOpPrices[op.id] !== undefined ? customOpPrices[op.id] : op.price;
                          const opTotal = price * jobQuantity;
                          return (
                            <div key={op.id} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">• {op.name}</span>
                              <span className="font-mono text-slate-600 dark:text-slate-400">
                                {price.toLocaleString()}đ × {jobQuantity.toLocaleString()} = <strong className="text-emerald-600 font-extrabold">{opTotal.toLocaleString()}đ</strong>
                              </span>
                            </div>
                          );
                        });
                    })()}
                  </div>

                  <div className="pt-2.5 border-t border-dashed border-indigo-250 dark:border-indigo-900/40 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 uppercase">TỔNG LƯƠNG LAO ĐỘNG:</span>
                    <span className="text-base font-black text-rose-600 font-mono tracking-tight bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl shadow-xs border border-rose-100 dark:border-rose-900/30">
                      {((operationBreakdowns.find(bd => bd.modelName === selectedModelForJob)?.operations
                        .filter(o => jobCheckedOps.includes(o.id))
                        .reduce((sum, o) => {
                          const price = customOpPrices[o.id] !== undefined ? customOpPrices[o.id] : o.price;
                          return sum + price;
                        }, 0) || 0) * jobQuantity).toLocaleString()}đ
                    </span>
                  </div>
                </div>
              )}

              {/* Real-time calculated overall total for Multiple configuration */}
              {isMultipleWorkers && selectedWorkerIds.length > 0 && selectedModelForJob && (
                <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl flex justify-between items-center text-xs font-bold">
                  <span className="text-emerald-900 dark:text-emerald-300 uppercase">Tổng Lương Sỉ Giao Mộc ({jobQuantity.toLocaleString()} cái):</span>
                  <span className="text-base font-black text-rose-600 font-mono tracking-tight bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl shadow-xs border border-rose-100 dark:border-rose-900/30">
                    {selectedWorkerIds.reduce((sum, id) => {
                      const qty = workerQuantities[id] || 0;
                      const checkedOps = workerCheckedOps[id] || [];
                      const customPricesMap = workerOpPrices[id] || {};
                      const selectedBd = operationBreakdowns.find(bd => bd.modelName === selectedModelForJob);
                      const opPricesSum = selectedBd ? selectedBd.operations
                        .filter(o => checkedOps.includes(o.id))
                        .reduce((s, o) => s + (customPricesMap[o.id] !== undefined ? customPricesMap[o.id] : o.price), 0) : 0;
                      return sum + (qty * opPricesSum);
                    }, 0).toLocaleString()}đ
                  </span>
                </div>
              )}

              {/* Real-time calculated overall total for Template config */}
              {assignmentMode === 'op_template' && selectedModelForJob && (
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl flex justify-between items-center text-xs font-bold">
                  <span className="text-indigo-900 dark:text-indigo-350 uppercase">Tổng Lương Lao Động Tạm Tính:</span>
                  <span className="text-base font-black text-rose-600 font-mono tracking-tight bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl shadow-xs border border-rose-100 dark:border-rose-900/30">
                    {(Object.values(opAssignments) as { workerId: string; quantity: number; price: number }[][]).reduce((sum, arr) => {
                      return sum + arr.reduce((subSum, assign) => {
                        if (!assign.workerId) return subSum;
                        return subSum + ((Number(assign.quantity) || 0) * (Number(assign.price) || 0));
                      }, 0);
                    }, 0).toLocaleString()}đ
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => setShowAddJob(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-550 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCreateJob}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 font-bold text-white shadow-lg shadow-indigo-550/10 rounded-xl text-xs transition cursor-pointer"
              >
                Giao việc & Lưu nhật ký
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 4: Add New Material */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <Package className="w-5 h-5 text-emerald-600" />
                <span>Thêm loại vải/vật tư nguyên liệu</span>
              </h3>
              <button 
                onClick={() => setShowAddMaterial(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên nguyên liệu / Loại vải:</label>
                <input 
                  type="text" 
                  value={materialName} 
                  onChange={e => setMaterialName(e.target.value)}
                  placeholder="Ví dụ: Vải Gấm Hàn Thêu Hoa"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đơn vị đo lường:</label>
                  <select
                    value={materialUnit}
                    onChange={e => setMaterialUnit(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                  >
                    <option value="Mét">Mét</option>
                    <option value="Cuộn">Cuộn</option>
                    <option value="Cái">Cái</option>
                    <option value="Kilôgam">Kilôgam</option>
                    <option value="Sợi">Sợi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vốn tồn kho khởi tạo:</label>
                  <input 
                    type="number" 
                    value={materialInitStock} 
                    onChange={e => setMaterialInitStock(Number(e.target.value))}
                    className="w-full text-xs font-mono font-extrabold text-center bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngưỡng cảnh báo sắp hết (Đơn vị tương ứng):</label>
                <input 
                  type="number" 
                  value={materialAlertLevel} 
                  onChange={e => setMaterialAlertLevel(Number(e.target.value))}
                  placeholder="Ví dụ: 30"
                  className="w-full text-xs font-mono font-extrabold text-center bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => setShowAddMaterial(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCreateMaterial}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 font-bold text-white shadow-lg shadow-emerald-555/10 rounded-xl text-xs transition cursor-pointer"
              >
                Lưu vào kho
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 5: Replenish existing material (Nhập thêm) */}
      {showReplenishMaterial && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <RefreshCw className="w-5 h-5 text-emerald-600 mr-1" />
                <span>NHẬP THÊM NGUYÊN LIỆU KHO</span>
              </h3>
              <button 
                onClick={() => setShowReplenishMaterial(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn loại nguyên vật liệu:</label>
                <select
                  value={replenishId}
                  onChange={e => setReplenishId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                >
                  <option value="">-- Click chọn vật tư --</option>
                  {rawMaterials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Tồn: {m.currentStock} {m.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số lượng nạp thêm:</label>
                <input 
                  type="number" 
                  value={replenishQty} 
                  onChange={e => setReplenishQty(Number(e.target.value))}
                  className="w-full text-xs font-mono font-extrabold text-center bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung ghi chú lô vật tư:</label>
                <input 
                  type="text" 
                  value={replenishNote} 
                  onChange={e => setReplenishNote(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => setShowReplenishMaterial(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleReplenish}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 font-bold text-white shadow-lg shadow-emerald-555/10 rounded-xl text-xs transition cursor-pointer"
              >
                Cập nhật tăng kho
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 6: Set Recipe Consumption Limits */}
      {showAddRecipe && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-emerald-600 mr-1" />
                <span>ĐỊNH MỨC NGUYÊN LIỆU CHO MẪU THIẾT KẾ</span>
              </h3>
              <button 
                onClick={() => {
                  setRecipeModel('');
                  setRecipeItems([]);
                  setShowAddRecipe(false);
                }} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã hàng liên kết định mức:</label>
                <input 
                  type="text" 
                  value={recipeModel} 
                  onChange={e => setRecipeModel(e.target.value)}
                  placeholder="Ví dụ: Đầm Voan Lỡ D102"
                  className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-500 dark:text-white"
                />
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 space-y-3">
                <p className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase">Thành phần cấu thành & Định lượng tiêu hao:</p>
                
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                  {recipeItems.map(item => {
                    const material = rawMaterials.find(m => m.id === item.materialId);
                    return (
                      <div key={item.materialId} className="flex justify-between items-center text-xs bg-white dark:bg-zinc-900 p-2.5 border border-slate-100 dark:border-slate-800/80 rounded-lg">
                        <span className="font-bold text-slate-700 dark:text-slate-300">• {material ? material.name : 'Chưa rõ'}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                            {item.consumptionRate.toLocaleString()} {material?.unit || "mét"}/cái
                          </span>
                          <button 
                            onClick={() => removeRecipeRow(item.materialId)}
                            className="text-red-500 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-850 flex flex-col gap-2">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-tight">Thêm thành phần tiêu hao mới:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <select
                        id="add_recipe_mat_selectbox"
                        className="w-full text-xs font-bold bg-white dark:bg-zinc-900 p-2 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                      >
                        <option value="">-- Bản dệt vải --</option>
                        {rawMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <input
                        id="add_recipe_rate_input"
                        type="number"
                        step="0.01"
                        placeholder="Định mức (e.g. 1.25)"
                        className="w-full text-xs font-mono font-bold text-right bg-white dark:bg-zinc-900 p-2 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const selEl = document.getElementById('add_recipe_mat_selectbox') as HTMLSelectElement;
                        const qtyEl = document.getElementById('add_recipe_rate_input') as HTMLInputElement;
                        if (!selEl || !qtyEl) return;
                        const matId = selEl.value;
                        const rate = Number(qtyEl.value);
                        if (!matId || rate <= 0) {
                          alert('Vui lòng chọn loại nguyên vật liệu và nhập định mức lớn hơn 0!');
                          return;
                        }
                        addRecipeRow(matId, rate);
                        qtyEl.value = '';
                      }}
                      className="sm:col-span-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex justify-center items-center"
                    >
                      <span>+</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => {
                  setRecipeModel('');
                  setRecipeItems([]);
                  setShowAddRecipe(false);
                }}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleCreateRecipe}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 font-bold text-white shadow-lg shadow-emerald-555/10 rounded-xl text-xs transition cursor-pointer"
              >
                Áp dụng quy tắc
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal 7: Run Production Batch & Auto-Deduct Inventory Stock */}
      {showRunProduction && (
        <div className="fixed inset-0 bg-slate-905/30 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-850 dark:text-slate-150 uppercase tracking-tight flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-emerald-600 mr-1" />
                <span>BẮT ĐẦU ĐỢT SẢN XUẤT MỚI TỰ ĐỘNG KHẤU TRỪ KHO</span>
              </h3>
              <button 
                onClick={() => setShowRunProduction(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mẫu mã sản phẩm sỉ:</label>
                  <select
                    value={prodModel}
                    onChange={e => setProdModel(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs dark:text-white"
                  >
                    <option value="">-- Chọn Mẫu --</option>
                    {materialRecipes.map(r => (
                      <option key={r.id} value={r.modelName}>{r.modelName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SL lên mẫu (Cái):</label>
                  <input 
                    type="number" 
                    value={prodQty} 
                    onChange={e => setProdQty(Number(e.target.value))}
                    className="w-full text-xs font-mono font-extrabold text-center bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-555 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày cập nhật sản xuất:</label>
                <input 
                  type="date" 
                  value={prodDate} 
                  onChange={e => setProdDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-xs focus:border-emerald-555 dark:text-white"
                />
              </div>

              {/* Dynamic consumption requirements evaluation list */}
              {prodModel && prodQty > 0 && (
                <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2.5">
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-350 uppercase">Pháp định hao hụt & Thể trạng so sánh kho:</p>
                  
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-[11px] font-medium">
                    {calculateRequiredMaterials(prodModel, prodQty).map(req => {
                      return (
                        <div key={req.materialId} className="p-2 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-slate-800 rounded-lg flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-205">{req.materialName}</span>
                            <p className="text-[10px] text-slate-450 mt-0.5">
                              Kho hiện tại: <span className="font-bold font-mono">{req.currentStock.toLocaleString()} {req.materialUnit}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Khấu hao:</span>
                            <span className="font-mono font-black block text-rose-600">
                              -{req.amountUsed.toLocaleString()} {req.materialUnit}
                            </span>
                            {req.insufficient ? (
                              <span className="text-[9.5px] font-bold text-red-650 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                                ⚠️ Thiếu {Math.abs(req.currentStock - req.amountUsed).toLocaleString()} {req.materialUnit}
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-bold text-emerald-650 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                                ✓ Đủ hàng
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button 
                onClick={() => setShowRunProduction(false)}
                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleRunProduction}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 font-bold text-white shadow-lg shadow-emerald-555/10 rounded-xl text-xs transition cursor-pointer"
              >
                Khấu trừ & Lên đợt hàng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating Speed Dial FAB */}
      {showFabMenu && (
        <div 
          onClick={() => setShowFabMenu(false)}
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-[2px] z-[990]"
        />
      )}

      <AnimatePresence>
        {showFabMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed bottom-[164px] right-6 z-[995] flex flex-col items-end gap-3"
          >
            <div className="bg-white dark:bg-zinc-950 p-2.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col gap-1.5 min-w-[250px] select-none">
              <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 px-3 py-1 border-b border-slate-100 dark:border-zinc-900 tracking-wider mb-1">
                {subTab === 'breakdown' ? 'Thao tác Nhân công & Thợ' : 'Thao tác Nguyên liệu & Kho'}
              </div>
              
              {subTab === 'breakdown' ? (
                <>
                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      if (operationBreakdowns.length === 0) {
                        alert('Vui lòng lập ít nhất 1 bảng phân bổ công đoạn mốc chiếc trước khi giao việc!');
                        return;
                      }
                      if (workers.length === 0) {
                        alert('Vui lòng tạo hồ sơ thợ may trước!');
                        return;
                      }
                      setShowAddJob(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                        +
                      </div>
                      <span className="font-extrabold text-[11.5px] text-slate-905 dark:text-white">Giao việc / Nhật ký công</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setShowAddBreakdown(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50/45 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 shrink-0">
                        <Scissors className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[11.5px]">Tạo bảng công đoạn</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setShowAddWorker(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50/45 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[11.5px]">Thêm thợ mới</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setShowAddTaskModal(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50/45 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 shrink-0">
                        <CheckSquare className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[11.5px]">Quản lý công việc mẫu</span>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 dark:border-zinc-900 my-1"></div>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      exportWorkerJobsToExcel();
                    }}
                    className="w-full text-left py-2 px-3 bg-emerald-55/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-55 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-650 shrink-0">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-extrabold text-[11.5px]">Xuất Excel Nhân Công</span>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      if (materialRecipes.length === 0) {
                        alert('Vui lòng lập bảng định mức hao hụt cho một mẫu sản phẩm trước khi khởi chạy đợt sản xuất!');
                        return;
                      }
                      setShowRunProduction(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        +
                      </div>
                      <span className="font-extrabold text-[11.5px] text-slate-905 dark:text-white">Sản xuất đợt mới</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      if (rawMaterials.length === 0) {
                        alert('Vui lòng khởi tạo ít nhất 1 loại nguyên liệu (vải) trong kho trước!');
                        return;
                      }
                      setShowAddRecipe(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50/45 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500 shrink-0">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[11.5px]">Định mức mẫu mã</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      if (rawMaterials.length === 0) {
                        alert('Hãy tạo danh mục nguyên liệu trước khi nhập kho sỉ lẻ!');
                        return;
                      }
                      setShowReplenishMaterial(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50/45 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-505 shrink-0">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                      </div>
                      <span className="font-bold text-[11.5px]">Nhập kho sỉ lẻ</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setShowAddMaterial(true);
                    }}
                    className="w-full text-left py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl text-xs text-slate-705 dark:text-slate-300 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50/45 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500 shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-[11.5px]">Thêm vải/vật tư mới</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main floating button plus */}
      <div className="fixed bottom-24 right-6 z-[998]">
        <motion.button
          onClick={() => setShowFabMenu(!showFabMenu)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl border-2 transition-all duration-300 cursor-pointer ${
            showFabMenu 
              ? 'bg-rose-600 hover:bg-rose-700 border-rose-500/30' 
              : subTab === 'breakdown'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 border-indigo-400/40 shadow-indigo-600/20'
                : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 border-emerald-400/40 shadow-emerald-600/20'
          }`}
          style={{ touchAction: 'none' }}
        >
          {showFabMenu ? (
            <X className="w-5 h-5 stroke-[3.5] transform rotate-90 transition-transform duration-250" />
          ) : (
            <Plus className="w-5.5 h-5.5 stroke-[3.5] animate-pulse" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
