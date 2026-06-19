/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Info,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Package,
  Award,
  CreditCard,
  FileText,
  Percent,
  CheckCircle,
  Truck,
  Users,
  ExternalLink
} from 'lucide-react';
import { ImportItem, Bill, ProductionBatch, Worker, WorkerJob, PaymentRecord, LaborPayment, Customer } from '../types';
import { useAndroidBack } from '../hooks/useAndroidBack';
import ReportInventoryDetail from './ReportInventoryDetail';

interface ReportTabProps {
  items: ImportItem[];
  bills: Bill[];
  productionBatches: ProductionBatch[];
  workers: Worker[];
  workerJobs: WorkerJob[];
  setActiveTab?: (tab: 'home' | 'import' | 'invoices' | 'production' | 'report' | 'settings' | 'notifications' | 'gallery') => void;
  payments?: PaymentRecord[];
  laborPayments?: LaborPayment[];
  customers?: Customer[];
}

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let res = str;
  res = res.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  res = res.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  res = res.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  res = res.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  res = res.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  res = res.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  res = res.replace(/đ/g, "d");
  res = res.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  res = res.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  res = res.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  res = res.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  res = res.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  res = res.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  res = res.replace(/Đ/g, "D");
  res = res.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, "");
  res = res.replace(/\u02C6|\u0306|\u031B/g, "");
  return res;
}

function cleansAndSortsWords(name: string): string {
  if (!name) return "";
  const noTones = removeVietnameseTones(name.trim().toLowerCase());
  const basic = noTones.replace(/[^a-z0-9\s]/gi, " ");
  return basic.split(/\s+/).filter(Boolean).sort().join(" ");
}

function isModelNameMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  return cleansAndSortsWords(nameA) === cleansAndSortsWords(nameB);
}

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'all';
type SubTabType = 'sales' | 'profit' | 'inventory' | 'cashflow';

export default function ReportTab({
  items = [],
  bills = [],
  productionBatches = [],
  workers = [],
  workerJobs = [],
  setActiveTab,
  payments = [],
  laborPayments = [],
  customers = []
}: ReportTabProps) {

  // 1. Core navigation and active tab states
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('sales');
  const [period, setPeriod] = useState<PeriodType>('month');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [chartValueType, setChartValueType] = useState<'value' | 'quantity'>('value');
  const [reportDetailView, setReportDetailView] = useState<'none' | 'cost_structure' | 'suit_profit'>('none');

  useAndroidBack(showPeriodMenu, () => setShowPeriodMenu(false));
  useAndroidBack(reportDetailView !== 'none', () => setReportDetailView('none'));

  // 2. Intelligently pre-calculate the latest active date in database to show meaningful data on initial load
  const latestDateStr = useMemo(() => {
    // Collect all dates from bills and import items
    const allDates = [
      ...bills.map(b => b.date),
      ...items.map(i => i.ngày)
    ].filter(Boolean);

    if (allDates.length === 0) {
      // Fallback to today formatted as YYYY-MM-DD in UTC+7
      const localDate = new Date();
      // Adjust to UTC+7 timezone
      const tzOffset = 7 * 60;
      const tzDifference = tzOffset + localDate.getTimezoneOffset();
      const localTime = new Date(localDate.getTime() + tzDifference * 60 * 1000);
      return localTime.toISOString().split('T')[0];
    }

    // Return the latest date sorted chronologically
    return allDates.sort((a, b) => b.localeCompare(a))[0];
  }, [bills, items]);

  const [selectedDate, setSelectedDate] = useState<string>(latestDateStr);

  useEffect(() => {
    setReportDetailView('none');
  }, [activeSubTab, period, selectedDate]);

  // Helper date parsing/formatting functions
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    }
    return dateStr;
  };

  // Switch Selected Date backward/forward dynamically
  const handleShiftDate = (direction: number) => {
    const current = new Date(selectedDate);
    if (isNaN(current.getTime())) return;
    
    if (period === 'day') {
      current.setDate(current.getDate() + direction);
    } else if (period === 'week') {
      current.setDate(current.getDate() + (direction * 7));
    } else if (period === 'month') {
      current.setMonth(current.getMonth() + direction);
    } else if (period === 'year') {
      current.setFullYear(current.getFullYear() + direction);
    } else {
      current.setDate(current.getDate() + direction);
    }
    
    // Format back to YYYY-MM-DD safely
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  // Calculate Yesterday's Date for comparison logic
  const yesterdayDateStr = useMemo(() => {
    const current = new Date(selectedDate);
    if (isNaN(current.getTime())) return '';
    current.setDate(current.getDate() - 1);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  // Handle period selector labels
  const getPeriodLabel = () => {
    switch (period) {
      case 'day': return 'Ngày';
      case 'week': return 'Tuần';
      case 'month': return 'Tháng';
      case 'year': return 'Năm';
      case 'all': return 'Tất cả';
    }
  };

  // --------------------------------------------------------
  // DATA FILTERING & KPI CALCULATIONS (Today vs. Yesterday)
  // --------------------------------------------------------

  // Match items based on period rules
  const filterByPeriod = (dateField: string, targetDate: string) => {
    if (!dateField || !targetDate) return false;
    
    if (period === 'day') {
      return dateField === targetDate;
    } else if (period === 'month') {
      // Compare YYYY-MM
      return dateField.substring(0, 7) === targetDate.substring(0, 7);
    } else if (period === 'week') {
      // Match within the last 7 days from targetDate
      const targetTime = new Date(targetDate).getTime();
      const checkTime = new Date(dateField).getTime();
      const diffDays = (targetTime - checkTime) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 7;
    } else if (period === 'year') {
      // Compare YYYY
      return dateField.substring(0, 4) === targetDate.substring(0, 4);
    }
    return true; // Cumulative / All
  };

  // Active Datasets based on selectedDate and period
  const activeBills = useMemo(() => {
    return bills.filter(b => filterByPeriod(b.date, selectedDate));
  }, [bills, selectedDate, period]);

  const yesterdayBills = useMemo(() => {
    if (!yesterdayDateStr) return [];
    return bills.filter(b => filterByPeriod(b.date, yesterdayDateStr));
  }, [bills, yesterdayDateStr, period]);

  const activePayments = useMemo(() => {
    return payments.filter(p => filterByPeriod(p.date, selectedDate));
  }, [payments, selectedDate, period]);

  const yesterdayPayments = useMemo(() => {
    if (!yesterdayDateStr) return [];
    return payments.filter(p => filterByPeriod(p.date, yesterdayDateStr));
  }, [payments, yesterdayDateStr, period]);

  const activeLaborPayments = useMemo(() => {
    return laborPayments.filter(p => filterByPeriod(p.date, selectedDate));
  }, [laborPayments, selectedDate, period]);

  const yesterdayLaborPayments = useMemo(() => {
    if (!yesterdayDateStr) return [];
    return laborPayments.filter(p => filterByPeriod(p.date, yesterdayDateStr));
  }, [laborPayments, yesterdayDateStr, period]);

  const activeImports = useMemo(() => {
    return items.filter(i => filterByPeriod(i.ngày, selectedDate));
  }, [items, selectedDate, period]);

  const yesterdayImports = useMemo(() => {
    if (!yesterdayDateStr) return [];
    return items.filter(i => filterByPeriod(i.ngày, yesterdayDateStr));
  }, [items, yesterdayDateStr, period]);

  // --- SUB-TAB metrics calculation ---

  // A. SALES METRICS
  const salesMetrics = useMemo(() => {
    // Current Period
    const totalRev = activeBills.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
    const invoiceCount = activeBills.length;
    const uniqueCustomers = new Set(activeBills.map(b => b.customerId)).size;
    const avgPerInvoice = invoiceCount > 0 ? Math.round(totalRev / invoiceCount) : 0;

    // Yesterday Period for trend comparison
    const yTotalRev = yesterdayBills.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
    const yInvoiceCount = yesterdayBills.length;
    const yUniqueCustomers = new Set(yesterdayBills.map(b => b.customerId)).size;
    const yAvgPerInvoice = yInvoiceCount > 0 ? Math.round(yTotalRev / yInvoiceCount) : 0;

    return {
      revenue: totalRev,
      orders: invoiceCount,
      customers: uniqueCustomers,
      average: avgPerInvoice,
      yRevenue: yTotalRev,
      yOrders: yInvoiceCount,
      yCustomers: yUniqueCustomers,
      yAverage: yAvgPerInvoice
    };
  }, [activeBills, yesterdayBills]);

  // Track manual unit cost overrides inside report hạch toán
  const [manualCosts, setManualCosts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_manual_report_costs');
      if (saved) {
        const parsed = JSON.parse(saved);
        const map: Record<string, number> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          const cleanK = cleansAndSortsWords(k);
          if (cleanK) {
            map[cleanK] = Number(v);
          }
        });
        return map;
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  // Load production costs defined in saved scenarios (ProfitEstimatorTab -> xuongan_saved_profit_estimates)
  const savedCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    try {
      const saved = localStorage.getItem('xuongan_saved_profit_estimates');
      if (saved) {
        const list = JSON.parse(saved);
        // Sort oldest first, newer overrides it.
        list.slice().reverse().forEach((est: any) => {
          if (est.modelName && est.totalProductionCost) {
            const key = cleansAndSortsWords(est.modelName);
            if (key) {
              map[key] = est.totalProductionCost;
            }
          }
        });
      }
    } catch (e) {
      console.error('Error loading saved profit estimates in ReportTab', e);
    }
    return map;
  }, [selectedDate, activeSubTab]); // Retrigger when shifting dates or tabs to keep in sync

  // Update a single model's unit cost
  const handleUpdateCost = (model: string, cost: number) => {
    setManualCosts(prev => {
      const cleanKey = cleansAndSortsWords(model);
      const updated = { ...prev, [cleanKey]: cost };
      localStorage.setItem('xuongan_manual_report_costs', JSON.stringify(updated));
      return updated;
    });
  };

  // Memoized breakdown of unique items sold on consumer bills in current period
  const soldProductsList = useMemo(() => {
    const list: Record<string, { modelName: string; totalQty: number; avgWholesalePrice: number; totalRev: number }> = {};
    
    activeBills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          if (!item.mẫuMã) return;
          const key = item.mẫuMã.trim();
          const lowerKey = key.toLowerCase();
          if (!list[lowerKey]) {
            list[lowerKey] = {
              modelName: key,
              totalQty: 0,
              avgWholesalePrice: 0,
              totalRev: 0
            };
          }
          list[lowerKey].totalQty += item.sốLượng || 0;
          list[lowerKey].totalRev += item.thànhTiền || 0;
        });
      }
    });

    return Object.values(list).map(p => {
      const avgWholesale = p.totalQty > 0 ? Math.round(p.totalRev / p.totalQty) : 0;
      return {
        ...p,
        avgWholesalePrice: avgWholesale
      };
    }).sort((a, b) => b.totalQty - a.totalQty);
  }, [activeBills]);

  // B. PROFIT & LOSS METRICS
  // Profit = Wholesale Billing subtotal - Cost of production
  // We approximate Cost of production by linking manufactured import costs,
  // or analyzing the specific items ordered.
  const profitLossMetrics = useMemo(() => {
    // Current Period Cost & Profit
    const revenue = activeBills.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
    
    // Calculate cost based on sewn items from items catalog matches, or estimate 65% labor expense
    let estimatedCost = 0;
    activeBills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          const qty = item.sốLượng || 0;
          const wholesalePrice = item.đơnGiá || 0;
          const modelKey = item.mẫuMã ? item.mẫuMã.trim().toLowerCase() : '';
          const normalizedKey = modelKey ? cleansAndSortsWords(modelKey) : '';
          
          let unitCost = 0;
          if (normalizedKey && manualCosts[normalizedKey] !== undefined) {
            unitCost = manualCosts[normalizedKey];
          } else if (normalizedKey && savedCostMap[normalizedKey] !== undefined) {
            unitCost = savedCostMap[normalizedKey];
          } else {
            // Try to find if we've recorded manufacture price of this model
            const matchedImport = items.find(imp => imp.mẫu && cleansAndSortsWords(imp.mẫu) === normalizedKey);
            const laborCost = matchedImport ? (matchedImport.đơnGiáMay || 0) : Math.round(wholesalePrice * 0.45);
            const shippingCost = matchedImport ? ((matchedImport.vậnChuyểnTP_ĐT || 0) - (matchedImport.vậnChuyểnĐT_TP || 0)) : 0;
            unitCost = laborCost + (shippingCost * (1 / 100)); // Average shipping averaged cost
          }
          
          estimatedCost += unitCost * qty;
        });
      }
    });

    // If no direct link computed (mostly empty items), default cost approximation based on active imports
    if (estimatedCost === 0) {
      estimatedCost = activeImports.reduce((acc, curr) => {
        const cost = (curr.sốLượng || 0) * (curr.đơnGiáMay || 0) + (curr.vậnChuyểnTP_ĐT || 0) - (curr.vậnChuyểnĐT_TP || 0);
        return acc + cost;
      }, 0);
    }

    const netProfit = Math.max(0, revenue - estimatedCost);
    const profitRate = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    // Yesterday Period Cost & Profit
    const yRevenue = yesterdayBills.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
    let yEstimatedCost = 0;
    yesterdayBills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          const qty = item.sốLượng || 0;
          const wholesalePrice = item.đơnGiá || 0;
          const modelKey = item.mẫuMã ? item.mẫuMã.trim().toLowerCase() : '';
          const normalizedKey = modelKey ? cleansAndSortsWords(modelKey) : '';
          
          let unitCost = 0;
          if (normalizedKey && manualCosts[normalizedKey] !== undefined) {
            unitCost = manualCosts[normalizedKey];
          } else if (normalizedKey && savedCostMap[normalizedKey] !== undefined) {
            unitCost = savedCostMap[normalizedKey];
          } else {
            const matchedImport = items.find(imp => imp.mẫu && cleansAndSortsWords(imp.mẫu) === normalizedKey);
            const laborCost = matchedImport ? (matchedImport.đơnGiáMay || 0) : Math.round(wholesalePrice * 0.45);
            const shippingCost = matchedImport ? ((matchedImport.vậnChuyểnTP_ĐT || 0) - (matchedImport.vậnChuyểnĐT_TP || 0)) : 0;
            unitCost = laborCost + (shippingCost * (1 / 100));
          }
          
          yEstimatedCost += unitCost * qty;
        });
      }
    });

    if (yEstimatedCost === 0) {
      yEstimatedCost = yesterdayImports.reduce((acc, curr) => {
        const cost = (curr.sốLượng || 0) * (curr.đơnGiáMay || 0) + (curr.vậnChuyểnTP_ĐT || 0) - (curr.vậnChuyểnĐT_TP || 0);
        return acc + cost;
      }, 0);
    }

    const yNetProfit = Math.max(0, yRevenue - yEstimatedCost);
    const yProfitRate = yRevenue > 0 ? Math.round((yNetProfit / yRevenue) * 100) : 0;

    return {
      revenue,
      cost: estimatedCost,
      profit: netProfit,
      rate: profitRate,
      yProfit: yNetProfit,
      yCost: yEstimatedCost,
      yRate: yProfitRate
    };
  }, [activeBills, yesterdayBills, activeImports, yesterdayImports, items, manualCosts, savedCostMap]);

  // C. INVENTORY INFLOW METRICS
  const inventoryMetrics = useMemo(() => {
    const totalPcs = activeImports.reduce((acc, curr) => acc + (curr.sốLượng || 0), 0);
    const uniqueModels = new Set(activeImports.map(i => i.mẫu)).size;
    const valueOfProduction = activeImports.reduce((acc, curr) => acc + ((curr.sốLượng || 0) * (curr.đơnGiáMay || 0)), 0);

    const yTotalPcs = yesterdayImports.reduce((acc, curr) => acc + (curr.sốLượng || 0), 0);
    const yUniqueModels = new Set(yesterdayImports.map(i => i.mẫu)).size;
    const yValueOfProduction = yesterdayImports.reduce((acc, curr) => acc + ((curr.sốLượng || 0) * (curr.đơnGiáMay || 0)), 0);

    return {
      totalQuantity: totalPcs,
      activeModels: uniqueModels,
      productionValue: valueOfProduction,
      yTotalQuantity: yTotalPcs,
      yActiveModels: yUniqueModels,
      yProductionValue: yValueOfProduction
    };
  }, [activeImports, yesterdayImports]);

  // D. CASHFLOW (THU CHI) METRICS
  const cashflowMetrics = useMemo(() => {
    // Receipts (Thu): Customer payments inside bills + standalone payments recorded in this period
    const directBillReceipts = activeBills.reduce((acc, curr) => acc + (curr.paymentAmount || 0), 0);
    const standaloneReceipts = activePayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalReceipts = directBillReceipts + standaloneReceipts;

    // Expenditures (Chi): Actual payments paid to workers (laborPayments) during this period + shipping expenses
    const directLaborPayouts = activeLaborPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const shippingExpenditures = activeImports.reduce((acc, curr) => {
      return acc + (curr.vậnChuyểnTP_ĐT || 0) - (curr.vậnChuyểnĐT_TP || 0);
    }, 0);
    const generalExpenditures = directLaborPayouts + shippingExpenditures;

    const netCashflow = totalReceipts - generalExpenditures;

    // Yesterday comparison
    const yDirectBillReceipts = yesterdayBills.reduce((acc, curr) => acc + (curr.paymentAmount || 0), 0);
    const yStandaloneReceipts = yesterdayPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const yTotalReceipts = yDirectBillReceipts + yStandaloneReceipts;

    const yDirectLaborPayouts = yesterdayLaborPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const yShippingExpenditures = yesterdayImports.reduce((acc, curr) => {
      return acc + (curr.vậnChuyểnTP_ĐT || 0) - (curr.vậnChuyểnĐT_TP || 0);
    }, 0);
    const yGeneralExpenditures = yDirectLaborPayouts + yShippingExpenditures;

    const yNetCashflow = yTotalReceipts - yGeneralExpenditures;

    return {
      receipts: totalReceipts,
      expenditures: generalExpenditures,
      net: netCashflow,
      yNet: yNetCashflow,
      yReceipts: yTotalReceipts,
      yExpenditures: yGeneralExpenditures
    };
  }, [activeBills, yesterdayBills, activePayments, yesterdayPayments, activeLaborPayments, yesterdayLaborPayments, activeImports, yesterdayImports]);

  // Determine key display numbers for active visual component
  const activePrimaryMetric = useMemo(() => {
    switch (activeSubTab) {
      case 'sales':
        return {
          title: 'Doanh thu',
          value: salesMetrics.revenue.toLocaleString() + 'đ',
          sub1Title: 'Đơn hàng',
          sub1Value: salesMetrics.orders.toLocaleString(),
          sub2Title: 'Khách hàng',
          sub2Value: salesMetrics.customers.toLocaleString(),
          sub3Title: 'Trung bình/đơn',
          sub3Value: salesMetrics.average.toLocaleString() + 'đ'
        };
      case 'profit':
        return {
          title: 'Lợi nhuận ước tính (Gốc xưởng)',
          value: profitLossMetrics.profit.toLocaleString() + 'đ',
          sub1Title: 'Doanh thu',
          sub1Value: profitLossMetrics.revenue.toLocaleString() + 'đ',
          sub2Title: 'Chi phí ước tính',
          sub2Value: profitLossMetrics.cost.toLocaleString() + 'đ',
          sub3Title: 'Tỷ suất lợi nhuận',
          sub3Value: profitLossMetrics.rate + '%'
        };
      case 'inventory':
        return {
          title: 'Sản lượng nhập kho hàng may',
          value: inventoryMetrics.totalQuantity.toLocaleString() + ' chiếc',
          sub1Title: 'Mẫu mã nhập',
          sub1Value: inventoryMetrics.activeModels.toLocaleString(),
          sub2Title: 'Định mức tiền may',
          sub2Value: inventoryMetrics.productionValue.toLocaleString() + 'đ',
          sub3Title: 'Trung bình/mẫu',
          sub3Value: inventoryMetrics.activeModels > 0
            ? Math.round(inventoryMetrics.totalQuantity / inventoryMetrics.activeModels).toLocaleString() + ' chiếc'
            : '0'
        };
      case 'cashflow':
        return {
          title: 'Dòng tiền ròng thực tế',
          value: (cashflowMetrics.net >= 0 ? '+' : '') + cashflowMetrics.net.toLocaleString() + 'đ',
          sub1Title: 'Thu khách hàng',
          sub1Value: cashflowMetrics.receipts.toLocaleString() + 'đ',
          sub2Title: 'Chi (Lương + Vận chuyển)',
          sub2Value: cashflowMetrics.expenditures.toLocaleString() + 'đ',
          sub3Title: 'Tỷ lệ thu hồi',
          sub3Value: salesMetrics.revenue > 0
            ? Math.round((cashflowMetrics.receipts / salesMetrics.revenue) * 100) + '%'
            : '100%'
        };
    }
  }, [activeSubTab, salesMetrics, profitLossMetrics, inventoryMetrics, cashflowMetrics]);


  // --------------------------------------------------------
  // VECTOR HOURLY PATHWAY GRAPH DATA (SVG CURVE RENDERING)
  // --------------------------------------------------------
  
  // --------------------------------------------------------
  // HELPER FOR IDENTIFYING PAYMENT METHOD VIA NOTES
  // --------------------------------------------------------
  const isTransferNote = (noteStr: string) => {
    if (!noteStr) return false;
    const normalized = noteStr.toLowerCase().trim();
    const keywords = ['ck', 'chuyển khoản', 'chuyen khoan', 'bck', 'bank', 'momo', 'chuyen khoa', 'banking', 'tài khoản', 'tai khoan', 'atm', 'online', 'vcb', 'agribank', 'vietcombank', 'mb bank', 'mbbank'];
    return keywords.some(keyword => normalized.includes(keyword));
  };

  // Create beautiful, customizable dynamic curves matching actual bills.
  // When no data exists, we plot a zero baseline.
  const lineChartPoints = useMemo(() => {
    const intervals = [0, 4, 8, 12, 16, 20, 24];
    
    // Attempt to bin actual bills into matching interval ranges
    const getBinnedValues = (targetBills: Bill[]) => {
      const bins = Array(intervals.length).fill(0);
      
      if (targetBills.length === 0) {
        return [0, 0, 0, 0, 0, 0, 0];
      }

      targetBills.forEach(b => {
        const dateObj = new Date(b.createdAt || Date.now());
        const hour = dateObj.getHours();
        
        // Fit into closest interval
        for (let i = 0; i < intervals.length; i++) {
          if (hour <= intervals[i]) {
            bins[i] += (chartValueType === 'value' ? (b.subtotal || 0) : b.items.reduce((sum, item) => sum + (item.sốLượng || 0), 0));
            break;
          }
        }
      });
      return bins;
    };

    const todayRaw = getBinnedValues(activeBills);
    const yesterdayRaw = getBinnedValues(yesterdayBills);

    const finalToday = todayRaw;
    const finalYesterday = yesterdayRaw;

    const maxVal = Math.max(...finalToday, ...finalYesterday, 10000);
    const roundToMax = Math.ceil(maxVal / 2000000) * 2000000 || 2000000; // Round up nice step bounds

    // Map values to height coordinates: top is 15px, bottom is 150px inside SVG container
    const mapToY = (val: number) => {
      const topOffset = 15;
      const height = 150;
      const ratio = val / roundToMax;
      return height - (ratio * (height - topOffset));
    };

    // Width allocation helper: 0 to 100% mapped across grid width
    const mapToX = (idx: number) => {
      const step = 85; // spacing in px
      return 35 + (idx * step);
    };

    return {
      today: finalToday.map((val, idx) => ({ x: mapToX(idx), y: mapToY(val), val })),
      yesterday: finalYesterday.map((val, idx) => ({ x: mapToX(idx), y: mapToY(val), val })),
      max: roundToMax,
      intervals: intervals.map(i => `${i}h`)
    };
  }, [activeBills, yesterdayBills, chartValueType]);


  // --------------------------------------------------------
  // PROGRESS CASH FLOW PAYMENTS CALCULATOR
  // --------------------------------------------------------
  const paymentMethodDetails = useMemo(() => {
    // 1. Customer cash payments:
    // - From bill payments (unspecified defaults to 40% cash, unless specified in bill description, but split is standard)
    // - From standalone separate payments (notes without transfer keywords)
    const directBillCash = activeBills.reduce((acc, curr) => acc + (curr.paymentAmount || 0) * 0.4, 0);
    const standaloneCash = activePayments
      .filter(p => !isTransferNote(p.note))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const customerCash = directBillCash + standaloneCash;

    // 2. Customer bank transfers:
    // - From bill payments (unspecified defaults to 60% transfer)
    // - From standalone separate payments (notes with transfer keywords)
    const directBillBank = activeBills.reduce((acc, curr) => acc + (curr.paymentAmount || 0) * 0.6, 0);
    const standaloneBank = activePayments
      .filter(p => isTransferNote(p.note))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const customerBank = directBillBank + standaloneBank;

    // 3. Worker cash payouts:
    // - From labor payments without transfer keywords
    const workerCash = activeLaborPayments
      .filter(p => !isTransferNote(p.note))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    // 4. Worker bank payouts:
    // - From labor payments with transfer keywords
    const workerBank = activeLaborPayments
      .filter(p => isTransferNote(p.note))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);

    // 5. Unpaid standing debt from bills created in this selected period
    const remainingDebt = activeBills.reduce((acc, curr) => acc + Math.max(0, (curr.subtotal || 0) - (curr.paymentAmount || 0)), 0);

    const cashNet = customerCash - workerCash;
    const bankNet = customerBank - workerBank;

    const totalAbsolute = Math.abs(cashNet) + Math.abs(bankNet) + remainingDebt;
    const den = totalAbsolute || 1;

    return [
      { 
        label: 'Tiền mặt thực tế (Mặt đất)', 
        amount: Math.round(cashNet), 
        percent: Math.round((Math.abs(cashNet) / den) * 100), 
        color: 'bg-emerald-500',
        subtext: `Thu từ khách: ${Math.round(customerCash).toLocaleString()}đ | Đã chi trả thợ: ${Math.round(workerCash).toLocaleString()}đ`
      },
      { 
        label: 'Chuyển khoản thực tế (Trực tuyến)', 
        amount: Math.round(bankNet), 
        percent: Math.round((Math.abs(bankNet) / den) * 100), 
        color: 'bg-blue-500',
        subtext: `Thu từ khách: ${Math.round(customerBank).toLocaleString()}đ | Đã chi trả thợ: ${Math.round(workerBank).toLocaleString()}đ`
      },
      { 
        label: 'Công nợ sỉ gối đầu (Hóa đơn mới)', 
        amount: Math.round(remainingDebt), 
        percent: Math.round((remainingDebt / den) * 100), 
        color: 'bg-amber-500',
        subtext: `Tổng nợ hóa đơn phát sinh trong kỳ chưa thanh toán gối đầu`
      }
    ];
  }, [activeBills, activePayments, activeLaborPayments]);


  // Formulating the SVG points string for Bezier curved render
  const getCurvePathString = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  return (
    <div className="bg-slate-50 dark:bg-[#0b0f19] min-h-screen text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {reportDetailView === 'cost_structure' ? (
        <div className="flex flex-col flex-grow">
          {/* CO-HEADER FOR COST STRUCTURE */}
          <header className="shrink-0 bg-white dark:bg-[#121824] border-b border-slate-100 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between z-10 sticky top-0 font-sans">
            <button
              onClick={() => setReportDetailView('none')}
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-500 transition active:scale-95 flex items-center gap-1 cursor-pointer font-bold text-xs"
            >
              <ArrowLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <span>Quay lại Lãi lỗ</span>
            </button>
            <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-wide text-center uppercase">
              Cơ cấu giá thành &amp; Chi phí ước tính
            </h1>
            <div className="w-16" />
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
            {/* PERIOD BANNER */}
            <div className="p-3 bg-white dark:bg-[#121824] border border-slate-100 dark:border-slate-800/80 rounded-xl flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold uppercase font-mono">Kỳ báo cáo ({getPeriodLabel()})</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {period === 'day' 
                  ? formatDisplayDate(selectedDate) 
                  : period === 'month' 
                    ? `Tháng ${selectedDate.substring(5, 7)}/${selectedDate.substring(0, 4)}` 
                    : period === 'week' 
                      ? `7 ngày quanh ${formatDisplayDate(selectedDate)}` 
                      : period === 'year'
                        ? `Năm ${selectedDate.substring(0, 4)}`
                        : 'Toàn thời gian'}
              </span>
            </div>

            {/* DETAILED PRODUCTION COST BREAKDOWN */}
            <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <span>Cơ cấu giá thành &amp; Chi phí ước tính</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                    Phân tích chi phí bộ đồ của xưởng dựa vào chi phí may và chi phí vận chuyển tương ứng của mỗi mẫu đồ.
                  </p>
                </div>
              </div>

              {soldProductsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  Chưa phát sinh hóa đơn bán hàng nào trong kỳ hạch toán này để phân tích.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full text-left border-collapse min-w-[420px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                          <th className="py-2.5 font-bold">Mẫu mã</th>
                          <th className="py-2.5 text-center font-bold">SL Bán trên Bill</th>
                          <th className="py-2.5 text-right font-bold w-32">chi phí bộ đồ (đ)</th>
                          <th className="py-2.5 text-right font-bold w-36">Chi phí ước tính</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                        {soldProductsList.map((p) => {
                          const normalizedKey = cleansAndSortsWords(p.modelName);
                          let currentCostVal = 0;
                          let costSource: 'manual' | 'saved' | 'default' = 'default';
                          
                          if (normalizedKey && manualCosts[normalizedKey] !== undefined) {
                            currentCostVal = manualCosts[normalizedKey];
                            costSource = 'manual';
                          } else if (normalizedKey && savedCostMap[normalizedKey] !== undefined) {
                            currentCostVal = savedCostMap[normalizedKey];
                            costSource = 'saved';
                          } else {
                            const matchedImport = items.find(imp => imp.mẫu && cleansAndSortsWords(imp.mẫu) === normalizedKey);
                            const laborCost = matchedImport ? (matchedImport.đơnGiáMay || 0) : Math.round(p.avgWholesalePrice * 0.45);
                            const shippingCost = matchedImport ? ((matchedImport.vậnChuyểnTP_ĐT || 0) - (matchedImport.vậnChuyểnĐT_TP || 0)) : 0;
                            currentCostVal = Math.round(laborCost + (shippingCost * (1 / 100)));
                            costSource = 'default';
                          }
                          
                          const totalEstCost = currentCostVal * p.totalQty;
                          
                          return (
                            <tr key={p.modelName} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors">
                              <td className="py-3 pr-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-extrabold text-slate-850 dark:text-slate-200">
                                    {p.modelName}
                                  </span>
                                  {costSource === 'saved' && (
                                    <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                      ✨ Dự toán sẵn ({savedCostMap[normalizedKey].toLocaleString()}đ)
                                    </span>
                                  )}
                                  {costSource === 'manual' && (
                                    <span className="text-[9.5px] text-blue-500 dark:text-blue-400 font-bold mt-0.5">
                                      ✏️ Ghi đè thủ công
                                    </span>
                                  )}
                                  {costSource === 'default' && (
                                    <span className="text-[9.5px] text-slate-450 mt-0.5">
                                      ⚙️ Tự tính (May + VC)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                <span className="font-mono font-black text-xs text-slate-750 dark:text-slate-300">
                                  {p.totalQty.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-400 block font-sans">bộ</span>
                              </td>
                              <td className="py-3 text-right">
                                <input
                                  type="number"
                                  value={currentCostVal || ''}
                                  onChange={(e) => handleUpdateCost(p.modelName, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-24 text-right px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-xs text-slate-850 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="py-3 text-right font-mono font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                {totalEstCost.toLocaleString()}đ
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-400 text-[9.5px] uppercase font-mono font-bold leading-relaxed">
                      * Ghi chú: Chỉnh sửa trực tiếp chi phí bộ đồ của mẫu mã để cập nhật chi phí giá vốn live.
                    </div>
                    <div className="flex gap-4 justify-end font-mono shrink-0">
                      <div className="text-right">
                        <span className="text-slate-400 block text-[9px] uppercase">Doanh Thu Bill</span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 block text-xs font-mono">
                          {soldProductsList.reduce((sum, p) => sum + p.totalRev, 0).toLocaleString()}đ
                        </span>
                      </div>
                      <div className="text-right border-l border-slate-150 dark:border-slate-850 pl-4">
                        <span className="text-slate-400 block text-[9px] uppercase">Vốn ước tính (định mức)</span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-550 block text-xs font-mono">
                          {profitLossMetrics.cost.toLocaleString()}đ
                        </span>
                      </div>
                      <div 
                        onClick={() => setReportDetailView('suit_profit')}
                        className="text-right border-l border-slate-150 dark:border-slate-850 pl-4 cursor-pointer hover:opacity-90 group/lr transition-all"
                        title="Nhấn để xem phân tích Chi tiết lãi/lời bộ đồ"
                      >
                        <span className="text-emerald-600 dark:text-emerald-450 block text-[9px] uppercase font-black flex items-center justify-end gap-0.5">
                          Lợi nhuận gộp <ExternalLink className="w-2.5 h-2.5 inline" />
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-500 block text-xs font-mono group-hover/lr:-translate-y-[0.5px] transition-transform underline decoration-dotted decoration-emerald-500/40">
                          {profitLossMetrics.profit.toLocaleString()}đ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : reportDetailView === 'suit_profit' ? (
        <div className="flex flex-col flex-grow">
          {/* CO-HEADER FOR SUIT PROFIT */}
          <header className="shrink-0 bg-white dark:bg-[#121824] border-b border-slate-100 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between z-10 sticky top-0 font-sans">
            <button
              onClick={() => setReportDetailView('none')}
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-500 transition active:scale-95 flex items-center gap-1 cursor-pointer font-bold text-xs"
            >
              <ArrowLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <span>Quay lại Lãi lỗ</span>
            </button>
            <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-wide text-center uppercase">
              Phân tích Tiền lời bộ đồ
            </h1>
            <div className="w-16" />
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
            {/* PERIOD BANNER */}
            <div className="p-3 bg-white dark:bg-[#121824] border border-slate-100 dark:border-slate-800/80 rounded-xl flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold uppercase font-mono">Kỳ báo cáo ({getPeriodLabel()})</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {period === 'day' 
                  ? formatDisplayDate(selectedDate) 
                  : period === 'month' 
                    ? `Tháng ${selectedDate.substring(5, 7)}/${selectedDate.substring(0, 4)}` 
                    : period === 'week' 
                      ? `7 ngày quanh ${formatDisplayDate(selectedDate)}` 
                      : period === 'year'
                        ? `Năm ${selectedDate.substring(0, 4)}`
                        : 'Toàn thời gian'}
              </span>
            </div>

            {/* DETAILED SUIT/SET PROFIT BREAKDOWN */}
            <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Percent className="w-5 h-5 text-emerald-600" />
                    <span>Lợi nhuận chi tiết từng bộ đồ (Mẫu mã)</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-505 mt-0.5 leading-relaxed">
                    Tính toán tiền lời của mỗi mẫu đồ dựa trên Giá bán bình quân trừ đi Chi phí bộ đồ hạch toán. Sếp có thể thay đổi chi phí bộ đồ trực tiếp để cập nhật live.
                  </p>
                </div>
              </div>

              {soldProductsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  Chưa phát sinh hóa đơn bán hàng nào trong kỳ hạch toán này để tính tiền lời.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                          <th className="py-2.5 font-bold">Mẫu mã</th>
                          <th className="py-2.5 text-center font-bold">Số lượng bán</th>
                          <th className="py-2.5 text-right font-bold w-24">Giá bán sỉ TB</th>
                          <th className="py-2.5 text-right font-bold w-24">chi phí bộ đồ (đ)</th>
                          <th className="py-2.5 text-right font-bold w-24">Lời/Bộ</th>
                          <th className="py-2.5 text-right font-bold w-28">Tổng tiền lời</th>
                          <th className="py-2.5 text-center font-bold w-16">Tỷ suất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                        {soldProductsList.map((p) => {
                          const normalizedKey = cleansAndSortsWords(p.modelName);
                          let currentCostVal = 0;
                          let costSource: 'manual' | 'saved' | 'default' = 'default';
                          
                          if (normalizedKey && manualCosts[normalizedKey] !== undefined) {
                            currentCostVal = manualCosts[normalizedKey];
                            costSource = 'manual';
                          } else if (normalizedKey && savedCostMap[normalizedKey] !== undefined) {
                            currentCostVal = savedCostMap[normalizedKey];
                            costSource = 'saved';
                          } else {
                            const matchedImport = items.find(imp => imp.mẫu && cleansAndSortsWords(imp.mẫu) === normalizedKey);
                            const laborCost = matchedImport ? (matchedImport.đơnGiáMay || 0) : Math.round(p.avgWholesalePrice * 0.45);
                            const shippingCost = matchedImport ? ((matchedImport.vậnChuyểnTP_ĐT || 0) - (matchedImport.vậnChuyểnĐT_TP || 0)) : 0;
                            currentCostVal = Math.round(laborCost + (shippingCost * (1 / 100)));
                            costSource = 'default';
                          }
                          
                          const totalEstCost = currentCostVal * p.totalQty;
                          const totalProfit = p.totalRev - totalEstCost;
                          const profitPerSuit = p.avgWholesalePrice - currentCostVal;
                          const marginPercent = p.totalRev > 0 ? Math.round((totalProfit / p.totalRev) * 100) : 0;
                          
                          return (
                            <tr key={p.modelName} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors">
                              <td className="py-3 pr-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-extrabold text-slate-850 dark:text-slate-205">
                                    {p.modelName}
                                  </span>
                                  {costSource === 'saved' && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                      ✨ Dự toán ({savedCostMap[normalizedKey].toLocaleString()}đ)
                                    </span>
                                  )}
                                  {costSource === 'manual' && (
                                    <span className="text-[9px] text-blue-500 dark:text-blue-400 font-bold mt-0.5">
                                      ✏️ Ghi đè thủ công
                                    </span>
                                  )}
                                  {costSource === 'default' && (
                                    <span className="text-[9px] text-slate-450 mt-0.5">
                                      ⚙️ Tự tính (May + VC)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                <span className="font-mono font-black text-xs text-slate-755 dark:text-slate-300">
                                  {p.totalQty.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-400 block font-sans">bộ</span>
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                                {p.avgWholesalePrice.toLocaleString()}đ
                              </td>
                              <td className="py-3 text-right">
                                <input
                                  type="number"
                                  value={currentCostVal || ''}
                                  onChange={(e) => handleUpdateCost(p.modelName, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-20 text-right px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-[11px] text-slate-850 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className={`py-3 text-right font-mono font-extrabold text-xs ${profitPerSuit >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600'}`}>
                                {profitPerSuit.toLocaleString()}đ
                              </td>
                              <td className={`py-3 text-right font-mono font-black text-xs ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600'}`}>
                                {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}đ
                              </td>
                              <td className="py-3 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[9.5px] ${
                                  marginPercent >= 40 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                                  marginPercent >= 20 ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' :
                                  marginPercent >= 10 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                                  'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                }`}>
                                  {marginPercent}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-400 text-[9.5px] uppercase font-mono font-bold leading-relaxed">
                      * Nhận xét: Mẫu có tỷ suất &gt; 40% là sinh lời lý tưởng, &lt; 10% sếp nên tối ưu lại chi phí sản xuất.
                    </div>
                    <div className="flex gap-4 justify-end font-mono shrink-0">
                      <div className="text-right">
                        <span className="text-slate-400 block text-[9px] uppercase">Tổng bán</span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400 block text-xs font-mono">
                          {soldProductsList.reduce((sum, p) => sum + p.totalRev, 0).toLocaleString()}đ
                        </span>
                      </div>
                      <div 
                        onClick={() => setReportDetailView('cost_structure')}
                        className="text-right border-l border-slate-150 dark:border-slate-850 pl-4 cursor-pointer hover:opacity-90 group/cp transition-all"
                        title="Nhấn để xem Phân tích Cơ cấu chi phí & giá thành"
                      >
                        <span className="text-amber-600 dark:text-amber-450 block text-[9px] uppercase font-black flex items-center justify-end gap-0.5">
                          Tổng vốn sỉ <ExternalLink className="w-2.5 h-2.5 inline" />
                        </span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-555 block text-xs font-mono group-hover/cp:-translate-y-[0.5px] transition-transform underline decoration-dotted decoration-amber-500/40">
                          {profitLossMetrics.cost.toLocaleString()}đ
                        </span>
                      </div>
                      <div className="text-right border-l border-slate-150 dark:border-slate-850 pl-4">
                        <span className="text-slate-400 block text-[9px] uppercase">Tổng Tiền Lời</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-500 block text-xs font-mono">
                          {profitLossMetrics.profit.toLocaleString()}đ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. FAITHFUL Centered HEADER PANEL with return arrow */}
          <header className="shrink-0 bg-white dark:bg-[#121824] border-b border-slate-100 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between z-10 sticky top-0">
        <button
          onClick={() => setActiveTab && setActiveTab('home')}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition active:scale-95 flex items-center justify-center cursor-pointer"
          title="Trở về trang chủ"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>

        <h1 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-wide text-center">
          Báo cáo
        </h1>

        <button
          className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-550 transition flex items-center justify-center cursor-pointer"
          onClick={() => alert(`Trung tâm Báo cáo nội bộ v${(import.meta as any).env.VITE_APP_VERSION || '1.2.0'}. Dữ liệu được tính toán dựa trên ngày hạch toán.`)}
        >
          <Info className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
      </header>

      {/* 2. TAB PILLS SELECTOR */}
      <div className="shrink-0 bg-white dark:bg-[#121824] border-b border-slate-100 dark:border-slate-800/60 px-2 flex justify-between overflow-x-auto scrollbar-none">
        {[
          { id: 'sales', label: 'Bán hàng' },
          { id: 'profit', label: 'Lãi lỗ' },
          { id: 'inventory', label: 'Kho hàng' },
          { id: 'cashflow', label: 'Thu chi' }
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTabType)}
              className="flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 outline-none cursor-pointer select-none whitespace-nowrap min-w-[70px]"
              style={{
                borderColor: isActive ? '#059669' : 'transparent', // emerald-600 Matching line green
                color: isActive ? '#059669' : '#94a3b8' // text active vs slate-400
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. DYNAMIC PERIOD & DATE PICKER */}
      <div className="shrink-0 p-3 bg-white dark:bg-[#121824] border-b border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-2.5">
        
        {/* Day/Week/Month picker button */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodMenu(!showPeriodMenu)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-250 transition cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            <span>{getPeriodLabel()}</span>
          </button>

          <AnimatePresence>
            {showPeriodMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowPeriodMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 mt-1.5 w-28 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-705 rounded-xl shadow-lg z-40 overflow-hidden"
                >
                  {(['day', 'week', 'month', 'year', 'all'] as PeriodType[]).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        setPeriod(p);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition ${
                        period === p ? 'text-emerald-600 dark:text-emerald-450 font-extrabold bg-slate-50 dark:bg-slate-750' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {p === 'day' ? 'Hàng Ngày' : p === 'week' ? 'Hàng Tuần' : p === 'month' ? 'Hàng Tháng' : p === 'year' ? 'Hàng Năm' : 'Tất cả'}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Date shifting block <  DD/MM/YYYY  > */}
        <div className="flex-1 max-w-xs flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-2 py-1">
          <button
            onClick={() => handleShiftDate(-1)}
            className="p-1 px-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            title="Ngày trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 font-mono">
            {period === 'day' 
              ? formatDisplayDate(selectedDate) 
              : period === 'month' 
                ? `Tháng ${selectedDate.substring(5, 7)}/${selectedDate.substring(0, 4)}` 
                : period === 'week' 
                  ? `7 ngày quanh ${formatDisplayDate(selectedDate)}` 
                  : period === 'year'
                    ? `Năm ${selectedDate.substring(0, 4)}`
                    : 'Toàn thời gian'}
          </span>

          <button
            onClick={() => handleShiftDate(1)}
            className="p-1 px-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            title="Ngày tiếp theo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 4. SCROLLABLE BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        
        {/* DYNAMIC METRIC OUTLINE CARD */}
        <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs text-center relative overflow-hidden">
          {activeSubTab === 'profit' ? (
            <div 
              className="space-y-1 cursor-pointer group/main hover:opacity-90 active:scale-98 transition-all"
              onClick={() => setReportDetailView('suit_profit')}
              title="Click để xem chi tiết tiền lời bộ đồ"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono flex items-center justify-center gap-1">
                {activePrimaryMetric.title}
                <ExternalLink className="w-3 h-3 text-emerald-600 group-hover/main:text-emerald-500 transition-colors" />
              </span>
              <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-500 font-mono tracking-tight my-1.5 group-hover/main:translate-y-[-1px] transition-transform underline decoration-dotted decoration-emerald-500/20 group-hover/main:decoration-emerald-500/70">
                {activePrimaryMetric.value}
              </h2>
              <div className="inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full mt-1.5 shadow-xs transition hover:bg-emerald-500/20">
                <span>Nhấn để xem tiền lời bộ đồ</span>
                <span>➔</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">
                {activePrimaryMetric.title}
              </span>
              <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-500 font-mono tracking-tight my-1.5">
                {activePrimaryMetric.value}
              </h2>
            </div>
          )}

          {/* Dividing border */}
          <div className="my-4 border-t border-slate-100 dark:border-slate-800/60" />

          {/* Underneath three sub-metrics columns */}
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center animate-fade-in">
              <span className="text-[9.5px] text-slate-400 block mb-1 truncate">{activePrimaryMetric.sub1Title}</span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono block animate-fade-in">
                {activePrimaryMetric.sub1Value}
              </span>
            </div>
            
            {activeSubTab === 'profit' ? (
              <div 
                onClick={() => setReportDetailView('cost_structure')}
                className="text-center border-l border-slate-100 dark:border-slate-800/50 cursor-pointer group/cost hover:scale-102 transition-transform p-0.5 rounded-lg hover:bg-amber-50/50 dark:hover:bg-amber-950/10"
                title="Click để xem cơ cấu giá thành & chi phí bộ đồ"
              >
                <span className="text-[9.5px] text-amber-600 dark:text-amber-500 block mb-1 truncate font-bold flex items-center justify-center gap-0.5 underline decoration-dotted decoration-amber-550/20 group-hover/cost:decoration-amber-500/60">
                  {activePrimaryMetric.sub2Title}
                  <ExternalLink className="w-2.5 h-2.5" />
                </span>
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-500 font-mono block group-hover/cost:translate-y-[-0.5px] transition-transform underline decoration-dotted decoration-amber-500/20 group-hover/cost:decoration-amber-500/70">
                  {activePrimaryMetric.sub2Value}
                </span>
                <span className="text-[8px] text-slate-400 font-bold block mt-0.5 scale-90 opacity-90 group-hover/cost:text-amber-500">
                  Phân tích ➔
                </span>
              </div>
            ) : (
              <div className="text-center border-l border-slate-100 dark:border-slate-800/50">
                <span className="text-[9.5px] text-slate-400 block mb-1 truncate">{activePrimaryMetric.sub2Title}</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono block">
                  {activePrimaryMetric.sub2Value}
                </span>
              </div>
            )}

            <div className="text-center border-l border-slate-100 dark:border-slate-800/50">
              <span className="text-[9.5px] text-slate-400 block mb-1 truncate">{activePrimaryMetric.sub3Title}</span>
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 font-mono block">
                {activePrimaryMetric.sub3Value}
              </span>
            </div>
          </div>
        </div>

        {activeSubTab === 'inventory' ? (
          <ReportInventoryDetail
            items={items}
            bills={bills}
            customers={customers}
          />
        ) : (
          <>
            {/* 5. HOURLY GRID CHART COMPONENT */}
            <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs">
              
              {/* Header selector inside graph */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-705 dark:text-slate-250 font-sans">
                    Biểu đồ xu hướng theo
                  </span>
                </div>

                {/* Custom Mini Select Box dropdown for value/quantity */}
                <select
                  value={chartValueType}
                  onChange={(e) => setChartValueType(e.target.value as 'value' | 'quantity')}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-450 focus:outline-none transition cursor-pointer"
                >
                  <option value="value">Doanh thu (đ)</option>
                  <option value="quantity">Sản lượng (chiếc)</option>
                </select>
              </div>

              {/* Graph Legend items */}
              <div className="flex items-center justify-center gap-6 text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block" />
                  <span>Hôm nay ({formatDisplayDate(selectedDate).substring(0, 5)})</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="w-3 border-t-2 border-dashed border-amber-500 block" />
                  <span>Hôm qua</span>
                </div>
              </div>

              {/* HIGH POLISHED RESPONSIVE SVG VECTOR GRAPH */}
              <div className="w-full relative overflow-x-auto scrollbar-none py-1">
                <div className="min-w-[550px] h-[190px] relative">
                  
                  <svg className="w-full h-full" viewBox="0 0 570 185" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Horizontal grid guide lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = 15 + ratio * 135;
                      const stepLabel = Math.round((lineChartPoints.max * (1 - ratio)));
                      let labelStr = stepLabel >= 1000000 ? `${(stepLabel / 1000000).toFixed(0)}tr` : `${(stepLabel / 100).toFixed(0)}k`;
                      if (stepLabel === 0) labelStr = '0tr';
                      
                      return (
                        <g key={idx}>
                          <line x1="35" y1={y} x2="550" y2={y} stroke="#f1f5f9" className="dark:stroke-slate-800/60" strokeWidth="1" strokeDasharray="4,4" />
                          <text x="5" y={y + 4} fill="#94a3b8" className="text-[9px] font-mono font-bold">{labelStr}</text>
                        </g>
                      );
                    })}

                    {/* Draw Areas under Curves for gorgeous visual overlay */}
                    {/* 1. Today filled gradient area */}
                    <path
                      d={`${getCurvePathString(lineChartPoints.today)} L ${lineChartPoints.today[lineChartPoints.today.length - 1].x} 150 L ${lineChartPoints.today[0].x} 150 Z`}
                      fill="url(#todayAreaGradient)"
                      opacity="0.08"
                    />

                    {/* 2. Yesterday Curve (Amber Dashed line) */}
                    <path
                      d={getCurvePathString(lineChartPoints.yesterday)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="5,4"
                      strokeLinecap="round"
                    />

                    {/* 1. Today Curve (Solid Blue line) */}
                    <path
                      d={getCurvePathString(lineChartPoints.today)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />

                    {/* Intersect point dots to give precision UI look */}
                    {lineChartPoints.today.map((pt, idx) => (
                      <g key={idx}>
                        {/* Pulsing point border */}
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#3b82f6" strokeWidth="2.5" />
                        {/* Tooltip value bubble on hover */}
                        <text x={pt.x} y={pt.y - 10} fill="#3b82f6" className="text-[8.5px] font-mono font-black" textAnchor="middle">
                          {pt.val > 0 ? (pt.val >= 1000000 ? `${(pt.val / 1000000).toFixed(1)}tr` : `${(pt.val / 1000).toFixed(0)}k`) : ''}
                        </text>
                      </g>
                    ))}

                    {/* X Axis time indicators */}
                    {lineChartPoints.intervals.map((time, idx) => {
                      const x = 35 + (idx * 85);
                      return (
                        <text key={idx} x={x} y="174" fill="#94a3b8" className="text-[10px] font-mono font-bold" textAnchor="middle">
                          {time}
                        </text>
                      );
                    })}

                    {/* Define gradient parameters inside SVG tags */}
                    <defs>
                      <linearGradient id="todayAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>

                </div>
              </div>
            </div>

            {/* COST BREAKDOWN REMOVED AND MOVED TO INDEPENDENT SUB-PAGE VIA CHI PHÍ ƯỚC TÍNH */}

            {/* 6. PAYMENTS METHODS PROGRESS LIST */}
            <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
                Dòng tiền theo phương thức thanh toán
              </h3>

              <div className="space-y-4">
                {paymentMethodDetails.map((method, idx) => (
                  <div key={idx} className="space-y-1.5 text-left">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-semibold text-slate-650 dark:text-slate-300 block">{method.label}</span>
                        {method.subtext && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 normal-case block mt-0.5">
                            {method.subtext}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-extrabold text-slate-800 dark:text-white shrink-0 ml-2 mt-0.5">
                        {method.amount >= 0 ? '' : '-'}{Math.abs(method.amount).toLocaleString()}đ ({method.percent}%)
                      </span>
                    </div>

                    {/* Track progress meter bar */}
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${method.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(3, method.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. HIGH ACHIEVING LABOR PRODUCTIVITY REPORT COUPLING */}
            <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-5 h-5 text-indigo-500 animate-pulse" />
                    <span>Năng suất tổ thợ may</span>
                  </h3>
                  <p className="text-[10px] text-slate-455 mt-0.5">Xếp hạng sản lượng thợ may hoạt động hiệu quả tối ưu.</p>
                </div>
              </div>

              {workers.length === 0 ? (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 italic text-xs font-bold">
                  Chưa phát sinh nhật ký công đoạn sản xuất để sắp xếp xếp hạng.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {workers.slice(0, 4).map((worker, position) => {
                    // Calculate productivity and total amounts for this specific worker
                    const workerJobs_ = workerJobs.filter(j => j.workerName === worker.name);
                    const accumulatedQty = workerJobs_.reduce((sum, j) => sum + (j.quantity || 0), 0);
                    const accumulatedSalary = workerJobs_.reduce((sum, j) => sum + (j.totalAmount || 0), 0);

                    return (
                      <div
                        key={worker.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-5.5 h-5.5 rounded-lg font-mono font-black text-[10px] flex items-center justify-center ${
                            position === 0 ? 'bg-amber-100 text-amber-700' :
                            position === 1 ? 'bg-slate-200 text-slate-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            #{position + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-850 dark:text-slate-205 text-xs">{worker.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Sản lượng may: <strong className="text-emerald-600 dark:text-emerald-450 font-black">{accumulatedQty.toLocaleString()} chiếc</strong></p>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                            {accumulatedSalary.toLocaleString()}đ
                          </span>
                          <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">Tiền công</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}
