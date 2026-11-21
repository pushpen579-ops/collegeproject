import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  apiRequest,
  formatCurrency,
  formatDateTime,
  formatDelayMinutes,
  formatSalaryTypeLabel,
} from '../lib/api.ts';
import type { Driver, SalaryType, UserRole, Vehicle } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';

interface DriversViewProps {
  role: UserRole;
  drivers: Driver[];
  vehicles: Vehicle[];
  onRefresh: () => Promise<void>;
}

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const createEmptyDriver = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  licenceNumber: '',
  licenceClass: 'Class A CDL',
  licenceExpiryDate: '',
  assignedVehicleId: '',
  joiningDate: getTodayIso(),
  salaryType: 'fixed_plus_allowance' as SalaryType,
  basicSalary: 0,
  tripAllowanceRate: 0,
  overtimeRatePerHour: 0,
  nightAllowanceRate: 0,
  status: 'Active' as Driver['status'],
  loginPassword: '',
});

export function DriversView({ role, drivers, vehicles, onRefresh }: DriversViewProps) {
  const canEdit = role === 'owner' || role === 'admin';
  const [search, setSearch] = useState('');
  const [salaryFilter, setSalaryFilter] = useState<'all' | SalaryType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [profileDriver, setProfileDriver] = useState<Driver | null>(null);
  const [profileTab, setProfileTab] = useState<'trips' | 'salaries'>('trips');
  const [form, setForm] = useState(createEmptyDriver);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (salaryFilter !== 'all' && d.salaryType !== salaryFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.licenceNumber.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q)
      );
    });
  }, [drivers, salaryFilter, search]);

  const openAdd = () => {
    setEditingDriver(null);
    setForm(createEmptyDriver());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (d: Driver) => {
    setEditingDriver(d);
    setForm({
      name: d.name,
      phone: d.phone,
      email: d.email,
      address: d.address,
      licenceNumber: d.licenceNumber,
      licenceClass: d.licenceClass,
      licenceExpiryDate: d.licenceExpiryDate,
      assignedVehicleId: d.assignedVehicleId ?? '',
      joiningDate: d.joiningDate,
      salaryType: d.salaryType,
      basicSalary: d.basicSalary,
      tripAllowanceRate: d.tripAllowanceRate,
      overtimeRatePerHour: d.overtimeRatePerHour,
      nightAllowanceRate: d.nightAllowanceRate,
      status: d.status,
      loginPassword: '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.phone.trim() || !form.licenceNumber.trim()) {
      setFormError('Driver name, phone number, and driving licence number are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        assignedVehicleId: form.assignedVehicleId || null,
        loginPassword: form.loginPassword.trim() || undefined,
      };
      if (editingDriver) {
        await apiRequest(`/api/drivers/${editingDriver.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/drivers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save driver.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Driver) => {
    await apiRequest(`/api/drivers/${d.id}`, { method: 'DELETE' });
    if (profileDriver?.id === d.id) setProfileDriver(null);
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_drivers_highway_crew_1795256519728.jpg"
        imageAlt="Commercial transport trucks lined up at highway dispatch gate"
        title="Driver Roster & Profiles"
        subtitle="Licences, compensation rules, performance history, and individual trip ledgers"
      >
        {canEdit && (
          <button
            type="button"
            onClick={openAdd}
            className="ff-btn-royal h-9 px-4 text-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Driver</span>
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
              placeholder="Search name, phone, licence, address..."
              className="ff-input h-9 pl-9 text-xs"
            />
          </div>

          <div className="ff-tab-bar">
            {(
              [
                { id: 'all', label: 'All Types' },
                { id: 'fixed', label: 'Fixed' },
                { id: 'per_trip', label: 'Per Trip' },
                { id: 'fixed_plus_allowance', label: 'Fixed + Allowance' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSalaryFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  salaryFilter === tab.id
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'bg-[#183B60]/70 text-slate-200 hover:bg-[#183B60] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Table */}
      <ScrollReveal delay={0.08} className="ff-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="ff-table-head">
              <tr>
                <th className="px-4 py-3 font-bold">Driver</th>
                <th className="px-4 py-3 font-bold">Licence &amp; Expiry</th>
                <th className="px-4 py-3 font-bold">Assigned Vehicle</th>
                <th className="px-4 py-3 font-bold">Pay Structure</th>
                <th className="px-4 py-3 font-bold text-right">Completed</th>
                <th className="px-4 py-3 font-bold text-right">Delayed</th>
                <th className="px-4 py-3 font-bold text-right">On-Time %</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-400/12">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-300">
                      {drivers.length === 0
                        ? 'No drivers added yet'
                        : 'No drivers match your filter.'}
                    </p>
                    {drivers.length === 0 && canEdit && (
                      <button
                        type="button"
                        onClick={openAdd}
                        className="ff-btn-royal mt-3 h-9 px-4 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add First Driver</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const vehicle = d.assignedVehicleId ? vehicleMap.get(d.assignedVehicleId) : null;
                  const licDaysLeft = d.licenceExpiryDate
                    ? Math.ceil((new Date(d.licenceExpiryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <tr key={d.id} className="ff-table-row transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">
                          {d.name}
                        </div>
                        <div className="font-mono text-slate-400">
                          {d.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-100">{d.licenceNumber}</div>
                        <div
                          className={
                            licDaysLeft !== null && licDaysLeft <= 30
                              ? 'text-red-400 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          {d.licenceExpiryDate ? `Exp ${d.licenceExpiryDate}` : '—'}
                          {licDaysLeft !== null && licDaysLeft <= 30 ? ` (${licDaysLeft}d)` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#38BDF8] whitespace-nowrap">
                        {vehicle ? vehicle.registrationNumber : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">
                          {formatSalaryTypeLabel(d.salaryType)}
                        </div>
                        <div className="font-mono text-slate-400">
                          {d.salaryType !== 'per_trip'
                            ? `${formatCurrency(d.basicSalary)} base`
                            : `${formatCurrency(d.tripAllowanceRate)} / trip`}
                          {d.salaryType === 'fixed_plus_allowance'
                            ? ` + ${formatCurrency(d.tripAllowanceRate)}/trip`
                            : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-white">
                        {d.totalCompletedTrips ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-red-400">
                        {d.totalDelayedTrips ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                        {d.onTimeRate ?? 100}%
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileDriver(d);
                              setProfileTab('trips');
                            }}
                            title="Open Driver Profile"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xs transition-all hover:bg-[#1D4ED8] hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(d)}
                                title="Edit Driver"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-[#142B4A] shadow-xs transition-all hover:bg-[#D97706] hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(d)}
                                title="Delete Driver"
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

      {/* Add / Edit Modal */}
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
                {editingDriver ? `Edit Driver — ${editingDriver.name}` : 'Add New Driver'}
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

            <form onSubmit={handleSave} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Full Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Phone Number *
                </label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Email (for Driver Portal Login)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="driver@company.com"
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Driver Portal Password (Optional)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={form.loginPassword}
                  onChange={(e) => setForm({ ...form, loginPassword: e.target.value })}
                  placeholder={editingDriver ? 'Leave blank to keep existing' : 'Min 6 chars if setting login'}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Address
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Driving Licence Number *
                </label>
                <input
                  required
                  value={form.licenceNumber}
                  onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Licence Expiry Date *
                </label>
                <input
                  required
                  type="date"
                  value={form.licenceExpiryDate}
                  onChange={(e) => setForm({ ...form, licenceExpiryDate: e.target.value })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Assigned Vehicle
                </label>
                <select
                  value={form.assignedVehicleId}
                  onChange={(e) => setForm({ ...form, assignedVehicleId: e.target.value })}
                  className="ff-input h-9 text-xs"
                >
                  <option value="">Unassigned</option>
                  {vehicles.map((v) => {
                    const label =
                      `${v.manufacturer} ${v.model}`.trim() || v.rtoOffice || v.vehicleType;
                    return (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} — {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Salary Type
                </label>
                <select
                  value={form.salaryType}
                  onChange={(e) => setForm({ ...form, salaryType: e.target.value as SalaryType })}
                  className="ff-input h-9 text-xs"
                >
                  <option value="fixed">Fixed Monthly Salary</option>
                  <option value="per_trip">Payment Per Trip</option>
                  <option value="fixed_plus_allowance">Fixed Salary + Trip Allowance</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Basic Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={form.salaryType === 'per_trip'}
                  value={form.salaryType === 'per_trip' ? 0 : form.basicSalary}
                  onChange={(e) => setForm({ ...form, basicSalary: Number(e.target.value) })}
                  className="ff-input h-9 text-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  {form.salaryType === 'per_trip' ? 'Per-Trip Pay Rate (₹)' : 'Trip Allowance Rate (₹)'}
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={form.salaryType === 'fixed'}
                  value={form.salaryType === 'fixed' ? 0 : form.tripAllowanceRate}
                  onChange={(e) => setForm({ ...form, tripAllowanceRate: Number(e.target.value) })}
                  className="ff-input h-9 text-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Overtime Rate (₹/hr)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.overtimeRatePerHour}
                  onChange={(e) => setForm({ ...form, overtimeRatePerHour: Number(e.target.value) })}
                  className="ff-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Night Allowance (₹/trip)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.nightAllowanceRate}
                  onChange={(e) => setForm({ ...form, nightAllowanceRate: Number(e.target.value) })}
                  className="ff-input h-9 text-xs"
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
                  {saving ? 'Saving...' : editingDriver ? 'Update Driver' : 'Create Driver'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Driver Profile Drawer */}
      <AnimatePresence>
      {profileDriver && (
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
            className="ff-drawer w-full max-w-2xl h-full overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between border-b border-sky-400/20 pb-4">
              <div>
                <div className="font-mono text-xs text-slate-400">
                  {profileDriver.id} · Joined {profileDriver.joiningDate}
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-white">
                  {profileDriver.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {profileDriver.phone} · {profileDriver.address || 'No address on file'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileDriver(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-sky-400/20 pb-5">
              <div>
                <div className="text-slate-400">Licence</div>
                <div className="mt-0.5 font-mono font-semibold text-white">
                  {profileDriver.licenceNumber}
                </div>
                <div className="font-mono text-slate-400">Exp {profileDriver.licenceExpiryDate}</div>
              </div>
              <div>
                <div className="text-slate-400">Completed Trips</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-white">
                  {profileDriver.totalCompletedTrips ?? 0}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Delayed Trips</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-red-400">
                  {profileDriver.totalDelayedTrips ?? 0}
                </div>
              </div>
              <div>
                <div className="text-slate-400">On-Time Rate</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-emerald-400">
                  {profileDriver.onTimeRate ?? 100}%
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-5 flex items-center gap-2 border-b border-sky-400/20 pb-3">
              <button
                type="button"
                onClick={() => setProfileTab('trips')}
                className={`h-8 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer ${
                  profileTab === 'trips'
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
                }`}
              >
                Trip History ({profileDriver.tripHistory?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('salaries')}
                className={`h-8 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer ${
                  profileTab === 'salaries'
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
                }`}
              >
                Salary History ({profileDriver.salaryHistory?.length ?? 0})
              </button>
            </div>

            {profileTab === 'trips' ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-sky-400/20 text-[#38BDF8]">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Trip</th>
                      <th className="py-2 pr-3 font-semibold">Route</th>
                      <th className="py-2 pr-3 font-semibold">Departure</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 font-semibold text-right">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-400/12">
                    {(profileDriver.tripHistory ?? []).map((t) => (
                      <tr key={t.id} className="ff-table-row">
                        <td className="py-2.5 pr-3 font-mono font-medium text-white">{t.tripCode}</td>
                        <td className="py-2.5 pr-3 text-slate-200">
                          {t.startingLocation.split(',')[0]} → {t.destination.split(',')[0]}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400">
                          {formatDateTime(t.departureTime)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <StatusLabel status={t.status} />
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-200">
                          {t.delayMinutes > 0 ? formatDelayMinutes(t.delayMinutes) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-sky-400/20 text-[#38BDF8]">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Month</th>
                      <th className="py-2 pr-3 font-semibold text-right">Trips</th>
                      <th className="py-2 pr-3 font-semibold text-right">Basic + Allow.</th>
                      <th className="py-2 pr-3 font-semibold text-right">Final Payable</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-400/12">
                    {(profileDriver.salaryHistory ?? []).map((s) => (
                      <tr key={s.id} className="ff-table-row">
                        <td className="py-2.5 pr-3 font-mono font-medium text-white">{s.month}</td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-200">
                          {s.completedTrips}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-200">
                          {formatCurrency(s.basicSalary + s.tripAllowances + s.nightAllowances)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-[#38BDF8]">
                          {formatCurrency(s.finalPayableSalary)}
                        </td>
                        <td className="py-2.5">
                          <StatusLabel status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
