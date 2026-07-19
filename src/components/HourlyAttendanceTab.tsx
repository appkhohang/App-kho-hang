/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, UserCheck, Calendar, ArrowRight, Save, Trash2, 
  FileSpreadsheet, Filter, CheckCircle2, AlertCircle, Play, Square,
  User, Plus, Minus, Zap, DollarSign, ChevronDown, ChevronUp, Search, RefreshCw, Edit, ClipboardList, Calculator
} from 'lucide-react';
import { Worker, HourlyAttendance, AppSettings } from '../types';
import { formatVietnameseDate, getCurrentDateStr, getVietnameseWeekKey } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface HourlyAttendanceTabProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  hourlyAttendance: HourlyAttendance[];
  setHourlyAttendance: React.Dispatch<React.SetStateAction<HourlyAttendance[]>>;
  settings: AppSettings;
  userRole: 'admin' | 'staff' | 'viewer';
  activeSubTab?: 'clock' | 'history' | 'payroll';
  onActiveSubTabChange?: (tab: 'clock' | 'history' | 'payroll') => void;
  autoOpenManualAttendance?: boolean;
  setAutoOpenManualAttendance?: (open: boolean) => void;
}

export default function HourlyAttendanceTab({
  workers,
  setWorkers,
  hourlyAttendance,
  setHourlyAttendance,
  settings,
  userRole,
  activeSubTab,
  onActiveSubTabChange,
  autoOpenManualAttendance,
  setAutoOpenManualAttendance
}: HourlyAttendanceTabProps) {
  const currentThemeColor = 'indigo';

  // States
  const [localSubTab, setLocalSubTab] = useState<'clock' | 'history' | 'payroll'>('clock');
  const selectedSubTab = activeSubTab !== undefined ? activeSubTab : localSubTab;
  const setSelectedSubTab = (tab: 'clock' | 'history' | 'payroll') => {
    setLocalSubTab(tab);
    if (onActiveSubTabChange) {
      onActiveSubTabChange(tab);
    }
  };
  const [isOtSettingsOpen, setIsOtSettingsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [clockStatusFilter, setClockStatusFilter] = useState<'all' | 'idle' | 'working' | 'done'>('all');
  const [clockSearchQuery, setClockSearchQuery] = useState<string>('');
  
  // Filtering states for History
  const [historyWorkerFilter, setHistoryWorkerFilter] = useState<string>('all');
  const [historyWeekFilter, setHistoryWeekFilter] = useState<string>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');

  // Form states for manual entry
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualWorkerId, setManualWorkerId] = useState('');
  const [manualDate, setManualDate] = useState(getCurrentDateStr());
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualHourlyRate, setManualHourlyRate] = useState<string>('30000'); // Default 30k/hour
  const [manualHours, setManualHours] = useState<string>('');
  const [manualNotes, setManualNotes] = useState('');
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Form states for quick batch entry
  const [isQuickClockModalOpen, setIsQuickClockModalOpen] = useState(false);
  const [quickSelectedWorkerIds, setQuickSelectedWorkerIds] = useState<string[]>([]);
  const [quickHours, setQuickHours] = useState<string>('8');
  const [quickDate, setQuickDate] = useState<string>(getCurrentDateStr());
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [quickWorkerSearch, setQuickWorkerSearch] = useState<string>('');

  // Overtime Calculation Settings
  const [isOvertimeEnabled, setIsOvertimeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('xuongan_ot_enabled');
      return saved !== 'false'; // Default to true
    } catch {
      return true;
    }
  });
  const [otStandardHours, setOtStandardHours] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('xuongan_ot_standard_hours');
      return saved ? saved : '8';
    } catch {
      return '8';
    }
  });
  const [otRateMultiplier, setOtRateMultiplier] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('xuongan_ot_multiplier');
      return saved ? saved : '1.5';
    } catch {
      return '1.5';
    }
  });

  // Modal-specific overtime form states
  const [formIsOvertimeApplied, setFormIsOvertimeApplied] = useState<boolean>(true);
  const [formOtStandardHours, setFormOtStandardHours] = useState<string>('8');
  const [formOtMultiplier, setFormOtMultiplier] = useState<string>('1.5');

  // Monthly salary converter states
  const [isSalaryCalcOpen, setIsSalaryCalcOpen] = useState(false);
  const [salaryCalcWorkerId, setSalaryCalcWorkerId] = useState<string | null>(null); // null means manual modal input, otherwise specific worker ID
  const [salaryCalcWorkerName, setSalaryCalcWorkerName] = useState<string>('');
  const [salaryCalcMonthly, setSalaryCalcMonthly] = useState<string>('5000000');
  const [salaryCalcDays, setSalaryCalcDays] = useState<string>('26');
  const [salaryCalcHours, setSalaryCalcHours] = useState<string>('8');
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  // Track monthly salary configurations for workers
  const [workerMonthlySalaries, setWorkerMonthlySalaries] = useState<Record<string, { monthlySalary: number; days: number; hours: number }>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_worker_monthly_salaries');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveWorkerMonthlySalary = (workerId: string, config: { monthlySalary: number; days: number; hours: number } | null) => {
    const updated = { ...workerMonthlySalaries };
    if (config === null) {
      delete updated[workerId];
    } else {
      updated[workerId] = config;
    }
    setWorkerMonthlySalaries(updated);
    localStorage.setItem('xuongan_worker_monthly_salaries', JSON.stringify(updated));
  };

  useEffect(() => {
    if (autoOpenManualAttendance && userRole !== 'viewer') {
      setIsEditingId(null);
      setManualWorkerId('');
      setManualDate(selectedDate);
      setManualCheckIn('');
      setManualCheckOut('');
      setManualHours('');
      setManualNotes('');
      setFormIsOvertimeApplied(isOvertimeEnabled);
      setFormOtStandardHours(otStandardHours);
      setFormOtMultiplier(otRateMultiplier);
      setIsManualFormOpen(true);
      
      if (setAutoOpenManualAttendance) {
        setAutoOpenManualAttendance(false);
      }
    }
  }, [autoOpenManualAttendance, userRole, selectedDate, isOvertimeEnabled, otStandardHours, otRateMultiplier, setAutoOpenManualAttendance]);

  const saveOtConfig = (enabled: boolean, std: string, mult: string) => {
    setIsOvertimeEnabled(enabled);
    setOtStandardHours(std);
    setOtRateMultiplier(mult);
    localStorage.setItem('xuongan_ot_enabled', String(enabled));
    localStorage.setItem('xuongan_ot_standard_hours', std);
    localStorage.setItem('xuongan_ot_multiplier', mult);
  };

  // Quick Action State - Quick rate configuration for workers
  const [workerRates, setWorkerRates] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('xuongan_worker_hourly_rates');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveWorkerRate = (workerId: string, rate: number) => {
    const updated = { ...workerRates, [workerId]: rate };
    setWorkerRates(updated);
    localStorage.setItem('xuongan_worker_hourly_rates', JSON.stringify(updated));
  };

  const handleApplyCalculatedRate = () => {
    const monthly = Number(salaryCalcMonthly) || 0;
    const days = Number(salaryCalcDays) || 26;
    const hours = Number(salaryCalcHours) || 8;
    
    if (monthly <= 0 || days <= 0 || hours <= 0) {
      alert("Sếp vui lòng điền các số hợp lệ lớn hơn 0 nhé.");
      return;
    }
    
    // Hourly rate calculation
    const calculatedRate = Math.round(monthly / (days * hours));
    
    if (salaryCalcWorkerId) {
      saveWorkerMonthlySalary(salaryCalcWorkerId, { monthlySalary: monthly, days, hours });
      saveWorkerRate(salaryCalcWorkerId, calculatedRate);
    } else {
      setManualHourlyRate(String(calculatedRate));
    }
    
    setIsSalaryCalcOpen(false);
  };

  // Auto-calculated week keys for historical filtering
  const weekKeys = useMemo(() => {
    const keys = new Set<string>();
    hourlyAttendance.forEach(item => {
      if (item.weekKey) keys.add(item.weekKey);
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [hourlyAttendance]);

  // Today's attendance states for the Quick Clock panel
  const todayAttendanceMap = useMemo(() => {
    const map = new Map<string, HourlyAttendance>();
    hourlyAttendance
      .filter(item => item.date === selectedDate)
      .forEach(item => {
        map.set(item.workerId, item);
      });
    return map;
  }, [hourlyAttendance, selectedDate]);

  // Handle Quick Clock In
  const handleQuickClockIn = (worker: Worker) => {
    if (userRole === 'viewer') return;
    
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const currentTimeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const rate = workerRates[worker.id] || 30000;

    const newRecord: HourlyAttendance = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      workerId: worker.id,
      workerName: worker.name,
      date: selectedDate,
      checkInTime: currentTimeStr,
      hourlyRate: rate,
      hoursWorked: 0,
      totalAmount: 0,
      weekKey: getVietnameseWeekKey(selectedDate),
      createdAt: Date.now()
    };

    const updated = [newRecord, ...hourlyAttendance];
    setHourlyAttendance(updated);
  };

  // Handle Quick Clock Out
  const handleQuickClockOut = (workerId: string, checkOutTimeStr?: string, customHours?: number) => {
    if (userRole === 'viewer') return;
    
    const record = todayAttendanceMap.get(workerId);
    if (!record || !record.checkInTime) return;

    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const outTime = checkOutTimeStr || `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    // Compute duration in hours
    let hours = 0;
    if (customHours !== undefined) {
      hours = customHours;
    } else {
      try {
        const [inH, inM] = record.checkInTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        const durationMin = (outH * 60 + outM) - (inH * 60 + inM);
        if (durationMin > 0) {
          hours = Math.round((durationMin / 60) * 10) / 10; // round to 1 decimal place
        } else {
          hours = 0;
        }
      } catch {
        hours = 0;
      }
    }

    const rate = workerRates[workerId] || record.hourlyRate || 30000;
    
    // Calculate overtime if enabled globally
    const stdHrs = Number(otStandardHours) || 8;
    const mult = Number(otRateMultiplier) || 1.5;
    let otHours = 0;
    let totalAmount = 0;
    let isOtApplied = false;

    if (isOvertimeEnabled && hours > stdHrs) {
      otHours = Math.round((hours - stdHrs) * 10) / 10;
      const regularWages = stdHrs * rate;
      const overtimeWages = otHours * rate * mult;
      totalAmount = Math.round(regularWages + overtimeWages);
      isOtApplied = true;
    } else {
      totalAmount = Math.round(hours * rate);
    }

    const updated = hourlyAttendance.map(item => {
      if (item.id === record.id) {
        return {
          ...item,
          checkOutTime: outTime,
          hoursWorked: hours,
          totalAmount: totalAmount,
          hourlyRate: rate,
          overtimeHours: otHours > 0 ? otHours : undefined,
          overtimeMultiplier: isOtApplied ? mult : undefined,
          isOvertimeApplied: isOtApplied,
          updatedAt: Date.now()
        };
      }
      return item;
    });

    setHourlyAttendance(updated);
  };

  // Universal wage calculator taking overtime settings into consideration
  const getCalculatedWages = (workerId: string, hours: number) => {
    const rate = workerRates[workerId] || 30000;
    const stdHrs = Number(otStandardHours) || 8;
    const mult = Number(otRateMultiplier) || 1.5;
    let otHours = 0;
    let totalAmount = 0;
    let isOtApplied = false;

    if (isOvertimeEnabled && hours > stdHrs) {
      otHours = Math.round((hours - stdHrs) * 10) / 10;
      const regularWages = stdHrs * rate;
      const overtimeWages = otHours * rate * mult;
      totalAmount = Math.round(regularWages + overtimeWages);
      isOtApplied = true;
    } else {
      totalAmount = Math.round(hours * rate);
    }

    return {
      rate,
      hours,
      otHours,
      mult,
      isOtApplied,
      totalAmount
    };
  };

  // Log completed ca instantly for a worker
  const handleInstantLogHours = (workerId: string, hours: number) => {
    if (userRole === 'viewer') return;
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    // Check if there is already a record for today
    const existing = todayAttendanceMap.get(workerId);
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const checkInTime = "08:00";
    
    // Calculate check-out time based on hours
    let checkOutTime = "";
    try {
      const endHour = 8 + Math.floor(hours);
      const endMinute = Math.round((hours % 1) * 60);
      checkOutTime = `${pad(endHour)}:${pad(endMinute)}`;
    } catch {
      checkOutTime = "16:00";
    }

    const { rate, otHours, mult, isOtApplied, totalAmount } = getCalculatedWages(workerId, hours);

    if (existing) {
      // Update existing record
      const updated = hourlyAttendance.map(item => {
        if (item.id === existing.id) {
          return {
            ...item,
            checkInTime,
            checkOutTime,
            hoursWorked: hours,
            totalAmount: totalAmount,
            hourlyRate: rate,
            overtimeHours: otHours > 0 ? otHours : undefined,
            overtimeMultiplier: isOtApplied ? mult : undefined,
            isOvertimeApplied: isOtApplied,
            updatedAt: Date.now()
          };
        }
        return item;
      });
      setHourlyAttendance(updated);
    } else {
      // Create new completed record
      const newRecord: HourlyAttendance = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        workerId: worker.id,
        workerName: worker.name,
        date: selectedDate,
        checkInTime,
        checkOutTime,
        hourlyRate: rate,
        hoursWorked: hours,
        totalAmount: totalAmount,
        weekKey: getVietnameseWeekKey(selectedDate),
        overtimeHours: otHours > 0 ? otHours : undefined,
        overtimeMultiplier: isOtApplied ? mult : undefined,
        isOvertimeApplied: isOtApplied,
        createdAt: Date.now()
      };
      setHourlyAttendance([newRecord, ...hourlyAttendance]);
    }
  };

  // Fine adjust hours with + or - buttons on worker card
  const handleAdjustHours = (workerId: string, delta: number) => {
    if (userRole === 'viewer') return;
    const existing = todayAttendanceMap.get(workerId);
    if (!existing) return;

    const newHours = Math.max(0, Math.round((existing.hoursWorked + delta) * 10) / 10);
    
    if (newHours === 0) {
      // If decreased to 0, ask if they want to delete today's record
      if (confirm(`Sếp có muốn xóa ca làm hôm nay của thợ ${existing.workerName} không?`)) {
        setHourlyAttendance(hourlyAttendance.filter(item => item.id !== existing.id));
      }
      return;
    }

    // Recalculate end time
    const pad = (n: number) => n.toString().padStart(2, '0');
    let checkInTime = existing.checkInTime || "08:00";
    let checkOutTime = existing.checkOutTime || "16:00";
    try {
      const [inH, inM] = checkInTime.split(':').map(Number);
      const totalMinutes = inH * 60 + inM + Math.round(newHours * 60);
      const outH = Math.floor(totalMinutes / 60) % 24;
      const outM = totalMinutes % 60;
      checkOutTime = `${pad(outH)}:${pad(outM)}`;
    } catch {}

    const { rate, otHours, mult, isOtApplied, totalAmount } = getCalculatedWages(workerId, newHours);

    const updated = hourlyAttendance.map(item => {
      if (item.id === existing.id) {
        return {
          ...item,
          checkOutTime,
          hoursWorked: newHours,
          totalAmount: totalAmount,
          hourlyRate: rate,
          overtimeHours: otHours > 0 ? otHours : undefined,
          overtimeMultiplier: isOtApplied ? mult : undefined,
          isOvertimeApplied: isOtApplied,
          updatedAt: Date.now()
        };
      }
      return item;
    });
    setHourlyAttendance(updated);
  };

  // Batch action handlers
  const handleBatchClockInAll = () => {
    if (userRole === 'viewer') return;
    const currentTimeStr = "08:00";
    
    const inactiveWorkers = workers.filter(worker => !todayAttendanceMap.has(worker.id));
    if (inactiveWorkers.length === 0) {
      alert("Tất cả thợ đều đã có trạng thái chấm công hôm nay rồi sếp ơi!");
      return;
    }

    const newRecords: HourlyAttendance[] = inactiveWorkers.map(worker => {
      const rate = workerRates[worker.id] || 30000;
      return {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        workerId: worker.id,
        workerName: worker.name,
        date: selectedDate,
        checkInTime: currentTimeStr,
        hourlyRate: rate,
        hoursWorked: 0,
        totalAmount: 0,
        weekKey: getVietnameseWeekKey(selectedDate),
        createdAt: Date.now()
      };
    });

    setHourlyAttendance([...newRecords, ...hourlyAttendance]);
  };

  const handleBatchClockOutAll = () => {
    if (userRole === 'viewer') return;
    
    const activeRecords = workers
      .map(w => todayAttendanceMap.get(w.id))
      .filter((rec): rec is HourlyAttendance => !!rec && !!rec.checkInTime && !rec.checkOutTime);

    if (activeRecords.length === 0) {
      alert("Không có thợ nào đang trong trạng thái 'Đang làm' để cho ra ca hàng loạt sếp ơi!");
      return;
    }

    const stdHrs = Number(otStandardHours) || 8;
    const mult = Number(otRateMultiplier) || 1.5;

    const updated = hourlyAttendance.map(item => {
      const activeRec = activeRecords.find(r => r.id === item.id);
      if (activeRec) {
        const hours = 8.0; // standard 8 hours
        const rate = workerRates[item.workerId] || item.hourlyRate || 30000;
        
        let otHours = 0;
        let totalAmount = 0;
        let isOtApplied = false;

        if (isOvertimeEnabled && hours > stdHrs) {
          otHours = Math.round((hours - stdHrs) * 10) / 10;
          const regularWages = stdHrs * rate;
          const overtimeWages = otHours * rate * mult;
          totalAmount = Math.round(regularWages + overtimeWages);
          isOtApplied = true;
        } else {
          totalAmount = Math.round(hours * rate);
        }

        return {
          ...item,
          checkOutTime: "16:00",
          hoursWorked: hours,
          totalAmount: totalAmount,
          hourlyRate: rate,
          overtimeHours: otHours > 0 ? otHours : undefined,
          overtimeMultiplier: isOtApplied ? mult : undefined,
          isOvertimeApplied: isOtApplied,
          updatedAt: Date.now()
        };
      }
      return item;
    });

    setHourlyAttendance(updated);
  };

  const handleBatchLogEightHoursAll = () => {
    if (userRole === 'viewer') return;

    const inactiveWorkers = workers.filter(worker => !todayAttendanceMap.has(worker.id));
    if (inactiveWorkers.length === 0) {
      alert("Tất cả thợ đều đã được chấm công hôm nay rồi sếp ơi!");
      return;
    }

    const stdHrs = Number(otStandardHours) || 8;
    const mult = Number(otRateMultiplier) || 1.5;
    const hours = 8.0;

    const newRecords: HourlyAttendance[] = inactiveWorkers.map(worker => {
      const rate = workerRates[worker.id] || 30000;
      let otHours = 0;
      let totalAmount = 0;
      let isOtApplied = false;

      if (isOvertimeEnabled && hours > stdHrs) {
        otHours = Math.round((hours - stdHrs) * 10) / 10;
        const regularWages = stdHrs * rate;
        const overtimeWages = otHours * rate * mult;
        totalAmount = Math.round(regularWages + overtimeWages);
        isOtApplied = true;
      } else {
        totalAmount = Math.round(hours * rate);
      }

      return {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        workerId: worker.id,
        workerName: worker.name,
        date: selectedDate,
        checkInTime: "08:00",
        checkOutTime: "16:00",
        hourlyRate: rate,
        hoursWorked: hours,
        totalAmount: totalAmount,
        weekKey: getVietnameseWeekKey(selectedDate),
        overtimeHours: otHours > 0 ? otHours : undefined,
        overtimeMultiplier: isOtApplied ? mult : undefined,
        isOvertimeApplied: isOtApplied,
        createdAt: Date.now()
      };
    });

    setHourlyAttendance([...newRecords, ...hourlyAttendance]);
  };

  const handleBatchClearToday = () => {
    if (userRole === 'viewer') return;
    
    const todayRecords = workers
      .map(w => todayAttendanceMap.get(w.id))
      .filter((rec): rec is HourlyAttendance => !!rec);

    if (todayRecords.length === 0) {
      alert("Hôm nay chưa có dữ liệu chấm công nào để xóa sếp ơi!");
      return;
    }

    if (confirm(`⚠️ CẢNH BÁO: Sếp có chắc chắn muốn XÓA TOÀN BỘ chấm công của cả xưởng trong ngày ${formatVietnameseDate(selectedDate)} không? Hành động này không thể khôi phục!`)) {
      const idsToRemove = new Set(todayRecords.map(r => r.id));
      setHourlyAttendance(hourlyAttendance.filter(item => !idsToRemove.has(item.id)));
    }
  };

  // Handle Direct Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'viewer') return;
    if (!manualWorkerId) {
      alert("Sếp vui lòng chọn nhân viên trước nhé!");
      return;
    }

    const worker = workers.find(w => w.id === manualWorkerId);
    if (!worker) return;

    const rate = Number(manualHourlyRate) || 30000;
    
    // Calculate hours manually if manual hours is empty but check-in/out exist
    let computedHours = Number(manualHours);
    if (!manualHours && manualCheckIn && manualCheckOut) {
      try {
        const [inH, inM] = manualCheckIn.split(':').map(Number);
        const [outH, outM] = manualCheckOut.split(':').map(Number);
        const durationMin = (outH * 60 + outM) - (inH * 60 + inM);
        if (durationMin > 0) {
          computedHours = Math.round((durationMin / 60) * 10) / 10;
        }
      } catch {}
    }

    if (computedHours <= 0) {
      alert("Số giờ làm việc phải lớn hơn 0 sếp ơi!");
      return;
    }

    // Calculate overtime if enabled for this form
    const formStdHrs = Number(formOtStandardHours) || 8;
    const formMult = Number(formOtMultiplier) || 1.5;
    let otHours = 0;
    let totalAmount = 0;
    let isOtApplied = false;

    if (formIsOvertimeApplied && computedHours > formStdHrs) {
      otHours = Math.round((computedHours - formStdHrs) * 10) / 10;
      const regularWages = formStdHrs * rate;
      const overtimeWages = otHours * rate * formMult;
      totalAmount = Math.round(regularWages + overtimeWages);
      isOtApplied = true;
    } else {
      totalAmount = Math.round(computedHours * rate);
    }

    if (isEditingId) {
      const updated = hourlyAttendance.map(item => {
        if (item.id === isEditingId) {
          return {
            ...item,
            workerId: manualWorkerId,
            workerName: worker.name,
            date: manualDate,
            checkInTime: manualCheckIn || undefined,
            checkOutTime: manualCheckOut || undefined,
            hourlyRate: rate,
            hoursWorked: computedHours,
            totalAmount: totalAmount,
            notes: manualNotes,
            weekKey: getVietnameseWeekKey(manualDate),
            overtimeHours: isOtApplied && otHours > 0 ? otHours : undefined,
            overtimeMultiplier: isOtApplied ? formMult : undefined,
            isOvertimeApplied: isOtApplied,
            updatedAt: Date.now()
          };
        }
        return item;
      });
      setHourlyAttendance(updated);
      setIsEditingId(null);
    } else {
      const newRecord: HourlyAttendance = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        workerId: manualWorkerId,
        workerName: worker.name,
        date: manualDate,
        checkInTime: manualCheckIn || undefined,
        checkOutTime: manualCheckOut || undefined,
        hourlyRate: rate,
        hoursWorked: computedHours,
        totalAmount: totalAmount,
        notes: manualNotes,
        weekKey: getVietnameseWeekKey(manualDate),
        overtimeHours: isOtApplied && otHours > 0 ? otHours : undefined,
        overtimeMultiplier: isOtApplied ? formMult : undefined,
        isOvertimeApplied: isOtApplied,
        createdAt: Date.now()
      };
      setHourlyAttendance([newRecord, ...hourlyAttendance]);
    }

    // Save worker rate preference
    saveWorkerRate(manualWorkerId, rate);

    // Reset Form
    setManualWorkerId('');
    setManualCheckIn('');
    setManualCheckOut('');
    setManualHours('');
    setManualNotes('');
    setIsManualFormOpen(false);
  };

  const handleQuickClockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'viewer') return;
    if (quickSelectedWorkerIds.length === 0) {
      alert("Sếp vui lòng chọn ít nhất một nhân viên để chấm công nhanh nhé!");
      return;
    }

    const hoursNum = Number(quickHours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      alert("Số giờ làm việc phải lớn hơn 0 sếp ơi!");
      return;
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const checkInTime = "08:00";
    let checkOutTime = "";
    try {
      const endHour = 8 + Math.floor(hoursNum);
      const endMinute = Math.round((hoursNum % 1) * 60);
      checkOutTime = `${pad(endHour)}:${pad(endMinute)}`;
    } catch {
      checkOutTime = "16:00";
    }

    // Prepare updated state
    let updatedRecords = [...hourlyAttendance];

    quickSelectedWorkerIds.forEach(workerId => {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const { rate, otHours, mult, isOtApplied, totalAmount } = getCalculatedWages(workerId, hoursNum);

      // Check if there's already an attendance record for this worker on this date
      const existingIdx = updatedRecords.findIndex(r => r.workerId === workerId && r.date === quickDate);

      const record: HourlyAttendance = {
        id: existingIdx >= 0 ? updatedRecords[existingIdx].id : 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        workerId: worker.id,
        workerName: worker.name,
        date: quickDate,
        checkInTime,
        checkOutTime,
        hourlyRate: rate,
        hoursWorked: hoursNum,
        totalAmount,
        notes: quickNotes || undefined,
        weekKey: getVietnameseWeekKey(quickDate),
        overtimeHours: otHours > 0 ? otHours : undefined,
        overtimeMultiplier: isOtApplied ? mult : undefined,
        isOvertimeApplied: isOtApplied,
        createdAt: existingIdx >= 0 ? updatedRecords[existingIdx].createdAt : Date.now(),
        updatedAt: Date.now()
      };

      if (existingIdx >= 0) {
        updatedRecords[existingIdx] = record;
      } else {
        updatedRecords.unshift(record);
      }
    });

    setHourlyAttendance(updatedRecords);
    setIsQuickClockModalOpen(false);
    setQuickSelectedWorkerIds([]);
    setQuickNotes('');
  };

  // Open edit modal
  const handleEditRecord = (record: HourlyAttendance) => {
    setIsEditingId(record.id);
    setManualWorkerId(record.workerId);
    setManualDate(record.date);
    setManualCheckIn(record.checkInTime || '');
    setManualCheckOut(record.checkOutTime || '');
    setManualHourlyRate(String(record.hourlyRate));
    setManualHours(String(record.hoursWorked));
    setManualNotes(record.notes || '');
    
    // Set overtime form states
    setFormIsOvertimeApplied(record.isOvertimeApplied ?? isOvertimeEnabled);
    setFormOtStandardHours(record.hoursWorked && record.overtimeHours ? String(Math.round((record.hoursWorked - record.overtimeHours) * 10) / 10) : otStandardHours);
    setFormOtMultiplier(record.overtimeMultiplier ? String(record.overtimeMultiplier) : otRateMultiplier);
    
    setIsManualFormOpen(true);
  };

  // Handle Delete
  const handleDeleteRecord = (id: string) => {
    if (userRole === 'viewer') return;
    if (confirm("Sếp chắc chắn muốn xoá dòng chấm công này chứ?")) {
      setHourlyAttendance(hourlyAttendance.filter(item => item.id !== id));
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return hourlyAttendance.filter(item => {
      const matchWorker = historyWorkerFilter === 'all' || item.workerId === historyWorkerFilter;
      const matchWeek = historyWeekFilter === 'all' || item.weekKey === historyWeekFilter;
      const matchDate = !historyDateFilter || item.date === historyDateFilter;
      const matchQuery = !searchQuery.trim() || 
        item.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchWorker && matchWeek && matchDate && matchQuery;
    });
  }, [hourlyAttendance, historyWorkerFilter, historyWeekFilter, historyDateFilter, searchQuery]);

  // Payroll / Wages summary calculations
  const payrollSummary = useMemo(() => {
    const summaryMap = new Map<string, {
      workerId: string;
      workerName: string;
      totalHours: number;
      totalWages: number;
      shiftsCount: number;
      averageRate: number;
    }>();

    hourlyAttendance.forEach(item => {
      // Group by worker
      const matchWeek = historyWeekFilter === 'all' || item.weekKey === historyWeekFilter;
      const matchDate = !historyDateFilter || item.date === historyDateFilter;
      if (!matchWeek || !matchDate) return;

      const current = summaryMap.get(item.workerId) || {
        workerId: item.workerId,
        workerName: item.workerName,
        totalHours: 0,
        totalWages: 0,
        shiftsCount: 0,
        averageRate: 0
      };

      current.totalHours += item.hoursWorked;
      current.totalWages += item.totalAmount;
      current.shiftsCount += 1;
      
      summaryMap.set(item.workerId, current);
    });

    return Array.from(summaryMap.values()).map(item => ({
      ...item,
      averageRate: item.totalHours > 0 ? Math.round(item.totalWages / item.totalHours) : 0
    })).sort((a, b) => b.totalWages - a.totalWages);
  }, [hourlyAttendance, historyWeekFilter, historyDateFilter]);

  // Overall statistics for the current filters
  const overallStats = useMemo(() => {
    let totalHours = 0;
    let totalEarnings = 0;
    let activeClocksCount = 0;

    // Active clock-ins today
    hourlyAttendance.forEach(item => {
      const matchWeek = historyWeekFilter === 'all' || item.weekKey === historyWeekFilter;
      const matchDate = !historyDateFilter || item.date === historyDateFilter;
      if (matchWeek && matchDate) {
        totalHours += item.hoursWorked;
        totalEarnings += item.totalAmount;
      }
    });

    // Count currently clocked-in (unfinished) today
    Array.from(todayAttendanceMap.values()).forEach(item => {
      if (item.checkInTime && !item.checkOutTime) {
        activeClocksCount++;
      }
    });

    return {
      totalHours,
      totalEarnings,
      activeClocksCount
    };
  }, [hourlyAttendance, historyWeekFilter, historyDateFilter, todayAttendanceMap]);

  // Export to Excel function
  const handleExportExcel = () => {
    try {
      const excelData = filteredHistory.map((item, idx) => ({
        "STT": idx + 1,
        "Ngày": formatVietnameseDate(item.date),
        "Tuần": item.weekKey,
        "Tên Nhân Viên": item.workerName,
        "Giờ Vào": item.checkInTime || "N/A",
        "Giờ Ra": item.checkOutTime || "N/A",
        "Số Giờ Làm": item.hoursWorked,
        "Số Giờ Tăng Ca (OT)": item.overtimeHours || 0,
        "Hệ Số Tăng Ca": item.overtimeMultiplier || "",
        "Đơn Giá (đ/giờ)": item.hourlyRate,
        "Thành Tiền (đ)": item.totalAmount,
        "Ghi Chú": item.notes || ""
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Auto size columns
      const maxLens = Object.keys(excelData[0] || {}).map(key => {
        let max = key.length;
        excelData.forEach(row => {
          const val = String((row as any)[key] || '');
          if (val.length > max) max = val.length;
        });
        return { wch: max + 3 };
      });
      ws['!cols'] = maxLens;

      XLSX.utils.book_append_sheet(wb, ws, "Chấm công theo giờ");
      
      // Export Worker Summaries sheet too
      const summarySheetData = payrollSummary.map((item, idx) => ({
        "STT": idx + 1,
        "Tên Nhân Viên": item.workerName,
        "Tổng Số Ca": item.shiftsCount,
        "Tổng Số Giờ": item.totalHours,
        "Đơn Giá TB (đ)": item.averageRate,
        "Tổng Lương Nhận (đ)": item.totalWages
      }));
      const wsSum = XLSX.utils.json_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, wsSum, "Tổng hợp lương nhân viên");

      const fileDate = selectedDate.replace(/-/g, "_");
      XLSX.writeFile(wb, `Bang_Chong_Cong_Theo_Gio_${fileDate}.xlsx`);
    } catch (err) {
      alert("Xảy ra lỗi khi xuất Excel sếp ơi!");
      console.error(err);
    }
  };

  // Export Monthly Payroll to Excel (Grouped by Month and Worker)
  const handleExportMonthlyPayroll = () => {
    try {
      if (hourlyAttendance.length === 0) {
        alert("Hiện tại chưa có dữ liệu chấm công nào để xuất bảng lương tháng sếp ơi!");
        return;
      }

      // Group records by Month (YYYY-MM) and Worker (workerId)
      const monthlyGroups: Record<string, Record<string, {
        workerId: string;
        workerName: string;
        totalHours: number;
        totalOtHours: number;
        totalWages: number;
        shiftsCount: number;
      }>> = {};

      hourlyAttendance.forEach(item => {
        // Parse date to extract YYYY-MM
        const monthKey = item.date.substring(0, 7); // "YYYY-MM"
        if (!monthlyGroups[monthKey]) {
          monthlyGroups[monthKey] = {};
        }

        if (!monthlyGroups[monthKey][item.workerId]) {
          monthlyGroups[monthKey][item.workerId] = {
            workerId: item.workerId,
            workerName: item.workerName,
            totalHours: 0,
            totalOtHours: 0,
            totalWages: 0,
            shiftsCount: 0
          };
        }

        const group = monthlyGroups[monthKey][item.workerId];
        group.totalHours += item.hoursWorked;
        group.totalOtHours += item.overtimeHours || 0;
        group.totalWages += item.totalAmount;
        group.shiftsCount += 1;
      });

      const wb = XLSX.utils.book_new();

      // Create a master summary sheet of all months
      const summaryData: any[] = [];
      let globalIdx = 1;

      // Sort months descending (latest month first)
      const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => b.localeCompare(a));

      sortedMonths.forEach(month => {
        const workersInMonth = monthlyGroups[month];
        const [year, monthNum] = month.split('-');
        const monthLabel = `Tháng ${monthNum}/${year}`;

        Object.values(workersInMonth).forEach(w => {
          summaryData.push({
            "STT": globalIdx++,
            "Tháng/Năm": monthLabel,
            "Tên Nhân Viên": w.workerName,
            "Số Ca Làm": w.shiftsCount,
            "Tổng Số Giờ": w.totalHours,
            "Số Giờ Tăng Ca (OT)": w.totalOtHours,
            "Đơn Giá TB (đ/h)": w.totalHours > 0 ? Math.round(w.totalWages / w.totalHours) : 0,
            "Tổng Lương Nhận (đ)": w.totalWages
          });
        });
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      
      // Auto size columns for summary sheet
      if (summaryData.length > 0) {
        const maxLensSum = Object.keys(summaryData[0] || {}).map(key => {
          let max = key.length;
          summaryData.forEach(row => {
            const val = String((row as any)[key] || '');
            if (val.length > max) max = val.length;
          });
          return { wch: max + 3 };
        });
        wsSummary['!cols'] = maxLensSum;
      }
      XLSX.utils.book_append_sheet(wb, wsSummary, "Bảng Lương Tổng Hợp");

      // For each month, create a detailed sheet
      sortedMonths.forEach(month => {
        const workersInMonth = monthlyGroups[month];
        const [year, monthNum] = month.split('-');
        const monthLabel = `Tháng ${monthNum}_${year}`;

        const monthDetailedData = Object.values(workersInMonth).map((w, idx) => ({
          "STT": idx + 1,
          "Tên Nhân Viên": w.workerName,
          "Tổng Số Ca": w.shiftsCount,
          "Tổng Số Giờ": w.totalHours,
          "Giờ Tăng Ca (OT)": w.totalOtHours,
          "Đơn Giá Bình Quân (đ)": w.totalHours > 0 ? Math.round(w.totalWages / w.totalHours) : 0,
          "Tổng Tiền Lương (đ)": w.totalWages
        }));

        const wsMonth = XLSX.utils.json_to_sheet(monthDetailedData);
        
        // Auto size columns
        if (monthDetailedData.length > 0) {
          const maxLensMonth = Object.keys(monthDetailedData[0] || {}).map(key => {
            let max = key.length;
            monthDetailedData.forEach(row => {
              const val = String((row as any)[key] || '');
              if (val.length > max) max = val.length;
            });
            return { wch: max + 3 };
          });
          wsMonth['!cols'] = maxLensMonth;
        }
        
        XLSX.utils.book_append_sheet(wb, wsMonth, monthLabel);
      });

      XLSX.writeFile(wb, `Bang_Luong_Tho_Theo_Thang.xlsx`);
    } catch (err) {
      alert("Xảy ra lỗi khi xuất bảng lương sếp ơi!");
      console.error(err);
    }
  };

  // Memos for quick attendance tab status filtering and searching
  const filteredClockWorkers = useMemo(() => {
    return workers.filter(worker => {
      // 1. Filter by search query
      if (clockSearchQuery.trim()) {
        const query = clockSearchQuery.toLowerCase();
        const nameMatch = worker.name.toLowerCase().includes(query);
        const phoneMatch = worker.phone && worker.phone.toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch) return false;
      }

      // 2. Filter by status
      const todayAtt = todayAttendanceMap.get(worker.id);
      let status: 'idle' | 'working' | 'done' = 'idle';
      if (todayAtt) {
        if (todayAtt.checkInTime && !todayAtt.checkOutTime) {
          status = 'working';
        } else if (todayAtt.checkInTime && todayAtt.checkOutTime) {
          status = 'done';
        }
      }

      if (clockStatusFilter !== 'all' && status !== clockStatusFilter) {
        return false;
      }

      return true;
    });
  }, [workers, todayAttendanceMap, clockSearchQuery, clockStatusFilter]);

  const clockCounts = useMemo(() => {
    let idle = 0;
    let working = 0;
    let done = 0;
    workers.forEach(worker => {
      const todayAtt = todayAttendanceMap.get(worker.id);
      if (!todayAtt) {
        idle++;
      } else if (todayAtt.checkInTime && !todayAtt.checkOutTime) {
        working++;
      } else if (todayAtt.checkInTime && todayAtt.checkOutTime) {
        done++;
      }
    });
    return { all: workers.length, idle, working, done };
  }, [workers, todayAttendanceMap]);

  return (
    <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 py-4 min-h-[70vh] font-sans">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md mb-5 relative overflow-hidden border border-slate-850 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5 text-white">
            <Clock className="text-indigo-400 w-6 h-6 shrink-0" />
            Chấm Công Theo Giờ
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Ghi nhận thời gian làm việc, thời điểm vào/ra ca và tự động tính toán tiền lương theo giờ cho thợ phụ, công nhân xưởng An.
          </p>
        </div>
        {userRole !== 'viewer' && (
          <div className="flex flex-wrap items-center gap-2 z-10 shrink-0">
            <button
              onClick={() => {
                setIsEditingId(null);
                setManualWorkerId('');
                setManualDate(selectedDate);
                setManualCheckIn('');
                setManualCheckOut('');
                setManualHours('');
                setManualNotes('');
                setFormIsOvertimeApplied(isOvertimeEnabled);
                setFormOtStandardHours(otStandardHours);
                setFormOtMultiplier(otRateMultiplier);
                setIsManualFormOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Ghi nhận giờ lẻ thủ công cho từng thợ"
            >
              <Plus size={14} className="stroke-[3]" />
              Thêm Giờ Lẻ
            </button>

            <button
              onClick={() => {
                setQuickSelectedWorkerIds([]);
                setQuickHours('8');
                setQuickDate(selectedDate);
                setQuickNotes('');
                setIsQuickClockModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Chấm nhanh cùng lúc cho một hoặc nhiều thợ"
            >
              <Zap size={14} className="stroke-[2.5]" />
              Chấm Công Nhanh
            </button>
          </div>
        )}
      </div>

      {/* Top Statistical Bento */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Tổng giờ làm</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
              {overallStats.totalHours.toLocaleString()}h
            </span>
          </div>
        </div>

        <div 
          onClick={() => setIsPayrollModalOpen(true)}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-all hover:border-emerald-500/50 cursor-pointer group"
          title="Nhấn để xem chi tiết tiền lương"
        >
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 rounded-lg shrink-0 transition-colors">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Tổng quỹ lương</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {overallStats.totalEarnings.toLocaleString()}đ
            </span>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-650 dark:text-amber-400 rounded-lg shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">Đang làm việc</span>
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
              {overallStats.activeClocksCount} Thợ
            </span>
          </div>
        </div>
      </div>

      {/* Cấu hình tăng ca */}
      <div className="mb-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsOtSettingsOpen(!isOtSettingsOpen)}
          className="w-full px-4 py-2.5 flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-950/70 transition-all cursor-pointer font-mono"
        >
          <span className="flex items-center gap-2 text-left">
            <Clock size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            Cấu hình tăng ca (OT): {isOvertimeEnabled ? "Đang bật" : "Đang tắt"}
          </span>
          {isOtSettingsOpen ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
        </button>
        
        <AnimatePresence>
          {isOtSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-150 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/20"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
                {/* Enable toggle */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase font-mono text-[10px]">
                    Tự động áp dụng tăng ca
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveOtConfig(!isOvertimeEnabled, otStandardHours, otRateMultiplier)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1 border ${
                        isOvertimeEnabled 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200'
                      }`}
                    >
                      {isOvertimeEnabled ? "Đang bật" : "Đang tắt"}
                    </button>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Tự tính lương OT khi quá giờ chuẩn.
                    </span>
                  </div>
                </div>

                {/* Standard Hours */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase font-mono text-[10px]">
                    Số giờ chuẩn/ngày
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={otStandardHours}
                      onChange={(e) => saveOtConfig(isOvertimeEnabled, e.target.value, otRateMultiplier)}
                      className="w-20 px-2 py-1.5 border border-slate-250 dark:border-slate-750 rounded-lg bg-white dark:bg-slate-900 font-black text-slate-850 dark:text-slate-100 text-center font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400 font-medium">giờ/ngày</span>
                  </div>
                </div>

                {/* Overtime Multiplier */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase font-mono text-[10px]">
                    Hệ số lương OT
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={otRateMultiplier}
                      onChange={(e) => saveOtConfig(isOvertimeEnabled, otStandardHours, e.target.value)}
                      className="w-20 px-2 py-1.5 border border-slate-250 dark:border-slate-750 rounded-lg bg-white dark:bg-slate-900 font-black text-slate-850 dark:text-slate-100 text-center font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400 font-medium">lần đơn giá</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Primary Sub-navigation Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-5 overflow-x-auto scrollbar-none gap-1 bg-slate-100/70 dark:bg-slate-950/40 p-1 rounded-xl">
        <button
          onClick={() => setSelectedSubTab('clock')}
          className={`px-4 py-2 text-xs font-black flex items-center gap-2 rounded-lg transition-all shrink-0 uppercase tracking-wider ${
            selectedSubTab === 'clock'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock size={14} />
          Chấm công hôm nay
        </button>
        <button
          onClick={() => setSelectedSubTab('history')}
          className={`px-4 py-2 text-xs font-black flex items-center gap-2 rounded-lg transition-all shrink-0 uppercase tracking-wider ${
            selectedSubTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ClipboardList size={14} />
          Lịch sử ({filteredHistory.length})
        </button>
        <button
          onClick={() => setSelectedSubTab('payroll')}
          className={`px-4 py-2 text-xs font-black flex items-center gap-2 rounded-lg transition-all shrink-0 uppercase tracking-wider ${
            selectedSubTab === 'payroll'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <DollarSign size={14} />
          Thống kê &amp; Lương
        </button>
      </div>

      {/* SUB-TAB 1: QUICK CLOCK-IN/OUT TODAY */}
      {selectedSubTab === 'clock' && (
        <div className="space-y-6">
          {/* Quick Date Picker header */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="text-indigo-600 dark:text-indigo-400 shrink-0 w-5 h-5" />
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black font-mono tracking-wider">Ngày đang chọn</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {formatVietnameseDate(selectedDate)} <span className="text-indigo-600 dark:text-indigo-400 font-black ml-1 font-mono text-xs">(Tuần {getVietnameseWeekKey(selectedDate)})</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-extrabold bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-200 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* BLOCK CHẤM CÔNG NHANH HÀNG LOẠT (BATCH OPERATIONS) */}
          {userRole !== 'viewer' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-2.5">
                <Zap size={12} className="text-indigo-500" />
                Thao tác nhanh cho tất cả thợ chưa chấm công
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={handleBatchClockInAll}
                  className="bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-lg transition-all flex flex-col items-center justify-center text-center shadow-xs active:scale-95 cursor-pointer"
                  title="Ghi nhận vào ca lúc 08:00 cho toàn bộ thợ chưa có trạng thái hôm nay"
                >
                  <Play size={15} className="text-indigo-600 dark:text-indigo-400 mb-1" />
                  <span className="text-[10.5px] font-black uppercase tracking-wide">Vào ca loạt thợ</span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 leading-tight">08:00</span>
                </button>

                <button
                  onClick={handleBatchLogEightHoursAll}
                  className="bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-lg transition-all flex flex-col items-center justify-center text-center shadow-xs active:scale-95 cursor-pointer"
                  title="Chấm thẳng 8 giờ làm chuẩn cho toàn bộ thợ chưa có trạng thái hôm nay"
                >
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 mb-1" />
                  <span className="text-[10.5px] font-black uppercase tracking-wide">Chấm 8h loạt thợ</span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 leading-tight">8.0 giờ</span>
                </button>

                <button
                  onClick={handleBatchClockOutAll}
                  className="bg-white dark:bg-slate-900 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded-lg transition-all flex flex-col items-center justify-center text-center shadow-xs active:scale-95 cursor-pointer"
                  title="Cho ra ca hàng loạt thợ đang làm việc với đúng 8 tiếng làm chuẩn"
                >
                  <Square size={13} className="text-orange-600 dark:text-orange-400 mb-1" />
                  <span className="text-[10.5px] font-black uppercase tracking-wide">Ra ca loạt thợ</span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 leading-tight">8.0 giờ</span>
                </button>

                <button
                  onClick={handleBatchClearToday}
                  className="bg-white dark:bg-slate-900 hover:bg-red-50/50 dark:hover:bg-red-950/20 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 p-2 rounded-lg transition-all flex flex-col items-center justify-center text-center shadow-xs active:scale-95 cursor-pointer"
                  title="Xóa sạch toàn bộ chấm công của ngày hiện tại để làm lại từ đầu"
                >
                  <Trash2 size={15} className="text-red-600 dark:text-red-400 mb-1" />
                  <span className="text-[10.5px] font-black uppercase tracking-wide font-sans">Xóa hết hôm nay</span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 leading-tight">Xóa sạch ca đã ghi</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Grid of Workers */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
            
            {/* SEARCH & FILTERS INLINE BAR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-xs sm:text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                Trạng thái ca thợ hôm nay
              </h2>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {/* Text search worker name */}
                <div className="relative flex-1 sm:w-60">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={clockSearchQuery}
                    onChange={(e) => setClockSearchQuery(e.target.value)}
                    placeholder="Tìm tên thợ hoặc số ĐT..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-black border border-slate-250 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Status selector tabs */}
                <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 bg-slate-50 dark:bg-slate-950 font-mono text-[10.5px]">
                  <button
                    onClick={() => setClockStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      clockStatusFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Tất cả ({clockCounts.all})
                  </button>
                  <button
                    onClick={() => setClockStatusFilter('idle')}
                    className={`px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      clockStatusFilter === 'idle'
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Chưa vào ({clockCounts.idle})
                  </button>
                  <button
                    onClick={() => setClockStatusFilter('working')}
                    className={`px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      clockStatusFilter === 'working'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-orange-600 dark:text-orange-450 hover:text-orange-900'
                    }`}
                  >
                    Đang làm ({clockCounts.working})
                  </button>
                  <button
                    onClick={() => setClockStatusFilter('done')}
                    className={`px-2.5 py-1 rounded-lg font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                      clockStatusFilter === 'done'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-600 dark:text-emerald-450 hover:text-emerald-900'
                    }`}
                  >
                    Đã xong ({clockCounts.done})
                  </button>
                </div>
              </div>
            </div>

            {filteredClockWorkers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="mx-auto text-slate-400 mb-3 stroke-[2.5]" size={40} />
                <p className="text-sm font-black">Không tìm thấy thợ nào phù hợp bộ lọc hiện tại sếp ơi.</p>
                <p className="text-xs text-slate-500 mt-2">Sếp thử đổi từ khóa tìm kiếm hoặc xem các tab trạng thái khác nhé!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredClockWorkers.map(worker => {
                  const todayAtt = todayAttendanceMap.get(worker.id);
                  const rate = workerRates[worker.id] || 30000;
                  
                  // Status evaluation
                  let status: 'idle' | 'working' | 'done' = 'idle';
                  if (todayAtt) {
                    if (todayAtt.checkInTime && !todayAtt.checkOutTime) {
                      status = 'working';
                    } else if (todayAtt.checkInTime && todayAtt.checkOutTime) {
                      status = 'done';
                    }
                  }

                  return (
                    <div 
                      key={worker.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        status === 'working' 
                          ? 'border-orange-300 bg-orange-50/20 dark:border-orange-900/40 dark:bg-orange-950/10 shadow-xs'
                          : status === 'done'
                            ? 'border-emerald-300 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-900 bg-white dark:bg-slate-900 shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              status === 'working' 
                                ? 'bg-orange-550 text-white' 
                                : status === 'done' 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              <User size={16} />
                            </div>
                            <div>
                              <span className="block text-sm font-black text-slate-850 dark:text-slate-100 leading-tight">{worker.name}</span>
                              <span className="block text-[10.5px] font-medium text-slate-400 mt-0.5">{worker.phone || 'Không có SĐT'}</span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {status === 'working' && (
                              <span className="inline-flex items-center bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 text-[10px] font-black px-2 py-0.5 rounded-md font-mono animate-pulse">
                                Đang làm
                              </span>
                            )}
                            {status === 'done' && (
                              <span className="inline-flex items-center bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md font-mono">
                                Đã xong
                              </span>
                            )}
                            {status === 'idle' && (
                              <span className="inline-flex items-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-md font-mono">
                                Chưa ca
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Info & Config fields */}
                        <div className="mt-3 pt-2.5 border-t border-slate-150 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="block text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                              ĐƠN GIÁ CÔNG
                              {workerMonthlySalaries[worker.id] && <span title="Đang khóa theo lương tháng quy ước">🔒</span>}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="number"
                                value={rate}
                                disabled={userRole === 'viewer' || !!workerMonthlySalaries[worker.id]}
                                onChange={(e) => saveWorkerRate(worker.id, Number(e.target.value))}
                                className={`w-16 px-1.5 py-0.5 border rounded-md font-black text-[11px] focus:outline-none focus:border-indigo-500 font-mono ${
                                  workerMonthlySalaries[worker.id]
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700'
                                    : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border-slate-250 dark:border-slate-750'
                                }`}
                              />
                              <span className="text-[10px] font-bold text-slate-400 font-mono">đ/h</span>
                            </div>
                            {userRole !== 'viewer' && (
                              <div className="flex flex-col gap-1 mt-1">
                                {workerMonthlySalaries[worker.id] ? (
                                  <>
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold bg-amber-50 dark:bg-amber-950/20 px-1 py-0.5 rounded border border-amber-200 leading-tight w-fit">
                                      Quy ước: {workerMonthlySalaries[worker.id].monthlySalary.toLocaleString()}đ
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const config = workerMonthlySalaries[worker.id];
                                          setSalaryCalcWorkerId(worker.id);
                                          setSalaryCalcWorkerName(worker.name);
                                          setSalaryCalcMonthly(String(config.monthlySalary));
                                          setSalaryCalcDays(String(config.days));
                                          setSalaryCalcHours(String(config.hours));
                                          setIsSalaryCalcOpen(true);
                                        }}
                                        className="text-[9.5px] text-indigo-600 hover:underline font-black cursor-pointer"
                                      >
                                        Sửa
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Xác nhận xóa lương tháng quy ước cho ${worker.name}? Đơn giá giờ sẽ được mở khóa để tự nhập.`)) {
                                            saveWorkerMonthlySalary(worker.id, null);
                                          }
                                        }}
                                        className="text-[9.5px] text-red-500 hover:underline font-black cursor-pointer"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSalaryCalcWorkerId(worker.id);
                                      setSalaryCalcWorkerName(worker.name);
                                      setSalaryCalcMonthly('5000000');
                                      setSalaryCalcDays('26');
                                      setSalaryCalcHours('8');
                                      setIsSalaryCalcOpen(true);
                                    }}
                                    className="text-[9.5px] text-indigo-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Calculator size={10} className="shrink-0" />
                                    Quy đổi lương tháng
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {todayAtt && (
                            <div>
                              <span className="block text-[9.5px] font-black text-slate-400 uppercase tracking-wider font-mono">GIỜ CA LÀM</span>
                              <span className="block font-black text-[11px] text-slate-800 dark:text-slate-200 mt-1 font-mono">
                                {todayAtt.checkInTime} {todayAtt.checkOutTime ? `→ ${todayAtt.checkOutTime}` : '(Chưa ra)'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CONTROLS AREA */}
                      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                        {status === 'idle' && (
                          <div className="space-y-2.5">
                            {userRole !== 'viewer' && (
                              <button
                                onClick={() => handleQuickClockIn(worker)}
                                className="w-full bg-indigo-600 hover:bg-indigo-750 active:scale-95 text-white font-black text-xs uppercase tracking-wider py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Play size={12} />
                                Ghi nhận vào ca
                              </button>
                            )}

                            {/* Ghi nhận nhanh công hoàn thành */}
                            {userRole !== 'viewer' && (
                              <div className="space-y-1">
                                <span className="block text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide font-mono">
                                  Chấm nhanh ca hôm nay:
                                </span>
                                <div className="grid grid-cols-3 gap-1">
                                  <button
                                    onClick={() => handleInstantLogHours(worker.id, 4.0)}
                                    className="px-1.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-350 rounded-lg text-[10px] font-black text-center cursor-pointer border border-slate-200 dark:border-slate-700"
                                    title="Chấm 4 tiếng (mặc định 08:00 - 12:00)"
                                  >
                                    4.0h
                                  </button>
                                  <button
                                    onClick={() => handleInstantLogHours(worker.id, 8.0)}
                                    className="px-1.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 dark:text-indigo-400 rounded-lg text-[10px] font-black text-center cursor-pointer border border-indigo-100"
                                    title="Chấm 8 tiếng tiêu chuẩn (mặc định 08:00 - 16:00)"
                                  >
                                    8.0h
                                  </button>
                                  <button
                                    onClick={() => handleInstantLogHours(worker.id, 10.0)}
                                    className="px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:text-amber-450 rounded-lg text-[10px] font-black text-center cursor-pointer border border-amber-100"
                                    title="Chấm 10 tiếng bao gồm tăng ca (mặc định 08:00 - 18:00)"
                                  >
                                    10.0h
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {status === 'working' && userRole !== 'viewer' && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQuickClockOut(worker.id)}
                                className="flex-1 bg-orange-550 hover:bg-orange-650 active:scale-95 text-white font-black text-xs uppercase tracking-wider py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                title="Chốt giờ thực tế"
                              >
                                <Square size={11} />
                                Ra ca ngay
                              </button>

                              <button
                                onClick={() => handleQuickClockOut(worker.id, "16:00", 8.0)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-300 px-3 py-2 rounded-lg text-xs font-black transition-all border border-emerald-150 cursor-pointer"
                                title="Cho ra ca và chốt tròn 8.0 giờ tiêu chuẩn"
                              >
                                Chốt 8h
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-slate-950/40 px-2 py-1 rounded-md border border-slate-150 dark:border-slate-800/60 text-[10px]">
                              <span className="font-bold text-slate-400">Giờ làm thủ công:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const hoursStr = prompt(`Sếp vui lòng nhập số giờ làm việc cho ${worker.name}:`, "4.0");
                                    if (hoursStr) {
                                      const hours = Number(hoursStr);
                                      if (!isNaN(hours) && hours > 0) {
                                        handleQuickClockOut(worker.id, undefined, hours);
                                      } else {
                                        alert("Số giờ không hợp lệ sếp ơi.");
                                      }
                                    }
                                  }}
                                  className="font-black text-indigo-655 hover:underline cursor-pointer"
                                >
                                  Nhập giờ
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  onClick={() => {
                                    if (confirm(`Sếp có muốn hủy ca làm chưa hoàn thành hôm nay của ${worker.name}?`)) {
                                      setHourlyAttendance(hourlyAttendance.filter(item => item.id !== todayAtt?.id));
                                    }
                                  }}
                                  className="font-black text-red-500 hover:underline cursor-pointer"
                                >
                                  Hủy ca
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {status === 'done' && todayAtt && (
                          <div className="space-y-2.5 bg-emerald-50/20 dark:bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20">
                            
                            {/* Inline hours stepper */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9.5px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wide font-mono">
                                Điều chỉnh số giờ:
                              </span>
                              {userRole !== 'viewer' && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Sếp có muốn xóa chấm công hôm nay của ${worker.name} không?`)) {
                                      setHourlyAttendance(hourlyAttendance.filter(item => item.id !== todayAtt.id));
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 dark:text-red-400 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                                  title="Xóa ca làm hôm nay"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>

                            {userRole !== 'viewer' ? (
                              <div className="grid grid-cols-5 items-center gap-1 bg-white dark:bg-zinc-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                <button
                                  onClick={() => handleAdjustHours(worker.id, -1.0)}
                                  className="py-0.5 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-[10px] rounded-md text-center transition-all cursor-pointer"
                                  title="Trừ 1 tiếng"
                                >
                                  -1h
                                </button>
                                <button
                                  onClick={() => handleAdjustHours(worker.id, -0.5)}
                                  className="py-0.5 px-0.5 bg-slate-50 hover:bg-slate-150 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-[9px] rounded-md text-center transition-all cursor-pointer"
                                  title="Trừ 0.5 tiếng"
                                >
                                  -0.5
                                </button>
                                <span className="text-center font-mono font-black text-xs text-slate-900 dark:text-white">
                                  {todayAtt.hoursWorked}h
                                </span>
                                <button
                                  onClick={() => handleAdjustHours(worker.id, 0.5)}
                                  className="py-0.5 px-0.5 bg-slate-50 hover:bg-slate-150 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-[9px] rounded-md text-center transition-all cursor-pointer"
                                  title="Cộng 0.5 tiếng"
                                >
                                  +0.5
                                </button>
                                <button
                                  onClick={() => handleAdjustHours(worker.id, 1.0)}
                                  className="py-0.5 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-[10px] rounded-md text-center transition-all cursor-pointer"
                                  title="Cộng 1 tiếng"
                                >
                                  +1h
                                </button>
                              </div>
                            ) : (
                              <div className="text-center py-0.5 font-mono font-black text-xs text-emerald-800 dark:text-emerald-400">
                                {todayAtt.hoursWorked} giờ làm việc
                              </div>
                            )}

                            {/* Wages indicator with regular and OT separation */}
                            <div className="flex items-center justify-between text-[10.5px] border-t border-emerald-100/50 dark:border-emerald-900/20 pt-1.5 font-mono">
                              <span className="font-bold text-slate-550 dark:text-slate-400">Tiền lương ca:</span>
                              <div className="text-right">
                                <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs block">
                                  {todayAtt.totalAmount.toLocaleString()}đ
                                </span>
                                {todayAtt.isOvertimeApplied && todayAtt.overtimeHours && (
                                  <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 px-1 py-0.5 rounded border border-orange-100 block mt-0.5">
                                    + {todayAtt.overtimeHours}h tăng ca (x{todayAtt.overtimeMultiplier || 1.5})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Small notes indicator/input */}
                            <div className="pt-1 flex items-center justify-between gap-1.5 text-[9px] text-slate-400 dark:text-slate-500">
                              <span className="truncate italic max-w-[75%] font-medium">
                                {todayAtt.notes ? `📝 ${todayAtt.notes}` : "Không ghi chú"}
                              </span>
                              {userRole !== 'viewer' && (
                                <button
                                  onClick={() => {
                                    const note = prompt(`Nhập ghi chú cho thợ ${worker.name} hôm nay sếp nhé:`, todayAtt.notes || "");
                                    if (note !== null) {
                                      const updated = hourlyAttendance.map(item => {
                                        if (item.id === todayAtt.id) {
                                          return { ...item, notes: note.trim() };
                                        }
                                        return item;
                                      });
                                      setHourlyAttendance(updated);
                                    }
                                  }}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-black flex items-center gap-0.5 cursor-pointer"
                                >
                                  Ghi chú
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ATTENDANCE HISTORY LIST */}
      {selectedSubTab === 'history' && (
        <div className="space-y-5">
          {/* Filters Bento Block */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <Filter size={20} className="text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
                  Bộ Lọc Dữ Liệu Chấm Công Lịch Sử
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-4.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md"
                >
                  <FileSpreadsheet size={16} />
                  Xuất Báo Cáo Excel
                </button>
                <button
                  onClick={handleExportMonthlyPayroll}
                  className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs sm:text-sm px-4.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md"
                  title="Xuất bảng lương tổng hợp theo tháng ra Excel"
                >
                  <FileSpreadsheet size={16} className="text-teal-200" />
                  Xuất Bảng Lương Tháng
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Filter by Worker */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 uppercase font-mono tracking-wider mb-1.5">
                  Chọn nhân viên
                </label>
                <select
                  value={historyWorkerFilter}
                  onChange={(e) => setHistoryWorkerFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Tất cả nhân viên</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Week */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 uppercase font-mono tracking-wider mb-1.5">
                  Chọn tuần làm việc
                </label>
                <select
                  value={historyWeekFilter}
                  onChange={(e) => setHistoryWeekFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Tất cả các tuần</option>
                  {weekKeys.map(wk => (
                    <option key={wk} value={wk}>Tuần {wk}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Specific Date */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 uppercase font-mono tracking-wider mb-1.5">
                  Chọn ngày chính xác
                </label>
                <input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Search input */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 uppercase font-mono tracking-wider mb-1.5">
                  Tìm kiếm từ khoá
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên hoặc ghi chú..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Table Listing */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 border-b-2 border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono">Ngày</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono">Nhân viên</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono">Tuần</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono text-center">Ca Giờ (Vào - Ra)</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono text-center">Số Giờ</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono text-right">Đơn Giá / Giờ</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono text-right">Thành Tiền</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono">Ghi Chú</th>
                    <th className="px-5 py-4 text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider font-mono text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs sm:text-sm">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-500 font-bold">
                        <AlertCircle className="mx-auto text-slate-400 mb-3 stroke-[2.5]" size={32} />
                        Không tìm thấy ca chấm công nào khớp với bộ lọc sếp ơi.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(item => (
                      <tr key={item.id} className="hover:bg-indigo-50/20 dark:hover:bg-slate-950/40 transition-all font-medium">
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-150 whitespace-nowrap">
                          {formatVietnameseDate(item.date)}
                        </td>
                        <td className="px-5 py-3.5 font-extrabold text-slate-900 dark:text-white whitespace-nowrap text-sm">
                          {item.workerName}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-600 dark:text-slate-350 font-mono whitespace-nowrap">
                          {item.weekKey}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap text-slate-800 dark:text-slate-200 font-bold font-mono">
                          {item.checkInTime ? `${item.checkInTime} - ${item.checkOutTime || 'Chưa ra'}` : 'Ghi thẳng số giờ'}
                        </td>
                        <td 
                          onClick={() => {
                            if (userRole !== 'viewer') {
                              handleEditRecord(item);
                            }
                          }}
                          className={`px-5 py-3.5 text-center font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm group ${
                            userRole !== 'viewer' 
                              ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:underline transition-all' 
                              : ''
                          }`}
                          title={userRole !== 'viewer' ? "Sếp bấm vào đây để sửa nhanh giờ làm" : undefined}
                        >
                          <div className="inline-flex flex-col items-center justify-center w-full gap-0.5">
                            <div className="inline-flex items-center gap-1 justify-center">
                              <span>{item.hoursWorked}h</span>
                              {userRole !== 'viewer' && <Edit size={12} className="opacity-45 group-hover:opacity-100 text-indigo-500 transition-all shrink-0" />}
                            </div>
                            {item.isOvertimeApplied && item.overtimeHours && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 leading-none mt-0.5 shrink-0 whitespace-nowrap">
                                OT: {item.overtimeHours}h (x{item.overtimeMultiplier || 1.5})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {item.hourlyRate.toLocaleString()}đ
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-indigo-700 dark:text-indigo-400 font-mono text-sm sm:text-base">
                          {item.totalAmount.toLocaleString()}đ
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 max-w-xs truncate font-medium" title={item.notes}>
                          {item.notes || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditRecord(item)}
                              disabled={userRole === 'viewer'}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-all disabled:opacity-50"
                              title="Sửa dòng này"
                            >
                              <Edit size={16} className="stroke-[2.5]" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(item.id)}
                              disabled={userRole === 'viewer'}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all disabled:opacity-50"
                              title="Xoá ca này"
                            >
                              <Trash2 size={16} className="stroke-[2.5]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PAYROLL & STATS */}
      {selectedSubTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filter banner */}
          <div className="col-span-full bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-850 dark:text-slate-100 uppercase tracking-wide">
                Bảng Tổng Hợp Doanh Thu &amp; Quỹ Lương Thợ
              </h3>
              <p className="text-xs font-bold text-slate-550 dark:text-slate-400 mt-1.5">
                Các số liệu tính toán chi tiết tự động cập nhật ngay lập tức dựa trên bộ lọc tuần/ngày bên phải:
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={historyWeekFilter}
                onChange={(e) => setHistoryWeekFilter(e.target.value)}
                className="px-3.5 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Tất cả các tuần</option>
                {weekKeys.map(wk => (
                  <option key={wk} value={wk}>Tuần {wk}</option>
                ))}
              </select>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="px-3.5 py-2 text-xs sm:text-sm border-2 border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleExportMonthlyPayroll}
                className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs sm:text-sm px-4.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md shrink-0"
                title="Xuất bảng lương tổng hợp theo tháng ra Excel"
              >
                <FileSpreadsheet size={16} className="text-teal-200" />
                Xuất Bảng Lương Tháng
              </button>
            </div>
          </div>

          {/* Left panel: Bar progress charts of wages per worker */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono mb-5 border-b border-slate-150 dark:border-slate-800 pb-3">
              Thống Kê Trực Quan Quỹ Lương Theo Thợ
            </h4>

            {payrollSummary.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="mx-auto text-slate-400 mb-2 stroke-[2.5]" size={30} />
                Chưa có dữ liệu thống kê trong khoảng thời gian được lọc sếp ơi.
              </div>
            ) : (
              <div className="space-y-5">
                {payrollSummary.map((item, idx) => {
                  const maxWage = Math.max(...payrollSummary.map(p => p.totalWages)) || 1;
                  const pct = Math.min(100, Math.round((item.totalWages / maxWage) * 100));
                  
                  return (
                    <div key={item.workerId} className="space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm font-extrabold">
                        <span className="text-slate-800 dark:text-slate-250 text-sm">
                          {idx + 1}. <strong className="font-black text-slate-900 dark:text-white">{item.workerName}</strong>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold ml-1.5">
                            ({item.shiftsCount} ca làm • {item.totalHours}h)
                          </span>
                        </span>
                        <span className="text-indigo-700 dark:text-indigo-400 font-black font-mono">
                          {item.totalWages.toLocaleString()}đ
                        </span>
                      </div>
                      <div className="w-full h-4 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-850">
                        <div 
                          className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Table list summary of wages */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono border-b border-slate-150 dark:border-slate-800 pb-3">
              Bảng Tổng Hợp Tiền Lương Thợ Nhận
            </h4>

            {payrollSummary.length === 0 ? (
              <p className="text-sm font-bold text-slate-500 text-center py-10">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1">
                {payrollSummary.map(item => (
                  <div key={item.workerId} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center text-xs sm:text-sm border border-slate-200 dark:border-slate-800 hover:border-indigo-300 transition-all">
                    <div>
                      <span className="block font-black text-slate-850 dark:text-slate-50 text-sm">{item.workerName}</span>
                      <span className="block text-xs font-bold text-slate-550 dark:text-slate-400 mt-1">
                        Tổng làm: <strong className="text-slate-700 dark:text-slate-300 font-black">{item.totalHours} giờ</strong> • Đơn giá TB: <strong className="text-slate-700 dark:text-slate-300 font-black">{item.averageRate.toLocaleString()}đ/h</strong>
                      </span>
                    </div>
                    <span className="font-black text-indigo-700 dark:text-indigo-400 font-mono text-base whitespace-nowrap">
                      {item.totalWages.toLocaleString()}đ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-MODAL: MANUAL OR EDIT ENTRY FORM */}
      <AnimatePresence>
        {isManualFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border-2 border-indigo-950 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="bg-indigo-950 text-white p-5 flex justify-between items-center border-b border-indigo-900">
                <h3 className="font-black text-sm sm:text-base uppercase tracking-wider flex items-center gap-2.5">
                  <Clock size={18} className="stroke-[2.5]" />
                  {isEditingId ? 'CẬP NHẬT CA LÀM VIỆC' : 'GHI NHẬN CA LÀM THỦ CÔNG'}
                </h3>
                <button
                  onClick={() => setIsManualFormOpen(false)}
                  className="p-1.5 hover:bg-white/15 rounded-lg transition-all"
                >
                  <ArrowRight size={20} className="stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Form body */}
              <form onSubmit={handleManualSubmit} className="p-6 space-y-4.5 text-xs sm:text-sm">
                {/* Select worker */}
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                    Nhân viên làm việc *
                  </label>
                  <select
                    value={manualWorkerId}
                    onChange={(e) => {
                      setManualWorkerId(e.target.value);
                      const rate = workerRates[e.target.value] || 30000;
                      setManualHourlyRate(String(rate));
                    }}
                    required
                    disabled={!!isEditingId}
                    className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Select Date */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                      Ngày làm việc *
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-black focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                    {/* Hourly rate */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs flex items-center gap-1">
                      Đơn giá công (đ/giờ) *
                      {manualWorkerId && workerMonthlySalaries[manualWorkerId] && <span title="Đang khóa theo lương tháng quy ước">🔒</span>}
                    </label>
                    <input
                      type="number"
                      value={manualHourlyRate}
                      disabled={!!(manualWorkerId && workerMonthlySalaries[manualWorkerId])}
                      onChange={(e) => setManualHourlyRate(e.target.value)}
                      required
                      placeholder="VD: 30000"
                      className={`w-full px-3.5 py-2.5 border-2 rounded-xl focus:outline-none focus:border-indigo-600 font-black font-mono text-sm sm:text-base ${
                        manualWorkerId && workerMonthlySalaries[manualWorkerId]
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-550 dark:text-slate-400 cursor-not-allowed border-slate-300 dark:border-slate-700'
                          : 'bg-slate-50 dark:bg-slate-950 text-indigo-700 dark:text-indigo-400 border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {manualWorkerId && workerMonthlySalaries[manualWorkerId] ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold mt-1.5 block bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900/60 leading-normal">
                        🔒 Đơn giá đang được khóa cố định theo lương tháng quy ước của nhân viên này: <strong>{workerMonthlySalaries[manualWorkerId].monthlySalary.toLocaleString()}đ</strong> ({workerMonthlySalaries[manualWorkerId].days} ngày - {workerMonthlySalaries[manualWorkerId].hours} giờ). 
                        <br />
                        <span className="text-[9.5px] font-bold text-slate-500 block mt-1">
                          (Sếp vui lòng ra ngoài màn hình chính, tại mục thợ này bấm "Thay đổi" hoặc "Xóa quy ước" để cập nhật nhé).
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSalaryCalcWorkerId(null);
                          setSalaryCalcWorkerName(workers.find(w => w.id === manualWorkerId)?.name || 'Nhân viên mới');
                          setSalaryCalcMonthly('5000000');
                          setSalaryCalcDays('26');
                          setSalaryCalcHours('8');
                          setIsSalaryCalcOpen(true);
                        }}
                        className="text-[10px] text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 underline font-bold mt-1 block flex items-center gap-0.5 transition-all"
                        title="Tính lương giờ tự động từ lương tháng"
                      >
                        <Calculator size={10} className="shrink-0" />
                        Quy đổi từ lương tháng
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-800 pt-4">
                  <span className="block font-black text-indigo-700 dark:text-indigo-400 uppercase text-xs tracking-wider mb-3 font-mono">
                    THỜI GIAN LÀM VIỆC CHI TIẾT (CHỌN 1 TRONG 2 CÁCH DƯỚI)
                  </span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Check In */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Giờ vào ca
                      </label>
                      <input
                        type="time"
                        value={manualCheckIn}
                        onChange={(e) => setManualCheckIn(e.target.value)}
                        className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    {/* Check Out */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Giờ ra ca
                      </label>
                      <input
                        type="time"
                        value={manualCheckOut}
                        onChange={(e) => setManualCheckOut(e.target.value)}
                        className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-slate-200 dark:border-slate-800"></div>
                    </div>
                    <span className="relative px-4 bg-white dark:bg-slate-900 text-xs text-indigo-750 dark:text-indigo-400 font-black uppercase font-mono">
                      HOẶC TỰ ĐIỀN THẲNG SỐ GIỜ LÀM
                    </span>
                  </div>

                  {/* Hours manual input */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tổng số giờ làm việc thực tế (ví dụ: 4.5)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      placeholder="Nếu để trống, hệ thống tự động tính theo giờ vào/ra"
                      className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-600 font-black text-slate-800 dark:text-slate-100 font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Overtime options in Form */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 font-black text-slate-700 dark:text-slate-300 uppercase font-mono text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsOvertimeApplied}
                        onChange={(e) => setFormIsOvertimeApplied(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-2 border-slate-300 dark:border-slate-700"
                      />
                      Tính giờ tăng ca (OT) cho ca này
                    </label>
                  </div>
                  
                  {formIsOvertimeApplied && (
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                          Giờ quy định (Chuẩn)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          value={formOtStandardHours}
                          onChange={(e) => setFormOtStandardHours(e.target.value)}
                          className="w-full px-3 py-1.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-600 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                          Hệ số nhân tăng ca
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="10"
                          value={formOtMultiplier}
                          onChange={(e) => setFormOtMultiplier(e.target.value)}
                          className="w-full px-3 py-1.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-600 font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                    Ghi chú ca làm (nếu có)
                  </label>
                  <textarea
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    rows={2}
                    placeholder="Ví dụ: Ca tăng ca tối muộn, làm phụ vặt tại xưởng may..."
                    className="w-full px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsManualFormOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-black py-3 rounded-xl transition-all uppercase tracking-wider text-xs border border-slate-250 dark:border-slate-700"
                  >
                    Hủy đóng
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-md uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                  >
                    <Save size={16} className="stroke-[2.5]" />
                    Lưu chấm công
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: QUY ĐỔI LƯƠNG THÁNG SANG LƯƠNG GIỜ */}
      <AnimatePresence>
        {isSalaryCalcOpen && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-500 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="bg-indigo-950 text-white p-5 flex justify-between items-center border-b border-indigo-900">
                <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5">
                  <Calculator size={18} className="stroke-[2.5] text-indigo-400" />
                  QUY ĐỔI LƯƠNG THÁNG ➡️ LƯƠNG GIỜ
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSalaryCalcOpen(false)}
                  className="text-slate-400 hover:text-white transition-all font-bold text-xl"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-150 dark:border-indigo-900/50">
                  <span className="block text-[10px] font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider font-mono">ĐỐI TƯỢNG ÁP DỤNG</span>
                  <span className="block text-sm font-black text-indigo-950 dark:text-white mt-1">
                    {salaryCalcWorkerName || 'Nhân viên đang chọn'}
                  </span>
                </div>

                {/* Monthly salary */}
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                    Mức lương tháng quy ước (đ)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="50000"
                      value={salaryCalcMonthly}
                      onChange={(e) => setSalaryCalcMonthly(e.target.value)}
                      placeholder="Ví dụ: 5000000"
                      className="w-full pl-3.5 pr-10 py-2.5 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-black font-mono text-base focus:outline-none focus:border-indigo-600"
                    />
                    <span className="absolute right-3.5 top-3 text-slate-400 dark:text-slate-500 font-black text-xs font-mono">đ</span>
                  </div>
                  {Number(salaryCalcMonthly) > 0 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">
                      Mức lương: <strong className="text-slate-700 dark:text-slate-300 font-bold">{Number(salaryCalcMonthly).toLocaleString()} đ/tháng</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Days worked per month */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                      Số ngày làm/tháng
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={salaryCalcDays}
                      onChange={(e) => setSalaryCalcDays(e.target.value)}
                      className="w-full px-3.5 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-black font-mono text-center text-sm focus:outline-none focus:border-indigo-600"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block text-center">
                      (Mặc định: 26 ngày)
                    </span>
                  </div>

                  {/* Hours worked per day */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-xs">
                      Số giờ làm/ngày
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={salaryCalcHours}
                      onChange={(e) => setSalaryCalcHours(e.target.value)}
                      className="w-full px-3.5 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-black font-mono text-center text-sm focus:outline-none focus:border-indigo-600"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block text-center">
                      (Mặc định: 8 giờ)
                    </span>
                  </div>
                </div>

                {/* Calculation Result Preview Box */}
                {(() => {
                  const m = Number(salaryCalcMonthly) || 0;
                  const d = Number(salaryCalcDays) || 26;
                  const h = Number(salaryCalcHours) || 8;
                  const totalHours = d * h;
                  const rate = totalHours > 0 ? Math.round(m / totalHours) : 0;
                  
                  return (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-150 dark:border-emerald-900/50 space-y-2 mt-2">
                      <span className="block text-[10px] font-black text-emerald-850 dark:text-emerald-400 uppercase tracking-wider font-mono">KẾT QUẢ QUY ĐỔI DỰ KIẾN</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-750 dark:text-emerald-400 font-mono">
                          {rate.toLocaleString()}
                        </span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase font-mono">đ/giờ</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Tổng số giờ làm tiêu chuẩn trong tháng: <strong className="text-slate-700 dark:text-slate-300">{totalHours} giờ</strong> (lấy {m.toLocaleString()}đ chia cho {totalHours} giờ).
                      </p>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-150 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSalaryCalcOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-black py-3 rounded-xl transition-all uppercase tracking-wider text-xs border border-slate-250 dark:border-slate-700"
                  >
                    Hủy đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCalculatedRate}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-md uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} className="stroke-[2.5]" />
                    Áp dụng đơn giá
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* STATS & PAYROLL MODAL DIALOG */}
        {isPayrollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 flex flex-col font-sans"
            >
              {/* Modal Header */}
              <div className="bg-indigo-950 text-white p-5 flex justify-between items-center border-b border-indigo-900">
                <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5">
                  <DollarSign size={18} className="stroke-[2.5] text-indigo-400" />
                  HỘP THOẠI THỐNG KÊ &amp; TIỀN LƯƠNG CHI TIẾT
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPayrollModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-all font-bold text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 dark:bg-slate-950">
                {/* Filters Row */}
                <div className="bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                      Bộ lọc dữ liệu thời gian
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-0.5">
                      Thay đổi tuần hoặc ngày để cập nhật quỹ lương của thợ ngay lập tức.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={historyWeekFilter}
                      onChange={(e) => setHistoryWeekFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs border-2 border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">Tất cả các tuần</option>
                      {weekKeys.map(wk => (
                        <option key={wk} value={wk}>Tuần {wk}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={historyDateFilter}
                      onChange={(e) => setHistoryDateFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs border-2 border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-extrabold focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleExportMonthlyPayroll}
                      className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                      title="Xuất bảng lương tổng hợp theo tháng ra Excel"
                    >
                      <FileSpreadsheet size={14} className="text-teal-200" />
                      Xuất Excel
                    </button>
                  </div>
                </div>

                {/* Wages table */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono border-b border-slate-150 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    Danh sách tiền công chi tiết
                  </h4>

                  {payrollSummary.length === 0 ? (
                    <p className="text-xs font-bold text-slate-500 text-center py-12">Chưa có dữ liệu thợ nhận lương.</p>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                      {payrollSummary.map(item => (
                        <div key={item.workerId} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between items-center text-xs border border-slate-200 dark:border-slate-800 hover:border-indigo-300 transition-all">
                          <div>
                            <span className="block font-black text-slate-850 dark:text-slate-50 text-xs">{item.workerName}</span>
                            <span className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 mt-1">
                              Tổng: <strong className="text-slate-700 dark:text-slate-300 font-black">{item.totalHours}h</strong> • Đơn giá TB: <strong className="text-slate-700 dark:text-slate-300 font-black">{item.averageRate.toLocaleString()}đ/h</strong>
                            </span>
                          </div>
                          <span className="font-black text-indigo-700 dark:text-indigo-400 font-mono text-sm whitespace-nowrap">
                            {item.totalWages.toLocaleString()}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPayrollModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow-md uppercase tracking-wider cursor-pointer"
                >
                  Đóng Hộp Thoại
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* QUICK ATTENDANCE / CHẤM CÔNG NHANH MODAL DIALOG */}
        {isQuickClockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden border-2 border-amber-500 dark:border-amber-650 flex flex-col font-sans"
            >
              {/* Modal Header */}
              <div className="bg-amber-950 text-white p-5 flex justify-between items-center border-b border-amber-900">
                <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5">
                  <Zap size={18} className="stroke-[2.5] text-amber-400 animate-pulse" />
                  CHẤM CÔNG NHANH HÀNG LOẠT THỢ
                </h3>
                <button
                  type="button"
                  onClick={() => setIsQuickClockModalOpen(false)}
                  className="text-amber-400 hover:text-white transition-all font-bold text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleQuickClockSubmit} className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50 dark:bg-slate-950">
                  {/* Step 1: Worker Selection */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide font-mono text-[11px]">
                        1. Chọn nhân viên ({quickSelectedWorkerIds.length} đã chọn) *
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickSelectedWorkerIds(workers.map(w => w.id))}
                          className="text-[10px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-black cursor-pointer transition active:scale-95"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickSelectedWorkerIds([])}
                          className="text-[10px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-black cursor-pointer transition active:scale-95"
                        >
                          Hủy chọn
                        </button>
                      </div>
                    </div>

                    {/* Search box within selector */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                        <Search size={12} />
                      </span>
                      <input
                        type="text"
                        placeholder="Tìm kiếm tên thợ nhanh..."
                        value={quickWorkerSearch}
                        onChange={(e) => setQuickWorkerSearch(e.target.value)}
                        className="w-full pl-8.5 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Checkbox list */}
                    <div className="border border-slate-250 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-3 max-h-[160px] overflow-y-auto space-y-1.5">
                      {workers
                        .filter(w => w.name.toLowerCase().includes(quickWorkerSearch.toLowerCase()))
                        .map(worker => {
                          const isSelected = quickSelectedWorkerIds.includes(worker.id);
                          return (
                            <label
                              key={worker.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition text-xs font-bold border ${
                                isSelected
                                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/40 text-amber-900 dark:text-amber-400'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/55 border-transparent text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setQuickSelectedWorkerIds(quickSelectedWorkerIds.filter(id => id !== worker.id));
                                  } else {
                                    setQuickSelectedWorkerIds([...quickSelectedWorkerIds, worker.id]);
                                  }
                                }}
                                className="accent-amber-500 w-3.5 h-3.5"
                              />
                              <div className="flex-grow flex justify-between items-center">
                                <span>{worker.name}</span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {workerRates[worker.id] ? `${workerRates[worker.id].toLocaleString()}đ/h` : '30,000đ/h'}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      {workers.filter(w => w.name.toLowerCase().includes(quickWorkerSearch.toLowerCase())).length === 0 && (
                        <p className="text-center py-4 text-xs font-semibold text-slate-400">Không tìm thấy thợ nào sếp ơi.</p>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Date Picker */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-[11px]">
                      2. Ngày chấm công *
                    </label>
                    <input
                      type="date"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-extrabold text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Step 3: Hours Selection */}
                  <div className="space-y-2">
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide font-mono text-[11px]">
                      3. Số giờ làm việc *
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="24"
                        value={quickHours}
                        onChange={(e) => setQuickHours(e.target.value)}
                        required
                        placeholder="Số giờ..."
                        className="w-full px-3.5 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono font-black text-xs focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-xs font-black text-slate-400 uppercase font-mono">giờ</span>
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickHours('4')}
                        className={`py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                          quickHours === '4'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Nửa ngày (4h)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickHours('8')}
                        className={`py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                          quickHours === '8'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Cả ngày (8h)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickHours('10')}
                        className={`py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer ${
                          quickHours === '10'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Tăng ca (10h)
                      </button>
                    </div>
                  </div>

                  {/* Step 4: Notes */}
                  <div>
                    <label className="block font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 font-mono text-[11px]">
                      4. Ghi chú (Không bắt buộc)
                    </label>
                    <textarea
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      placeholder="VD: Làm bù giờ, tăng ca tổ may,..."
                      rows={2}
                      className="w-full px-3.5 py-2 border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold text-xs focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsQuickClockModalOpen(false)}
                    className="border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    HỦY BỎ
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs px-6 py-2.5 rounded-xl transition shadow-md cursor-pointer"
                  >
                    CHẤM CÔNG NGAY ({quickSelectedWorkerIds.length} thợ)
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
