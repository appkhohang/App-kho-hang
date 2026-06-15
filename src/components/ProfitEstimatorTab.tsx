/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, AlertCircle, TrendingUp, Sparkles, Check, Info, FileText, ArrowUpDown
} from 'lucide-react';
import { ModelMaterialRecipe, RawMaterial, ModelOperationBreakdown } from '../types';

interface ProfitEstimatorTabProps {
  materialRecipes: ModelMaterialRecipe[];
  rawMaterials: RawMaterial[];
  operationBreakdowns: ModelOperationBreakdown[];
}

export default function ProfitEstimatorTab({
  materialRecipes,
  rawMaterials,
  operationBreakdowns,
}: ProfitEstimatorTabProps) {
  // Local states for the Suit Pricing & Profit Cost Calculator
  const [selectedCalcRecipeId, setSelectedCalcRecipeId] = useState<string>('');
  const [calcMaterials, setCalcMaterials] = useState<Record<string, { mode: 'direct' | 'batch'; unitPrice: number; batchQty: number; batchTotal: number }>>({});
  const [calcLaborCost, setCalcLaborCost] = useState<number>(0);
  const [calcTargetSalePrice, setCalcTargetSalePrice] = useState<number>(120000);

  const handleSelectCalcRecipe = (recipeId: string) => {
    setSelectedCalcRecipeId(recipeId);
    if (!recipeId) {
      setCalcMaterials({});
      setCalcLaborCost(0);
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

      // 2. Prepopulate labor cost from operation breakdowns
      const matchedBreakdown = operationBreakdowns.find(ob => ob.modelName.trim().toLowerCase() === recipe.modelName.trim().toLowerCase());
      const totalLabor = matchedBreakdown 
        ? matchedBreakdown.operations.reduce((sum, op) => sum + op.price, 0) 
        : 15000; // default standard labor cost
      setCalcLaborCost(totalLabor);

      // 3. Set a default selling price
      const totalMatCost = recipe.items.reduce((sum, item) => sum + (item.consumptionRate * 25000), 0);
      setCalcTargetSalePrice(Math.round((totalMatCost + totalLabor) * 1.5 / 1000) * 1000 || 120000);
    }
  };

  // If a recipe is newly added or changed and we have none selected, auto-select the first one
  useEffect(() => {
    if (!selectedCalcRecipeId && materialRecipes.length > 0) {
      handleSelectCalcRecipe(materialRecipes[0].id);
    }
  }, [materialRecipes, selectedCalcRecipeId]);

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT CONTAINER: INPUT PARAMETERS */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="font-extrabold text-xs text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                1. Tham số đầu vào ước tính
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
                {/* 2. Materials unit dynamic list */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-350 uppercase">
                      Đơn giá vật tư theo mét/cuộn:
                    </label>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">
                      Có thể thay đổi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            
                            // Recalculate unit price automatically if batch mode and we edit batchQty or batchTotal
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
                            className="p-3.5 bg-slate-50/60 dark:bg-zinc-950/60 border border-slate-150 dark:border-slate-800/80 rounded-xl space-y-2"
                          >
                            <div className="flex justify-between items-start border-b border-slate-200/50 dark:border-slate-800 pb-1.5">
                              <div>
                                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[150px]">{matName}</h4>
                                <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-0.5">
                                  Định lượng: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{item.consumptionRate}</strong> {matUnit}/bộ
                                </p>
                              </div>
                            </div>

                            {/* Direct Entry vs Bulk Batch Purchase Entry */}
                            <div className="flex bg-slate-200/50 dark:bg-zinc-900/80 p-0.5 rounded-lg text-[10px] font-bold font-sans">
                              <button
                                type="button"
                                onClick={() => updateConfigField('mode', 'direct')}
                                className={`flex-1 py-1 rounded-md text-center transition ${config.mode === 'direct' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-450 shadow-2xs font-black' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700'}`}
                              >
                                Nhập lẻ 1 bộ
                              </button>
                              <button
                                type="button"
                                onClick={() => updateConfigField('mode', 'batch')}
                                className={`flex-1 py-1 rounded-md text-center transition ${config.mode === 'batch' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-450 shadow-2xs font-black' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700'}`}
                              >
                                Quy đổi lô mua sỉ
                              </button>
                            </div>

                            {config.mode === 'direct' ? (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Giá sắm mỗi {matUnit} (đ):</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={config.unitPrice || ''}
                                    placeholder="25,000"
                                    onChange={(e) => updateConfigField('unitPrice', Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-850 rounded-lg pl-3 pr-8 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">đ</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-400 block mb-0.5">Số lượng ({matUnit}):</label>
                                    <input
                                      type="number"
                                      value={config.batchQty || ''}
                                      placeholder="1000"
                                      onChange={(e) => updateConfigField('batchQty', Math.max(0, Number(e.target.value)))}
                                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-400 block mb-0.5">Tổng tiền lô (đ):</label>
                                    <input
                                      type="number"
                                      value={config.batchTotal || ''}
                                      placeholder="25,000,000"
                                      onChange={(e) => updateConfigField('batchTotal', Math.max(0, Number(e.target.value)))}
                                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                    />
                                  </div>
                                </div>
                                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 p-1.5 rounded-lg text-center font-mono">
                                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    👉 Quy đổi: {config.unitPrice.toLocaleString()}đ/{matUnit}
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

                {/* Labor cost & Target Sale Price Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  
                  {/* Labor cost */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Đơn Giá Nhân Công Thợ May (đ/Bộ):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={calcLaborCost || ''}
                        placeholder="15,000"
                        onChange={(e) => setCalcLaborCost(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-12 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ/bộ</span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 leading-normal italic">
                      * Tự động đồng khớp giá gốc nếu khớp kiểu mẫu bảng dập tổ thợ.
                    </p>
                  </div>

                  {/* Target Sale Price */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Giá Bán Sỉ Dự Kiến Cho Khách (đ/Bộ):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={calcTargetSalePrice || ''}
                        placeholder="120,000"
                        onChange={(e) => setCalcTargetSalePrice(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-12 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ/bộ</span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 leading-normal italic">
                      * Nhập giá mẫu sỉ để ước tính điểm hòa vốn và tỷ suất lợi nhuận.
                    </p>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* RIGHT CONTAINER: MATH VISUAL REPORTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
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

                const totalProductionCost = totalMaterialCostSingle + calcLaborCost;
                const netProfit = Math.max(0, calcTargetSalePrice - totalProductionCost);
                const profitMarginPercent = calcTargetSalePrice > 0 ? Math.round((netProfit / calcTargetSalePrice) * 100) : 0;
                const breakevenBatchSize = totalProductionCost > 0 ? Math.ceil(25000000 / (calcTargetSalePrice - totalProductionCost || 1)) : 0;

                return (
                  <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 space-y-5 flex-grow group shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4.5 h-4.5 text-emerald-400 animate-bounce" />
                        <h3 className="font-extrabold text-xs text-indigo-400 uppercase tracking-widest">
                          📊 KẾT QUẢ PHÂN TÍCH THÀNH PHẨM
                        </h3>
                      </div>
                      <span className="text-[9.5px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                        {currentRecipe.modelName}
                      </span>
                    </div>

                    {/* Breakdown items detail list */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        1. Thành phần định mức giá gốc:
                      </p>
                      
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {breakDownLines.map((line, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-slate-850/60 border border-slate-800/80 p-2 rounded-lg">
                            <span className="text-slate-350">
                              • <strong>{line.name}</strong> ({line.rate} {line.unit} × {line.unitPrice.toLocaleString()}đ)
                            </span>
                            <span className="font-mono font-bold text-slate-100">
                              {Math.round(line.total).toLocaleString()}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary card highlights details block */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-slate-850 border border-slate-800 p-3 rounded-xl">
                        <span className="text-[9px] uppercase font-bold text-slate-450 block">Tổng vải & phụ liệu:</span>
                        <span className="text-sm font-mono font-bold text-slate-100 block mt-1">
                          {Math.round(totalMaterialCostSingle).toLocaleString()}đ
                        </span>
                      </div>
                      <div className="bg-slate-850 border border-slate-800 p-3 rounded-xl">
                        <span className="text-[9px] uppercase font-bold text-slate-450 block">Công thợ gia công:</span>
                        <span className="text-sm font-mono font-bold text-slate-100 block mt-1">
                          {calcLaborCost.toLocaleString()}đ
                        </span>
                      </div>
                    </div>

                    {/* GRAND TOTAL CAPITAL VALUE */}
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-black text-amber-400 block">Vốn sản xuất gốc (1 bộ):</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5 italic">(Vật liệu định mức + Công thợ)</span>
                      </div>
                      <span className="text-lg font-black font-mono text-amber-400">
                        {Math.round(totalProductionCost).toLocaleString()}đ
                      </span>
                    </div>

                    {/* PROFIT MARGIN SCALE SUMMARY */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">Lãi thu ròng / Bộ:</span>
                        <span className="text-base font-black font-mono text-emerald-400 mt-1">
                          {Math.round(netProfit).toLocaleString()}đ
                        </span>
                      </div>

                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex flex-col justify-between">
                        <span className="text-[9px] uppercase font-bold text-indigo-400">Biên lãi suất gộp:</span>
                        <div>
                          <span className="text-base font-black font-mono text-indigo-400 mt-1 block">
                            {profitMarginPercent}%
                          </span>
                          <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, profitMarginPercent)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BUSINESS METRICS STRATEGISTS ADVICES */}
                    <div className="bg-slate-850 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5 text-[11px] text-slate-350">
                      <div className="flex gap-2 items-start">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 font-sans">
                          <p className="font-bold text-slate-200">💡 Nhận định chỉ số kinh doanh:</p>
                          {profitMarginPercent >= 40 ? (
                            <p className="text-emerald-400 leading-relaxed font-semibold">Tỷ suất lãi cao ({profitMarginPercent}%). Mẫu đầm/bộ này sếp sản xuất số lượng lớn rất an toàn, giúp tích luỹ thặng dư cao cho xưởng An!</p>
                          ) : profitMarginPercent >= 20 ? (
                            <p className="text-amber-400 leading-relaxed font-semibold">Biên lợi nhuận ở mức chấp nhận được ({profitMarginPercent}%). Sếp nên kiểm soát kỹ hao đo định mức rập tổ cắt để tranh thất thoát chỉ vải.</p>
                          ) : (
                            <p className="text-red-400 leading-relaxed font-semibold">Cảnh báo: Biên lãi rất mỏng ({profitMarginPercent}%). Có vẻ sếp đang bán giá hơi thấp hoặc công nhân tính tiền may hơi cao. Sếp hãy thương lượng giảm tiền công hoặc nhích giá sỉ khách đặt nhé!</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs flex-grow flex flex-col items-center justify-center">
                <FileText className="w-10 h-10 mb-2 text-slate-300" />
                <p>Hãy chọn Mẫu định mức ở cột bên trái để phân tích dòng tiền và tổng cơ cấu giá vốn.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
