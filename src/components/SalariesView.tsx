import { Calculator, Check, Clock, Download, FileSpreadsheet, FileText, IndianRupee, Settings, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import { apiRequest, formatCurrency, formatSalaryTypeLabel } from '../lib/api.ts';
import { downloadSalaryPdf } from '../lib/exportUtils.ts';
import type {
  Driver,
  SalaryApprovalStatus,
  SalaryConfigRules,
  SalaryRecord,
  UserRole,
} from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal, StaggerGrid, StaggerItem } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';
import { TtsBriefingButton } from './TtsBriefingButton.tsx';

interface SalariesViewProps {
  role: UserRole;
  salaries: SalaryRecord[];
  rules: SalaryConfigRules | null;
  drivers: Driver[];
  onRefresh: () => Promise<void>;
}

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

export function SalariesView({
  role,
  salaries,
  rules,
  drivers,
  onRefresh,
}: SalariesViewProps) {
  const isAdmin = role === 'owner' || role === 'admin';
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [detailSalary, setDetailSalary] = useState<SalaryRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rulesForm, setRulesForm] = useState({
    defaultOvertimeRatePerHour: rules?.defaultOvertimeRatePerHour ?? 0,
    defaultNightAllowancePerTrip: rules?.defaultNightAllowancePerTrip ?? 0,
    defaultTripAllowance: rules?.defaultTripAllowance ?? 0,
    defaultPerTripPay: rules?.defaultPerTripPay ?? 0,
  });

  const [editForm, setEditForm] = useState({
    basicSalary: 0,
    tripAllowances: 0,
    nightAllowances: 0,
    overtimeHours: 0,
    overtimePay: 0,
    approvedBonuses: 0,
    approvedDeductions: 0,
    advancePayments: 0,
    status: 'Pending Approval' as SalaryApprovalStatus,
    notes: '',
  });

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const monthsAvailable = useMemo(() => {
    const set = new Set(salaries.map((s) => s.month));
    set.add(getCurrentMonth());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [salaries]);

  const filtered = useMemo(
    () => salaries.filter((s) => s.month === selectedMonth),
    [salaries, selectedMonth],
  );

  const totalPayroll = filtered.reduce((sum, s) => sum + s.finalPayableSalary, 0);
  const pendingCount = filtered.filter((s) => s.status === 'Pending Approval').length;

  const handleGeneratePayroll = async () => {
    setGenerating(true);
    try {
      await apiRequest('/api/salaries/generate', {
        method: 'POST',
        body: JSON.stringify({ month: selectedMonth }),
      });
      await onRefresh();
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveRules = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/salaries/rules', {
        method: 'PUT',
        body: JSON.stringify(rulesForm),
      });
      await onRefresh();
      setRulesOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (s: SalaryRecord) => {
    setDetailSalary(s);
    setEditForm({
      basicSalary: s.basicSalary,
      tripAllowances: s.tripAllowances,
      nightAllowances: s.nightAllowances,
      overtimeHours: s.overtimeHours,
      overtimePay: s.overtimePay,
      approvedBonuses: s.approvedBonuses,
      approvedDeductions: s.approvedDeductions,
      advancePayments: s.advancePayments,
      status: s.status,
      notes: s.notes,
    });
  };

  const computedPreviewFinal = Math.max(
    0,
    editForm.basicSalary +
      editForm.tripAllowances +
      editForm.nightAllowances +
      editForm.approvedBonuses +
      editForm.overtimePay -
      editForm.approvedDeductions -
      editForm.advancePayments,
  );

  const handleSaveSalaryAdjustments = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailSalary) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ salary: SalaryRecord }>(`/api/salaries/${detailSalary.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setDetailSalary(res.salary);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleQuickApprove = async (s: SalaryRecord, nextStatus: SalaryApprovalStatus) => {
    await apiRequest(`/api/salaries/${s.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_payroll_operations_desk_1795256520432.jpg"
        imageAlt="Transport operations command office overlooking truck terminal"
        title="Salary & Payroll Management"
        subtitle="Formula: Basic + Allowances + Bonuses + Overtime − Approved Deductions − Advances"
      >
        <input
          aria-label="Payroll month"
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-9 rounded-lg border border-sky-400/30 bg-[#081629]/85 px-3 text-xs font-mono font-semibold text-white backdrop-blur-sm focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/30 focus:outline-none [color-scheme:dark]"
        />
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => {
                setRulesForm({
                  defaultOvertimeRatePerHour: rules?.defaultOvertimeRatePerHour ?? 0,
                  defaultNightAllowancePerTrip: rules?.defaultNightAllowancePerTrip ?? 0,
                  defaultTripAllowance: rules?.defaultTripAllowance ?? 0,
                  defaultPerTripPay: rules?.defaultPerTripPay ?? 0,
                });
                setRulesOpen(true);
              }}
              className="ff-btn-warning h-9 px-3.5 text-xs"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Payroll Rules</span>
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={handleGeneratePayroll}
              className="ff-btn-royal h-9 px-3.5 text-xs"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>{generating ? 'Calculating...' : 'Calculate Monthly Payroll'}</span>
            </button>
          </>
        )}
      </FeatureBanner>

      {/* Period Summary Strip */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.05}>
        <StaggerItem>
          <div className="ff-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Total Payable ({selectedMonth})
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/30 bg-[#2563EB]/25 text-[#38BDF8]">
                <IndianRupee className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
              {formatCurrency(totalPayroll)}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Net driver disbursements
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Statements Generated
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/20 text-emerald-400">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-400">
              {filtered.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Verified monthly payslips
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Pending Approvals
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-[#F59E0B]/20 text-[#F59E0B]">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#F59E0B]">
              {pendingCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Awaiting owner sign-off
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>

      {/* Quick Month Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {monthsAvailable.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSelectedMonth(m)}
            className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.97] ${
              selectedMonth === m
                ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Payroll Table */}
      <ScrollReveal delay={0.08} className="ff-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="ff-table-head">
              <tr>
                <th className="px-4 py-3 font-semibold">Driver &amp; Plan</th>
                <th className="px-4 py-3 font-semibold text-right">Trips</th>
                <th className="px-4 py-3 font-semibold text-right">Basic</th>
                <th className="px-4 py-3 font-semibold text-right">Allowances</th>
                <th className="px-4 py-3 font-semibold text-right">OT + Bonus</th>
                <th className="px-4 py-3 font-semibold text-right">Ded. + Adv.</th>
                <th className="px-4 py-3 font-semibold text-right">Final Payable</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-400/12 text-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-200">
                      No salary records available
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {drivers.length === 0
                        ? 'Add drivers first, then calculate monthly payroll.'
                        : isAdmin
                          ? `Click "Calculate Monthly Payroll" above to generate statements for ${selectedMonth}.`
                          : `No salary statements have been published for ${selectedMonth}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const drv = driverMap.get(s.driverId);
                  return (
                    <tr key={s.id} className="ff-table-row">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">
                          {drv?.name ?? s.driverId}
                        </div>
                        <div className="text-slate-400">
                          {formatSalaryTypeLabel(s.salaryType)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {s.completedTrips}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(s.basicSalary)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(s.tripAllowances + s.nightAllowances)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                        {formatCurrency(s.overtimePay + s.approvedBonuses)}
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetail(s)}
                            title="View Breakdown"
                            className="ff-btn-royal h-8 px-2.5 text-[11px]"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Breakdown</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSalaryPdf(s, drv)}
                            title="Download PDF Payslip"
                            className="ff-btn-secondary h-8 w-8 p-0"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && s.status === 'Pending Approval' && (
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(s, 'Approved')}
                              title="Approve Salary"
                              className="ff-btn-success h-8 px-2.5 text-[11px]"
                            >
                              <Check className="h-3 w-3" />
                              <span>Approve</span>
                            </button>
                          )}
                          {isAdmin && s.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(s, 'Paid')}
                              title="Mark Paid"
                              className="ff-btn-primary h-8 px-2.5 text-[11px]"
                            >
                              <Check className="h-3 w-3" />
                              <span>Mark Paid</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ScrollReveal>

      {/* Salary Breakdown & Adjustments Modal */}
      <AnimatePresence>
      {detailSalary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="ff-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 text-slate-100"
          >
            <div className="flex items-start justify-between border-b border-sky-400/20 pb-4">
              <div>
                <div className="font-mono text-xs text-slate-400">
                  {detailSalary.id} · Period {detailSalary.month}
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-white">
                  {driverMap.get(detailSalary.driverId)?.name ?? detailSalary.driverId} — Salary
                  Breakdown
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailSalary(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <TtsBriefingButton
                label="Speak Salary Summary"
                text={`Salary statement for ${driverMap.get(detailSalary.driverId)?.name ?? 'driver'}, period ${detailSalary.month}. Completed ${detailSalary.completedTrips} trips. Basic salary ${formatCurrency(detailSalary.basicSalary)}, allowances ${formatCurrency(detailSalary.tripAllowances + detailSalary.nightAllowances)}, overtime and bonuses ${formatCurrency(detailSalary.overtimePay + detailSalary.approvedBonuses)}, less deductions and advances of ${formatCurrency(detailSalary.approvedDeductions + detailSalary.advancePayments)}. Final payable salary is ${formatCurrency(detailSalary.finalPayableSalary)}.`}
              />
              <button
                type="button"
                onClick={() =>
                  downloadSalaryPdf(detailSalary, driverMap.get(detailSalary.driverId))
                }
                className="ff-btn-royal h-9 px-3.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF Statement</span>
              </button>
            </div>

            <div className="mt-4 ff-subcard p-3 text-xs text-slate-300">
              <span className="font-semibold text-white">Delay Audit: </span>
              {detailSalary.delayAuditNote}
            </div>

            <form onSubmit={handleSaveSalaryAdjustments} className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Basic Salary (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.basicSalary}
                  onChange={(e) => setEditForm({ ...editForm, basicSalary: Number(e.target.value) })}
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Trip Allowances (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.tripAllowances}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tripAllowances: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Night Allowances (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.nightAllowances}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nightAllowances: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Overtime Pay (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.overtimePay}
                  onChange={(e) => setEditForm({ ...editForm, overtimePay: Number(e.target.value) })}
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Approved Bonuses (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.approvedBonuses}
                  onChange={(e) =>
                    setEditForm({ ...editForm, approvedBonuses: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Approved Deductions (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.approvedDeductions}
                  onChange={(e) =>
                    setEditForm({ ...editForm, approvedDeductions: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Advance Payments (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={editForm.advancePayments}
                  onChange={(e) =>
                    setEditForm({ ...editForm, advancePayments: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Approval Status
                </label>
                <select
                  disabled={!isAdmin}
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as SalaryApprovalStatus })
                  }
                  className="ff-select h-9 text-xs disabled:opacity-70"
                >
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-slate-200 mb-1">
                  Payroll Remarks
                </label>
                <input
                  disabled={!isAdmin}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="ff-input h-9 text-xs disabled:opacity-70"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between rounded-lg border border-sky-400/35 bg-[#183B60]/60 px-4 py-3">
                <span className="font-semibold text-white">
                  Final Payable Salary
                </span>
                <span className="font-mono text-lg font-bold text-[#38BDF8]">
                  {formatCurrency(computedPreviewFinal)}
                </span>
              </div>

              <div className="col-span-2 flex justify-end gap-2.5 pt-3 border-t border-sky-400/20">
                <button
                  type="button"
                  onClick={() => setDetailSalary(null)}
                  className="ff-btn-secondary h-9 px-4 text-xs"
                >
                  Close
                </button>
                {isAdmin && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="ff-btn-primary h-9 px-4 text-xs"
                  >
                    {saving ? 'Saving...' : 'Save & Update Statement'}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Payroll Rules Modal */}
      <AnimatePresence>
      {rulesOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="ff-modal w-full max-w-md p-6 text-slate-100"
          >
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-3">
              <h2 className="font-display text-lg font-bold text-white">
                Global Payroll Calculation Rules
              </h2>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRules} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Default Overtime Rate (₹ / hour)</label>
                <input
                  type="number"
                  min={0}
                  value={rulesForm.defaultOvertimeRatePerHour}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      defaultOvertimeRatePerHour: Number(e.target.value),
                    })
                  }
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Default Night Allowance (₹ / trip)
                </label>
                <input
                  type="number"
                  min={0}
                  value={rulesForm.defaultNightAllowancePerTrip}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      defaultNightAllowancePerTrip: Number(e.target.value),
                    })
                  }
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Default Trip Allowance (₹ / trip)
                </label>
                <input
                  type="number"
                  min={0}
                  value={rulesForm.defaultTripAllowance}
                  onChange={(e) =>
                    setRulesForm({ ...rulesForm, defaultTripAllowance: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Default Per-Trip Base Pay (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={rulesForm.defaultPerTripPay}
                  onChange={(e) =>
                    setRulesForm({ ...rulesForm, defaultPerTripPay: Number(e.target.value) })
                  }
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div className="ff-subcard p-3 text-slate-300">
                Automatic Delay Deductions: <strong className="text-white">Disabled by policy</strong>
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-sky-400/20">
                <button
                  type="button"
                  onClick={() => setRulesOpen(false)}
                  className="ff-btn-secondary h-9 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ff-btn-primary h-9 px-4 text-xs"
                >
                  {saving ? 'Saving...' : 'Save Rules'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
