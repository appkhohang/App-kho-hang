/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Calendar } from 'lucide-react';
import { ImportItem, LaborPayment, TpDtShippingItem } from '../types';

interface YearGroupedMonthHistoryProps {
  itemsByMonth: { [monthLabel: string]: ImportItem[] };
  shippingsByMonth: { [monthLabel: string]: TpDtShippingItem[] };
  laborPayments: LaborPayment[];
  yearsWithData: string[];
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  setSelectedMonthForStats: (month: string | null) => void;
  setMonthStatsSearchQuery: (query: string) => void;
  getMonthStats: (monthKey: string) => {
    totalQty: number;
    totalAmount: number;
    totalShipTP_ĐT: number;
    totalShipĐT_TP: number;
    netBackShipValue: number;
    totalLaborPaid: number;
    remainingLaborDebt: number;
    totalMonthAmount: number;
    itemsCount: number;
  };
}

export default function YearGroupedMonthHistory({
  itemsByMonth,
  shippingsByMonth,
  laborPayments,
  yearsWithData,
  selectedYear,
  setSelectedYear,
  setSelectedMonthForStats,
  setMonthStatsSearchQuery,
  getMonthStats,
}: YearGroupedMonthHistoryProps) {
  const monthsOfSelectedYear = Object.keys(itemsByMonth)
    .filter(monthKey => monthKey.endsWith(`/${selectedYear}`))
    .sort((a, b) => b.localeCompare(a)); // Sort latest month to earliest

  if (yearsWithData.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <p className="text-xs text-slate-400">Không tìm thấy dữ liệu năm nào.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Tabs Bar Selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-150 dark:border-slate-800 pb-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5 mr-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Chọn năm xem báo cáo:
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {yearsWithData.map(year => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold font-mono transition cursor-pointer select-none border ${selectedYear === year ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-650/10 scale-102' : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
            >
              Năm {year}
            </button>
          ))}
        </div>
      </div>

      {/* Months cards grid/stack of the selected year */}
      {monthsOfSelectedYear.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-400 italic">Không tìm thấy dữ liệu tháng nào cho năm {selectedYear}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {monthsOfSelectedYear.map(monthLabel => {
            const stats = getMonthStats(monthLabel);
            
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                key={monthLabel}
                onClick={() => {
                  setSelectedMonthForStats(monthLabel);
                  setMonthStatsSearchQuery('');
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl p-5 shadow-3xs hover:shadow-md hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition duration-300 cursor-pointer flex flex-col justify-between relative group overflow-hidden"
              >
                {/* Decorative background circle on hover */}
                <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/5 rounded-full transition-transform duration-500 group-hover:scale-120 pointer-events-none" />

                <div>
                  {/* Header */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-150 dark:border-slate-800/70">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base font-sans tracking-tight">
                        {monthLabel}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      {stats.itemsCount} lô hàng
                    </span>
                  </div>

                  {/* Key Metrics Columns */}
                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 py-4 text-xs font-sans">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">Sản lượng may</span>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                        {stats.totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">cái</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-450 tracking-wider block">Tiền hàng dệt gốc</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-450 font-mono mt-0.5 block">
                        {stats.totalAmount.toLocaleString()}đ
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-rose-500 tracking-wider block">Chi phí ship ròng</span>
                      <span className="text-sm font-black text-rose-500 dark:text-rose-450 font-mono mt-0.5 block">
                        {stats.netBackShipValue.toLocaleString()}đ
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">Thanh toán thợ</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                        {stats.totalLaborPaid.toLocaleString()}đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer card action bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/70 flex justify-between items-center text-[11px] font-medium text-slate-450 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">Công nợ thợ:</span>
                    <span className={`font-mono font-black ${stats.remainingLaborDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-450'}`}>
                      {stats.remainingLaborDebt.toLocaleString()}đ
                    </span>
                  </div>
                  <span className="text-indigo-650 dark:text-indigo-400 font-black flex items-center gap-1 group-hover:translate-x-1 transition duration-300">
                    Xem chi tiết ➔
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
