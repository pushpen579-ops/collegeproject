import type {
  AppNotification,
  DelayRecord,
  Driver,
  SalaryConfigRules,
  SalaryRecord,
  Trip,
  UserRole,
  Vehicle,
} from './types.ts';

/**
 * Automatically calculates delay in minutes:
 * Delay = Actual Arrival Time - Estimated Arrival Time
 */
export function calculateDelayMinutes(
  estimatedArrivalTime: string,
  actualArrivalTime: string | null | undefined,
): number {
  if (!actualArrivalTime) return 0;
  const est = new Date(estimatedArrivalTime).getTime();
  const act = new Date(actualArrivalTime).getTime();
  if (Number.isNaN(est) || Number.isNaN(act)) return 0;
  const diffMinutes = Math.round((act - est) / 60000);
  return diffMinutes > 0 ? diffMinutes : 0;
}

export function formatDelayDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculates monthly salary strictly using:
 * Final Salary = Basic Salary + Allowances + Bonuses + Overtime - Approved Deductions - Advances
 * Note: Never applies automatic deductions solely because of a trip delay.
 */
export function calculateSalaryBreakdown(params: {
  driver: Driver;
  month: string;
  trips: Trip[];
  rules: SalaryConfigRules;
  existing?: Partial<SalaryRecord>;
}): Omit<SalaryRecord, 'id' | 'generatedAt'> {
  const { driver, month, trips, rules, existing } = params;

  const driverMonthTrips = trips.filter(
    (t) => t.driverId === driver.id && t.departureTime.startsWith(month),
  );

  // Both Completed and Delayed trips with actual arrival count as finished trips for operational allowance,
  // while Cancelled/Scheduled/Running do not count as completed.
  const finishedTrips = driverMonthTrips.filter(
    (t) => t.status === 'Completed' || (t.status === 'Delayed' && Boolean(t.actualArrivalTime)),
  );
  const completedTrips = finishedTrips.length;
  const delayedTripsCount = driverMonthTrips.filter(
    (t) => t.status === 'Delayed' || t.delayMinutes > 0,
  ).length;

  const nightTripsCount = finishedTrips.filter((t) => Boolean(t.nightShift)).length;
  const totalOvertimeHours = finishedTrips.reduce((sum, t) => sum + (t.overtimeHours || 0), 0);

  let basicSalary = 0;
  let tripAllowances = 0;

  if (driver.salaryType === 'fixed') {
    basicSalary = driver.basicSalary;
    tripAllowances = 0;
  } else if (driver.salaryType === 'per_trip') {
    basicSalary = 0;
    const perTripRate = driver.tripAllowanceRate || rules.defaultPerTripPay;
    tripAllowances = completedTrips * perTripRate;
  } else {
    // fixed_plus_allowance
    basicSalary = driver.basicSalary;
    const allowanceRate = driver.tripAllowanceRate || rules.defaultTripAllowance;
    tripAllowances = completedTrips * allowanceRate;
  }

  const nightRate = driver.nightAllowanceRate || rules.defaultNightAllowancePerTrip;
  const nightAllowances =
    existing?.nightAllowances !== undefined
      ? existing.nightAllowances
      : nightTripsCount * nightRate;

  const overtimeHours =
    existing?.overtimeHours !== undefined ? existing.overtimeHours : totalOvertimeHours;
  const overtimeRate = driver.overtimeRatePerHour || rules.defaultOvertimeRatePerHour;
  const overtimePay =
    existing?.overtimePay !== undefined
      ? existing.overtimePay
      : Math.round(overtimeHours * overtimeRate * 100) / 100;

  const approvedBonuses = existing?.approvedBonuses ?? 0;
  const approvedDeductions = existing?.approvedDeductions ?? 0;
  const advancePayments = existing?.advancePayments ?? 0;

  const totalAllowances = tripAllowances + nightAllowances;
  const finalPayableSalary = Math.max(
    0,
    Math.round(
      (basicSalary +
        totalAllowances +
        approvedBonuses +
        overtimePay -
        approvedDeductions -
        advancePayments) *
        100,
    ) / 100,
  );

  const delayAuditNote =
    delayedTripsCount > 0
      ? `${delayedTripsCount} delayed trip(s) logged this period. Per company policy, zero automatic penalties were applied.`
      : 'No delayed trips recorded in this period.';

  return {
    driverId: driver.id,
    month,
    salaryType: driver.salaryType,
    basicSalary,
    completedTrips,
    delayedTripsCount,
    tripAllowances,
    nightAllowances,
    overtimeHours,
    overtimePay,
    approvedBonuses,
    approvedDeductions,
    advancePayments,
    finalPayableSalary,
    status: existing?.status ?? 'Pending Approval',
    notes: existing?.notes ?? '',
    delayAuditNote,
    approvedBy: existing?.approvedBy,
    approvedAt: existing?.approvedAt,
  };
}

export function buildNotifications(params: {
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  delays: DelayRecord[];
  salaries: SalaryRecord[];
  role: UserRole;
  driverId?: string;
}): AppNotification[] {
  const { vehicles, drivers, trips, delays, salaries, role, driverId } = params;
  const notifications: AppNotification[] = [];
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  // 1. Delayed trips
  const relevantDelays =
    role === 'driver'
      ? driverId
        ? delays.filter((d) => d.driverId === driverId && d.reviewStatus === 'Pending Review')
        : []
      : delays.filter((d) => d.reviewStatus === 'Pending Review');

  for (const delay of relevantDelays) {
    const driver = drivers.find((d) => d.id === delay.driverId);
    notifications.push({
      id: `notif-delay-${delay.id}`,
      category: 'delayed_trip',
      severity: delay.delayMinutes >= 90 ? 'critical' : 'warning',
      title: `Delayed Trip ${delay.tripCode} (${delay.delayFormatted})`,
      message: `${driver?.name ?? 'Driver'} on ${delay.route} — ${delay.reason === 'Unclassified' ? 'Reason pending classification' : delay.reason}`,
      timestamp: delay.recordedAt,
      targetTab: 'delays',
      entityId: delay.id,
    });
  }

  // 2. Upcoming scheduled trips (next 48h)
  const relevantTrips =
    role === 'driver'
      ? driverId
        ? trips.filter((t) => t.driverId === driverId)
        : []
      : trips;

  for (const trip of relevantTrips) {
    if (trip.status === 'Scheduled') {
      const depMs = new Date(trip.departureTime).getTime();
      if (depMs >= now - 3600000 && depMs <= now + fortyEightHoursMs) {
        const driver = drivers.find((d) => d.id === trip.driverId);
        notifications.push({
          id: `notif-upcoming-${trip.id}`,
          category: 'upcoming_trip',
          severity: 'info',
          title: `Upcoming Trip ${trip.tripCode}`,
          message: `${trip.startingLocation} to ${trip.destination} (${driver?.name ?? 'Assigned driver'}) departs ${trip.departureTime.slice(0, 16).replace('T', ' ')}`,
          timestamp: trip.departureTime,
          targetTab: 'trips',
          entityId: trip.id,
        });
      }
    }
  }

  // 3. Pending salary approvals (Owner)
  if (role !== 'driver') {
    const pendingSalaries = salaries.filter((s) => s.status === 'Pending Approval');
    if (pendingSalaries.length > 0) {
      notifications.push({
        id: 'notif-salary-pending',
        category: 'salary_approval',
        severity: 'warning',
        title: `${pendingSalaries.length} Pending Salary Approval${pendingSalaries.length > 1 ? 's' : ''}`,
        message: `Monthly payroll records require fleet owner review and approval.`,
        timestamp: pendingSalaries[0].generatedAt,
        targetTab: 'salaries',
      });
    }
  }

  // 4. Vehicle maintenance
  const maintVehicles =
    role === 'driver'
      ? driverId
        ? vehicles.filter((v) => v.status === 'Maintenance' && v.assignedDriverId === driverId)
        : []
      : vehicles.filter((v) => v.status === 'Maintenance');

  for (const v of maintVehicles) {
    const vehicleLabel = `${v.manufacturer} ${v.model}`.trim() || v.rtoOffice || v.vehicleType;
    notifications.push({
      id: `notif-maint-${v.id}`,
      category: 'vehicle_maintenance',
      severity: 'warning',
      title: `Vehicle Under Maintenance: ${v.registrationNumber}`,
      message: `${vehicleLabel} is currently in workshop maintenance.`,
      timestamp: new Date(now).toISOString(),
      targetTab: 'vehicles',
      entityId: v.id,
    });
  }

  // 5. Expiring driving licences
  const relevantDrivers =
    role === 'driver'
      ? driverId
        ? drivers.filter((d) => d.id === driverId)
        : []
      : drivers;

  for (const d of relevantDrivers) {
    if (!d.licenceExpiryDate) continue;
    const expMs = new Date(d.licenceExpiryDate).getTime();
    if (Number.isNaN(expMs)) continue;
    if (expMs <= now + thirtyDaysMs) {
      const expired = expMs < now;
      notifications.push({
        id: `notif-licence-${d.id}`,
        category: 'expiring_licence',
        severity: expired ? 'critical' : 'warning',
        title: expired
          ? `Expired Licence: ${d.name}`
          : `Expiring Licence: ${d.name}`,
        message: `Licence ${d.licenceNumber} ${expired ? 'expired on' : 'expires on'} ${d.licenceExpiryDate}.`,
        timestamp: d.licenceExpiryDate,
        targetTab: role === 'driver' ? 'dashboard' : 'drivers',
        entityId: d.id,
      });
    }
  }

  // 6. Expiring vehicle insurance
  if (role !== 'driver') {
    for (const v of vehicles) {
      if (!v.insuranceExpiryDate) continue;
      const expMs = new Date(v.insuranceExpiryDate).getTime();
      if (Number.isNaN(expMs)) continue;
      if (expMs <= now + thirtyDaysMs) {
        const expired = expMs < now;
        const policyRef = v.insurancePolicyNumber ? ` policy ${v.insurancePolicyNumber}` : '';
        notifications.push({
          id: `notif-insurance-${v.id}`,
          category: 'expiring_insurance',
          severity: expired ? 'critical' : 'warning',
          title: expired
            ? `Expired Insurance: ${v.registrationNumber}`
            : `Expiring Insurance: ${v.registrationNumber}`,
          message: `${v.insuranceProvider || 'Insurance'}${policyRef} ${expired ? 'expired on' : 'expires on'} ${v.insuranceExpiryDate}.`,
          timestamp: v.insuranceExpiryDate,
          targetTab: 'vehicles',
          entityId: v.id,
        });
      }
    }
  }

  return notifications;
}
