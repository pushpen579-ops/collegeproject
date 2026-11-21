import { FileSpreadsheet, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatDateTime, formatDelayMinutes } from '../lib/api.ts';
import { exportReportToExcel, exportReportToPdf } from '../lib/exportUtils.ts';
import type { DelayRecord, Driver, SalaryRecord, Trip, TripStatus, Vehicle } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';

interface ReportsViewProps {
  trips: Trip[];
  delays: DelayRecord[];
  salaries: SalaryRecord[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

type ReportTab = 'monthly' | 'drivers' | 'vehicles' | 'delays' | 'salaries' | 'expenses';

export function ReportsView({
  trips,
  delays,
  salaries,
  drivers,
  vehicles,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('monthly');
  const [driverId, setDriverId] = useState('all');
  const [vehicleId, setVehicleId] = useState('all');
  const [status, setStatus] = useState<'all' | TripStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (driverId !== 'all' && t.driverId !== driverId) return false;
      if (vehicleId !== 'all' && t.vehicleId !== vehicleId) return false;
      if (status !== 'all' && t.status !== status) return false;
      const d = t.departureTime.slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [trips, driverId, vehicleId, status, fromDate, toDate]);

  const filteredDelays = useMemo(() => {
    return delays.filter((d) => {
      if (driverId !== 'all' && d.driverId !== driverId) return false;
      if (vehicleId !== 'all' && d.vehicleId !== vehicleId) return false;
      const date = d.estimatedArrivalTime.slice(0, 10);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }, [delays, driverId, vehicleId, fromDate, toDate]);

  const filteredSalaries = useMemo(() => {
    return salaries.filter((s) => {
      if (driverId !== 'all' && s.driverId !== driverId) return false;
      if (fromDate && s.month < fromDate.slice(0, 7)) return false;
      if (toDate && s.month > toDate.slice(0, 7)) return false;
      return true;
    });
  }, [salaries, driverId, fromDate, toDate]);

  const driverPerfRows = useMemo(() => {
    return drivers
      .filter((d) => driverId === 'all' || d.id === driverId)
      .map((d) => {
        const dt = filteredTrips.filter((t) => t.driverId === d.id);
        const completed = dt.filter(
          (t) => t.status === 'Completed' || (t.status === 'Delayed' && Boolean(t.actualArrivalTime)),
        ).length;
        const delayed = dt.filter((t) => t.status === 'Delayed' || t.delayMinutes > 0).length;
        const dist = dt.reduce((s, t) => s + t.totalDistanceKm, 0);
        const onTimePct = completed > 0 ? Math.round(((completed - delayed) / completed) * 100) : 100;
        return {
          name: d.name,
          trips: dt.length,
          completed,
          delayed,
          onTimePct,
          distanceKm: dist,
        };
      });
  }, [drivers, driverId, filteredTrips]);

  const vehicleUtilRows = useMemo(() => {
    return vehicles
      .filter((v) => vehicleId === 'all' || v.id === vehicleId)
      .map((v) => {
        const vt = filteredTrips.filter((t) => t.vehicleId === v.id);
        const distanceKm = vt.reduce((s, t) => s + t.totalDistanceKm, 0);
        const expenses = vt.reduce((s, t) => s + t.expenses, 0);
        const maintCost = v.maintenanceHistory.reduce((s, m) => s + m.cost, 0);
        return {
          reg: v.registrationNumber,
          model: `${v.manufacturer} ${v.model}`.trim() || v.rtoOffice || v.vehicleType,
          status: v.status,
          tripsCount: vt.length,
          distanceKm,
          tripExpenses: expenses,
          maintCost,
        };
      });
  }, [vehicles, vehicleId, filteredTrips]);

  const monthlyChartData = useMemo(() => {
    const map: Record<string, { month: string; trips: number; expenses: number; delayed: number }> = {};
    for (const t of filteredTrips) {
      const m = t.departureTime.slice(0, 7);
      if (!map[m]) map[m] = { month: m, trips: 0, expenses: 0, delayed: 0 };
      map[m].trips += 1;
      map[m].expenses += t.expenses;
      if (t.status === 'Delayed' || t.delayMinutes > 0) map[m].delayed += 1;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredTrips]);

  const handleExportPdf = () => {
    const subtitle =
      fromDate || toDate
        ? `Range: ${fromDate || 'Start'} to ${toDate || 'Present'}`
        : 'All recorded dates';
    if (activeTab === 'monthly') {
      exportReportToPdf({
        title: 'Monthly Trip Report',
        subtitle,
        columns: ['Trip ID', 'Route', 'Driver', 'Vehicle', 'Departure', 'Status', 'Delay', 'Expenses'],
        rows: filteredTrips.map((t) => [
          t.tripCode,
          `${t.startingLocation} -> ${t.destination}`,
          driverMap.get(t.driverId)?.name ?? t.driverId,
          vehicleMap.get(t.vehicleId)?.registrationNumber ?? t.vehicleId,
          formatDateTime(t.departureTime),
          t.status,
          t.delayMinutes > 0 ? formatDelayMinutes(t.delayMinutes) : 'On time',
          formatCurrency(t.expenses),
        ]),
        filename: `FleetFlow_Trip_Report_${fromDate}_${toDate}`,
      });
    } else if (activeTab === 'drivers') {
      exportReportToPdf({
        title: 'Driver Performance Report',
        subtitle,
        columns: ['Driver', 'Total Trips', 'Completed', 'Delayed', 'On-Time %', 'Distance (km)'],
        rows: driverPerfRows.map((r) => [
          r.name,
          r.trips,
          r.completed,
          r.delayed,
          `${r.onTimePct}%`,
          r.distanceKm,
        ]),
        filename: 'FleetFlow_Driver_Performance_Report',
      });
    } else if (activeTab === 'vehicles') {
      exportReportToPdf({
        title: 'Vehicle Utilization Report',
        subtitle,
        columns: ['Registration', 'Model', 'Status', 'Trips', 'Distance (km)', 'Trip Expenses', 'Maintenance Cost'],
        rows: vehicleUtilRows.map((r) => [
          r.reg,
          r.model,
          r.status,
          r.tripsCount,
          r.distanceKm,
          formatCurrency(r.tripExpenses),
          formatCurrency(r.maintCost),
        ]),
        filename: 'FleetFlow_Vehicle_Utilization_Report',
      });
    } else if (activeTab === 'delays') {
      exportReportToPdf({
        title: 'Delay Analysis Report',
        subtitle,
        columns: ['Trip', 'Driver', 'Route', 'Delay', 'Reason', 'Review Status'],
        rows: filteredDelays.map((d) => [
          d.tripCode,
          driverMap.get(d.driverId)?.name ?? d.driverId,
          d.route,
          d.delayFormatted,
          d.reason,
          d.reviewStatus,
        ]),
        filename: 'FleetFlow_Delay_Report',
      });
    } else if (activeTab === 'salaries') {
      exportReportToPdf({
        title: 'Salary Ledger Report',
        subtitle,
        columns: ['Month', 'Driver', 'Trips', 'Basic', 'Allowances', 'OT+Bonus', 'Deductions', 'Final Payable', 'Status'],
        rows: filteredSalaries.map((s) => [
          s.month,
          driverMap.get(s.driverId)?.name ?? s.driverId,
          s.completedTrips,
          formatCurrency(s.basicSalary),
          formatCurrency(s.tripAllowances + s.nightAllowances),
          formatCurrency(s.overtimePay + s.approvedBonuses),
          formatCurrency(s.approvedDeductions + s.advancePayments),
          formatCurrency(s.finalPayableSalary),
          s.status,
        ]),
        filename: 'FleetFlow_Salary_Report',
      });
    } else {
      exportReportToPdf({
        title: 'Trip Expense Report',
        subtitle,
        columns: ['Trip ID', 'Date', 'Driver', 'Fuel', 'Tolls', 'Other', 'Total Expense'],
        rows: filteredTrips.map((t) => [
          t.tripCode,
          t.departureTime.slice(0, 10),
          driverMap.get(t.driverId)?.name ?? t.driverId,
          formatCurrency(t.fuelCost),
          formatCurrency(t.tollCost),
          formatCurrency(t.otherExpenses),
          formatCurrency(t.expenses),
        ]),
        filename: 'FleetFlow_Expense_Report',
      });
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'monthly') {
      exportReportToExcel(
        'FleetFlow_Monthly_Trips',
        'Trips',
        filteredTrips.map((t) => ({
          TripID: t.tripCode,
          Origin: t.startingLocation,
          Destination: t.destination,
          Driver: driverMap.get(t.driverId)?.name ?? t.driverId,
          Vehicle: vehicleMap.get(t.vehicleId)?.registrationNumber ?? t.vehicleId,
          Departure: formatDateTime(t.departureTime),
          EstimatedArrival: formatDateTime(t.estimatedArrivalTime),
          ActualArrival: formatDateTime(t.actualArrivalTime),
          DistanceKm: t.totalDistanceKm,
          Status: t.status,
          DelayMinutes: t.delayMinutes,
          ExpensesINR: t.expenses,
        })),
      );
    } else if (activeTab === 'drivers') {
      exportReportToExcel(
        'FleetFlow_Driver_Performance',
        'Drivers',
        driverPerfRows.map((r) => ({
          Driver: r.name,
          TotalTrips: r.trips,
          CompletedTrips: r.completed,
          DelayedTrips: r.delayed,
          OnTimePercent: r.onTimePct,
          DistanceKm: r.distanceKm,
        })),
      );
    } else if (activeTab === 'vehicles') {
      exportReportToExcel(
        'FleetFlow_Vehicle_Utilization',
        'Vehicles',
        vehicleUtilRows.map((r) => ({
          Registration: r.reg,
          Model: r.model,
          Status: r.status,
          Trips: r.tripsCount,
          DistanceKm: r.distanceKm,
          TripExpensesINR: r.tripExpenses,
          MaintenanceCostINR: r.maintCost,
        })),
      );
    } else if (activeTab === 'delays') {
      exportReportToExcel(
        'FleetFlow_Delay_Report',
        'Delays',
        filteredDelays.map((d) => ({
          TripID: d.tripCode,
          Driver: driverMap.get(d.driverId)?.name ?? d.driverId,
          Route: d.route,
          DelayMinutes: d.delayMinutes,
          DelayDuration: d.delayFormatted,
          Reason: d.reason,
          ReviewStatus: d.reviewStatus,
        })),
      );
    } else if (activeTab === 'salaries') {
      exportReportToExcel(
        'FleetFlow_Salary_Report',
        'Salaries',
        filteredSalaries.map((s) => ({
          Month: s.month,
          Driver: driverMap.get(s.driverId)?.name ?? s.driverId,
          CompletedTrips: s.completedTrips,
          BasicSalary: s.basicSalary,
          TripAllowances: s.tripAllowances,
          NightAllowances: s.nightAllowances,
          OvertimePay: s.overtimePay,
          Bonuses: s.approvedBonuses,
          Deductions: s.approvedDeductions,
          Advances: s.advancePayments,
          FinalPayableSalary: s.finalPayableSalary,
          Status: s.status,
        })),
      );
    } else {
      exportReportToExcel(
        'FleetFlow_Expense_Report',
        'Expenses',
        filteredTrips.map((t) => ({
          TripID: t.tripCode,
          Date: t.departureTime.slice(0, 10),
          Driver: driverMap.get(t.driverId)?.name ?? t.driverId,
          FuelCost: t.fuelCost,
          TollCost: t.tollCost,
          OtherExpenses: t.otherExpenses,
          TotalExpense: t.expenses,
        })),
      );
    }
  };

  return (
    <div className="space-y-6">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_payroll_operations_desk_1795256520432.jpg"
        imageAlt="Transport operations glass command office overlooking commercial fleet"
        title="Reports & Analytics"
        subtitle="Filter operational datasets and export executive reports to PDF or Excel"
      >
        <button
          type="button"
          onClick={handleExportPdf}
          className="ff-btn-warning h-9 px-3.5 text-xs"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Export PDF</span>
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          className="ff-btn-success h-9 px-3.5 text-xs"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Export Excel</span>
        </button>
      </FeatureBanner>

      {/* Report Type Tabs */}
      <div className="ff-tab-bar flex flex-wrap items-center gap-2 p-2">
        {(
          [
            { id: 'monthly', label: 'Monthly Trips' },
            { id: 'drivers', label: 'Driver Performance' },
            { id: 'vehicles', label: 'Vehicle Utilization' },
            { id: 'delays', label: 'Delay Report' },
            { id: 'salaries', label: 'Salary Report' },
            { id: 'expenses', label: 'Expense Report' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.97] ${
              activeTab === tab.id
                ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Multi-Filter Bar */}
      <ScrollReveal delay={0.05}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 ff-card p-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-200 mb-1">Driver</label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="ff-select h-9 text-xs"
          >
            <option value="all">All Drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-200 mb-1">Vehicle</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="ff-select h-9 text-xs"
          >
            <option value="all">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-200 mb-1">Trip Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | TripStatus)}
            className="ff-select h-9 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Running">Running</option>
            <option value="Completed">Completed</option>
            <option value="Delayed">Delayed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold text-slate-200 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ff-input h-9 font-mono text-xs [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-200 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ff-input h-9 font-mono text-xs [color-scheme:dark]"
          />
        </div>
        </div>
      </ScrollReveal>

      {/* Contextual Chart */}
      {(activeTab === 'monthly' || activeTab === 'expenses') && (
        <ScrollReveal delay={0.06} className="ff-card p-5">
          <h2 className="font-display text-base font-semibold mb-4 text-white">
            {activeTab === 'monthly' ? 'Filtered Monthly Volume' : 'Monthly Trip Expenses (₹)'}
          </h2>
          {monthlyChartData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-xs text-slate-400">
              No trips recorded yet
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.14)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#081629',
                      borderColor: 'rgba(56,189,248,0.35)',
                      borderRadius: '10px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#CBD5E1', fontSize: '12px' }} />
                  {activeTab === 'monthly' ? (
                    <>
                      <Bar dataKey="trips" name="Total Trips" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="delayed" name="Delayed" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <Bar dataKey="expenses" name="Trip Expenses (₹)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ScrollReveal>
      )}

      {/* Report Data Table */}
      <ScrollReveal delay={0.08} className="ff-card overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'monthly' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Trip</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold">Departure</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Delay</th>
                  <th className="px-4 py-3 font-semibold text-right">Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No trips recorded yet
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((t) => (
                    <tr key={t.id} className="ff-table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{t.tripCode}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {t.startingLocation} → {t.destination}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{driverMap.get(t.driverId)?.name ?? t.driverId}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                        {formatDateTime(t.departureTime)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                        {t.delayMinutes > 0 ? formatDelayMinutes(t.delayMinutes) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#38BDF8]">
                        {formatCurrency(t.expenses)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'drivers' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Trips</th>
                  <th className="px-4 py-3 font-semibold text-right">Completed</th>
                  <th className="px-4 py-3 font-semibold text-right">Delayed</th>
                  <th className="px-4 py-3 font-semibold text-right">On-Time Rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Distance Covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {driverPerfRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No drivers added yet
                    </td>
                  </tr>
                ) : (
                  driverPerfRows.map((r) => (
                    <tr key={r.name} className="ff-table-row">
                      <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">{r.trips}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">{r.completed}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-red-400">
                        {r.delayed}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-[#38BDF8]">
                        {r.onTimePct}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                        {r.distanceKm.toLocaleString()} km
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'vehicles' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Registration</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Trips</th>
                  <th className="px-4 py-3 font-semibold text-right">Distance</th>
                  <th className="px-4 py-3 font-semibold text-right">Trip Expenses</th>
                  <th className="px-4 py-3 font-semibold text-right">Maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {vehicleUtilRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No vehicles added yet
                    </td>
                  </tr>
                ) : (
                  vehicleUtilRows.map((r) => (
                    <tr key={r.reg} className="ff-table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-[#38BDF8]">{r.reg}</td>
                      <td className="px-4 py-3 text-slate-200">{r.model}</td>
                      <td className="px-4 py-3">
                        <StatusLabel status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">{r.tripsCount}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                        {r.distanceKm.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(r.tripExpenses)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#F59E0B]">
                        {formatCurrency(r.maintCost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'delays' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Trip</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold text-right">Delay</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {filteredDelays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No delay records available
                    </td>
                  </tr>
                ) : (
                  filteredDelays.map((d) => (
                    <tr key={d.id} className="ff-table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{d.tripCode}</td>
                      <td className="px-4 py-3 text-slate-200">{driverMap.get(d.driverId)?.name ?? d.driverId}</td>
                      <td className="px-4 py-3 text-slate-300">{d.route}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-red-400">
                        +{d.delayFormatted}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{d.reason}</td>
                      <td className="px-4 py-3">
                        <StatusLabel status={d.reviewStatus} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'salaries' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Month</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold text-right">Trips</th>
                  <th className="px-4 py-3 font-semibold text-right">Gross Earnings</th>
                  <th className="px-4 py-3 font-semibold text-right">Ded. + Adv.</th>
                  <th className="px-4 py-3 font-semibold text-right">Final Payable</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {filteredSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No salary records available
                    </td>
                  </tr>
                ) : (
                  filteredSalaries.map((s) => (
                    <tr key={s.id} className="ff-table-row">
                      <td className="px-4 py-3 font-mono text-slate-300">{s.month}</td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {driverMap.get(s.driverId)?.name ?? s.driverId}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {s.completedTrips}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(
                          s.basicSalary +
                            s.tripAllowances +
                            s.nightAllowances +
                            s.overtimePay +
                            s.approvedBonuses,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-red-400">
                        -{formatCurrency(s.approvedDeductions + s.advancePayments)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#38BDF8]">
                        {formatCurrency(s.finalPayableSalary)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={s.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-3 font-semibold">Trip</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold text-right">Fuel</th>
                  <th className="px-4 py-3 font-semibold text-right">Tolls</th>
                  <th className="px-4 py-3 font-semibold text-right">Other</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Expense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12 text-slate-200">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No expense records available
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((t) => (
                    <tr key={t.id} className="ff-table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-white">{t.tripCode}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                        {t.departureTime.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{driverMap.get(t.driverId)?.name ?? t.driverId}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(t.fuelCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(t.tollCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(t.otherExpenses)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#38BDF8]">
                        {formatCurrency(t.expenses)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}
