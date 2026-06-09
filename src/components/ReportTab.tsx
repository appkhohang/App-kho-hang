/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, BarChart3, Users, DollarSign, Calendar, Layers, Package, ShoppingBag, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { ImportItem, Bill, ProductionBatch, Worker, WorkerJob } from '../types';
import { getVietnameseMonthKey, getVietnameseWeekKey } from '../utils/dateUtils';
import FloatingStats from './FloatingStats';

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
    if (!item) return;
    const week = item.weekKey || 'Khác';
    if (!itemsByWeek[week]) {
      itemsByWeek[week] = [];
    }
    itemsByWeek[week].push(item);
  });
  
  const weekKeys = Object.keys(itemsByWeek).sort((a, b) => b.localeCompare(a));
  
  // Calculate statistics for operating charts
  const weekStatsForChart = weekKeys.map(weekKey => {
    const list = itemsByWeek[weekKey] || [];
    const qty = list.reduce((a, b) => a + (b?.sốLượng || 0), 0);
    const val = list.reduce((a, b) => a + ((b?.sốLượng || 0) * (b?.đơnGiáMay || 0)), 0);
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
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">DỮ LIỆU CHUẨN THỜI GIAN THỰC</span>
          </div>

          <FloatingStats items={items} isFloating={false} />
        </div>
      </div>

      {/* Grid Summary widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric Card 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Doanh thu</span>
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
