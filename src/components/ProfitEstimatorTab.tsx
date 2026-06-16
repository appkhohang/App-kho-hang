/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, AlertCircle, TrendingUp, Sparkles, Check, Info, FileText, 
  Plus, Trash2, Edit3, RotateCcw, X, Save, Clock, Search
} from 'lucide-react';
import { ModelMaterialRecipe, RawMaterial, ModelOperationBreakdown } from '../types';

export interface SavedEstimate {
  id: string;
  title: string;
  recipeId: string;
  modelName: string;
  calcMaterials: Record<string, { mode: 'direct' | 'batch'; unitPrice: number; batchQty: number; batchTotal: number }>;
  calcLaborCost: number;
  calcAccessoryCost?: number;
  calcTargetSalePrice: number;
  totalMaterialCost: number;
  totalProductionCost: number;
  netProfit: number;
  profitMarginPercent: number;
  createdAt: string;
}

interface ProfitEstimatorTabProps {
  materialRecipes: ModelMaterialRecipe[];
  rawMaterials: RawMaterial[];
  operationBreakdowns: ModelOperationBreakdown[];
  fastEditMode?: boolean;
  defaultLaborCost?: number;
  defaultProfitMarginPercent?: number;
}

export default function ProfitEstimatorTab({
  materialRecipes,
  rawMaterials,
  operationBreakdowns,
  fastEditMode = false,
  defaultLaborCost = 15000,
  defaultProfitMarginPercent = 50,
}: ProfitEstimatorTabProps) {
  // Local states for the Suit Pricing & Profit Cost Calculator
  const [selectedCalcRecipeId, setSelectedCalcRecipeId] = useState<string>('');
  const [calcMaterials, setCalcMaterials] = useState<Record<string, { mode: 'direct' | 'batch'; unitPrice: number; batchQty: number; batchTotal: number }>>({});
  const [calcLaborCost, setCalcLaborCost] = useState<number>(0);
  const [calcAccessoryCost, setCalcAccessoryCost] = useState<number>(0);
  const [calcTargetSalePrice, setCalcTargetSalePrice] = useState<number>(120000);

  // Scenario manager states
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>(() => {
    try {
      const saved = localStorage.getItem('xuongan_saved_profit_estimates');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [saveTitleInput, setSaveTitleInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Inline editing state for saved estimate list
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTargetSalePrice, setEditTargetSalePrice] = useState<number>(0);
  const [editLaborCost, setEditLaborCost] = useState<number>(0);
  const [editAccessoryCost, setEditAccessoryCost] = useState<number>(0);

  // Floating Action Modal control for cost margins calculation
  const [isEstimatorModalOpen, setIsEstimatorModalOpen] = useState<boolean>(false);

  // Keep localStorage in sync
  useEffect(() => {
    localStorage.setItem('xuongan_saved_profit_estimates', JSON.stringify(savedEstimates));
  }, [savedEstimates]);

  const handleSelectCalcRecipe = (recipeId: string) => {
    setSelectedCalcRecipeId(recipeId);
    if (!recipeId) {
      setCalcMaterials({});
      setCalcLaborCost(0);
      setCalcAccessoryCost(0);
      return;
    }
    const recipe = materialRecipes.find(r => r.id === recipeId);
    if (recipe) {
      // 1. Prepopulate material costs
      const initialCalcMaterials: typeof calcMaterials = {};
      recipe.items.forEach(item => {
        initialCalcMaterials[item.materialId] = {
          mode: 'direct',
          unitPrice: 25000, // Default price for calculation
          batchQty: 1000,
          batchTotal: 25000000
        };
      });
      setCalcMaterials(initialCalcMaterials);
      setCalcAccessoryCost(0);

      // 2. Prepopulate labor cost from operation breakdowns
      const matchedBreakdown = operationBreakdowns.find(ob => ob.modelName.trim().toLowerCase() === recipe.modelName.trim().toLowerCase());
      const totalLabor = matchedBreakdown 
        ? matchedBreakdown.operations.reduce((sum, op) => sum + op.price, 0) 
        : defaultLaborCost; // default standard labor cost
      setCalcLaborCost(totalLabor);

      // 3. Set a default selling price
      const totalMatCost = recipe.items.reduce((sum, item) => sum + (item.consumptionRate * 25000), 0);
      const markupMultiplier = 1 + (defaultProfitMarginPercent / 100);
      setCalcTargetSalePrice(Math.round((totalMatCost + totalLabor) * markupMultiplier / 1000) * 1000 || 120000);
    }
  };

  // If a recipe is newly added or changed and we have none selected, auto-select the first one
  useEffect(() => {
    if (!selectedCalcRecipeId && materialRecipes.length > 0) {
      handleSelectCalcRecipe(materialRecipes[0].id);
    }
  }, [materialRecipes, selectedCalcRecipeId]);

  // Handler to save current scenario to the database/localStorage
  const handleSaveCurrentEstimate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCalcRecipeId) return;

    const currentRecipe = materialRecipes.find(r => r.id === selectedCalcRecipeId);
    if (!currentRecipe) return;

    // Calculate production costs based on current states
    let totalMaterialCostSingle = 0;
    currentRecipe.items.forEach(item => {
      const config = calcMaterials[item.materialId] || { unitPrice: 25000 };
      totalMaterialCostSingle += item.consumptionRate * config.unitPrice;
    });

    const totalProductionCost = totalMaterialCostSingle + calcLaborCost + calcAccessoryCost;
    const netProfit = Math.max(0, calcTargetSalePrice - totalProductionCost);
    const profitMarginPercent = calcTargetSalePrice > 0 ? Math.round((netProfit / calcTargetSalePrice) * 100) : 0;

    const hourStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('vi-VN');
    const displayTitle = saveTitleInput.trim() || `Ước tính ${currentRecipe.modelName} (Đợt ${dateStr})`;

    const newEstimate: SavedEstimate = {
      id: 'est_' + Math.random().toString(36).substring(2, 9),
      title: displayTitle,
      recipeId: selectedCalcRecipeId,
      modelName: currentRecipe.modelName,
      calcMaterials: JSON.parse(JSON.stringify(calcMaterials)),
      calcLaborCost,
      calcAccessoryCost,
      calcTargetSalePrice,
      totalMaterialCost: totalMaterialCostSingle,
      totalProductionCost,
      netProfit,
      profitMarginPercent,
      createdAt: `${dateStr} lúc ${hourStr}`
    };

    setSavedEstimates(prev => [newEstimate, ...prev]);
    setSaveTitleInput('');
    setSaveSuccessMessage(`🎉 Đã lưu thành công bản dự khóa "${displayTitle}"!`);
    
    // Auto-clear success message and close modal after 1.5 seconds
    setTimeout(() => {
      setSaveSuccessMessage('');
      setIsEstimatorModalOpen(false);
    }, 1500);
  };

  // Handler to load state of a saved scenario back into the editor controls
  const handleLoadEstimate = (est: SavedEstimate) => {
    setSelectedCalcRecipeId(est.recipeId);
    setCalcMaterials(JSON.parse(JSON.stringify(est.calcMaterials)));
    setCalcLaborCost(est.calcLaborCost);
    setCalcAccessoryCost(est.calcAccessoryCost || 0);
    setCalcTargetSalePrice(est.calcTargetSalePrice);
    
    // Open floating modal to allow direct editing
    setIsEstimatorModalOpen(true);
  };

  // Handler to delete a saved estimate
  const handleDeleteEstimate = (id: string, title: string) => {
    if (confirm(`Sếp có chắc chắn muốn xóa bản dự toán biên lãi "${title}" này không?`)) {
      setSavedEstimates(prev => prev.filter(est => est.id !== id));
      if (editingEstimateId === id) {
        setEditingEstimateId(null);
      }
    }
  };

  // Handler to open inline editor for a saved estimate
  const handleStartEdit = (est: SavedEstimate) => {
    setEditingEstimateId(est.id);
    setEditTitle(est.title);
    setEditTargetSalePrice(est.calcTargetSalePrice);
    setEditLaborCost(est.calcLaborCost);
    setEditAccessoryCost(est.calcAccessoryCost || 0);
  };

  // Handler to save modifications of inline editing
  const handleSaveEdit = (id: string) => {
    setSavedEstimates(prev => prev.map(est => {
      if (est.id !== id) return est;

      // Recalculate based on updated inline inputs
      const totalProductionCost = est.totalMaterialCost + editLaborCost + editAccessoryCost;
      const netProfit = Math.max(0, editTargetSalePrice - totalProductionCost);
      const profitMarginPercent = editTargetSalePrice > 0 ? Math.round((netProfit / editTargetSalePrice) * 100) : 0;

      return {
        ...est,
        title: editTitle.trim() || est.title,
        calcLaborCost: editLaborCost,
        calcAccessoryCost: editAccessoryCost,
        calcTargetSalePrice: editTargetSalePrice,
        totalProductionCost,
        netProfit,
        profitMarginPercent
      };
    }));
    setEditingEstimateId(null);
  };

  // Filtered saved estimate list representation
  const filteredEstimates = savedEstimates.filter(est => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return est.title.toLowerCase().includes(term) || est.modelName.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER STATEMENT */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border-l-4 border-indigo-600 dark:border-indigo-500 p-5 rounded-r-2xl">
        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
          🧮 QUẢN LÝ GIÁ THÀNH & LỢI NHUẬN BỘ ĐỒ
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Công cụ phân tích cấu trúc giá thành sản xuất dựa trên định mức nguyên vật liệu tiêu sinh cùng đơn giá thợ may thực tế. Tự động dự phóng doanh thu, tỷ suất lợi nhuận gộp thông thái giúp sếp tối ưu hóa dòng tiền và báo giá khách sỉ cực kỳ chuẩn xác.
        </p>
      </div>

      {materialRecipes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Chưa có bảng Định Mức Nguyên Liệu</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Sếp hãy tạo ít nhất một bảng Định Mức Vật Tư ở Tab <strong>"Quản Lý Sản Xuất"</strong> trước khi sử dụng chức năng tính toán chi tiết này nhé.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* FLOATING ACTION BUTTON (FAB) FOR NEW CALCULATION */}
          <div className="fixed bottom-8 right-8 z-40">
            <button
              onClick={() => setIsEstimatorModalOpen(true)}
              className="relative group bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-indigo-400/20 focus:outline-none cursor-pointer"
              title="Tính toán biên chi phí mới"
            >
              <Plus className="w-7 h-7 text-white transition-transform duration-300 group-hover:rotate-90" />
              <div className="absolute right-16 bg-slate-900/95 dark:bg-slate-900/95 border border-slate-800 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Báo giá & Lợi nhuận mới (+)</span>
              </div>
              {/* Pulsing ring indicator */}
              <span className="absolute -inset-0.5 rounded-full border border-indigo-500/50 animate-ping opacity-75 pointer-events-none" />
            </button>
          </div>

          {/* BEAUTIFUL COST CALCULATOR DIALOG / MODAL (FLOATING) */}
          <AnimatePresence>
            {isEstimatorModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                {/* Overlay backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsEstimatorModalOpen(false)}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                />

                {/* Modal Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="relative bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col z-10"
                >
                  {/* Modal Header */}
                  <div className="bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <DollarSign className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                          🧮 PHÂN TÍCH GIÁ THÀNH & TÍNH BIÊN LỢI NHUẬN
                        </h3>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          Sếp chỉnh sửa giá vải thô và tiền gia công tổ may để xem kết quả biên lãi ròng tức thì
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEstimatorModalOpen(false)}
                      className="p-1.5 rounded-lg bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Đóng bảng tính"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body (Scrollable inside) */}
                  <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                      
                      {/* LEFT CONTAINER: INPUT PARAMETERS */}
                      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <h3 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                            1. Tham số ước tính định lượng sỉ
                          </h3>
                        </div>

                        {/* Select Recipe Selector */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Mẫu Định Mức Áp Dụng:
                          </label>
                          <select
                            id="estimator-recipe-select"
                            value={selectedCalcRecipeId}
                            onChange={(e) => handleSelectCalcRecipe(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Chọn kiểu mẫu định mức để bắt đầu tính toán --</option>
                            {materialRecipes.map(r => (
                              <option key={r.id} value={r.id}>{r.modelName}</option>
                            ))}
                          </select>
                        </div>

                        {selectedCalcRecipeId && (
                          <div className="space-y-5 animate-fadeIn">
                            {/* Materials list */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="block text-xs font-black text-slate-600 dark:text-slate-350 uppercase">
                                  Đơn giá vật tư theo mét/cuộn:
                                </label>
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-bold">
                                  Định lượng dập mẫu
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                                {(() => {
                                  const currentRecipe = materialRecipes.find(r => r.id === selectedCalcRecipeId);
                                  if (!currentRecipe) return null;

                                  return currentRecipe.items.map(item => {
                                    const matchedMat = rawMaterials.find(m => m.id === item.materialId);
                                    const matName = matchedMat ? matchedMat.name : "Vải / Vật tư";
                                    const matUnit = matchedMat ? matchedMat.unit : "mét";
                                    const config = calcMaterials[item.materialId] || {
                                      mode: 'direct',
                                      unitPrice: 25000,
                                      batchQty: 1000,
                                      batchTotal: 25000000
                                    };

                                    const updateConfigField = (field: string, val: any) => {
                                      setCalcMaterials(prev => {
                                        const prevConfig = prev[item.materialId] || {
                                          mode: 'direct',
                                          unitPrice: 25000,
                                          batchQty: 1000,
                                          batchTotal: 25000000
                                        };
                                        const nextConfig = { ...prevConfig, [field]: val };
                                        if (nextConfig.mode === 'batch') {
                                          const qty = Number(nextConfig.batchQty) || 0;
                                          const total = Number(nextConfig.batchTotal) || 0;
                                          nextConfig.unitPrice = qty > 0 ? Math.round(total / qty) : 0;
                                        }
                                        return { ...prev, [item.materialId]: nextConfig };
                                      });
                                    };

                                    return (
                                      <div 
                                        key={item.materialId}
                                        className="p-3 bg-slate-50/60 dark:bg-zinc-950/60 border border-slate-150 dark:border-slate-800/80 rounded-xl space-y-2 text-left"
                                      >
                                        <div className="flex justify-between items-start border-b border-slate-200/50 dark:border-slate-800 pb-1.5">
                                          <div className="truncate pr-1">
                                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate" title={matName}>{matName}</h4>
                                            <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-0.5 whitespace-nowrap hidden sm:block">
                                              Tiêu hao: <strong className="font-mono text-indigo-650 dark:text-indigo-400">{item.consumptionRate}</strong> {matUnit}/bộ
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex bg-slate-200/50 dark:bg-zinc-900/80 p-0.5 rounded-lg text-[10px] font-bold">
                                          <button
                                            type="button"
                                            onClick={() => updateConfigField('mode', 'direct')}
                                            className={`flex-1 py-1 rounded-md text-center transition cursor-pointer ${config.mode === 'direct' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-450 shadow-2xs font-black' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700'}`}
                                          >
                                            Nhập lẻ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updateConfigField('mode', 'batch')}
                                            className={`flex-1 py-1 rounded-md text-center transition cursor-pointer ${config.mode === 'batch' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-450 shadow-2xs font-black' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700'}`}
                                          >
                                            Quy đổi sỉ
                                          </button>
                                        </div>

                                        {config.mode === 'direct' ? (
                                          <div className="space-y-1">
                                            <label className="text-[10px] block font-bold text-slate-400 uppercase">Giá mua /{matUnit} (đ):</label>
                                            <div className="relative">
                                              <input
                                                type="number"
                                                value={config.unitPrice || ''}
                                                placeholder="25,000"
                                                onChange={(e) => updateConfigField('unitPrice', Math.max(0, Number(e.target.value)))}
                                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-850 rounded-lg pl-3 pr-8 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">đ</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="text-[9px] block font-bold text-slate-400">S.Lượng ({matUnit}):</label>
                                                <input
                                                  type="number"
                                                  value={config.batchQty || ''}
                                                  placeholder="1000"
                                                  onChange={(e) => updateConfigField('batchQty', Math.max(0, Number(e.target.value)))}
                                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[9px] block font-bold text-slate-400">Tổng tiền sỉ:</label>
                                                <input
                                                  type="number"
                                                  value={config.batchTotal || ''}
                                                  placeholder="25,000,000"
                                                  onChange={(e) => updateConfigField('batchTotal', Math.max(0, Number(e.target.value)))}
                                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                                />
                                              </div>
                                            </div>
                                            <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 py-0.5 px-2 rounded text-center font-mono mt-1">
                                              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                                                👉 {config.unitPrice.toLocaleString()}đ/{matUnit}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Labor cost, Accessory cost & Target Sale Price Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-850 pt-4">
                              {/* Labor cost */}
                              <div className="space-y-1.5 text-left">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                  Đơn Giá May Gia Công (đ/Bộ):
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={calcLaborCost || ''}
                                    placeholder="15,000"
                                    onChange={(e) => setCalcLaborCost(Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-14 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ/bộ</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400 leading-normal italic">
                                  * Gốc thợ may từ sơ đồ công đoạn mẫu
                                </p>
                              </div>

                              {/* Accessory Cost */}
                              <div className="space-y-1.5 text-left">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                  Giá Tiền Phụ Kiện Bộ Đồ (đ/Bộ):
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={calcAccessoryCost || ''}
                                    placeholder="5,000"
                                    onChange={(e) => setCalcAccessoryCost(Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-14 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ/bộ</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400 leading-normal italic">
                                  * Cút, tag mác, bao bì chun chỉ phụ bộ
                                </p>
                              </div>

                              {/* Target Sale Price */}
                              <div className="space-y-1.5 text-left">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                  Giá Báo Sỉ Dự Kiến Cho Khách (đ/Bộ):
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={calcTargetSalePrice || ''}
                                    placeholder="120,000"
                                    onChange={(e) => setCalcTargetSalePrice(Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-14 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ/bộ</span>
                                </div>
                                <p className="text-[9.5px] text-slate-400 leading-normal italic">
                                  * Giá bán sỉ để tự động tính phần trăm biên lãi
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* RIGHT CONTAINER: MATH VISUAL REPORTS */}
                      <div className="lg:col-span-5 flex flex-col justify-between">
                        {selectedCalcRecipeId ? (
                          (() => {
                            const currentRecipe = materialRecipes.find(r => r.id === selectedCalcRecipeId);
                            if (!currentRecipe) return null;

                            let totalMaterialCostSingle = 0;
                            const breakDownLines: { name: string; rate: number; unitPrice: number; total: number; unit: string }[] = [];

                            currentRecipe.items.forEach(item => {
                              const matchedMat = rawMaterials.find(m => m.id === item.materialId);
                              const matName = matchedMat ? matchedMat.name : "Vật tư";
                              const matUnit = matchedMat ? matchedMat.unit : "mét";
                              const config = calcMaterials[item.materialId] || { unitPrice: 25000 };
                              const costSingle = item.consumptionRate * config.unitPrice;
                              
                              totalMaterialCostSingle += costSingle;
                              breakDownLines.push({
                                name: matName,
                                rate: item.consumptionRate,
                                unitPrice: config.unitPrice,
                                total: costSingle,
                                unit: matUnit
                              });
                            });

                            const totalProductionCost = totalMaterialCostSingle + calcLaborCost + calcAccessoryCost;
                            const netProfit = Math.max(0, calcTargetSalePrice - totalProductionCost);
                            const profitMarginPercent = calcTargetSalePrice > 0 ? Math.round((netProfit / calcTargetSalePrice) * 100) : 0;

                            return (
                              <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 space-y-4 flex-grow flex flex-col justify-between shadow-xl text-left">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <TrendingUp className="w-4 h-4 text-emerald-400 animate-pulse" />
                                      <h3 className="font-extrabold text-[11px] text-indigo-400 uppercase tracking-widest">
                                        📊 KẾT QUẢ TÍNH TOÁN BIÊN CHI PHÍ
                                      </h3>
                                    </div>
                                    <span className="text-[9.5px] bg-slate-800 text-slate-350 font-mono px-2 py-0.5 rounded font-bold">
                                      {currentRecipe.modelName}
                                    </span>
                                  </div>

                                  {/* Breakdown items detail list */}
                                  <div className="space-y-1.5">
                                    <p className="text-[9.5px] font-black text-slate-405 uppercase tracking-wide">
                                      1. Định lượng vải rập gốc:
                                    </p>
                                    
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                      {breakDownLines.map((line, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-850/60 border border-slate-800/50 p-1.5 rounded-lg">
                                          <span className="text-slate-350 text-[10.5px] truncate max-w-[200px]">
                                            • {line.name} ({line.rate}{line.unit} × {line.unitPrice.toLocaleString()}đ)
                                          </span>
                                          <span className="font-mono font-bold text-slate-100 text-[10.5px]">
                                            {Math.round(line.total).toLocaleString()}đ
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Summary details */}
                                  <div className="grid grid-cols-3 gap-2 text-left">
                                    <div className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl">
                                      <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Vải mộc:</span>
                                      <span className="text-[11px] font-mono font-bold text-slate-100 block mt-0.5 truncate">
                                        {Math.round(totalMaterialCostSingle).toLocaleString()}đ
                                      </span>
                                    </div>
                                    <div className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl">
                                      <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Công may:</span>
                                      <span className="text-[11px] font-mono font-bold text-slate-100 block mt-0.5 truncate">
                                        {calcLaborCost.toLocaleString()}đ
                                      </span>
                                    </div>
                                    <div className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl">
                                      <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Phụ kiện:</span>
                                      <span className="text-[11px] font-mono font-bold text-slate-100 block mt-0.5 truncate">
                                        {calcAccessoryCost.toLocaleString()}đ
                                      </span>
                                    </div>
                                  </div>

                                  {/* Grand cost value */}
                                  <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl flex items-center justify-between text-left">
                                    <div>
                                      <span className="text-[9.5px] uppercase font-black text-amber-400 block">Vốn gốc / 1 Bộ đồ:</span>
                                      <span className="text-[8.5px] text-slate-400 block mt-0.5">Thành phẩm hoàn chỉnh</span>
                                    </div>
                                    <span className="text-sm font-black font-mono text-amber-400">
                                      {Math.round(totalProductionCost).toLocaleString()}đ
                                    </span>
                                  </div>

                                  {/* Margins */}
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex flex-col justify-between text-left">
                                      <span className="text-[8.5px] uppercase font-bold text-emerald-400">Lãi thu ròng:</span>
                                      <span className="text-[13px] font-black font-mono text-emerald-400 mt-0.5">
                                        {Math.round(netProfit).toLocaleString()}đ
                                      </span>
                                    </div>

                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl flex flex-col justify-between text-left">
                                      <span className="text-[8.5px] uppercase font-bold text-indigo-400">Lợi nhuận gộp:</span>
                                      <div>
                                        <span className="text-[13px] font-black font-mono text-indigo-400 mt-0.5 block">
                                          {profitMarginPercent}%
                                        </span>
                                        <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                                          <div 
                                            className="bg-indigo-400 h-full rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, profitMarginPercent)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Business indicators diagnostics */}
                                  <div className="bg-slate-850 border border-slate-800 p-2.5 rounded-xl text-[10px] text-slate-400 text-left">
                                    <div className="flex gap-2 items-start">
                                      <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                      <div>
                                        {profitMarginPercent >= 45 ? (
                                          <p className="text-emerald-400 leading-tight font-bold">Biên lãi siêu tốt ({profitMarginPercent}%). Tối ưu rất tốt, dòng tiền thặng dư cực chất sếp nhé!</p>
                                        ) : profitMarginPercent >= 20 ? (
                                          <p className="text-amber-400 leading-tight font-semibold">Tỷ suất an toàn ({profitMarginPercent}%). Theo sát hao hụt cắt vải mộc thực tế sếp nhé.</p>
                                        ) : (
                                          <p className="text-red-400 leading-tight font-semibold">Cảnh báo: Biên lãi quá thấp ({profitMarginPercent}%). Hãy thương khảo giảm giá vải thô/công thợ.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* QUICK ADD / SAVE SCENARIO SECTION WITH "+" KEY */}
                                <form onSubmit={handleSaveCurrentEstimate} className="border-t border-slate-800 pt-3.5 space-y-2 text-left">
                                  <label className="block text-[9.5px] font-black text-slate-400 uppercase tracking-wider">
                                    ✍️ Đặt tên bảo mật để đăng ký sổ ước tính (+):
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      required
                                      value={saveTitleInput}
                                      placeholder={`e.g., Dự tính sỉ ${currentRecipe.modelName} hè`}
                                      onChange={(e) => setSaveTitleInput(e.target.value)}
                                      className="flex-grow bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button
                                      type="submit"
                                      title="Xác nhận lưu ước tính vào sổ"
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 transition font-black text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-lg cursor-pointer animate-pulse"
                                    >
                                      <Plus className="w-4 h-4 text-white" />
                                      <span>Lưu (+)</span>
                                    </button>
                                  </div>
                                  {saveSuccessMessage && (
                                    <p className="text-[10px] text-emerald-400 font-extrabold animate-pulse">{saveSuccessMessage}</p>
                                  )}
                                </form>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs flex-grow flex flex-col items-center justify-center min-h-[300px]">
                            <FileText className="w-10 h-10 mb-2 text-indigo-400 animate-bounce" />
                            <p>Hãy chọn Mẫu định mức ở cột bên trái để phân tích dòng tiền sỉ của bộ đồ nhé.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* LOWER SECTION: SCENARIO MANAGER LIST (EDITABLE & DELETABLE) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                    Sổ danh sách ước tính biên lợi nhuận
                  </h3>
                  <p className="text-[10.5px] text-slate-400">Các hồ sơ cấu trúc chi phí giá sỉ sếp đã lưu trữ</p>
                </div>
              </div>

              {/* Real-time search filter */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  placeholder="Tìm theo tên bản lưu, mã hàng..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-450 focus:outline-none"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredEstimates.length === 0 ? (
              <div className="py-10 text-center space-y-2 border-2 border-dashed border-slate-100 dark:border-slate-800/50 rounded-2xl">
                <FileText className="w-9 h-9 text-slate-350 mx-auto" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-450">Không tìm thấy bản lưu dự phóng nào</h4>
                <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                  {searchTerm 
                    ? "Sếp vui lòng đổi từ khóa tìm kiếm khác phù hợp"
                    : "Sếp hãy điền tên ở bảng 'KẾT QUẢ' phía trên và chọn nút 'Lưu (+)' để ghi lại hồ sơ nhé!"
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/85">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/80 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3">scenario / tên bản ghi</th>
                      <th className="p-3">kiểu mẫu định lượng</th>
                      <th className="p-3 text-right">báo sỉ dự kiến</th>
                      <th className="p-3 text-right">thùng công thợ</th>
                      <th className="p-3 text-right">phụ kiện bộ</th>
                      <th className="p-3 text-right">vải sỉ gốc</th>
                      <th className="p-3 text-right">giá thành</th>
                      <th className="p-3 text-right">lãi dự tính</th>
                      <th className="p-3 text-center">tỷ suất lãi</th>
                      <th className="p-3 text-center w-28">thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                    <AnimatePresence initial={false}>
                      {filteredEstimates.map((est) => {
                        const isEditing = editingEstimateId === est.id;

                        // Color styles based on margin
                        let marginBadgeStyle = "bg-red-500/10 text-red-600 border border-red-500/20";
                        if (est.profitMarginPercent >= 45) {
                          marginBadgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                        } else if (est.profitMarginPercent >= 20) {
                          marginBadgeStyle = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
                        } else if (est.profitMarginPercent >= 10) {
                          marginBadgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20";
                        }

                        return (
                          <motion.tr 
                            key={est.id} 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 align-middle transition"
                          >
                            
                            {/* Scenario Title */}
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="bg-slate-50 dark:bg-zinc-950 border border-slate-350 dark:border-slate-700 px-2 py-1 rounded text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                />
                              ) : (
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-[#312e81] dark:text-indigo-300 text-xs">{est.title}</p>
                                  <p className="text-[9px] text-slate-450 dark:text-slate-500 font-mono flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    Lưu: {est.createdAt}
                                  </p>
                                </div>
                              )}
                            </td>

                            {/* Applied Recipe model */}
                            <td className="p-3 font-bold text-slate-600 dark:text-slate-350">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold">
                                {est.modelName}
                              </span>
                            </td>

                            {/* Target retail price */}
                            <td 
                              className={`p-3 text-right font-semibold font-mono text-slate-800 dark:text-slate-100 ${
                                fastEditMode && !isEditing 
                                  ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 transition-all rounded-lg select-none group/cell relative' 
                                  : ''
                              }`}
                              onClick={() => {
                                if (fastEditMode && !isEditing) {
                                  handleStartEdit(est);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="relative inline-block w-24">
                                  <input
                                    type="number"
                                    value={editTargetSalePrice || ''}
                                    onChange={(e) => setEditTargetSalePrice(Math.max(0, Number(e.target.value)))}
                                    className="bg-slate-50 dark:bg-zinc-950 border border-slate-350 dark:border-slate-700 px-1 py-1 rounded text-xs font-bold text-right font-mono text-slate-900 w-full"
                                  />
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <span className="font-black text-slate-900 dark:text-white">
                                    {Math.round(est.calcTargetSalePrice).toLocaleString()}đ
                                  </span>
                                  {fastEditMode && (
                                    <span className="text-[9px] text-[#6366f1] opacity-0 group-hover/cell:opacity-100 font-sans font-semibold ml-0.5 whitespace-nowrap">✍️ Sửa</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Labor cost */}
                            <td 
                              className={`p-3 text-right font-medium font-mono text-slate-500 dark:text-slate-400 ${
                                fastEditMode && !isEditing 
                                  ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 transition-all rounded-lg select-none group/cell relative' 
                                  : ''
                              }`}
                              onClick={() => {
                                if (fastEditMode && !isEditing) {
                                  handleStartEdit(est);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="relative inline-block w-20">
                                  <input
                                    type="number"
                                    value={editLaborCost || ''}
                                    onChange={(e) => setEditLaborCost(Math.max(0, Number(e.target.value)))}
                                    className="bg-slate-50 dark:bg-zinc-950 border border-slate-350 dark:border-slate-700 px-1 py-1 rounded text-xs font-bold text-right font-mono text-slate-900 w-full"
                                  />
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <span>{est.calcLaborCost.toLocaleString()}đ</span>
                                  {fastEditMode && (
                                    <span className="text-[9px] text-[#6366f1] opacity-0 group-hover/cell:opacity-100 font-sans font-semibold ml-0.5 whitespace-nowrap">✍️ Sửa</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Accessory Cost */}
                            <td 
                              className={`p-3 text-right font-medium font-mono text-slate-500 dark:text-slate-400 ${
                                fastEditMode && !isEditing 
                                  ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 transition-all rounded-lg select-none group/cell relative' 
                                  : ''
                              }`}
                              onClick={() => {
                                if (fastEditMode && !isEditing) {
                                  handleStartEdit(est);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="relative inline-block w-20">
                                  <input
                                    type="number"
                                    value={editAccessoryCost || 0}
                                    onChange={(e) => setEditAccessoryCost(Math.max(0, Number(e.target.value)))}
                                    className="bg-slate-50 dark:bg-zinc-950 border border-slate-350 dark:border-slate-700 px-1 py-1 rounded text-xs font-bold text-right font-mono text-slate-900 w-full"
                                  />
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <span>{(est.calcAccessoryCost || 0).toLocaleString()}đ</span>
                                  {fastEditMode && (
                                    <span className="text-[9px] text-[#6366f1] opacity-0 group-hover/cell:opacity-100 font-sans font-semibold ml-0.5 whitespace-nowrap">✍️ Sửa</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Materials base cost */}
                            <td className="p-3 text-right font-medium font-mono text-slate-550 dark:text-slate-400">
                              <span>{Math.round(est.totalMaterialCost).toLocaleString()}đ</span>
                            </td>

                            {/* Total Production Cost */}
                            <td className="p-3 text-right font-bold font-mono text-amber-600 dark:text-amber-400">
                              <span>{Math.round(est.totalProductionCost).toLocaleString()}đ</span>
                            </td>

                            {/* Net Profit Cash Amount */}
                            <td className="p-3 text-right font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                              <span>{Math.round(est.netProfit).toLocaleString()}đ</span>
                            </td>

                            {/* Margin precentage pill */}
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-tight ${marginBadgeStyle}`}>
                                {est.profitMarginPercent}%
                              </span>
                            </td>

                            {/* Scenario Action Controls */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveEdit(est.id)}
                                      title="Lưu sửa đổi"
                                      className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition cursor-pointer"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingEstimateId(null)}
                                      title="Hủy bỏ"
                                      className="p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 transition cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleLoadEstimate(est)}
                                      title="Tải lại ước tính lên bảng tính"
                                      className="p-1.5 bg-indigo-50 hover:bg-indigo-150 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer text-[10px] font-black"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Tải lại</span>
                                    </button>
                                    <button
                                      onClick={() => handleStartEdit(est)}
                                      title="Chỉnh sửa hồ sơ"
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 rounded-lg transition cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEstimate(est.id, est.title)}
                                      title="Xóa vĩnh viễn"
                                      className="p-1.5 bg-red-50 hover:bg-red-150 dark:bg-red-550/10 dark:hover:bg-red-550/20 text-red-650 dark:text-red-400 rounded-lg transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>

                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
