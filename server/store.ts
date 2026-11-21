import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import type { FleetDatabase, SalaryConfigRules, User } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fleetflow.json');

function createDefaultUsers(): User[] {
  const ownerHash = bcrypt.hashSync('owner123', 10);
  const driverHash = bcrypt.hashSync('driver123', 10);

  return [
    {
      id: 'USR-OWNER',
      name: 'Fleet Owner',
      email: 'owner@fleetflow.io',
      passwordHash: ownerHash,
      role: 'owner',
    },
    {
      id: 'USR-DRIVER',
      name: 'Driver Account',
      email: 'driver@fleetflow.io',
      passwordHash: driverHash,
      role: 'driver',
    },
  ];
}

function createCleanDatabase(): FleetDatabase {
  const salaryRules: SalaryConfigRules = {
    defaultOvertimeRatePerHour: 0,
    defaultNightAllowancePerTrip: 0,
    defaultTripAllowance: 0,
    defaultPerTripPay: 0,
    currencySymbol: '₹',
    autoPenalizeDelays: false,
    updatedAt: new Date().toISOString(),
  };

  return {
    users: createDefaultUsers(),
    vehicles: [],
    drivers: [],
    trips: [],
    delays: [],
    salaryRules,
    salaries: [],
  };
}

let cachedDb: FleetDatabase | null = null;

export function getDb(): FleetDatabase {
  if (cachedDb) return cachedDb;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as FleetDatabase;
      // Ensure primary Owner portal account exists without disturbing any business records
      if (!parsed.users.some((u) => u.email.toLowerCase() === 'owner@fleetflow.io')) {
        parsed.users.unshift({
          id: 'USR-OWNER',
          name: 'Fleet Owner',
          email: 'owner@fleetflow.io',
          passwordHash: bcrypt.hashSync('owner123', 10),
          role: 'owner',
        });
        saveDb(parsed);
      }
      cachedDb = parsed;
      return cachedDb;
    } catch {
      // Fallback to clean empty structure if file cannot be parsed
    }
  }

  cachedDb = createCleanDatabase();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: FleetDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  cachedDb = db;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function resetToCleanDatabase(): FleetDatabase {
  const clean = createCleanDatabase();
  saveDb(clean);
  return clean;
}
