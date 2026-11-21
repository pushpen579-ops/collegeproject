import { CheckCircle2, Eye, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { apiRequest, formatCurrency, formatDateTime, formatDelayMinutes } from '../lib/api.ts';
import type { DelayReason, Driver, Trip, TripStatus, UserRole, Vehicle } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';
import { TtsBriefingButton } from './TtsBriefingButton.tsx';

interface TripsViewProps {
  role: UserRole;
  trips: Trip[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onRefresh: () => Promise<void>;
}

const DELAY_REASONS: DelayReason[] = [
  'Traffic',
  'Road conditions',
  'Vehicle breakdown',
  'Loading/unloading',
  'Weather',
  'Personal or other',
];

const getLocalDateTime = (offsetHours = 0) => {
  const d = new Date(Date.now() + offsetHours * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const createEmptyTrip = () => ({
  vehicleId: '',
  driverId: '',
  startingLocation: '',
  destination: '',
  departureTime: getLocalDateTime(0),
  estimatedArrivalTime: getLocalDateTime(4),
  actualArrivalTime: '',
  totalDistanceKm: 0,
  status: 'Scheduled' as TripStatus,
  fuelCost: 0,
  tollCost: 0,
  otherExpenses: 0,
  notes: '',
  delayReason: '' as '' | DelayReason,
  nightShift: false,
  overtimeHours: 0,
});

function computePreviewDelay(est: string, act: string): number {
  if (!est || !act) return 0;
  const diff = Math.round((new Date(act).getTime() - new Date(est).getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

export function TripsView({ role, trips, drivers, vehicles, onRefresh }: TripsViewProps) {
  const canManage = role === 'owner' || role === 'admin' || role === 'manager';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TripStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
  const [arrivalTrip, setArrivalTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState(createEmptyTrip);
  const [arrivalForm, setArrivalForm] = useState({
    actualArrivalTime: getLocalDateTime(0),
    delayReason: '' as '' | DelayReason,
    driverExplanation: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      const drv = driverMap.get(t.driverId)?.name.toLowerCase() ?? '';
      const veh = vehicleMap.get(t.vehicleId)?.registrationNumber.toLowerCase() ?? '';
      return (
        t.tripCode.toLowerCase().includes(q) ||
        t.startingLocation.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        drv.includes(q) ||
        veh.includes(q)
      );
    });
  }, [trips, statusFilter, search, driverMap, vehicleMap]);

  const openAdd = () => {
    setEditingTrip(null);
    setForm({
      ...createEmptyTrip(),
      vehicleId: vehicles[0]?.id ?? '',
      driverId: drivers[0]?.id ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (t: Trip) => {
    setEditingTrip(t);
    setForm({
      vehicleId: t.vehicleId,
      driverId: t.driverId,
      startingLocation: t.startingLocation,
      destination: t.destination,
      departureTime: t.departureTime.slice(0, 16),
      estimatedArrivalTime: t.estimatedArrivalTime.slice(0, 16),
      actualArrivalTime: t.actualArrivalTime ? t.actualArrivalTime.slice(0, 16) : '',
      totalDistanceKm: t.totalDistanceKm,
      status: t.status,
      fuelCost: t.fuelCost,
      tollCost: t.tollCost,
      otherExpenses: t.otherExpenses,
      notes: t.notes,
      delayReason: t.delayReason ?? '',
      nightShift: Boolean(t.nightShift),
      overtimeHours: t.overtimeHours ?? 0,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveTrip = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.vehicleId || !form.driverId || !form.startingLocation.trim() || !form.destination.trim()) {
      setFormError('Vehicle, driver, starting location, and destination are required.');
      return;
    }
    if (form.estimatedArrivalTime <= form.departureTime) {
      setFormError('Estimated arrival time must be after departure time.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        actualArrivalTime: form.actualArrivalTime || null,
        delayReason: form.delayReason || null,
        expenses: Number(form.fuelCost) + Number(form.tollCost) + Number(form.otherExpenses),
      };
      if (editingTrip) {
        await apiRequest(`/api/trips/${editingTrip.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/trips', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save trip.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrip = async (t: Trip) => {
    await apiRequest(`/api/trips/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Running' }),
    });
    await onRefresh();
  };

  const openArrivalModal = (t: Trip) => {
    setArrivalTrip(t);
    setArrivalForm({
      actualArrivalTime: t.actualArrivalTime?.slice(0, 16) || t.estimatedArrivalTime.slice(0, 16),
      delayReason: t.delayReason || '',
      driverExplanation: '',
      notes: t.notes || '',
    });
    setFormError(null);
  };

  const handleSubmitArrival = async (e: FormEvent) => {
    e.preventDefault();
    if (!arrivalTrip) return;
    const delayMins = computePreviewDelay(
      arrivalTrip.estimatedArrivalTime,
      arrivalForm.actualArrivalTime,
    );
    if (delayMins > 0 && !arrivalForm.delayReason) {
      setFormError('Please select a delay reason since arrival is after the estimated time.');
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/trips/${arrivalTrip.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          actualArrivalTime: arrivalForm.actualArrivalTime,
          delayReason: delayMins > 0 ? arrivalForm.delayReason : null,
          driverExplanation: arrivalForm.driverExplanation,
          notes: arrivalForm.notes,
        }),
      });
      await onRefresh();
      setArrivalTrip(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to log arrival.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = async (t: Trip) => {
    await apiRequest(`/api/trips/${t.id}`, { method: 'DELETE' });
    if (viewingTrip?.id === t.id) setViewingTrip(null);
    await onRefresh();
  };

  const previewDelay = computePreviewDelay(form.estimatedArrivalTime, form.actualArrivalTime);
  const arrivalPreviewDelay = arrivalTrip
    ? computePreviewDelay(arrivalTrip.estimatedArrivalTime, arrivalForm.actualArrivalTime)
    : 0;

  return (
    <div className="space-y-5">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_trips_highway_corridor_1795256519073.jpg"
        imageAlt="Freight trucks cruising on expressway corridor at sunset"
        title="Trip Dispatch & Timings"
        subtitle="Schedule routes, monitor live progress, log arrival times, and compute delays automatically"
      >
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="ff-btn-royal h-9 px-4 text-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Trip</span>
          </button>
        )}
      </FeatureBanner>

      {/* Filters */}
      <ScrollReveal delay={0.05}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trip ID, route, driver, vehicle..."
              className="ff-input h-9 pl-9 text-xs"
            />
          </div>

          <div className="ff-tab-bar">
            {(['all', 'Scheduled', 'Running', 'Completed', 'Delayed', 'Cancelled'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                      : 'bg-[#183B60]/70 text-slate-200 hover:bg-[#183B60] hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All Trips' : st}
                </button>
              ),
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* Table */}
      <ScrollReveal delay={0.08} className="ff-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="ff-table-head">
              <tr>
                <th className="px-4 py-3 font-bold">Trip ID</th>
                <th className="px-4 py-3 font-bold">Route</th>
                <th className="px-4 py-3 font-bold">Driver &amp; Vehicle</th>
                <th className="px-4 py-3 font-bold">Departure / Est. Arrival</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Delay</th>
                <th className="px-4 py-3 font-bold text-right">Expenses</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-400/12">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-300">
                      {trips.length === 0
                        ? 'No trips recorded yet'
                        : 'No trips match your current filter.'}
                    </p>
                    {trips.length === 0 && canManage && vehicles.length > 0 && drivers.length > 0 && (
                      <button
                        type="button"
                        onClick={openAdd}
                        className="ff-btn-royal mt-3 h-9 px-4 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Schedule First Trip</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const drv = driverMap.get(t.driverId);
                  const veh = vehicleMap.get(t.vehicleId);
                  return (
                    <tr key={t.id} className="ff-table-row transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                        {t.tripCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">
                          {t.startingLocation} → {t.destination}
                        </div>
                        <div className="font-mono text-slate-400">
                          {t.totalDistanceKm} km
                          {t.nightShift ? ' · Night Shift' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">
                          {drv?.name ?? t.driverId}
                        </div>
                        <div className="font-mono text-[#38BDF8]">
                          {veh?.registrationNumber ?? t.vehicleId}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        <div>Dep: {formatDateTime(t.departureTime)}</div>
                        <div>Est: {formatDateTime(t.estimatedArrivalTime)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {t.delayMinutes > 0 ? (
                          <span className="font-semibold text-red-400">
                            +{formatDelayMinutes(t.delayMinutes)}
                          </span>
                        ) : t.actualArrivalTime ? (
                          <span className="font-semibold text-emerald-400">On time</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-white whitespace-nowrap">
                        {formatCurrency(t.expenses)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {t.status === 'Scheduled' && (
                            <button
                              type="button"
                              onClick={() => handleStartTrip(t)}
                              title="Start Trip"
                              className="ff-btn-success h-8 px-2.5 text-[11px]"
                            >
                              <Play className="h-3 w-3" />
                              <span>Start</span>
                            </button>
                          )}
                          {t.status === 'Running' && (
                            <button
                              type="button"
                              onClick={() => openArrivalModal(t)}
                              className="ff-btn-warning h-8 px-2.5 text-[11px]"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Log Arrival</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingTrip(t)}
                            title="View Trip Details"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xs transition-all hover:bg-[#1D4ED8] hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                title="Edit Trip"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-[#142B4A] shadow-xs transition-all hover:bg-[#D97706] hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTrip(t)}
                                title="Delete Trip"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DC2626] text-white shadow-xs transition-all hover:bg-[#B91C1C] hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
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

      {/* Schedule / Edit Trip Modal */}
      <AnimatePresence>
      {modalOpen && (
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
            className="ff-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-4">
              <h2 className="font-display text-lg font-bold text-white">
                {editingTrip ? `Edit Trip ${editingTrip.tripCode}` : 'Schedule New Trip'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-400/35 bg-red-950/60 px-3 py-2 text-xs font-medium text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTrip} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Assigned Vehicle *
                </label>
                <select
                  required
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className="ff-input h-9 text-xs"
                >
                  {vehicles.map((v) => {
                    const label =
                      `${v.manufacturer} ${v.model}`.trim() || v.rtoOffice || v.vehicleType;
                    return (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} — {label} ({v.status})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Assigned Driver *
                </label>
                <select
                  required
                  value={form.driverId}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  className="ff-input h-9 text-xs"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.licenceClass})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Starting Location *
                </label>
                <input
                  required
                  value={form.startingLocation}
                  onChange={(e) => setForm({ ...form, startingLocation: e.target.value })}
                  placeholder="Enter starting location"
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Destination *
                </label>
                <input
                  required
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="Enter destination"
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Departure Date &amp; Time *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.departureTime}
                  onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Estimated Arrival *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={form.estimatedArrivalTime}
                  onChange={(e) => setForm({ ...form, estimatedArrivalTime: e.target.value })}
                  className="ff-input h-9 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Actual Arrival (optional)
                </label>
                <input
                  type="datetime-local"
                  value={form.actualArrivalTime}
                  onChange={(e) => setForm({ ...form, actualArrivalTime: e.target.value })}
                  className="ff-input h-9 font-mono text-xs"
                />
                {form.actualArrivalTime && (
                  <p className="mt-1 font-mono text-[11px] text-slate-300">
                    Calculated delay:{' '}
                    <span className={previewDelay > 0 ? 'font-bold text-red-400' : 'text-emerald-400'}>
                      {previewDelay > 0 ? `+${formatDelayMinutes(previewDelay)} (Marked Delayed)` : '0m (On Time)'}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TripStatus })}
                  className="ff-input h-9 text-xs"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Running">Running</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              {previewDelay > 0 && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-200 mb-1">
                    Delay Reason Classification
                  </label>
                  <select
                    value={form.delayReason}
                    onChange={(e) => setForm({ ...form, delayReason: e.target.value as DelayReason })}
                    className="ff-input h-9 text-xs"
                  >
                    <option value="">Select reason...</option>
                    {DELAY_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Distance (km)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.totalDistanceKm}
                  onChange={(e) => setForm({ ...form, totalDistanceKm: Number(e.target.value) })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Overtime Hours
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.overtimeHours}
                  onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Fuel Cost (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.fuelCost}
                    onChange={(e) => setForm({ ...form, fuelCost: Number(e.target.value) })}
                    className="ff-input h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Tolls (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.tollCost}
                    onChange={(e) => setForm({ ...form, tollCost: Number(e.target.value) })}
                    className="ff-input h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">
                    Other (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.otherExpenses}
                    onChange={(e) => setForm({ ...form, otherExpenses: Number(e.target.value) })}
                    className="ff-input h-9 text-xs"
                  />
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="night-shift-chk"
                  type="checkbox"
                  checked={form.nightShift}
                  onChange={(e) => setForm({ ...form, nightShift: e.target.checked })}
                  className="h-4 w-4 rounded border-sky-400/40 bg-[#081629] accent-[#2563EB]"
                />
                <label htmlFor="night-shift-chk" className="font-medium text-slate-200">
                  Qualifies for Night Shift Allowance
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-200 mb-1">
                  Additional Dispatch Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="ff-textarea text-xs"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2.5 pt-4 border-t border-sky-400/20">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ff-btn-secondary h-9 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ff-btn-primary h-9 px-4 text-xs"
                >
                  {saving ? 'Saving...' : editingTrip ? 'Update Trip' : 'Create Trip'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Log Arrival / Driver Progress Modal */}
      <AnimatePresence>
      {arrivalTrip && (
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
                Submit Arrival — {arrivalTrip.tripCode}
              </h2>
              <button
                type="button"
                onClick={() => setArrivalTrip(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg border border-red-400/35 bg-red-950/60 px-3 py-2 text-xs font-medium text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitArrival} className="mt-4 space-y-4 text-xs">
              <div className="ff-subcard p-3">
                <div className="font-medium text-white">
                  {arrivalTrip.startingLocation} → {arrivalTrip.destination}
                </div>
                <div className="mt-1 font-mono text-slate-400">
                  Estimated Arrival: {formatDateTime(arrivalTrip.estimatedArrivalTime)}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Actual Arrival Date &amp; Time *
                </label>
                <input
                  required
                  type="datetime-local"
                  value={arrivalForm.actualArrivalTime}
                  onChange={(e) =>
                    setArrivalForm({ ...arrivalForm, actualArrivalTime: e.target.value })
                  }
                  className="ff-input h-9 font-mono text-xs"
                />
                <div className="mt-1.5 font-mono text-xs text-slate-300">
                  Calculated Variance:{' '}
                  <span
                    className={
                      arrivalPreviewDelay > 0
                        ? 'font-bold text-red-400'
                        : 'font-semibold text-emerald-400'
                    }
                  >
                    {arrivalPreviewDelay > 0
                      ? `+${formatDelayMinutes(arrivalPreviewDelay)} late (Automatically logged as Delayed)`
                      : 'On time (Completed)'}
                  </span>
                </div>
              </div>

              {arrivalPreviewDelay > 0 && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Reason for Delay *
                    </label>
                    <select
                      required
                      value={arrivalForm.delayReason}
                      onChange={(e) =>
                        setArrivalForm({
                          ...arrivalForm,
                          delayReason: e.target.value as DelayReason,
                        })
                      }
                      className="ff-input h-9 text-xs"
                    >
                      <option value="">Select primary delay factor...</option>
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
                      value={arrivalForm.driverExplanation}
                      onChange={(e) =>
                        setArrivalForm({ ...arrivalForm, driverExplanation: e.target.value })
                      }
                      placeholder="Provide route or dock details for review..."
                      className="ff-textarea text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Trip Notes
                </label>
                <textarea
                  rows={2}
                  value={arrivalForm.notes}
                  onChange={(e) => setArrivalForm({ ...arrivalForm, notes: e.target.value })}
                  className="ff-textarea text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-sky-400/20">
                <button
                  type="button"
                  onClick={() => setArrivalTrip(null)}
                  className="ff-btn-secondary h-9 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ff-btn-success h-9 px-4 text-xs"
                >
                  {saving ? 'Submitting...' : 'Confirm Arrival'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Trip Details Drawer */}
      <AnimatePresence>
      {viewingTrip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
        >
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="ff-drawer w-full max-w-lg h-full overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between border-b border-sky-400/20 pb-4">
              <div>
                <div className="font-mono text-xs text-slate-400">{viewingTrip.tripCode}</div>
                <h2 className="mt-1 font-display text-lg font-bold text-white">
                  {viewingTrip.startingLocation} → {viewingTrip.destination}
                </h2>
                <div className="mt-2">
                  <StatusLabel status={viewingTrip.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTrip(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <TtsBriefingButton
                label="Speak Trip Dispatch"
                text={`Trip ${viewingTrip.tripCode}, assigned to ${driverMap.get(viewingTrip.driverId)?.name ?? 'driver'}, operating vehicle ${vehicleMap.get(viewingTrip.vehicleId)?.registrationNumber ?? ''}. Route from ${viewingTrip.startingLocation} to ${viewingTrip.destination}, ${viewingTrip.totalDistanceKm} kilometers. Current status is ${viewingTrip.status}. ${viewingTrip.delayMinutes > 0 ? `Recorded delay is ${formatDelayMinutes(viewingTrip.delayMinutes)} due to ${viewingTrip.delayReason ?? 'unclassified cause'}.` : 'Schedule is nominal.'}`}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-xs border-t border-sky-400/20 pt-5">
              <div>
                <div className="text-slate-400">Driver</div>
                <div className="font-semibold text-white mt-0.5">
                  {driverMap.get(viewingTrip.driverId)?.name ?? viewingTrip.driverId}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Vehicle</div>
                <div className="font-mono font-semibold text-[#38BDF8] mt-0.5">
                  {vehicleMap.get(viewingTrip.vehicleId)?.registrationNumber ?? viewingTrip.vehicleId}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Departure</div>
                <div className="font-mono text-slate-200 mt-0.5">{formatDateTime(viewingTrip.departureTime)}</div>
              </div>
              <div>
                <div className="text-slate-400">Estimated Arrival</div>
                <div className="font-mono text-slate-200 mt-0.5">
                  {formatDateTime(viewingTrip.estimatedArrivalTime)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Actual Arrival</div>
                <div className="font-mono text-slate-200 mt-0.5">
                  {formatDateTime(viewingTrip.actualArrivalTime)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Calculated Delay</div>
                <div className="font-mono font-semibold text-slate-200 mt-0.5">
                  {viewingTrip.delayMinutes > 0
                    ? `${formatDelayMinutes(viewingTrip.delayMinutes)} (${viewingTrip.delayReason ?? 'Pending'})`
                    : 'None'}
                </div>
              </div>
              <div className="col-span-2 border-t border-sky-400/20 pt-4">
                <div className="text-slate-400 mb-1">Trip Expenses Breakdown</div>
                <div className="grid grid-cols-4 gap-2 font-mono">
                  <div>
                    <div className="text-[11px] text-slate-400">Fuel</div>
                    <div className="font-semibold text-slate-100">{formatCurrency(viewingTrip.fuelCost)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Tolls</div>
                    <div className="font-semibold text-slate-100">{formatCurrency(viewingTrip.tollCost)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Other</div>
                    <div className="font-semibold text-slate-100">{formatCurrency(viewingTrip.otherExpenses)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Total</div>
                    <div className="font-bold text-[#38BDF8]">
                      {formatCurrency(viewingTrip.expenses)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-2 border-t border-sky-400/20 pt-4">
                <div className="text-slate-400 mb-1">Notes</div>
                <p className="text-slate-200">
                  {viewingTrip.notes || 'No dispatch notes attached.'}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
