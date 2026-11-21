export type UserRole = 'owner' | 'driver' | 'admin' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  driverId?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  driverId?: string;
  avatarUrl?: string;
  phone?: string;
}

export type VehicleStatus = 'Available' | 'On Trip' | 'Maintenance';

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  cost: number;
  vendor: string;
  nextServiceDue?: string;
}

export interface VehicleLocation {
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  locationLabel?: string;
  updatedAt: string;
  updatedBy: string;
  source: 'gps' | 'manual' | 'telemetry';
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  manufacturer: string;
  model: string;
  year: number;
  fuelType: string;
  capacity: string;
  assignedDriverId: string | null;
  status: VehicleStatus;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceExpiryDate: string;
  registrationDate: string;
  registrationExpiryDate: string;
  rtoCode?: string;
  rtoState?: string;
  rtoOffice?: string;
  fitnessExpiryDate?: string;
  pucExpiryDate?: string;
  permitExpiryDate?: string;
  chassisNumber?: string;
  engineNumber?: string;
  rtoSource?: 'live_api' | 'rto_code' | 'manual';
  rtoLastSyncedAt?: string;
  odometerKm: number;
  maintenanceHistory: MaintenanceRecord[];
  lastLocation?: VehicleLocation | null;
  locationHistory?: VehicleLocation[];
}

export type SalaryType = 'fixed' | 'per_trip' | 'fixed_plus_allowance';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  licenceNumber: string;
  licenceClass: string;
  licenceExpiryDate: string;
  assignedVehicleId: string | null;
  joiningDate: string;
  salaryType: SalaryType;
  basicSalary: number;
  tripAllowanceRate: number;
  overtimeRatePerHour: number;
  nightAllowanceRate: number;
  avatarUrl?: string;
  status: 'Active' | 'On Leave' | 'Inactive';
}

export type TripStatus = 'Scheduled' | 'Running' | 'Completed' | 'Delayed' | 'Cancelled';

export type DelayReason =
  | 'Traffic'
  | 'Road conditions'
  | 'Vehicle breakdown'
  | 'Loading/unloading'
  | 'Weather'
  | 'Personal or other';

export interface Trip {
  id: string;
  tripCode: string;
  vehicleId: string;
  driverId: string;
  startingLocation: string;
  destination: string;
  departureTime: string;
  estimatedArrivalTime: string;
  actualArrivalTime: string | null;
  totalDistanceKm: number;
  status: TripStatus;
  expenses: number;
  fuelCost: number;
  tollCost: number;
  otherExpenses: number;
  notes: string;
  delayMinutes: number;
  delayReason: DelayReason | null;
  delaySubmittedByDriver?: boolean;
  nightShift?: boolean;
  overtimeHours?: number;
  createdAt: string;
  updatedAt: string;
}

export type DelayReviewStatus = 'Pending Review' | 'Reviewed - No Penalty' | 'Reviewed - Escalated';

export interface DelayRecord {
  id: string;
  tripId: string;
  tripCode: string;
  driverId: string;
  vehicleId: string;
  route: string;
  estimatedArrivalTime: string;
  actualArrivalTime: string;
  delayMinutes: number;
  delayFormatted: string;
  reason: DelayReason | 'Unclassified';
  driverExplanation: string;
  adminNotes: string;
  reviewStatus: DelayReviewStatus;
  salaryAdjustmentApproved: boolean;
  recordedAt: string;
}

export interface SalaryConfigRules {
  defaultOvertimeRatePerHour: number;
  defaultNightAllowancePerTrip: number;
  defaultTripAllowance: number;
  defaultPerTripPay: number;
  currencySymbol: string;
  autoPenalizeDelays: false; // Strictly prohibited by business policy
  updatedAt: string;
}

export type SalaryApprovalStatus = 'Pending Approval' | 'Approved' | 'Paid';

export interface SalaryRecord {
  id: string;
  driverId: string;
  month: string; // YYYY-MM
  salaryType: SalaryType;
  basicSalary: number;
  completedTrips: number;
  delayedTripsCount: number;
  tripAllowances: number;
  nightAllowances: number;
  overtimeHours: number;
  overtimePay: number;
  approvedBonuses: number;
  approvedDeductions: number;
  advancePayments: number;
  finalPayableSalary: number;
  status: SalaryApprovalStatus;
  notes: string;
  delayAuditNote: string;
  approvedBy?: string;
  approvedAt?: string;
  generatedAt: string;
}

export type NotificationSeverity = 'critical' | 'warning' | 'info';
export type NotificationCategory =
  | 'delayed_trip'
  | 'upcoming_trip'
  | 'salary_approval'
  | 'vehicle_maintenance'
  | 'expiring_licence'
  | 'expiring_insurance';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string;
  targetTab: string;
  entityId?: string;
}

export interface FleetDatabase {
  users: User[];
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  delays: DelayRecord[];
  salaryRules: SalaryConfigRules;
  salaries: SalaryRecord[];
}
