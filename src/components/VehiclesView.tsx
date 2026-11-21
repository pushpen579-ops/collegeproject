import {
  ArrowUpDown,
  CheckCircle2,
  ClipboardPaste,
  Eye,
  FileUp,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiRequest, formatCurrency } from '../lib/api.ts';
import type { Driver, RtoLookupResult, UserRole, Vehicle, VehicleStatus } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { ScrollReveal } from './ScrollReveal.tsx';
import { StatusLabel } from './StatusLabel.tsx';

interface VehiclesViewProps {
  role: UserRole;
  vehicles: Vehicle[];
  drivers: Driver[];
  onRefresh: () => Promise<void>;
}

interface ParsedRcResponse {
  registrationNumber?: string;
  rtoCode?: string;
  rtoState?: string;
  rtoOffice?: string;
  fieldsPopulated: number;
  fields: RtoLookupResult['fields'];
}

const STANDARD_FUEL_OPTIONS = ['Diesel', 'Petrol', 'CNG', 'Electric', 'LNG'];

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const createEmptyVehicleForm = () => ({
  registrationNumber: '',
  vehicleType: 'Commercial Vehicle',
  manufacturer: '',
  model: '',
  year: new Date().getFullYear(),
  fuelType: 'Diesel',
  capacity: '',
  assignedDriverId: '',
  status: 'Available' as VehicleStatus,
  insuranceProvider: '',
  insurancePolicyNumber: '',
  insuranceExpiryDate: '',
  registrationDate: '',
  registrationExpiryDate: '',
  fitnessExpiryDate: '',
  pucExpiryDate: '',
  permitExpiryDate: '',
  chassisNumber: '',
  engineNumber: '',
  rtoCode: '',
  rtoState: '',
  rtoOffice: '',
  odometerKm: 0,
});

export function VehiclesView({ role, vehicles, drivers, onRefresh }: VehiclesViewProps) {
  const canEdit = role === 'owner' || role === 'admin';
  const canLogMaintenance = role === 'owner' || role === 'admin' || role === 'manager';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VehicleStatus>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(createEmptyVehicleForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // RTO Lookup & Bulk Sync state
  const [rtoLoading, setRtoLoading] = useState(false);
  const [rtoInfo, setRtoInfo] = useState<RtoLookupResult | null>(null);
  const [syncingAllRto, setSyncingAllRto] = useState(false);
  const [bulkSyncNotice, setBulkSyncNotice] = useState<string | null>(null);
  const [syncingDrawerRto, setSyncingDrawerRto] = useState(false);
  const [drawerSyncNotice, setDrawerSyncNotice] = useState<string | null>(null);

  // mParivahan / RC Text Paste Parser state
  const [showRcPaste, setShowRcPaste] = useState(false);
  const [rcRawText, setRcRawText] = useState('');
  const [parsingRc, setParsingRc] = useState(false);
  const [rcParseNotice, setRcParseNotice] = useState<string | null>(null);

  // Maintenance form state inside detail drawer
  const [maintForm, setMaintForm] = useState({
    date: getTodayIso(),
    type: '',
    description: '',
    cost: '',
    vendor: '',
    nextServiceDue: '',
    setVehicleStatus: '' as '' | VehicleStatus,
  });

  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const applyRtoFieldsToForm = useCallback(
    (payload: {
      registrationNumber?: string;
      rtoCode?: string;
      rtoState?: string;
      rtoOffice?: string;
      fields: RtoLookupResult['fields'];
    }) => {
      const f = payload.fields;
      setForm((prev) => ({
        ...prev,
        registrationNumber: payload.registrationNumber || prev.registrationNumber,
        rtoCode: payload.rtoCode || prev.rtoCode,
        rtoState: payload.rtoState || prev.rtoState,
        rtoOffice: payload.rtoOffice || prev.rtoOffice,
        vehicleType: f.vehicleType || prev.vehicleType,
        manufacturer: f.manufacturer || prev.manufacturer,
        model: f.model || prev.model,
        year: f.year || prev.year,
        fuelType: f.fuelType || prev.fuelType,
        capacity: f.capacity || prev.capacity,
        insuranceProvider: f.insuranceProvider || prev.insuranceProvider,
        insurancePolicyNumber: f.insurancePolicyNumber || prev.insurancePolicyNumber,
        insuranceExpiryDate: f.insuranceExpiryDate || prev.insuranceExpiryDate,
        registrationDate: f.registrationDate || prev.registrationDate,
        registrationExpiryDate: f.registrationExpiryDate || prev.registrationExpiryDate,
        fitnessExpiryDate: f.fitnessExpiryDate || prev.fitnessExpiryDate,
        pucExpiryDate: f.pucExpiryDate || prev.pucExpiryDate,
        permitExpiryDate: f.permitExpiryDate || prev.permitExpiryDate,
        chassisNumber: f.chassisNumber || prev.chassisNumber,
        engineNumber: f.engineNumber || prev.engineNumber,
      }));
    },
    [],
  );

  const runRtoLookup = useCallback(
    async (regInput: string, applyToForm = true) => {
      const cleaned = regInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleaned.length < 4) {
        setRtoInfo(null);
        return;
      }
      setRtoLoading(true);
      try {
        const res = await apiRequest<{ rto: RtoLookupResult }>(
          `/api/rto/lookup/${encodeURIComponent(cleaned)}`,
        );
        setRtoInfo(res.rto);
        if (applyToForm) {
          applyRtoFieldsToForm(res.rto);
        }
      } catch {
        // Ignore transient lookup errors while typing
      } finally {
        setRtoLoading(false);
      }
    },
    [applyRtoFieldsToForm],
  );

  // Debounced auto-lookup while typing registration number in Add/Edit modal
  useEffect(() => {
    if (!modalOpen || !canEdit) return;
    const cleaned = form.registrationNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 4) {
      setRtoInfo(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void runRtoLookup(cleaned, true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [modalOpen, canEdit, form.registrationNumber, runRtoLookup]);

  const handleParseRcText = async (overrideText?: string) => {
    const targetText = (overrideText ?? rcRawText).trim();
    if (!targetText) return;
    setParsingRc(true);
    setRcParseNotice(null);
    setFormError(null);
    try {
      const res = await apiRequest<{ parsed: ParsedRcResponse }>('/api/rto/parse-rc', {
        method: 'POST',
        body: JSON.stringify({ rawText: targetText }),
      });
      applyRtoFieldsToForm(res.parsed);
      setRcParseNotice(
        res.parsed.fieldsPopulated > 0
          ? `Extracted ${res.parsed.fieldsPopulated} RC field(s) automatically into the vehicle form.`
          : 'No matching RC fields detected in document. Verify labels (Maker, Model, Policy No, Registration Date, etc.).',
      );
      if (res.parsed.fieldsPopulated > 0) {
        setShowRcPaste(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to parse RC document text.');
    } finally {
      setParsingRc(false);
    }
  };

  const handleRcFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setRcRawText(content);
      if (content.trim()) {
        void handleParseRcText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncAllRto = async () => {
    setSyncingAllRto(true);
    setBulkSyncNotice(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/vehicles/sync-all-rto', {
        method: 'POST',
      });
      await onRefresh();
      setBulkSyncNotice(res.message);
    } catch (err) {
      setBulkSyncNotice(err instanceof Error ? err.message : 'Unable to sync fleet RTO records.');
    } finally {
      setSyncingAllRto(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles
      .filter((v) => {
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        if (!q) return true;
        const driverName = v.assignedDriverId
          ? driverMap.get(v.assignedDriverId)?.name.toLowerCase() ?? ''
          : '';
        return (
          v.registrationNumber.toLowerCase().includes(q) ||
          v.manufacturer.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.vehicleType.toLowerCase().includes(q) ||
          (v.insurancePolicyNumber ?? '').toLowerCase().includes(q) ||
          (v.rtoOffice ?? '').toLowerCase().includes(q) ||
          (v.rtoState ?? '').toLowerCase().includes(q) ||
          driverName.includes(q)
        );
      })
      .sort((a, b) =>
        sortAsc
          ? a.registrationNumber.localeCompare(b.registrationNumber)
          : b.registrationNumber.localeCompare(a.registrationNumber),
      );
  }, [vehicles, statusFilter, search, sortAsc, driverMap]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setForm(createEmptyVehicleForm());
    setRtoInfo(null);
    setShowRcPaste(false);
    setRcRawText('');
    setRcParseNotice(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setRtoInfo(null);
    setShowRcPaste(false);
    setRcRawText('');
    setRcParseNotice(null);
    setForm({
      registrationNumber: v.registrationNumber,
      vehicleType: v.vehicleType || 'Commercial Vehicle',
      manufacturer: v.manufacturer,
      model: v.model,
      year: v.year,
      fuelType: v.fuelType || 'Diesel',
      capacity: v.capacity,
      assignedDriverId: v.assignedDriverId ?? '',
      status: v.status,
      insuranceProvider: v.insuranceProvider,
      insurancePolicyNumber: v.insurancePolicyNumber,
      insuranceExpiryDate: v.insuranceExpiryDate,
      registrationDate: v.registrationDate,
      registrationExpiryDate: v.registrationExpiryDate,
      fitnessExpiryDate: v.fitnessExpiryDate ?? '',
      pucExpiryDate: v.pucExpiryDate ?? '',
      permitExpiryDate: v.permitExpiryDate ?? '',
      chassisNumber: v.chassisNumber ?? '',
      engineNumber: v.engineNumber ?? '',
      rtoCode: v.rtoCode ?? '',
      rtoState: v.rtoState ?? '',
      rtoOffice: v.rtoOffice ?? '',
      odometerKm: v.odometerKm,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const regCleaned = form.registrationNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!regCleaned) {
      setFormError('Vehicle registration number is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        registrationNumber: regCleaned,
        assignedDriverId: form.assignedDriverId || null,
      };
      if (editingVehicle) {
        await apiRequest(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    try {
      await apiRequest(`/api/vehicles/${v.id}`, { method: 'DELETE' });
      if (viewingVehicle?.id === v.id) setViewingVehicle(null);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete vehicle.');
    }
  };

  const handleSyncDrawerRto = async (vehicleId: string) => {
    setSyncingDrawerRto(true);
    setDrawerSyncNotice(null);
    try {
      const res = await apiRequest<{ vehicle: Vehicle; rto: RtoLookupResult }>(
        `/api/vehicles/${vehicleId}/sync-rto`,
        { method: 'POST' },
      );
      setViewingVehicle(res.vehicle);
      setDrawerSyncNotice(res.rto.message);
      await onRefresh();
    } finally {
      setSyncingDrawerRto(false);
    }
  };

  const handleAddMaintenance = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewingVehicle || !maintForm.type.trim() || !maintForm.description.trim()) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ vehicle: Vehicle }>(
        `/api/vehicles/${viewingVehicle.id}/maintenance`,
        {
          method: 'POST',
          body: JSON.stringify({
            date: maintForm.date,
            type: maintForm.type,
            description: maintForm.description,
            cost: Number(maintForm.cost) || 0,
            vendor: maintForm.vendor || 'Fleet Workshop',
            nextServiceDue: maintForm.nextServiceDue || undefined,
            setVehicleStatus: maintForm.setVehicleStatus || undefined,
          }),
        },
      );
      setViewingVehicle(res.vehicle);
      setMaintForm({
        date: getTodayIso(),
        type: '',
        description: '',
        cost: '',
        vendor: '',
        nextServiceDue: '',
        setVehicleStatus: '',
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <FeatureBanner
        imageSrc="/src/assets/images/bg_vehicles_fleet_yard_1795256519749.jpg"
        imageAlt="Commercial transport trucks inside fleet maintenance and inspection bay"
        title={canEdit ? 'Vehicle Fleet Management' : 'My Assigned Vehicle'}
        subtitle={
          canEdit
            ? 'RTO-based registration, make/model, insurance policy, registration validity & maintenance logs'
            : 'Assigned vehicle registration, RTO office, insurance policy, and workshop logs'
        }
      >
        {canLogMaintenance && vehicles.length > 0 && (
          <button
            type="button"
            disabled={syncingAllRto}
            onClick={() => void handleSyncAllRto()}
            className="ff-btn-warning h-9 px-3.5 text-xs shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAllRto ? 'animate-spin' : ''}`} />
            <span>{syncingAllRto ? 'Syncing Fleet RTO...' : 'Sync All RTO'}</span>
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={openAddModal}
            className="ff-btn-royal h-9 px-4 text-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Vehicle by RTO No.</span>
          </button>
        )}
      </FeatureBanner>

      {bulkSyncNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-sky-400/30 bg-[#0B1D36]/90 px-4 py-3 text-xs font-medium text-sky-200">
          <span>{bulkSyncNotice}</span>
          <button
            type="button"
            onClick={() => setBulkSyncNotice(null)}
            className="ff-btn-secondary h-6 w-6 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <ScrollReveal delay={0.05}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate, make, policy no, RTO office..."
              className="ff-input h-9 pl-9 text-xs"
            />
          </div>

          <div className="ff-tab-bar">
            {(['all', 'Available', 'On Trip', 'Maintenance'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'bg-[#183B60]/70 text-slate-200 hover:bg-[#183B60] hover:text-white'
                }`}
              >
                {status === 'all' ? 'All Vehicles' : status}
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
                <th className="px-4 py-3 font-bold">
                  <button
                    type="button"
                    onClick={() => setSortAsc((s) => !s)}
                    className="ff-btn-secondary h-7 px-2.5 text-[11px]"
                  >
                    <span>Registration &amp; RTO</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-bold">Make, Model &amp; Specs</th>
                <th className="px-4 py-3 font-bold">Assigned Driver</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Insurance Policy</th>
                <th className="px-4 py-3 font-bold">Registration Validity</th>
                <th className="px-4 py-3 font-bold text-right">Odometer</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-400/12">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-300">
                      {vehicles.length === 0
                        ? canEdit
                          ? 'No vehicles added yet'
                          : 'No vehicle assigned to you yet'
                        : 'No vehicles match the active search or status filter.'}
                    </p>
                    {vehicles.length === 0 && canEdit && (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="ff-btn-royal mt-3 h-9 px-4 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add First Vehicle</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const driver = v.assignedDriverId ? driverMap.get(v.assignedDriverId) : null;
                  const insDaysLeft = v.insuranceExpiryDate
                    ? Math.ceil((new Date(v.insuranceExpiryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  const makeModel = `${v.manufacturer} ${v.model}`.trim();
                  return (
                    <tr key={v.id} className="ff-table-row transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-white">
                          {v.registrationNumber}
                        </div>
                        {(v.rtoOffice || v.rtoState) && (
                          <div className="text-[11px] text-slate-400">
                            {v.rtoCode ? `${v.rtoCode} · ` : ''}
                            {v.rtoOffice ?? v.rtoState}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">
                          {makeModel ? `${makeModel} (${v.year})` : v.vehicleType}
                        </div>
                        <div className="text-slate-400">
                          {v.vehicleType}
                          {v.fuelType ? ` · ${v.fuelType}` : ''}
                          {v.capacity ? ` · ${v.capacity}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {driver ? driver.name : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={v.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {v.insuranceExpiryDate || v.insuranceProvider || v.insurancePolicyNumber ? (
                          <div>
                            <div className="font-mono tabular-nums">
                              {v.insuranceExpiryDate ? (
                                <>
                                  <span
                                    className={
                                      insDaysLeft !== null && insDaysLeft <= 30
                                        ? 'text-red-400 font-semibold'
                                        : 'text-slate-200'
                                    }
                                  >
                                    Exp: {v.insuranceExpiryDate}
                                  </span>
                                  {insDaysLeft !== null && insDaysLeft <= 30 && (
                                    <span className="ml-1.5 text-[11px] font-semibold text-red-400">
                                      ({insDaysLeft}d)
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-200">Active Policy</span>
                              )}
                            </div>
                            {(v.insuranceProvider || v.insurancePolicyNumber) && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[190px]">
                                {[v.insuranceProvider, v.insurancePolicyNumber].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap text-slate-300">
                        {v.registrationDate || v.registrationExpiryDate ? (
                          <div>
                            <div>Exp: {v.registrationExpiryDate || '—'}</div>
                            {v.registrationDate && (
                              <div className="text-[11px] text-slate-400">
                                Reg: {v.registrationDate}
                              </div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {v.odometerKm.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerSyncNotice(null);
                              setViewingVehicle(v);
                            }}
                            title="View Details & Maintenance"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xs transition-all hover:bg-[#1D4ED8] hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(v)}
                                title="Edit Vehicle"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-[#142B4A] shadow-xs transition-all hover:bg-[#D97706] hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(v)}
                                title="Delete Vehicle"
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

      {/* RTO-Based Add/Edit Modal */}
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
            className="ff-modal w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  {editingVehicle
                    ? `Edit Vehicle ${editingVehicle.registrationNumber}`
                    : 'Add Vehicle by RTO Registration Number'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auto-resolves RTO office &amp; state, and syncs maker, model, insurance policy, registration, fitness, PUC &amp; chassis from connected Vahan API or uploaded/pasted RC
                </p>
              </div>
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

            <form onSubmit={handleSave} className="mt-4 space-y-5 text-xs">
              {/* Primary RTO Registration Box */}
              <div className="ff-subcard p-4 space-y-3 border-sky-400/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-white">
                    RTO Registration Number *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRcPaste((v) => !v)}
                    className="ff-btn-royal h-7 px-3 text-[11px]"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>{showRcPaste ? 'Hide RC Importer' : 'Upload / Paste RC Document'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    required
                    value={form.registrationNumber}
                    onChange={(e) =>
                      setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. MH12AB1234"
                    className="ff-input h-10 flex-1 font-mono text-sm font-bold uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    disabled={rtoLoading || form.registrationNumber.trim().length < 4}
                    onClick={() => void runRtoLookup(form.registrationNumber, true)}
                    className="ff-btn-primary h-10 px-4 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rtoLoading ? 'animate-spin' : ''}`} />
                    <span>{rtoLoading ? 'Fetching RTO...' : 'Fetch RTO Details'}</span>
                  </button>
                </div>

                {showRcPaste && (
                  <div className="ff-subcard p-3.5 space-y-3">
                    <label className="ff-upload-zone flex flex-col items-center justify-center gap-1.5 px-4 py-4 text-center cursor-pointer transition-colors">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xs">
                        <FileUp className="h-4.5 w-4.5" />
                      </span>
                      <span className="text-xs font-bold text-white">
                        Upload mParivahan / DigiLocker RC Export (.txt, .json, .csv)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Click to select an exported RC file or paste RC details directly below
                      </span>
                      <input
                        type="file"
                        accept=".txt,.json,.csv,.html,.xml,text/plain,application/json"
                        onChange={handleRcFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <textarea
                      rows={4}
                      value={rcRawText}
                      onChange={(e) => setRcRawText(e.target.value)}
                      placeholder={
                        'Example:\nRegistration No: MH12AB1234\nMaker Name: TATA MOTORS LTD\nModel: PRIMA 5530.S\nVehicle Class: Goods Carrier\nFuel Type: DIESEL\nRegistration Date: 15-03-2023\nInsurance Company: New India Assurance\nPolicy No: NIA-99887766\nInsurance Valid Upto: 14-03-2027'
                      }
                      className="ff-textarea font-mono text-[11px]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        Extracts Maker, Model, Year, Fuel, Policy, Registration, Fitness, PUC, Chassis &amp; Engine.
                      </span>
                      <button
                        type="button"
                        disabled={parsingRc || !rcRawText.trim()}
                        onClick={() => void handleParseRcText()}
                        className="ff-btn-royal h-8 px-3.5 text-[11px]"
                      >
                        <span>{parsingRc ? 'Extracting...' : 'Extract & Fill All Fields'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {rcParseNotice && (
                  <div className="rounded-lg border border-emerald-400/35 bg-emerald-950/60 px-3 py-2 text-[11px] text-emerald-300">
                    {rcParseNotice}
                  </div>
                )}

                {rtoInfo && (
                  <div className="ff-subcard p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        {rtoInfo.validFormat ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 text-[#38BDF8]" />
                        )}
                        <span>
                          {rtoInfo.rtoCode ? `${rtoInfo.rtoCode} · ${rtoInfo.rtoOffice}` : 'RTO Check'}
                        </span>
                      </div>
                      <span className="font-semibold text-[11px] text-[#38BDF8]">
                        {rtoInfo.source === 'live_api'
                          ? 'Live Vahan RC Connected'
                          : rtoInfo.rtoState || 'RTO Resolver'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {rtoInfo.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Section 1: RTO Authority & Specifications */}
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#38BDF8]">
                  RTO Authority &amp; Vehicle Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      RTO Code
                    </label>
                    <input
                      value={form.rtoCode}
                      onChange={(e) => setForm({ ...form, rtoCode: e.target.value })}
                      placeholder="e.g. MH-12"
                      className="ff-input h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      RTO Office
                    </label>
                    <input
                      value={form.rtoOffice}
                      onChange={(e) => setForm({ ...form, rtoOffice: e.target.value })}
                      placeholder="Auto-filled from plate"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      RTO State
                    </label>
                    <input
                      value={form.rtoState}
                      onChange={(e) => setForm({ ...form, rtoState: e.target.value })}
                      placeholder="Auto-filled from plate"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Manufacturer
                    </label>
                    <input
                      value={form.manufacturer}
                      onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      placeholder="e.g. Tata Motors"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Model
                    </label>
                    <input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="e.g. Prima 5530.S"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Mfg Year
                    </label>
                    <input
                      type="number"
                      min={1980}
                      max={new Date().getFullYear() + 1}
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                      className="ff-input h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Vehicle Type / Class
                    </label>
                    <input
                      value={form.vehicleType}
                      onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                      placeholder="Commercial Vehicle"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Fuel Type
                    </label>
                    <select
                      value={form.fuelType}
                      onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
                      className="ff-input h-9 text-xs"
                    >
                      {!STANDARD_FUEL_OPTIONS.includes(form.fuelType) && form.fuelType && (
                        <option value={form.fuelType}>{form.fuelType}</option>
                      )}
                      {STANDARD_FUEL_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Capacity / GVW
                    </label>
                    <input
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                      placeholder="e.g. 28,000 kg GVW"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Insurance Policy & Registration Validity */}
              <div className="space-y-3 border-t border-sky-400/20 pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#38BDF8]">
                  Insurance Policy, Registration &amp; RTO Compliance
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Insurance Provider
                    </label>
                    <input
                      value={form.insuranceProvider}
                      onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                      placeholder="e.g. New India Assurance"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Policy Number
                    </label>
                    <input
                      value={form.insurancePolicyNumber}
                      onChange={(e) => setForm({ ...form, insurancePolicyNumber: e.target.value })}
                      placeholder="Policy number"
                      className="ff-input h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Insurance Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.insuranceExpiryDate}
                      onChange={(e) => setForm({ ...form, insuranceExpiryDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Registration Date
                    </label>
                    <input
                      type="date"
                      value={form.registrationDate}
                      onChange={(e) => setForm({ ...form, registrationDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Registration Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.registrationExpiryDate}
                      onChange={(e) => setForm({ ...form, registrationExpiryDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Fitness Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.fitnessExpiryDate}
                      onChange={(e) => setForm({ ...form, fitnessExpiryDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      PUC Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.pucExpiryDate}
                      onChange={(e) => setForm({ ...form, pucExpiryDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Permit Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.permitExpiryDate}
                      onChange={(e) => setForm({ ...form, permitExpiryDate: e.target.value })}
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Chassis Number
                    </label>
                    <input
                      value={form.chassisNumber}
                      onChange={(e) => setForm({ ...form, chassisNumber: e.target.value.toUpperCase() })}
                      placeholder="VIN / Chassis No."
                      className="ff-input h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Engine Number
                    </label>
                    <input
                      value={form.engineNumber}
                      onChange={(e) => setForm({ ...form, engineNumber: e.target.value.toUpperCase() })}
                      placeholder="Engine No."
                      className="ff-input h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Assigned Driver
                    </label>
                    <select
                      value={form.assignedDriverId}
                      onChange={(e) => setForm({ ...form, assignedDriverId: e.target.value })}
                      className="ff-input h-9 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.licenceClass})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-200 mb-1">
                      Status &amp; Odometer (km)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
                        className="ff-select h-9 flex-1 px-2 text-xs"
                      >
                        <option value="Available">Available</option>
                        <option value="On Trip">On Trip</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={form.odometerKm}
                        onChange={(e) => setForm({ ...form, odometerKm: Number(e.target.value) })}
                        className="ff-input h-9 w-24 px-2 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-sky-400/20">
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
                  {saving ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Vehicle Detail & Maintenance Drawer */}
      <AnimatePresence>
      {viewingVehicle && (
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
            className="ff-drawer w-full max-w-xl h-full overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between border-b border-sky-400/20 pb-4">
              <div>
                <div className="font-mono text-xs text-slate-400">
                  {viewingVehicle.id} · {viewingVehicle.vehicleType}
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-white">
                  {viewingVehicle.registrationNumber}
                  {viewingVehicle.manufacturer || viewingVehicle.model
                    ? ` — ${viewingVehicle.manufacturer} ${viewingVehicle.model}`.trim()
                    : ''}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusLabel status={viewingVehicle.status} />
                  {viewingVehicle.rtoSource && (
                    <span className="rounded-md border border-sky-400/25 bg-[#183B60]/70 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                      {viewingVehicle.rtoSource === 'live_api'
                        ? 'Live Vahan RC'
                        : viewingVehicle.rtoSource === 'rto_code'
                          ? 'RTO Office Resolved'
                          : 'Manual Entry'}
                    </span>
                  )}
                  {canLogMaintenance && (
                    <button
                      type="button"
                      disabled={syncingDrawerRto}
                      onClick={() => void handleSyncDrawerRto(viewingVehicle.id)}
                      className="ff-btn-royal h-7 px-2.5 text-[11px]"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncingDrawerRto ? 'animate-spin' : ''}`} />
                      <span>{syncingDrawerRto ? 'Syncing RTO...' : 'Sync RTO'}</span>
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingVehicle(null)}
                className="ff-btn-secondary h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drawerSyncNotice && (
              <div className="mt-4 rounded-lg border border-sky-400/30 bg-[#0B1D36]/90 px-3 py-2 text-xs text-sky-200">
                {drawerSyncNotice}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 text-xs border-b border-sky-400/20 pb-5">
              <div>
                <div className="text-slate-400">RTO Office &amp; State</div>
                <div className="mt-0.5 font-semibold text-white">
                  {viewingVehicle.rtoOffice || '—'}
                </div>
                <div className="text-slate-400">
                  {viewingVehicle.rtoCode ? `${viewingVehicle.rtoCode} · ` : ''}
                  {viewingVehicle.rtoState || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Manufacturer, Model &amp; Year</div>
                <div className="mt-0.5 font-semibold text-white">
                  {`${viewingVehicle.manufacturer} ${viewingVehicle.model}`.trim() || '—'}
                </div>
                <div className="text-slate-400">
                  {viewingVehicle.year ? `Mfg ${viewingVehicle.year} · ` : ''}
                  {viewingVehicle.fuelType || '—'}
                  {viewingVehicle.capacity ? ` · ${viewingVehicle.capacity}` : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Assigned Driver</div>
                <div className="mt-0.5 font-semibold text-white">
                  {viewingVehicle.assignedDriverId
                    ? driverMap.get(viewingVehicle.assignedDriverId)?.name ?? 'Unassigned'
                    : 'Unassigned'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Registration Validity</div>
                <div className="mt-0.5 font-mono text-white">
                  Reg: {viewingVehicle.registrationDate || '—'}
                </div>
                <div className="font-mono text-slate-400">
                  Exp: {viewingVehicle.registrationExpiryDate || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Insurance Policy</div>
                <div className="mt-0.5 font-medium text-white">
                  {viewingVehicle.insuranceProvider || '—'}
                </div>
                <div className="font-mono text-slate-400">
                  {viewingVehicle.insurancePolicyNumber || '—'}
                  {viewingVehicle.insuranceExpiryDate
                    ? ` · Exp ${viewingVehicle.insuranceExpiryDate}`
                    : ''}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Fitness, PUC &amp; Permit</div>
                <div className="mt-0.5 font-mono text-slate-300 space-y-0.5">
                  <div>Fitness: {viewingVehicle.fitnessExpiryDate || '—'}</div>
                  <div>PUC: {viewingVehicle.pucExpiryDate || '—'}</div>
                  <div>Permit: {viewingVehicle.permitExpiryDate || '—'}</div>
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-slate-400">Chassis &amp; Engine Number</div>
                <div className="mt-0.5 font-mono text-slate-200">
                  Chassis: {viewingVehicle.chassisNumber || '—'} · Engine:{' '}
                  {viewingVehicle.engineNumber || '—'}
                </div>
                {viewingVehicle.rtoLastSyncedAt && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Last RTO check: {new Date(viewingVehicle.rtoLastSyncedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Maintenance History */}
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#38BDF8]" />
                <h3 className="font-display text-sm font-bold text-white">
                  Maintenance History ({viewingVehicle.maintenanceHistory.length})
                </h3>
              </div>

              {viewingVehicle.maintenanceHistory.length === 0 ? (
                <p className="text-xs text-slate-400">No maintenance logs recorded yet.</p>
              ) : (
                <div className="divide-y divide-sky-400/15 border-t border-b border-sky-400/20">
                  {viewingVehicle.maintenanceHistory.map((m) => (
                    <div key={m.id} className="py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {m.type}
                        </span>
                        <span className="font-mono font-semibold text-[#38BDF8]">
                          {formatCurrency(m.cost)}
                        </span>
                      </div>
                      <p className="text-slate-300">{m.description}</p>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {m.date} · {m.vendor}
                        {m.nextServiceDue ? ` · Next due: ${m.nextServiceDue}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canLogMaintenance && (
                <form
                  onSubmit={handleAddMaintenance}
                  className="pt-3 space-y-3 border-t border-sky-400/20 text-xs"
                >
                  <div className="font-semibold text-white">
                    Log Workshop Maintenance
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      value={maintForm.type}
                      onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })}
                      placeholder="Service Type (e.g. Brake Overhaul)"
                      className="ff-input h-9 text-xs"
                    />
                    <input
                      type="date"
                      value={maintForm.date}
                      onChange={(e) => setMaintForm({ ...maintForm, date: e.target.value })}
                      className="ff-input h-9 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={maintForm.cost}
                      onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                      placeholder="Cost (₹)"
                      className="ff-input h-9 font-mono text-xs"
                    />
                    <input
                      value={maintForm.vendor}
                      onChange={(e) => setMaintForm({ ...maintForm, vendor: e.target.value })}
                      placeholder="Vendor / Workshop"
                      className="ff-input h-9 text-xs"
                    />
                  </div>
                  <textarea
                    required
                    rows={2}
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    placeholder="Parts replaced, inspection findings..."
                    className="ff-textarea text-xs"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={maintForm.setVehicleStatus}
                      onChange={(e) =>
                        setMaintForm({
                          ...maintForm,
                          setVehicleStatus: e.target.value as '' | VehicleStatus,
                        })
                      }
                      className="ff-select h-9 w-auto text-xs"
                    >
                      <option value="">Keep current status ({viewingVehicle.status})</option>
                      <option value="Maintenance">Set status: Maintenance</option>
                      <option value="Available">Set status: Available</option>
                    </select>
                    <button
                      type="submit"
                      disabled={saving}
                      className="ff-btn-primary h-9 px-4 text-xs"
                    >
                      Save Maintenance
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
