import 'dotenv/config';
import bcrypt from 'bcryptjs';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  authenticate,
  requireRole,
  sanitizeUser,
  signToken,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  buildNotifications,
  calculateDelayMinutes,
  calculateSalaryBreakdown,
  formatDelayDuration,
} from './server/calculations.ts';
import {
  lookupRtoVehicle,
  normalizeRegistrationNumber,
  parseRcDocumentText,
  type RtoLookupResult,
} from './server/rto.ts';
import { getDb, saveDb } from './server/store.ts';
import { generateSpeechBriefing } from './server/tts.ts';
import type {
  DelayReason,
  DelayRecord,
  Driver,
  MaintenanceRecord,
  SalaryRecord,
  Trip,
  TripStatus,
  Vehicle,
  VehicleLocation,
} from './server/types.ts';

const PORT = 3000;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Ensure DB is initialized at boot
  getDb();

  // ---------------- HEALTH ----------------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'FleetFlow API', timestamp: new Date().toISOString() });
  });

  // ---------------- AUTHENTICATION ----------------
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      role?: string;
      licenceNumber?: string;
      licenceExpiryDate?: string;
    };

    const name = body.name?.trim() || '';
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    const phone = body.phone?.trim() || '';
    const role = body.role === 'owner' ? 'owner' : body.role === 'driver' ? 'driver' : null;

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and account type (Owner or Driver) are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const db = getDb();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    let driverId: string | undefined;
    if (role === 'driver') {
      const existingDriver = db.drivers.find(
        (d) =>
          (d.email && d.email.toLowerCase() === email) ||
          (phone && d.phone && d.phone.trim() === phone),
      );
      if (existingDriver) {
        driverId = existingDriver.id;
        if (!existingDriver.email) existingDriver.email = email;
      } else {
        const newDriver: Driver = {
          id: generateId('DRV'),
          name,
          phone,
          email,
          address: '',
          licenceNumber: body.licenceNumber?.trim().toUpperCase() || '',
          licenceClass: 'Commercial',
          licenceExpiryDate: body.licenceExpiryDate || '',
          assignedVehicleId: null,
          joiningDate: new Date().toISOString().slice(0, 10),
          salaryType: 'fixed_plus_allowance',
          basicSalary: 0,
          tripAllowanceRate: db.salaryRules.defaultTripAllowance || 0,
          overtimeRatePerHour: db.salaryRules.defaultOvertimeRatePerHour || 0,
          nightAllowanceRate: db.salaryRules.defaultNightAllowancePerTrip || 0,
          status: 'Active',
        };
        db.drivers.unshift(newDriver);
        driverId = newDriver.id;
      }
    }

    const newUser = {
      id: generateId('USR'),
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
      driverId,
      phone: phone || undefined,
    } as const;

    db.users.push({ ...newUser });
    saveDb(db);
    const token = signToken({ ...newUser });
    res.status(201).json({ token, user: sanitizeUser({ ...newUser }) });
  });

  app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.auth?.userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    const safe = sanitizeUser(user);
    if (req.auth?.driverId && !safe.driverId) {
      safe.driverId = req.auth.driverId;
    }
    res.json({ user: safe });
  });

  // ---------------- DASHBOARD ----------------
  app.get('/api/dashboard', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const role = req.auth!.role;
    const driverId = req.auth!.driverId;

    const visibleTrips =
      role === 'driver'
        ? driverId
          ? db.trips.filter((t) => t.driverId === driverId)
          : []
        : db.trips;

    const visibleSalaries =
      role === 'driver'
        ? driverId
          ? db.salaries.filter((s) => s.driverId === driverId)
          : []
        : db.salaries;

    const visibleVehicles =
      role === 'driver'
        ? driverId
          ? db.vehicles.filter((v) => v.assignedDriverId === driverId)
          : []
        : db.vehicles;

    const totalVehicles = visibleVehicles.length;
    const availableVehicles = visibleVehicles.filter((v) => v.status === 'Available').length;
    const maintenanceVehicles = visibleVehicles.filter((v) => v.status === 'Maintenance').length;
    const onTripVehicles = visibleVehicles.filter((v) => v.status === 'On Trip').length;

    const totalDrivers =
      role === 'driver'
        ? driverId && db.drivers.some((d) => d.id === driverId)
          ? 1
          : 0
        : db.drivers.length;
    const activeTrips = visibleTrips.filter((t) => t.status === 'Running').length;
    const delayedTrips = visibleTrips.filter(
      (t) => t.status === 'Delayed' || t.delayMinutes > 0,
    ).length;
    const completedTrips = visibleTrips.filter(
      (t) => t.status === 'Completed' || (t.status === 'Delayed' && Boolean(t.actualArrivalTime)),
    ).length;

    const pendingSalaryRecords = visibleSalaries.filter((s) => s.status === 'Pending Approval');
    const pendingSalaryPaymentsCount = pendingSalaryRecords.length;
    const pendingSalaryAmount = pendingSalaryRecords.reduce(
      (sum, s) => sum + s.finalPayableSalary,
      0,
    );

    // Monthly trip statistics computed from actual trips in the database
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const monthKeys = Array.from(
      new Set(visibleTrips.map((t) => t.departureTime.slice(0, 7)).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    const monthlyTripStats = monthKeys.map((m) => {
      const mTrips = visibleTrips.filter((t) => t.departureTime.startsWith(m));
      const completed = mTrips.filter((t) => t.status === 'Completed').length;
      const delayed = mTrips.filter((t) => t.status === 'Delayed' || t.delayMinutes > 0).length;
      const scheduledOrRunning = mTrips.filter(
        (t) => t.status === 'Scheduled' || t.status === 'Running',
      ).length;
      const totalExpenses = mTrips.reduce((s, t) => s + t.expenses, 0);
      const monthIdx = Number(m.slice(5, 7)) - 1;
      const label = monthNames[monthIdx] ? `${monthNames[monthIdx]} ${m.slice(2, 4)}` : m;
      return {
        month: label,
        monthKey: m,
        completed,
        delayed,
        activeOrScheduled: scheduledOrRunning,
        total: mTrips.length,
        expenses: totalExpenses,
      };
    });

    // Driver performance chart computed from real driver & trip records
    const driverList =
      role === 'driver' && driverId
        ? db.drivers.filter((d) => d.id === driverId)
        : role === 'driver'
          ? []
          : db.drivers;

    const driverPerformance = driverList.map((d) => {
      const dTrips = db.trips.filter((t) => t.driverId === d.id);
      const onTime = dTrips.filter((t) => t.status === 'Completed' && t.delayMinutes === 0).length;
      const delayed = dTrips.filter((t) => t.status === 'Delayed' || t.delayMinutes > 0).length;
      const totalDelayMinutes = dTrips.reduce((s, t) => s + (t.delayMinutes || 0), 0);
      return {
        driverId: d.id,
        name: d.name.split(' ')[0],
        fullName: d.name,
        onTime,
        delayed,
        totalDelayMinutes,
      };
    });

    // Vehicle utilization breakdown (empty array when fleet has 0 vehicles)
    const vehicleUtilization =
      totalVehicles === 0
        ? []
        : [
            { name: 'On Trip', value: onTripVehicles, color: '#1D4ED8' },
            { name: 'Available', value: availableVehicles, color: '#16A34A' },
            { name: 'Maintenance', value: maintenanceVehicles, color: '#D97706' },
          ].filter((item) => item.value > 0);

    const recentTrips = [...visibleTrips]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);

    const upcomingTrips = visibleTrips
      .filter((t) => t.status === 'Scheduled' || t.status === 'Running')
      .sort((a, b) => a.departureTime.localeCompare(b.departureTime))
      .slice(0, 6);

    const notifications = buildNotifications({
      vehicles: db.vehicles,
      drivers: db.drivers,
      trips: db.trips,
      delays: db.delays,
      salaries: db.salaries,
      role,
      driverId,
    });

    res.json({
      kpis: {
        totalVehicles,
        totalDrivers,
        activeTrips,
        availableVehicles,
        maintenanceVehicles,
        delayedTrips,
        completedTrips,
        pendingSalaryPaymentsCount,
        pendingSalaryAmount,
      },
      monthlyTripStats,
      driverPerformance,
      vehicleUtilization,
      recentTrips,
      upcomingTrips,
      notificationsCount: notifications.length,
    });
  });

  // ---------------- NOTIFICATIONS ----------------
  app.get('/api/notifications', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const notifications = buildNotifications({
      vehicles: db.vehicles,
      drivers: db.drivers,
      trips: db.trips,
      delays: db.delays,
      salaries: db.salaries,
      role: req.auth!.role,
      driverId: req.auth!.driverId,
    });
    res.json({ notifications });
  });

  // ---------------- RTO REGISTRATION LOOKUP & VEHICLES ----------------
  function applyRtoToVehicle(prev: Vehicle, rto: RtoLookupResult, syncedAt: string): Vehicle {
    return {
      ...prev,
      registrationNumber: rto.registrationNumber || prev.registrationNumber,
      rtoCode: rto.rtoCode || prev.rtoCode,
      rtoState: rto.rtoState || prev.rtoState,
      rtoOffice: rto.rtoOffice || prev.rtoOffice,
      vehicleType: rto.fields.vehicleType || prev.vehicleType,
      manufacturer: rto.fields.manufacturer || prev.manufacturer,
      model: rto.fields.model || prev.model,
      year: rto.fields.year || prev.year,
      fuelType: rto.fields.fuelType || prev.fuelType,
      capacity: rto.fields.capacity || prev.capacity,
      insuranceProvider: rto.fields.insuranceProvider || prev.insuranceProvider,
      insurancePolicyNumber: rto.fields.insurancePolicyNumber || prev.insurancePolicyNumber,
      insuranceExpiryDate: rto.fields.insuranceExpiryDate || prev.insuranceExpiryDate,
      registrationDate: rto.fields.registrationDate || prev.registrationDate,
      registrationExpiryDate: rto.fields.registrationExpiryDate || prev.registrationExpiryDate,
      fitnessExpiryDate: rto.fields.fitnessExpiryDate || prev.fitnessExpiryDate,
      pucExpiryDate: rto.fields.pucExpiryDate || prev.pucExpiryDate,
      permitExpiryDate: rto.fields.permitExpiryDate || prev.permitExpiryDate,
      chassisNumber: rto.fields.chassisNumber || prev.chassisNumber,
      engineNumber: rto.fields.engineNumber || prev.engineNumber,
      rtoSource: rto.source === 'live_api' ? 'live_api' : rto.rtoCode ? 'rto_code' : prev.rtoSource,
      rtoLastSyncedAt: syncedAt,
    };
  }

  app.get(
    '/api/rto/lookup/:regNumber',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    async (req, res) => {
      const result = await lookupRtoVehicle(req.params.regNumber || '');
      res.json({ rto: result });
    },
  );

  app.post(
    '/api/rto/parse-rc',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    (req, res) => {
      const { rawText } = (req.body || {}) as { rawText?: string };
      if (!rawText || !rawText.trim()) {
        res.status(400).json({ error: 'Paste mParivahan / Parivahan RC text or JSON to extract fields.' });
        return;
      }
      const parsed = parseRcDocumentText(rawText);
      res.json({ parsed });
    },
  );

  app.get('/api/vehicles', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.auth!.role === 'driver') {
      const assigned = req.auth!.driverId
        ? db.vehicles.filter((v) => v.assignedDriverId === req.auth!.driverId)
        : [];
      res.json({ vehicles: assigned });
      return;
    }
    res.json({ vehicles: db.vehicles });
  });

  app.post('/api/vehicles', authenticate, requireRole('owner', 'admin'), async (req, res) => {
    const body = req.body as Partial<Vehicle>;
    const normalizedReg = normalizeRegistrationNumber(body.registrationNumber || '');
    if (!normalizedReg) {
      res.status(400).json({
        error: 'Vehicle registration number is required.',
      });
      return;
    }

    const db = getDb();
    if (
      db.vehicles.some(
        (v) => normalizeRegistrationNumber(v.registrationNumber) === normalizedReg,
      )
    ) {
      res.status(409).json({ error: 'A vehicle with this registration number already exists.' });
      return;
    }

    const rto = await lookupRtoVehicle(normalizedReg);
    const nowIso = new Date().toISOString();

    const newVehicle: Vehicle = {
      id: generateId('VEH'),
      registrationNumber: normalizedReg,
      vehicleType: body.vehicleType?.trim() || rto.fields.vehicleType || 'Commercial Vehicle',
      manufacturer: body.manufacturer?.trim() || rto.fields.manufacturer || '',
      model: body.model?.trim() || rto.fields.model || '',
      year: Number(body.year) || rto.fields.year || new Date().getFullYear(),
      fuelType: body.fuelType?.trim() || rto.fields.fuelType || 'Diesel',
      capacity: body.capacity?.trim() || rto.fields.capacity || '',
      assignedDriverId: body.assignedDriverId || null,
      status: body.status || 'Available',
      insuranceProvider: body.insuranceProvider?.trim() || rto.fields.insuranceProvider || '',
      insurancePolicyNumber:
        body.insurancePolicyNumber?.trim() || rto.fields.insurancePolicyNumber || '',
      insuranceExpiryDate:
        body.insuranceExpiryDate?.trim() || rto.fields.insuranceExpiryDate || '',
      registrationDate: body.registrationDate?.trim() || rto.fields.registrationDate || '',
      registrationExpiryDate:
        body.registrationExpiryDate?.trim() || rto.fields.registrationExpiryDate || '',
      rtoCode: body.rtoCode || rto.rtoCode || undefined,
      rtoState: body.rtoState || rto.rtoState || undefined,
      rtoOffice: body.rtoOffice || rto.rtoOffice || undefined,
      fitnessExpiryDate: body.fitnessExpiryDate || rto.fields.fitnessExpiryDate || undefined,
      pucExpiryDate: body.pucExpiryDate || rto.fields.pucExpiryDate || undefined,
      permitExpiryDate: body.permitExpiryDate || rto.fields.permitExpiryDate || undefined,
      chassisNumber: body.chassisNumber || rto.fields.chassisNumber || undefined,
      engineNumber: body.engineNumber || rto.fields.engineNumber || undefined,
      rtoSource: rto.source === 'live_api' ? 'live_api' : rto.rtoCode ? 'rto_code' : 'manual',
      rtoLastSyncedAt: nowIso,
      odometerKm: Number(body.odometerKm) || 0,
      maintenanceHistory: Array.isArray(body.maintenanceHistory) ? body.maintenanceHistory : [],
    };

    if (newVehicle.assignedDriverId) {
      const driver = db.drivers.find((d) => d.id === newVehicle.assignedDriverId);
      if (driver) driver.assignedVehicleId = newVehicle.id;
    }

    db.vehicles.unshift(newVehicle);
    saveDb(db);
    res.status(201).json({ vehicle: newVehicle, rto });
  });

  app.post(
    '/api/vehicles/sync-all-rto',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    async (_req, res) => {
      const db = getDb();
      const nowIso = new Date().toISOString();
      let liveSyncedCount = 0;
      let liveApiConfigured = false;

      for (let i = 0; i < db.vehicles.length; i += 1) {
        const v = db.vehicles[i];
        const rto = await lookupRtoVehicle(v.registrationNumber);
        if (rto.liveApiConfigured) liveApiConfigured = true;
        if (rto.source === 'live_api') liveSyncedCount += 1;
        db.vehicles[i] = applyRtoToVehicle(v, rto, nowIso);
      }

      saveDb(db);
      res.json({
        vehicles: db.vehicles,
        totalProcessed: db.vehicles.length,
        liveSyncedCount,
        liveApiConfigured,
        message:
          db.vehicles.length === 0
            ? 'No vehicles in fleet yet.'
            : liveApiConfigured
              ? `Synced RTO records for ${db.vehicles.length} vehicle(s) (${liveSyncedCount} updated from live Vahan RC API).`
              : `Resolved RTO office & state codes for ${db.vehicles.length} vehicle(s). Configure RTO_API_URL & RTO_API_KEY in server secrets to fetch live Vahan make, model, insurance & registration fields automatically.`,
      });
    },
  );

  app.post(
    '/api/vehicles/:id/sync-rto',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    async (req, res) => {
      const db = getDb();
      const idx = db.vehicles.findIndex((v) => v.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Vehicle not found.' });
        return;
      }

      const prev = db.vehicles[idx];
      const rto = await lookupRtoVehicle(prev.registrationNumber);
      const updated = applyRtoToVehicle(prev, rto, new Date().toISOString());

      db.vehicles[idx] = updated;
      saveDb(db);
      res.json({ vehicle: updated, rto });
    },
  );

  app.put('/api/vehicles/:id', authenticate, requireRole('owner', 'admin'), async (req, res) => {
    const db = getDb();
    const idx = db.vehicles.findIndex((v) => v.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    const prev = db.vehicles[idx];
    const updates = req.body as Partial<Vehicle>;
    const nextReg = updates.registrationNumber
      ? normalizeRegistrationNumber(updates.registrationNumber)
      : prev.registrationNumber;
    const regChanged = nextReg !== normalizeRegistrationNumber(prev.registrationNumber);

    const rto =
      regChanged || !prev.rtoCode || !prev.rtoOffice
        ? await lookupRtoVehicle(nextReg)
        : null;

    const updated: Vehicle = {
      ...prev,
      ...updates,
      id: prev.id,
      registrationNumber: nextReg,
      rtoCode: updates.rtoCode || rto?.rtoCode || prev.rtoCode,
      rtoState: updates.rtoState || rto?.rtoState || prev.rtoState,
      rtoOffice: updates.rtoOffice || rto?.rtoOffice || prev.rtoOffice,
      vehicleType: updates.vehicleType?.trim() || rto?.fields.vehicleType || prev.vehicleType,
      manufacturer: updates.manufacturer?.trim() ?? rto?.fields.manufacturer ?? prev.manufacturer,
      model: updates.model?.trim() ?? rto?.fields.model ?? prev.model,
      year: updates.year !== undefined ? Number(updates.year) : rto?.fields.year || prev.year,
      fuelType: updates.fuelType?.trim() || rto?.fields.fuelType || prev.fuelType,
      capacity: updates.capacity?.trim() ?? rto?.fields.capacity ?? prev.capacity,
      insuranceProvider:
        updates.insuranceProvider?.trim() ?? rto?.fields.insuranceProvider ?? prev.insuranceProvider,
      insurancePolicyNumber:
        updates.insurancePolicyNumber?.trim() ??
        rto?.fields.insurancePolicyNumber ??
        prev.insurancePolicyNumber,
      insuranceExpiryDate:
        updates.insuranceExpiryDate?.trim() ??
        rto?.fields.insuranceExpiryDate ??
        prev.insuranceExpiryDate,
      registrationDate:
        updates.registrationDate?.trim() ?? rto?.fields.registrationDate ?? prev.registrationDate,
      registrationExpiryDate:
        updates.registrationExpiryDate?.trim() ??
        rto?.fields.registrationExpiryDate ??
        prev.registrationExpiryDate,
      fitnessExpiryDate:
        updates.fitnessExpiryDate ?? rto?.fields.fitnessExpiryDate ?? prev.fitnessExpiryDate,
      pucExpiryDate: updates.pucExpiryDate ?? rto?.fields.pucExpiryDate ?? prev.pucExpiryDate,
      permitExpiryDate:
        updates.permitExpiryDate ?? rto?.fields.permitExpiryDate ?? prev.permitExpiryDate,
      chassisNumber: updates.chassisNumber ?? rto?.fields.chassisNumber ?? prev.chassisNumber,
      engineNumber: updates.engineNumber ?? rto?.fields.engineNumber ?? prev.engineNumber,
      rtoSource:
        rto?.source === 'live_api'
          ? 'live_api'
          : prev.rtoSource || (rto?.rtoCode ? 'rto_code' : 'manual'),
      rtoLastSyncedAt: rto ? new Date().toISOString() : prev.rtoLastSyncedAt,
      odometerKm: updates.odometerKm !== undefined ? Number(updates.odometerKm) : prev.odometerKm,
      maintenanceHistory: updates.maintenanceHistory ?? prev.maintenanceHistory,
    };

    if (prev.assignedDriverId !== updated.assignedDriverId) {
      if (prev.assignedDriverId) {
        const oldDrv = db.drivers.find((d) => d.id === prev.assignedDriverId);
        if (oldDrv && oldDrv.assignedVehicleId === prev.id) oldDrv.assignedVehicleId = null;
      }
      if (updated.assignedDriverId) {
        const newDrv = db.drivers.find((d) => d.id === updated.assignedDriverId);
        if (newDrv) newDrv.assignedVehicleId = updated.id;
      }
    }

    db.vehicles[idx] = updated;
    saveDb(db);
    res.json({ vehicle: updated, rto });
  });

  app.post(
    '/api/vehicles/:id/maintenance',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    (req, res) => {
      const db = getDb();
      const vehicle = db.vehicles.find((v) => v.id === req.params.id);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found.' });
        return;
      }

      const { date, type, description, cost, vendor, nextServiceDue, setVehicleStatus } = req.body as {
        date?: string;
        type?: string;
        description?: string;
        cost?: number;
        vendor?: string;
        nextServiceDue?: string;
        setVehicleStatus?: Vehicle['status'];
      };

      if (!type || !description) {
        res.status(400).json({ error: 'Maintenance type and description are required.' });
        return;
      }

      const record: MaintenanceRecord = {
        id: generateId('MNT'),
        date: date || new Date().toISOString().slice(0, 10),
        type: type.trim(),
        description: description.trim(),
        cost: Number(cost) || 0,
        vendor: vendor?.trim() || 'Authorized Service Center',
        nextServiceDue,
      };

      vehicle.maintenanceHistory.unshift(record);
      if (setVehicleStatus) {
        vehicle.status = setVehicleStatus;
      }
      saveDb(db);
      res.status(201).json({ vehicle, maintenanceRecord: record });
    },
  );

  app.delete('/api/vehicles/:id', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const db = getDb();
    const idx = db.vehicles.findIndex((v) => v.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }
    const [removed] = db.vehicles.splice(idx, 1);
    for (const d of db.drivers) {
      if (d.assignedVehicleId === removed.id) d.assignedVehicleId = null;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  // ---------------- DRIVERS ----------------
  app.get('/api/drivers', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const driversList =
      req.auth!.role === 'driver'
        ? req.auth!.driverId
          ? db.drivers.filter((d) => d.id === req.auth!.driverId)
          : []
        : db.drivers;

    const enriched = driversList.map((d) => {
      const driverTrips = db.trips.filter((t) => t.driverId === d.id);
      const completedTrips = driverTrips.filter(
        (t) => t.status === 'Completed' || (t.status === 'Delayed' && Boolean(t.actualArrivalTime)),
      ).length;
      const delayedTrips = driverTrips.filter(
        (t) => t.status === 'Delayed' || t.delayMinutes > 0,
      ).length;
      const onTimeRate =
        completedTrips > 0
          ? Math.round(((completedTrips - delayedTrips) / completedTrips) * 100)
          : 100;
      const driverSalaries = db.salaries.filter((s) => s.driverId === d.id);
      return {
        ...d,
        totalCompletedTrips: completedTrips,
        totalDelayedTrips: delayedTrips,
        onTimeRate,
        tripHistory: driverTrips.sort((a, b) => b.departureTime.localeCompare(a.departureTime)),
        salaryHistory: driverSalaries.sort((a, b) => b.month.localeCompare(a.month)),
      };
    });

    res.json({ drivers: enriched });
  });

  app.post('/api/drivers', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const body = req.body as Partial<Driver> & { loginPassword?: string };
    if (!body.name || !body.phone || !body.licenceNumber || !body.licenceExpiryDate) {
      res.status(400).json({
        error: 'Driver name, phone, licence number, and licence expiry date are required.',
      });
      return;
    }

    const db = getDb();
    const cleanEmail = body.email?.trim().toLowerCase() || '';
    const cleanPhone = body.phone.trim();
    const newDriver: Driver = {
      id: generateId('DRV'),
      name: body.name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      address: body.address?.trim() || '',
      licenceNumber: body.licenceNumber.trim().toUpperCase(),
      licenceClass: body.licenceClass?.trim() || 'Class A CDL',
      licenceExpiryDate: body.licenceExpiryDate,
      assignedVehicleId: body.assignedVehicleId || null,
      joiningDate: body.joiningDate || new Date().toISOString().slice(0, 10),
      salaryType: body.salaryType || 'fixed_plus_allowance',
      basicSalary: Number(body.basicSalary) || 0,
      tripAllowanceRate: Number(body.tripAllowanceRate) || 0,
      overtimeRatePerHour: Number(body.overtimeRatePerHour) || db.salaryRules.defaultOvertimeRatePerHour,
      nightAllowanceRate: Number(body.nightAllowanceRate) || db.salaryRules.defaultNightAllowancePerTrip,
      status: body.status || 'Active',
    };

    if (newDriver.assignedVehicleId) {
      const veh = db.vehicles.find((v) => v.id === newDriver.assignedVehicleId);
      if (veh) veh.assignedDriverId = newDriver.id;
    }

    if (cleanEmail || cleanPhone) {
      const matchingUser = db.users.find(
        (u) =>
          u.role === 'driver' &&
          ((cleanEmail && u.email.toLowerCase() === cleanEmail) ||
            (cleanPhone && u.phone && u.phone.trim() === cleanPhone)),
      );
      if (matchingUser) {
        matchingUser.driverId = newDriver.id;
        if (body.loginPassword && body.loginPassword.trim().length >= 6) {
          matchingUser.passwordHash = bcrypt.hashSync(body.loginPassword.trim(), 10);
        }
      } else if (cleanEmail && body.loginPassword && body.loginPassword.trim().length >= 6) {
        if (!db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
          db.users.push({
            id: generateId('USR'),
            name: newDriver.name,
            email: cleanEmail,
            passwordHash: bcrypt.hashSync(body.loginPassword.trim(), 10),
            role: 'driver',
            driverId: newDriver.id,
            phone: cleanPhone,
          });
        }
      }
    }

    db.drivers.unshift(newDriver);
    saveDb(db);
    res.status(201).json({ driver: newDriver });
  });

  app.put('/api/drivers/:id', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const db = getDb();
    const idx = db.drivers.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }

    const prev = db.drivers[idx];
    const updates = req.body as Partial<Driver> & { loginPassword?: string };
    const { loginPassword: _pw, ...cleanUpdates } = updates;
    const updated: Driver = {
      ...prev,
      ...cleanUpdates,
      id: prev.id,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : prev.email,
      basicSalary: updates.basicSalary !== undefined ? Number(updates.basicSalary) : prev.basicSalary,
      tripAllowanceRate:
        updates.tripAllowanceRate !== undefined
          ? Number(updates.tripAllowanceRate)
          : prev.tripAllowanceRate,
      overtimeRatePerHour:
        updates.overtimeRatePerHour !== undefined
          ? Number(updates.overtimeRatePerHour)
          : prev.overtimeRatePerHour,
      nightAllowanceRate:
        updates.nightAllowanceRate !== undefined
          ? Number(updates.nightAllowanceRate)
          : prev.nightAllowanceRate,
    };

    if (prev.assignedVehicleId !== updated.assignedVehicleId) {
      if (prev.assignedVehicleId) {
        const oldVeh = db.vehicles.find((v) => v.id === prev.assignedVehicleId);
        if (oldVeh && oldVeh.assignedDriverId === prev.id) oldVeh.assignedDriverId = null;
      }
      if (updated.assignedVehicleId) {
        const newVeh = db.vehicles.find((v) => v.id === updated.assignedVehicleId);
        if (newVeh) newVeh.assignedDriverId = updated.id;
      }
    }

    if (updated.email || updated.phone) {
      const linkedUser = db.users.find(
        (u) =>
          u.role === 'driver' &&
          (u.driverId === updated.id ||
            (updated.email && u.email.toLowerCase() === updated.email.toLowerCase())),
      );
      if (linkedUser) {
        linkedUser.driverId = updated.id;
        if (updates.loginPassword && updates.loginPassword.trim().length >= 6) {
          linkedUser.passwordHash = bcrypt.hashSync(updates.loginPassword.trim(), 10);
        }
      } else if (updated.email && updates.loginPassword && updates.loginPassword.trim().length >= 6) {
        if (!db.users.some((u) => u.email.toLowerCase() === updated.email.toLowerCase())) {
          db.users.push({
            id: generateId('USR'),
            name: updated.name,
            email: updated.email.toLowerCase(),
            passwordHash: bcrypt.hashSync(updates.loginPassword.trim(), 10),
            role: 'driver',
            driverId: updated.id,
            phone: updated.phone,
          });
        }
      }
    }

    db.drivers[idx] = updated;
    saveDb(db);
    res.json({ driver: updated });
  });

  app.delete('/api/drivers/:id', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const db = getDb();
    const idx = db.drivers.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }
    const [removed] = db.drivers.splice(idx, 1);
    for (const v of db.vehicles) {
      if (v.assignedDriverId === removed.id) v.assignedDriverId = null;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  // ---------------- TRIPS & AUTOMATIC DELAY CALCULATION ----------------
  function syncDelayRecordForTrip(db: ReturnType<typeof getDb>, trip: Trip, driverExplanation?: string) {
    if (trip.delayMinutes <= 0 || !trip.actualArrivalTime) {
      // Remove delay record if arrival updated to on-time
      db.delays = db.delays.filter((d) => d.tripId !== trip.id);
      return;
    }

    const existing = db.delays.find((d) => d.tripId === trip.id);
    const route = `${trip.startingLocation} → ${trip.destination}`;
    const formatted = formatDelayDuration(trip.delayMinutes);

    if (existing) {
      existing.actualArrivalTime = trip.actualArrivalTime;
      existing.estimatedArrivalTime = trip.estimatedArrivalTime;
      existing.delayMinutes = trip.delayMinutes;
      existing.delayFormatted = formatted;
      existing.reason = trip.delayReason || existing.reason;
      if (driverExplanation) existing.driverExplanation = driverExplanation;
      existing.route = route;
    } else {
      const record: DelayRecord = {
        id: generateId('DLY'),
        tripId: trip.id,
        tripCode: trip.tripCode,
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        route,
        estimatedArrivalTime: trip.estimatedArrivalTime,
        actualArrivalTime: trip.actualArrivalTime,
        delayMinutes: trip.delayMinutes,
        delayFormatted: formatted,
        reason: trip.delayReason || 'Unclassified',
        driverExplanation: driverExplanation || trip.notes || '',
        adminNotes: '',
        reviewStatus: 'Pending Review',
        salaryAdjustmentApproved: false,
        recordedAt: new Date().toISOString(),
      };
      db.delays.unshift(record);
    }
  }

  app.get('/api/trips', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const trips =
      req.auth!.role === 'driver'
        ? req.auth!.driverId
          ? db.trips.filter((t) => t.driverId === req.auth!.driverId)
          : []
        : db.trips;
    res.json({
      trips: [...trips].sort((a, b) => b.departureTime.localeCompare(a.departureTime)),
    });
  });

  app.post('/api/trips', authenticate, requireRole('owner', 'admin', 'manager'), (req, res) => {
    const body = req.body as Partial<Trip>;
    if (
      !body.vehicleId ||
      !body.driverId ||
      !body.startingLocation ||
      !body.destination ||
      !body.departureTime ||
      !body.estimatedArrivalTime
    ) {
      res.status(400).json({
        error:
          'Vehicle, driver, starting location, destination, departure time, and estimated arrival are required.',
      });
      return;
    }

    const db = getDb();
    const delayMinutes = calculateDelayMinutes(body.estimatedArrivalTime, body.actualArrivalTime);
    let status: TripStatus = body.status || 'Scheduled';
    if (body.actualArrivalTime && delayMinutes > 0 && status !== 'Cancelled') {
      status = 'Delayed';
    } else if (body.actualArrivalTime && delayMinutes === 0 && status === 'Running') {
      status = 'Completed';
    }

    const fuelCost = Number(body.fuelCost) || 0;
    const tollCost = Number(body.tollCost) || 0;
    const otherExpenses = Number(body.otherExpenses) || 0;
    const expenses =
      body.expenses !== undefined ? Number(body.expenses) : fuelCost + tollCost + otherExpenses;

    const nowIso = new Date().toISOString();
    const tripCount = db.trips.length + 1;
    const monthTag = body.departureTime.slice(2, 7).replace('-', '');

    const newTrip: Trip = {
      id: generateId('TRP'),
      tripCode: body.tripCode?.trim() || `FF-${monthTag}-${String(tripCount).padStart(3, '0')}`,
      vehicleId: body.vehicleId,
      driverId: body.driverId,
      startingLocation: body.startingLocation.trim(),
      destination: body.destination.trim(),
      departureTime: body.departureTime,
      estimatedArrivalTime: body.estimatedArrivalTime,
      actualArrivalTime: body.actualArrivalTime || null,
      totalDistanceKm: Number(body.totalDistanceKm) || 0,
      status,
      expenses,
      fuelCost,
      tollCost,
      otherExpenses,
      notes: body.notes?.trim() || '',
      delayMinutes,
      delayReason: delayMinutes > 0 ? body.delayReason || null : null,
      nightShift: Boolean(body.nightShift),
      overtimeHours: Number(body.overtimeHours) || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Sync vehicle status
    const veh = db.vehicles.find((v) => v.id === newTrip.vehicleId);
    if (veh) {
      if (newTrip.status === 'Running') veh.status = 'On Trip';
      else if (
        (newTrip.status === 'Completed' || newTrip.status === 'Delayed') &&
        veh.status === 'On Trip'
      ) {
        veh.status = 'Available';
      }
    }

    db.trips.unshift(newTrip);
    syncDelayRecordForTrip(db, newTrip);
    saveDb(db);
    res.status(201).json({ trip: newTrip });
  });

  app.put('/api/trips/:id', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const idx = db.trips.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const existing = db.trips[idx];
    const role = req.auth!.role;
    const body = req.body as Partial<Trip> & { driverExplanation?: string };

    // Drivers can only update their own assigned trips (progress, arrival time, delay reason, notes)
    if (role === 'driver') {
      if (existing.driverId !== req.auth!.driverId) {
        res.status(403).json({ error: 'You can only update trips assigned to you.' });
        return;
      }
      const allowedStatus: TripStatus[] = ['Running', 'Completed', 'Delayed'];
      const nextActual =
        body.actualArrivalTime !== undefined ? body.actualArrivalTime : existing.actualArrivalTime;
      const delayMinutes = calculateDelayMinutes(existing.estimatedArrivalTime, nextActual);

      let nextStatus = existing.status;
      if (body.status && allowedStatus.includes(body.status)) {
        nextStatus = body.status;
      }
      if (nextActual) {
        nextStatus = delayMinutes > 0 ? 'Delayed' : 'Completed';
      }

      const updated: Trip = {
        ...existing,
        status: nextStatus,
        actualArrivalTime: nextActual,
        delayMinutes,
        delayReason: delayMinutes > 0 ? body.delayReason ?? existing.delayReason : null,
        delaySubmittedByDriver: body.delayReason ? true : existing.delaySubmittedByDriver,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updatedAt: new Date().toISOString(),
      };

      const veh = db.vehicles.find((v) => v.id === updated.vehicleId);
      if (veh && veh.status !== 'Maintenance') {
        if (updated.status === 'Running') veh.status = 'On Trip';
        else if (updated.status === 'Completed' || updated.status === 'Delayed') {
          veh.status = 'Available';
        }
      }

      db.trips[idx] = updated;
      syncDelayRecordForTrip(db, updated, body.driverExplanation);
      saveDb(db);
      res.json({ trip: updated });
      return;
    }

    // Admin / Manager full update
    const nextEst = body.estimatedArrivalTime ?? existing.estimatedArrivalTime;
    const nextAct =
      body.actualArrivalTime !== undefined ? body.actualArrivalTime : existing.actualArrivalTime;
    const delayMinutes = calculateDelayMinutes(nextEst, nextAct);

    let nextStatus = body.status ?? existing.status;
    if (nextStatus !== 'Cancelled' && nextAct) {
      nextStatus = delayMinutes > 0 ? 'Delayed' : 'Completed';
    }

    const fuelCost = body.fuelCost !== undefined ? Number(body.fuelCost) : existing.fuelCost;
    const tollCost = body.tollCost !== undefined ? Number(body.tollCost) : existing.tollCost;
    const otherExpenses =
      body.otherExpenses !== undefined ? Number(body.otherExpenses) : existing.otherExpenses;
    const expenses =
      body.expenses !== undefined
        ? Number(body.expenses)
        : fuelCost + tollCost + otherExpenses;

    const updated: Trip = {
      ...existing,
      ...body,
      id: existing.id,
      estimatedArrivalTime: nextEst,
      actualArrivalTime: nextAct,
      delayMinutes,
      delayReason: delayMinutes > 0 ? body.delayReason ?? existing.delayReason : null,
      status: nextStatus,
      fuelCost,
      tollCost,
      otherExpenses,
      expenses,
      totalDistanceKm:
        body.totalDistanceKm !== undefined
          ? Number(body.totalDistanceKm)
          : existing.totalDistanceKm,
      overtimeHours:
        body.overtimeHours !== undefined ? Number(body.overtimeHours) : existing.overtimeHours,
      updatedAt: new Date().toISOString(),
    };

    const veh = db.vehicles.find((v) => v.id === updated.vehicleId);
    if (veh && veh.status !== 'Maintenance') {
      if (updated.status === 'Running') veh.status = 'On Trip';
      else if (updated.status === 'Completed' || updated.status === 'Delayed' || updated.status === 'Cancelled') {
        veh.status = 'Available';
      }
    }

    db.trips[idx] = updated;
    syncDelayRecordForTrip(db, updated, body.driverExplanation);
    saveDb(db);
    res.json({ trip: updated });
  });

  app.delete('/api/trips/:id', authenticate, requireRole('owner', 'admin', 'manager'), (req, res) => {
    const db = getDb();
    const idx = db.trips.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }
    const [removed] = db.trips.splice(idx, 1);
    db.delays = db.delays.filter((d) => d.tripId !== removed.id);
    saveDb(db);
    res.json({ ok: true });
  });

  // ---------------- DELAY TRACKING ----------------
  app.get('/api/delays', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const delays =
      req.auth!.role === 'driver'
        ? req.auth!.driverId
          ? db.delays.filter((d) => d.driverId === req.auth!.driverId)
          : []
        : db.delays;

    const visibleDrivers =
      req.auth!.role === 'driver'
        ? req.auth!.driverId
          ? db.drivers.filter((d) => d.id === req.auth!.driverId)
          : []
        : db.drivers;

    // Driver-wise delay summary
    const driverSummary = visibleDrivers.map((drv) => {
      const drvDelays = db.delays.filter((d) => d.driverId === drv.id);
      const totalDelayMinutes = drvDelays.reduce((s, d) => s + d.delayMinutes, 0);
      return {
        driverId: drv.id,
        driverName: drv.name,
        delayedCount: drvDelays.length,
        totalDelayMinutes,
        totalDelayFormatted: formatDelayDuration(totalDelayMinutes),
        pendingReviewCount: drvDelays.filter((d) => d.reviewStatus === 'Pending Review').length,
      };
    });

    // Monthly delay statistics
    const monthMap: Record<string, { month: string; count: number; totalMinutes: number }> = {};
    for (const d of delays) {
      const m = d.estimatedArrivalTime.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, count: 0, totalMinutes: 0 };
      monthMap[m].count += 1;
      monthMap[m].totalMinutes += d.delayMinutes;
    }

    const monthlyDelays = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      delays: [...delays].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
      driverSummary,
      monthlyDelays,
    });
  });

  app.put('/api/delays/:id', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const delay = db.delays.find((d) => d.id === req.params.id);
    if (!delay) {
      res.status(404).json({ error: 'Delay record not found.' });
      return;
    }

    const role = req.auth!.role;
    const body = req.body as Partial<DelayRecord>;

    if (role === 'driver') {
      if (delay.driverId !== req.auth!.driverId) {
        res.status(403).json({ error: 'You can only submit reasons for your own delays.' });
        return;
      }
      if (body.reason) delay.reason = body.reason;
      if (body.driverExplanation !== undefined) delay.driverExplanation = body.driverExplanation;

      const trip = db.trips.find((t) => t.id === delay.tripId);
      if (trip && body.reason && body.reason !== 'Unclassified') {
        trip.delayReason = body.reason as DelayReason;
        trip.delaySubmittedByDriver = true;
      }
      saveDb(db);
      res.json({ delay });
      return;
    }

    // Admin / Manager classification & review
    if (body.reason) delay.reason = body.reason;
    if (body.driverExplanation !== undefined) delay.driverExplanation = body.driverExplanation;
    if (body.adminNotes !== undefined) delay.adminNotes = body.adminNotes;
    if (body.reviewStatus) delay.reviewStatus = body.reviewStatus;
    if (body.salaryAdjustmentApproved !== undefined && (role === 'owner' || role === 'admin')) {
      delay.salaryAdjustmentApproved = Boolean(body.salaryAdjustmentApproved);
    }

    const trip = db.trips.find((t) => t.id === delay.tripId);
    if (trip && body.reason && body.reason !== 'Unclassified') {
      trip.delayReason = body.reason as DelayReason;
    }

    saveDb(db);
    res.json({ delay });
  });

  // ---------------- SALARY MANAGEMENT & PAYROLL ----------------
  app.get('/api/salaries', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const salaries =
      req.auth!.role === 'driver'
        ? req.auth!.driverId
          ? db.salaries.filter((s) => s.driverId === req.auth!.driverId)
          : []
        : db.salaries;

    res.json({
      salaries: [...salaries].sort((a, b) => b.month.localeCompare(a.month)),
      rules: db.salaryRules,
    });
  });

  app.put('/api/salaries/rules', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const db = getDb();
    const body = req.body as Partial<typeof db.salaryRules>;
    db.salaryRules = {
      defaultOvertimeRatePerHour:
        body.defaultOvertimeRatePerHour !== undefined
          ? Number(body.defaultOvertimeRatePerHour)
          : db.salaryRules.defaultOvertimeRatePerHour,
      defaultNightAllowancePerTrip:
        body.defaultNightAllowancePerTrip !== undefined
          ? Number(body.defaultNightAllowancePerTrip)
          : db.salaryRules.defaultNightAllowancePerTrip,
      defaultTripAllowance:
        body.defaultTripAllowance !== undefined
          ? Number(body.defaultTripAllowance)
          : db.salaryRules.defaultTripAllowance,
      defaultPerTripPay:
        body.defaultPerTripPay !== undefined
          ? Number(body.defaultPerTripPay)
          : db.salaryRules.defaultPerTripPay,
      currencySymbol: body.currencySymbol || db.salaryRules.currencySymbol,
      autoPenalizeDelays: false, // Enforced invariant: never auto-penalize delays
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ rules: db.salaryRules });
  });

  app.post('/api/salaries/generate', authenticate, requireRole('owner', 'admin'), (req, res) => {
    const { month } = req.body as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Valid month (YYYY-MM) is required.' });
      return;
    }

    const db = getDb();
    const generated: SalaryRecord[] = [];

    for (const driver of db.drivers) {
      const existingIdx = db.salaries.findIndex(
        (s) => s.driverId === driver.id && s.month === month,
      );
      const existing = existingIdx >= 0 ? db.salaries[existingIdx] : undefined;

      // Do not overwrite already Paid salaries unless manually edited
      if (existing && existing.status === 'Paid') {
        generated.push(existing);
        continue;
      }

      const calc = calculateSalaryBreakdown({
        driver,
        month,
        trips: db.trips,
        rules: db.salaryRules,
        existing,
      });

      const record: SalaryRecord = {
        ...calc,
        id: existing?.id || `SAL-${month.replace('-', '')}-${driver.id}`,
        generatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        db.salaries[existingIdx] = record;
      } else {
        db.salaries.unshift(record);
      }
      generated.push(record);
    }

    saveDb(db);
    res.json({ generatedCount: generated.length, salaries: db.salaries });
  });

  app.put('/api/salaries/:id', authenticate, requireRole('owner', 'admin'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const idx = db.salaries.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Salary record not found.' });
      return;
    }

    const existing = db.salaries[idx];
    const body = req.body as Partial<SalaryRecord>;

    const basicSalary =
      body.basicSalary !== undefined ? Number(body.basicSalary) : existing.basicSalary;
    const tripAllowances =
      body.tripAllowances !== undefined ? Number(body.tripAllowances) : existing.tripAllowances;
    const nightAllowances =
      body.nightAllowances !== undefined ? Number(body.nightAllowances) : existing.nightAllowances;
    const overtimeHours =
      body.overtimeHours !== undefined ? Number(body.overtimeHours) : existing.overtimeHours;
    const overtimePay =
      body.overtimePay !== undefined ? Number(body.overtimePay) : existing.overtimePay;
    const approvedBonuses =
      body.approvedBonuses !== undefined ? Number(body.approvedBonuses) : existing.approvedBonuses;
    const approvedDeductions =
      body.approvedDeductions !== undefined
        ? Number(body.approvedDeductions)
        : existing.approvedDeductions;
    const advancePayments =
      body.advancePayments !== undefined ? Number(body.advancePayments) : existing.advancePayments;

    const finalPayableSalary = Math.max(
      0,
      Math.round(
        (basicSalary +
          tripAllowances +
          nightAllowances +
          approvedBonuses +
          overtimePay -
          approvedDeductions -
          advancePayments) *
          100,
      ) / 100,
    );

    const nextStatus = body.status ?? existing.status;
    const adminUser = db.users.find((u) => u.id === req.auth?.userId);

    const updated: SalaryRecord = {
      ...existing,
      basicSalary,
      tripAllowances,
      nightAllowances,
      overtimeHours,
      overtimePay,
      approvedBonuses,
      approvedDeductions,
      advancePayments,
      finalPayableSalary,
      status: nextStatus,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      approvedBy:
        nextStatus === 'Approved' || nextStatus === 'Paid'
          ? existing.approvedBy || adminUser?.name || 'Administrator'
          : undefined,
      approvedAt:
        nextStatus === 'Approved' || nextStatus === 'Paid'
          ? existing.approvedAt || new Date().toISOString()
          : undefined,
    };

    db.salaries[idx] = updated;
    saveDb(db);
    res.json({ salary: updated });
  });

  // ---------------- REPORTS ----------------
  app.get(
    '/api/reports',
    authenticate,
    requireRole('owner', 'admin', 'manager'),
    (req, res) => {
      const db = getDb();
      const { driverId, vehicleId, from, to, status } = req.query as {
        driverId?: string;
        vehicleId?: string;
        from?: string;
        to?: string;
        status?: string;
      };

      const filteredTrips = db.trips.filter((t) => {
        if (driverId && driverId !== 'all' && t.driverId !== driverId) return false;
        if (vehicleId && vehicleId !== 'all' && t.vehicleId !== vehicleId) return false;
        if (status && status !== 'all' && t.status !== status) return false;
        const depDate = t.departureTime.slice(0, 10);
        if (from && depDate < from) return false;
        if (to && depDate > to) return false;
        return true;
      });

      const filteredDelays = db.delays.filter((d) => {
        if (driverId && driverId !== 'all' && d.driverId !== driverId) return false;
        if (vehicleId && vehicleId !== 'all' && d.vehicleId !== vehicleId) return false;
        const recDate = d.estimatedArrivalTime.slice(0, 10);
        if (from && recDate < from) return false;
        if (to && recDate > to) return false;
        return true;
      });

      const filteredSalaries = db.salaries.filter((s) => {
        if (driverId && driverId !== 'all' && s.driverId !== driverId) return false;
        if (from && s.month < from.slice(0, 7)) return false;
        if (to && s.month > to.slice(0, 7)) return false;
        return true;
      });

      res.json({
        trips: filteredTrips,
        delays: filteredDelays,
        salaries: filteredSalaries,
        vehicles: db.vehicles,
        drivers: db.drivers,
      });
    },
  );

  // ---------------- GEMINI 3.8 FLASH TTS ----------------
  app.post('/api/tts', authenticate, async (req, res) => {
    const { text, voiceName, style, mode, secondaryText } = req.body as {
      text?: string;
      voiceName?: string;
      style?: string;
      mode?: 'single' | 'dispatch_dialogue';
      secondaryText?: string;
    };

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'Text content is required for speech synthesis.' });
      return;
    }

    try {
      const result = await generateSpeechBriefing({
        text: text.trim().slice(0, 2000),
        voiceName,
        style,
        mode,
        secondaryText: secondaryText?.trim().slice(0, 1500),
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // ---------------- LIVE FLEET TRACKING & MAPS CONFIG ----------------
  app.get('/api/maps/config', authenticate, (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  app.get('/api/tracking', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const role = req.auth!.role;
    const driverId = req.auth!.driverId;

    const vehicles =
      role === 'driver'
        ? driverId
          ? db.vehicles.filter((v) => v.assignedDriverId === driverId)
          : []
        : db.vehicles;

    const fleet = vehicles.map((vehicle) => {
      const driver = vehicle.assignedDriverId
        ? db.drivers.find((d) => d.id === vehicle.assignedDriverId)
        : undefined;
      const activeTrip =
        db.trips.find(
          (t) =>
            t.vehicleId === vehicle.id &&
            (t.status === 'Running' || t.status === 'Delayed' && !t.actualArrivalTime),
        ) ??
        db.trips
          .filter((t) => t.vehicleId === vehicle.id && t.status === 'Scheduled')
          .sort((a, b) => a.departureTime.localeCompare(b.departureTime))[0] ??
        null;

      return {
        vehicle,
        driver: driver
          ? { id: driver.id, name: driver.name, phone: driver.phone }
          : null,
        activeTrip,
      };
    });

    res.json({ fleet });
  });

  app.post('/api/tracking/:vehicleId/location', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const vehicle = db.vehicles.find((v) => v.id === req.params.vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    if (
      req.auth!.role === 'driver' &&
      (!req.auth!.driverId || vehicle.assignedDriverId !== req.auth!.driverId)
    ) {
      res.status(403).json({ error: 'Drivers can only update live location for their assigned vehicle.' });
      return;
    }

    const body = req.body as {
      lat?: number;
      lng?: number;
      speedKmh?: number;
      headingDeg?: number;
      locationLabel?: string;
      source?: 'gps' | 'manual' | 'telemetry';
    };

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.' });
      return;
    }

    const actor = db.users.find((u) => u.id === req.auth?.userId);
    const locationPoint: VehicleLocation = {
      lat: Math.round(lat * 1000000) / 1000000,
      lng: Math.round(lng * 1000000) / 1000000,
      speedKmh:
        body.speedKmh !== undefined && Number.isFinite(Number(body.speedKmh))
          ? Math.max(0, Math.round(Number(body.speedKmh) * 10) / 10)
          : undefined,
      headingDeg:
        body.headingDeg !== undefined && Number.isFinite(Number(body.headingDeg))
          ? Math.round(Number(body.headingDeg))
          : undefined,
      locationLabel: body.locationLabel?.trim() || undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name || req.auth!.email,
      source: body.source === 'gps' || body.source === 'telemetry' ? body.source : 'manual',
    };

    const history = Array.isArray(vehicle.locationHistory) ? [...vehicle.locationHistory] : [];
    history.push(locationPoint);
    if (history.length > 25) {
      history.splice(0, history.length - 25);
    }

    vehicle.lastLocation = locationPoint;
    vehicle.locationHistory = history;
    saveDb(db);

    res.json({ vehicle, location: locationPoint });
  });

  app.delete('/api/tracking/:vehicleId/location', authenticate, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const vehicle = db.vehicles.find((v) => v.id === req.params.vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }

    if (
      req.auth!.role === 'driver' &&
      (!req.auth!.driverId || vehicle.assignedDriverId !== req.auth!.driverId)
    ) {
      res.status(403).json({ error: 'Drivers can only clear live location for their assigned vehicle.' });
      return;
    }

    vehicle.lastLocation = null;
    vehicle.locationHistory = [];
    saveDb(db);
    res.json({ ok: true });
  });

  // ---------------- VITE / STATIC SERVING ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FleetFlow server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FleetFlow server:', err);
  process.exit(1);
});
