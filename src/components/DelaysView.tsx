import { AlertTriangle, ClipboardCheck, Clock, Hourglass, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest, formatDateTime, formatDelayMinutes } from '../lib/api.ts';
import type {
  DelayReason,
  DelayRecord,
  DelayReviewStatus,
  Driver,
  UserRole,
} from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal, StaggerGrid, StaggerItem } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';
import { TtsBriefingButton } from './TtsBriefingButton.tsx';

interface DelaysViewProps {
  role: UserRole;
  delays: DelayRecord[];
  driverSummary: Array<{
    driverId: string;
    driverName: string;
    delayedCount: number;
    totalDelayMinutes: number;
    totalDelayFormatted: string;
    pendingReviewCount: number;
  }>;
  monthlyDelays: Array<{ month: string; count: number; totalMinutes: number }>;
  drivers: Driver[];
  onRefresh: () => Promise<void>;
}

const DELAY_REASONS: Array<DelayReason | 'Unclassified'> = [
  'Traffic',
  'Road conditions',
  'Vehicle breakdown',
  'Loading/unloading',
  'Weather',
  'Personal or other',
  'Unclassified',
];

export function DelaysView({
  role,
  delays,
  driverSummary,
  monthlyDelays,
  drivers,
  onRefresh,
}: DelaysViewProps) {
  const canClassify = role === 'owner' || role === 'admin' || role === 'manager';
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [reviewing, setReviewing] = useState<DelayRecord | null>(null);
  const [form, setForm] = useState({
    reason: 'Traffic' as DelayReason | 'Unclassified',
    driverExplanation: '',
    adminNotes: '',
    reviewStatus: 'Reviewed - No Penalty' as DelayReviewStatus,
  });
  const [saving, setSaving] = useState(false);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const filtered = useMemo(
    () =>
      delays.filter((d) => (reasonFilter === 'all' ? true : d.reason === reasonFilter)),
    [delays, reasonFilter],
  );

  const totalDelayMinutes = delays.reduce((s, d) => s + d.delayMinutes, 0);
  const pendingCount = delays.filter((d) => d.reviewStatus === 'Pending Review').length;

  const openReviewModal = (d: DelayRecord) => {
    setReviewing(d);
    setForm({
      reason: d.reason,
      driverExplanation: d.driverExplanation,
      adminNotes: d.adminNotes,
      reviewStatus: d.reviewStatus === 'Pending Review' ? 'Reviewed - No Penalty' : d.reviewStatus,
    });
  };

  const handleSaveReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      await apiRequest(`/api/delays/${reviewing.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await onRefresh();
      setReviewing(null);
    } finally {
      setSaving(false);
    }
  };

  const ttsText = `Delay audit summary: ${delays.length} delayed trips recorded, totaling ${formatDelayMinutes(totalDelayMinutes)} across the fleet. ${pendingCount} delay record${pendingCount === 1 ? ' is' : 's are'} currently pending supervisor classification. Reminder: zero automatic salary deductions are applied for trip delays.`;

  return (
    <div className="space-y-6">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_trips_highway_corridor_1795256519073.jpg"
        imageAlt="Expressway freight transport route at sunset"
        title={canClassify ? 'Delay Tracking & Audit' : 'My Delays & Explanations'}
        subtitle={
          canClassify
            ? 'Automated variance calculation (Actual Arrival − Estimated Arrival) and transparent classification'
            : 'Review your delayed arrivals and submit clear reasons to operations'
        }
      >
        <TtsBriefingButton label="Speak Delay Audit" text={ttsText} />
      </FeatureBanner>

      {/* Policy Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-400/30 bg-[#0B1D36]/85 p-4 text-xs text-sky-100 shadow-xs">
        <ShieldCheck className="h-4.5 w-4.5 shrink-0 mt-0.5 text-[#38BDF8]" />
        <div>
          <span className="font-bold text-white">Fair Payroll Policy: </span>
          Delays are never automatically deducted from driver wages. Every delayed arrival is logged
          with exact hours and minutes and must be reviewed and classified by operations before any
          payroll decision.
        </div>
      </div>

      {/* Summary KPIs */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.05}>
        <StaggerItem>
          <div className="ff-card p-4 hover:border-[#38BDF8]/40 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Total Delayed Trips
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/25 bg-[#183B60]/80 text-[#38BDF8]">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
              {delays.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Logged late arrival variances
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card border-red-400/25 p-4 hover:border-red-400/45 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Cumulative Delay Time
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/15 text-red-400">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-400">
              {formatDelayMinutes(totalDelayMinutes)}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Total variance beyond ETA
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="ff-card border-amber-400/25 p-4 hover:border-amber-400/45 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Pending Review
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#F59E0B]">
                <Hourglass className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#F59E0B]">
              {pendingCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Awaiting supervisor audit
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>

      {/* Charts & Driver Summary */}
      <ScrollReveal delay={0.06}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          className={`${
            canClassify ? 'lg:col-span-6' : 'lg:col-span-12'
          } ff-card p-5`}
        >
          <h2 className="font-display text-base font-semibold text-white">
            Monthly Delay Minutes
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Total minutes delayed per month
          </p>
          {monthlyDelays.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-xs text-slate-400">
              No delay records available
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDelays} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
                  <Bar dataKey="totalMinutes" name="Delay Minutes" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {canClassify && (
          <div className="lg:col-span-6 ff-card overflow-hidden">
            <div className="border-b border-sky-400/20 px-5 py-4">
              <h2 className="font-display text-base font-semibold text-white">
                Driver-Wise Delay Report
              </h2>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="ff-table-head">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Driver</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Delayed Trips</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total Duration</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Pending Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-400/12">
                {driverSummary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      No drivers added yet
                    </td>
                  </tr>
                ) : (
                  driverSummary.map((row) => (
                    <tr key={row.driverId} className="ff-table-row">
                      <td className="px-4 py-2.5 font-medium text-white">
                        {row.driverName}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-200">
                        {row.delayedCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-200">
                        {row.totalDelayMinutes > 0 ? row.totalDelayFormatted : '0m'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-300">
                        {row.pendingReviewCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}
        </div>
      </ScrollReveal>

      {/* Delay History Table */}
      <ScrollReveal delay={0.08} className="ff-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/20 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-white">
            Delay History Ledger
          </h2>
          <select
            aria-label="Filter by delay reason"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="ff-select h-9 w-auto min-w-[180px] text-xs font-medium"
          >
            <option value="all">All Delay Reasons</option>
            {DELAY_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="ff-table-head">
              <tr>
                <th className="px-4 py-3 font-semibold">Trip &amp; Route</th>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">Est. vs Actual Arrival</th>
                <th className="px-4 py-3 font-semibold text-right">Delay</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Review Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-400/12">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-medium text-slate-300">
                    No delay records available
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="ff-table-row transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-white">
                        {d.tripCode}
                      </div>
                      <div className="text-slate-400">{d.route}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-200">
                      {driverMap.get(d.driverId)?.name ?? d.driverId}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      <div>Est: {formatDateTime(d.estimatedArrivalTime)}</div>
                      <div>Act: {formatDateTime(d.actualArrivalTime)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-red-400 whitespace-nowrap">
                      +{d.delayFormatted}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{d.reason}</div>
                      {d.driverExplanation && (
                        <div className="text-slate-400 max-w-[220px] truncate">
                          {d.driverExplanation}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel status={d.reviewStatus} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openReviewModal(d)}
                        className={`h-8 px-3 text-xs ${
                          d.reviewStatus === 'Pending Review' ? 'ff-btn-warning' : 'ff-btn-royal'
                        }`}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        <span>{canClassify ? 'Classify' : 'Explain'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ScrollReveal>

      {/* Review / Classification Modal */}
      <AnimatePresence>
      {reviewing && (
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
            className="ff-modal w-full max-w-lg p-6"
          >
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-3">
              <h2 className="font-display text-lg font-bold text-white">
                {canClassify ? 'Review & Classify Delay' : 'Submit Delay Explanation'} —{' '}
                {reviewing.tripCode}
              </h2>
              <button
                type="button"
                onClick={() => setReviewing(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReview} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Delay Cause Category
                </label>
                <select
                  value={form.reason}
                  onChange={(e) =>
                    setForm({ ...form, reason: e.target.value as DelayReason | 'Unclassified' })
                  }
                  className="ff-select h-9 text-xs"
                >
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Driver Explanation
                </label>
                <textarea
                  rows={2}
                  value={form.driverExplanation}
                  onChange={(e) => setForm({ ...form, driverExplanation: e.target.value })}
                  className="ff-textarea text-xs"
                />
              </div>
              {canClassify && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Review Status
                    </label>
                    <select
                      value={form.reviewStatus}
                      onChange={(e) =>
                        setForm({ ...form, reviewStatus: e.target.value as DelayReviewStatus })
                      }
                      className="ff-select h-9 text-xs"
                    >
                      <option value="Pending Review">Pending Review</option>
                      <option value="Reviewed - No Penalty">Reviewed - No Penalty</option>
                      <option value="Reviewed - Escalated">Reviewed - Escalated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Supervisor Audit Notes
                    </label>
                    <textarea
                      rows={2}
                      value={form.adminNotes}
                      onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                      placeholder="Verification notes (weather bulletin, traffic log, dock ticket)..."
                      className="ff-textarea text-xs"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-sky-400/20">
                <button
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="ff-btn-secondary h-9 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ff-btn-primary h-9 px-4 text-xs"
                >
                  {saving ? 'Saving...' : 'Save Review'}
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
