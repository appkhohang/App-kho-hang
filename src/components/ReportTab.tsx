/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, BarChart3, Users, DollarSign, Calendar, Layers, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { ImportItem, Bill, ProductionBatch, Worker, WorkerJob } from '../types';
import { getVietnameseMonthKey, getVietnameseWeekKey } from '../utils/dateUtils';

interface ReportTabProps {
  items: ImportItem[];
  bills: Bill[];
  productionBatches: ProductionBatch[];
  workers: Worker[];
  workerJobs: WorkerJob[];
}

export default function ReportTab({ items, bills, productionBatches, workers, workerJobs }: ReportTabProps) {
  
  // Calculate stats
  const totalItemsCount = items.reduce((acc, curr) => acc + curr.sốLượng, 0);
  const totalInvoicesCount = bills.length;
  
  // Total Revenue
  const totalRevenue = bills.reduce((acc, curr) => acc + curr.subtotal, 0);
  
  // Monthly Revenue (current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthBills = bills.filter(b => {
    const d = new Date(b.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const currentMonthRevenue = currentMonthBills.reduce((acc, curr) => acc + curr.subtotal, 0);

  // Group items by week
  const itemsByWeek: { [weekLabel: string]: ImportItem[] } = {};
  items.forEach(item => {
    const week = item.weekKey || 'Khác';
    if (!itemsByWeek[week]) {
      itemsByWeek[week] = [];
    }
    itemsByWeek[week].push(item);
  });
  
  const weekKeys = Object.keys(itemsByWeek).sort((a, b) => b.localeCompare(a));
  
  // Calculate statistics for operating charts
  const weekStatsForChart = weekKeys.map(weekKey => {
    const list = itemsByWeek[weekKey];
    const qty = list.reduce((a, b) => a + b.sốLượng, 0);
    const val = list.reduce((a, b) => a + (b.sốLượng * b.đơnGiáMay), 0);
    return { name: weekKey.replace('Tuần ', 'T').replace(' - Tháng ', '/'), qty, val };
  }).reverse().slice(-6); // Last 6 weeks

  // Worker productivity calculation
  const workerSalaries: { [name: string]: number } = {};
  const workerProductivity: { [name: string]: number } = {};
  workerJobs.forEach(job => {
    workerSalaries[job.workerName] = (workerSalaries[job.workerName] || 0) + job.totalAmount;
    workerProductivity[job.workerName] = (workerProductivity[job.workerName] || 0) + job.quantity;
  });

  const topWorkers = Object.entries(workerProductivity)
    .map(([name, qty]) => ({ name, qty, salary: workerSalaries[name] || 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Tab Introduce & Dynamic Analytics Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-850 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Trung tâm Báo cáo & Phân tích Tài chính</span>
          </h2>
          <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
            Số liệu thống kê tự động kết xuất trực tiếp từ nhật ký bán buôn, nhập hàng và tổ sản xuất của xưởng An.
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">DỮ LIỆU CHUẨN THỜI GIAN THỰC</span>
        </div>
      </div>

      {/* Grid Summary widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric Card 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Doanh thu Luỹ Kế</span>
            <div className="w-7 h-7 rounded-sm bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 font-mono leading-none">
              {totalRevenue.toLocaleString()}đ
            </h3>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-455 mt-1 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Ghi nhận từ {totalInvoicesCount} hoá đơn</span>
            </p>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Doanh thu tháng này</span>
            <div className="w-7 h-7 rounded-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-405 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 font-mono leading-none">
              {currentMonthRevenue.toLocaleString()}đ
            </h3>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold flex items-center gap-0.5">
              <span>Tháng {currentMonth + 1}/{currentYear}</span>
            </p>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Tổng mẫu mã may</span>
            <div className="w-7 h-7 rounded-sm bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 font-mono leading-none">
              {totalItemsCount.toLocaleString()} chiếc
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              Sản lượng may về kho
            </p>
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Đơn Tổ Sản xuất</span>
            <div className="w-7 h-7 rounded-sm bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 font-mono leading-none">
              {productionBatches.length} lô sản xuất
            </h3>
            <p className="text-[10px] text-purple-600 dark:text-purple-450 mt-1 font-semibold">
              Chia tổ công đoạn thợ may
            </p>
          </div>
        </div>

      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart Card 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 dark:bg-indigo-400 block" />
              <span>Diễn tiến sản lượng may {weekStatsForChart.length > 0 ? `(${weekStatsForChart.length} tuần gần đây)` : ''}</span>
            </h3>
            <p className="text-[10.5px] text-slate-450 mt-1">Sản lượng may lên/về tại Đồng Tháp và TP.HCM.</p>
          </div>

          {weekStatsForChart.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400 dark:text-slate-500 italic">
              Chưa có đủ dữ liệu hàng tuần để tạo đồ thị...
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
              <svg viewBox="0 0 500 200" className="w-full overflow-visible">
                <defs>
                  <linearGradient id="chartQtyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="30" y1="20" x2="480" y2="20" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" strokeDasharray="3" />
                <line x1="30" y1="75" x2="480" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" strokeDasharray="3" />
                <line x1="30" y1="130" x2="480" y2="130" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" strokeDasharray="3" />
                <line x1="30" y1="170" x2="480" y2="170" stroke="currentColor" className="text-slate-300 dark:text-slate-805" strokeWidth="1.5" />

                {(() => {
                  const maxQty = Math.max(...weekStatsForChart.map(w => w.qty)) || 1;
                  const points = weekStatsForChart.map((ws, i) => {
                    const x = 40 + (i * 420) / (weekStatsForChart.length - 1 || 1);
                    const y = 170 - ((ws.qty / maxQty) * 135);
                    return { x, y, qty: ws.qty, name: ws.name };
                  });

                  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaD = points.length > 0 
                    ? `${lineD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`
                    : '';

                  return (
                    <>
                      {areaD && <path d={areaD} fill="url(#chartQtyGrad)" />}
                      {lineD && <path d={lineD} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="5" className="fill-white dark:fill-slate-900 stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="2.5" />
                          <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-black font-mono fill-indigo-650 dark:fill-indigo-400">
                            {p.qty.toLocaleString()}
                          </text>
                          <text x={p.x} y="190" textAnchor="middle" className="text-[9.5px] font-semibold fill-slate-450 dark:fill-slate-400 font-sans">
                            {p.name}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* Chart Card 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 block" />
              <span>Ước lượng trị giá công may theo tuần</span>
            </h3>
            <p className="text-[10.5px] text-slate-450 mt-1">Giá trị lượng tiền công sỉ cho mặt mẫu hằng tuần.</p>
          </div>

          {weekStatsForChart.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400 dark:text-slate-500 italic">
              Chưa có đủ dữ liệu hàng tuần để tạo đồ thị...
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
              <div className="h-[155px] flex items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                {weekStatsForChart.map((ws, i) => {
                  const maxVal = Math.max(...weekStatsForChart.map(w => w.val)) || 1;
                  const heightPr = (ws.val / maxVal) * 90;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="text-[9px] font-black font-mono text-emerald-600 dark:text-emerald-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {(ws.val / 1000).toFixed(0)}k
                      </span>
                      <div 
                        className="w-full bg-emerald-505 dark:bg-emerald-600/80 rounded-t-lg shadow-inner transition-all hover:brightness-110 min-h-[3px]"
                        style={{ height: `${heightPr}%` }}
                      />
                      <span className="text-[9px] text-slate-400 mt-2 font-semibold truncate max-w-full text-center">{ws.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Top workers column layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-5 h-5 text-indigo-500" />
              <span>Năng suất thợ may (Hoàn thành nhiều nhất)</span>
            </h3>
            <p className="text-[10px] text-slate-450 mt-1">Top thợ may đạt sản lượng cao dựa trên cơ sở phân tổ sản xuất.</p>
          </div>
        </div>

        {topWorkers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 italic text-xs font-bold">
            Chưa phát sinh nhật ký công đoạn thợ may để tính toán xếp hạng năng suất.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topWorkers.map((worker, position) => (
              <div 
                key={position}
                className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-950/60 border border-slate-100 dark:border-slate-850 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center ${
                    position === 0 ? 'bg-amber-100 text-amber-700 font-mono' :
                    position === 1 ? 'bg-slate-200 text-slate-700' :
                    position === 2 ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-500'
                  }`}>
                    #{position + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{worker.name}</p>
                    <p className="text-[9.5px] text-slate-400 mt-0.5">May tích luỹ: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{worker.qty.toLocaleString()} chiếc</strong></p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {worker.salary.toLocaleString()}đ
                  </span>
                  <p className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">Tiền công nhận</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
