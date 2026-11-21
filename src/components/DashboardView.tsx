import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Disc,
  FileWarning,
  Fuel,
  Hospital,
  Hotel,
  IndianRupee,
  MapPin,
  Navigation,
  Pill,
  Plus,
  RefreshCw,
  ShieldAlert,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatDateTime, formatDelayMinutes } from '../lib/api.ts';
import type { DashboardPayload, Driver, User, Vehicle } from '../types.ts';
import { FeatureBanner } from './FeatureBanner.tsx';
import { SectionLogisticsDecor } from './FleetAmbientBackground.tsx';
import type { NearbyCategoryId } from './NearbyServicesView.tsx';
import {
  ScrollReveal,
  ScrollStorySection,
  SectionNavStrip,
  StaggerGrid,
  StaggerItem,
  type StoryStep,
} from './ScrollReveal.tsx';

gsap.registerPlugin(ScrollTrigger);
import { StatusLabel } from './StatusLabel.tsx';
import { TtsBriefingButton } from './TtsBriefingButton.tsx';

interface DashboardViewProps {
  user: User;
  data: DashboardPayload | null;
  loading: boolean;
  drivers: Driver[];
  vehicles: Vehicle[];
  onRefresh: () => void;
  onNavigate: (tab: string, nearbyCategory?: NearbyCategoryId) => void;
}

const DRIVER_ROADSIDE_SHORTCUTS: Array<{
  id: NearbyCategoryId;
  label: string;
  icon: typeof Fuel;
  tone: string;
  iconBg: string;
}> = [
  {
    id: 'petrol_pump',
    label: 'Petrol Pump',
    icon: Fuel,
    tone: 'border-amber-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-amber-400/60',
    iconBg: 'bg-[#F59E0B] text-[#081629]',
  },
  {
    id: 'police',
    label: 'Police Station',
    icon: ShieldAlert,
    tone: 'border-sky-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-sky-400/60',
    iconBg: 'bg-[#2563EB] text-white',
  },
  {
    id: 'hotel',
    label: 'Hotel & Stay',
    icon: Hotel,
    tone: 'border-indigo-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-indigo-400/60',
    iconBg: 'bg-indigo-500 text-white',
  },
  {
    id: 'tyre_shop',
    label: 'Tyre Shop',
    icon: Disc,
    tone: 'border-cyan-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-cyan-400/60',
    iconBg: 'bg-[#183B60] text-[#38BDF8] ring-1 ring-[#38BDF8]/40',
  },
  {
    id: 'medical',
    label: 'Medical',
    icon: Pill,
    tone: 'border-emerald-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-emerald-400/60',
    iconBg: 'bg-[#16A34A] text-white',
  },
  {
    id: 'hospital',
    label: 'Hospital',
    icon: Hospital,
    tone: 'border-red-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-red-400/60',
    iconBg: 'bg-[#DC2626] text-white',
  },
  {
    id: 'garage',
    label: 'Garage',
    icon: Wrench,
    tone: 'border-orange-400/30 bg-[#0B1D36]/90 text-slate-100 hover:bg-[#183B60]/85 hover:border-orange-400/60',
    iconBg: 'bg-[#F59E0B] text-[#081629]',
  },
];

function isExpiringOrMissing(dateStr?: string | null): boolean {
  if (!dateStr || !dateStr.trim()) return true;
  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return false;
  const daysLeft = (ms - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft <= 30;
}

export function DashboardView({
  user,
  data,
  loading,
  drivers,
  vehicles,
  onRefresh,
  onNavigate,
}: DashboardViewProps) {
  const dashboardRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = dashboardRootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const bgOverlays = gsap.utils.toArray<HTMLElement>('.ff-section-bg-shift', root);
        bgOverlays.forEach((overlay) => {
          gsap.fromTo(
            overlay,
            { opacity: 0.15 },
            {
              opacity: 0.85,
              ease: 'none',
              scrollTrigger: {
                trigger: overlay.parentElement ?? overlay,
                start: 'top 85%',
                end: 'bottom 25%',
                scrub: 1.2,
              },
            },
          );
        });
      });
    }, root);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, [data, user.role]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ff-card h-28 animate-pulse" />
          ))}
        </div>
        <div className="ff-card h-80 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ff-card p-8 text-center">
        <p className="text-sm text-slate-300">
          Unable to load dashboard telemetry.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="ff-btn-primary mt-4 h-9 px-4 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { kpis } = data;
  const isDriver = user.role === 'driver';
  const driverMap = new Map(drivers.map((d) => [d.id, d]));
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  // ---------------- DRIVER PORTAL DASHBOARD ----------------
  if (isDriver) {
    const assignedVehicle = vehicles[0] ?? null;
    const myProfile = drivers[0] ?? null;
    const activeOrNextTrip =
      data.upcomingTrips.find((t) => t.status === 'Running') ?? data.upcomingTrips[0] ?? null;

    const totalFinished = kpis.completedTrips;
    const onTimeCount = Math.max(0, totalFinished - kpis.delayedTrips);
    const onTimeRate =
      totalFinished > 0 ? Math.round((onTimeCount / totalFinished) * 100) : 100;

    const driverBrief = assignedVehicle
      ? `Driver overview for ${user.name}: assigned vehicle ${assignedVehicle.registrationNumber} (${assignedVehicle.status}), ${kpis.activeTrips} active trips, ${kpis.completedTrips} completed trips, and ${kpis.delayedTrips} delayed trips.`
      : `Driver overview for ${user.name}: no vehicle has been assigned to your account yet. You can share live device GPS or check nearby roadside services anytime.`;

    const driverStorySteps: StoryStep[] = [
      {
        id: 'drv-vehicle',
        eyebrow: 'Vehicle & RTO Compliance',
        title: assignedVehicle
          ? `${assignedVehicle.registrationNumber} Ready Check`
          : 'Awaiting Vehicle Assignment',
        description: assignedVehicle
          ? `${assignedVehicle.manufacturer} ${assignedVehicle.model}`.trim()
            ? `Inspect your assigned ${assignedVehicle.manufacturer} ${assignedVehicle.model}, insurance validity, fitness status, and odometer logs.`
            : `Inspect your assigned vehicle registered at ${assignedVehicle.rtoOffice || 'RTO'}, along with insurance and compliance records.`
          : 'Once your fleet owner assigns a vehicle from the RTO registry, full vehicle specs and policy validity appear here.',
        imageSrc: '/src/assets/images/bg_vehicles_fleet_yard_1795256519749.jpg',
        imageAlt: 'Fleet vehicle yard ready for dispatch',
        highlightLabel: 'Assigned Plate',
        highlightValue: assignedVehicle ? assignedVehicle.registrationNumber : 'Unassigned',
        surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#132E52]/60',
        icon: Truck,
        actionLabel: 'Open My Vehicle',
        onAction: () => onNavigate('vehicles'),
      },
      {
        id: 'drv-gps',
        eyebrow: 'Live Route & GPS Broadcast',
        title: activeOrNextTrip
          ? `${activeOrNextTrip.startingLocation.split(',')[0]} → ${activeOrNextTrip.destination.split(',')[0]}`
          : 'Live Device GPS Broadcast',
        description:
          'Share your live phone or vehicle coordinates directly with FleetFlow dispatch so arrival times and corridor progress stay synchronized.',
        imageSrc: '/src/assets/images/bg_trips_highway_corridor_1795256519073.jpg',
        imageAlt: 'Commercial truck driving along highway corridor',
        highlightLabel: 'Active Trips',
        highlightValue: `${kpis.activeTrips} Active`,
        surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#132E52]/60',
        icon: Navigation,
        actionLabel: 'Open Live GPS',
        onAction: () => onNavigate('tracking'),
      },
      {
        id: 'drv-roadside',
        eyebrow: 'Highway Support Radar',
        title: '7 Essential Nearby Roadside Services',
        description:
          'Locate the nearest petrol pumps, police stations, hotels, tyre shops, medical stores, hospitals, and repair garages around your live GPS coordinate.',
        imageSrc: '/src/assets/images/bg_nearby_roadside_station_1795256520028.jpg',
        imageAlt: 'Highway fuel and roadside service station',
        highlightLabel: 'Categories',
        highlightValue: '7 Essentials',
        surfaceTint: 'bg-gradient-to-br from-[#0A1D36]/68 via-[#071529]/72 to-[#103454]/60',
        icon: Compass,
        actionLabel: 'Find Nearby Services',
        onAction: () => onNavigate('nearby', 'all'),
      },
      {
        id: 'drv-salary',
        eyebrow: 'Transparent Earnings',
        title: 'On-Time Score & Monthly ₹ Payslips',
        description:
          'Track completed deliveries, reviewed delay logs, incentives, and approved monthly payouts cleanly in Indian Rupees.',
        imageSrc: '/src/assets/images/bg_payroll_operations_desk_1795256520432.jpg',
        imageAlt: 'Transport operations and payroll desk',
        highlightLabel: 'Pending Salary',
        highlightValue: formatCurrency(kpis.pendingSalaryAmount),
        surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#152E4D]/60',
        icon: IndianRupee,
        actionLabel: 'View My Payslips',
        onAction: () => onNavigate('salaries'),
      },
    ];

    return (
      <div ref={dashboardRootRef} className="space-y-8">
        <div id="driver-hero" className="scroll-mt-20 space-y-3">
          <FeatureBanner
            imageSrc="/src/assets/images/fleet_highway_backdrop_1795256358542.jpg"
            imageAlt="FleetFlow logistics fleet terminal"
            title="Driver Dashboard"
            subtitle="Your current duty, assigned vehicle, roadside help, and ₹ monthly salary"
          >
            <TtsBriefingButton label="Voice Summary" text={driverBrief} />
            <button
              type="button"
              onClick={onRefresh}
              className="ff-btn-warning h-9 px-3.5 text-xs shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </FeatureBanner>

          {/* Smooth Overlapping Section Navigation */}
          <div className="-mt-6 relative z-20 mx-1 sm:mx-3">
            <SectionNavStrip
              sections={[
                { id: 'driver-duty', label: 'Current Duty' },
                { id: 'driver-roadside', label: 'Roadside Help' },
                { id: 'driver-stats', label: 'Performance' },
                { id: 'driver-workflow', label: 'Duty Tour' },
                { id: 'driver-trips', label: 'Trip History' },
              ]}
            />
          </div>
        </div>

        {/* Driver Duty Hero Row: Current Trip + Assigned Vehicle */}
        <ScrollReveal id="driver-duty" className="scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Active / Next Trip Card */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="lg:col-span-7 ff-card p-5 flex flex-col justify-between hover:border-sky-400/45 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#38BDF8]">
                    {activeOrNextTrip?.status === 'Running' ? 'Current Active Duty' : 'Next Assigned Trip'}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-white">
                    {activeOrNextTrip
                      ? `${activeOrNextTrip.startingLocation} → ${activeOrNextTrip.destination}`
                      : 'No active trip assigned yet'}
                  </h2>
                </div>
                {activeOrNextTrip && <StatusLabel status={activeOrNextTrip.status} />}
              </div>

              {activeOrNextTrip ? (
                <div className="ff-subcard mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 text-xs">
                  <div>
                    <div className="text-slate-400">Trip Code</div>
                    <div className="mt-0.5 font-mono font-bold text-white">
                      {activeOrNextTrip.tripCode}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Departure</div>
                    <div className="mt-0.5 font-mono text-slate-200">
                      {formatDateTime(activeOrNextTrip.departureTime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Est. Arrival</div>
                    <div className="mt-0.5 font-mono text-slate-200">
                      {formatDateTime(activeOrNextTrip.estimatedArrivalTime)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-300">
                  {myProfile
                    ? 'No running or scheduled trips are currently assigned to you.'
                    : `Signed in as ${user.email}. Once your Fleet Owner assigns a trip, route timings appear here.`}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-3 border-t border-sky-400/15">
                <button
                  type="button"
                  onClick={() => onNavigate('trips')}
                  className="ff-btn-primary h-9 px-3.5 text-xs"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Open My Trips</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tracking')}
                  className="ff-btn-royal h-9 px-3.5 text-xs"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Share My Live GPS</span>
                </button>
              </div>
            </motion.div>

            {/* Assigned Vehicle Card */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="lg:col-span-5 ff-card p-5 flex flex-col justify-between hover:border-sky-400/45 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-[#38BDF8]">
                    Assigned Vehicle
                  </div>
                  <h2 className="mt-1 font-mono text-lg font-bold text-white">
                    {assignedVehicle ? assignedVehicle.registrationNumber : 'Unassigned'}
                  </h2>
                  <p className="text-xs text-slate-300">
                    {assignedVehicle
                      ? [
                          `${assignedVehicle.manufacturer} ${assignedVehicle.model}`.trim() ||
                            assignedVehicle.rtoOffice,
                          assignedVehicle.vehicleType,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'No vehicle assigned to your profile yet'}
                  </p>
                </div>
                {assignedVehicle ? (
                  <StatusLabel status={assignedVehicle.status} />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#183B60] text-[#38BDF8]">
                    <Truck className="h-5 w-5" />
                  </div>
                )}
              </div>

              {assignedVehicle && (
                <div className="ff-subcard mt-4 grid grid-cols-2 gap-3 text-xs p-3.5">
                  <div>
                    <div className="text-slate-400">Odometer</div>
                    <div className="mt-0.5 font-mono font-semibold text-white">
                      {assignedVehicle.odometerKm.toLocaleString()} km
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Last Live GPS</div>
                    <div className="mt-0.5 font-mono text-slate-200 truncate">
                      {assignedVehicle.lastLocation
                        ? `${assignedVehicle.lastLocation.lat.toFixed(3)}, ${assignedVehicle.lastLocation.lng.toFixed(3)}`
                        : 'Not shared yet'}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sky-400/15">
                <button
                  type="button"
                  onClick={() => onNavigate('vehicles')}
                  className="ff-btn-secondary h-8 px-3 text-xs"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Vehicle &amp; Insurance</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('salaries')}
                  className="ff-btn-success h-8 px-3 text-xs"
                >
                  <IndianRupee className="h-3.5 w-3.5" />
                  <span>My Salary</span>
                </button>
              </div>
            </motion.div>
          </div>
        </ScrollReveal>

        {/* Driver-Only Section: Nearest Roadside Help Shortcuts */}
        <ScrollReveal
          id="driver-roadside"
          className="scroll-mt-20 ff-section p-5"
        >
          <div
            aria-hidden="true"
            className="ff-section-bg-shift pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#2563EB]/14 via-transparent to-[#F59E0B]/10"
          />
          <SectionLogisticsDecor variant="blue" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Roadside &amp; Emergency Services (Driver Only)
              </h2>
              <p className="text-xs text-slate-300">
                Jump directly to the nearest essential service around your live vehicle or device GPS
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('nearby', 'all')}
              className="ff-btn-royal h-8 px-3 text-xs"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Open All Nearby</span>
            </button>
          </div>

          <StaggerGrid
            className="relative z-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5"
            staggerDelay={0.04}
          >
            {DRIVER_ROADSIDE_SHORTCUTS.map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={item.id}>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onNavigate('nearby', item.id)}
                    className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 text-center shadow-xs hover:shadow-md transition-all cursor-pointer ${item.tone}`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-xs ${item.iconBg}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-xs font-bold">{item.label}</span>
                  </motion.button>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </ScrollReveal>

        {/* Driver Personal Stats Strip */}
        <StaggerGrid id="driver-stats" className="scroll-mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <button
              type="button"
              onClick={() => onNavigate('trips')}
              className="ff-card w-full p-4 text-left hover:border-[#38BDF8]/60 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Completed Trips</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
                {kpis.completedTrips}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#38BDF8]">
                Delivered assignments
              </div>
            </button>
          </StaggerItem>
          <StaggerItem>
            <button
              type="button"
              onClick={() => onNavigate('delays')}
              className="ff-card w-full p-4 text-left border-amber-400/25 hover:border-[#F59E0B]/70 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Delayed Trips</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59E0B] text-[#081629]">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
                {kpis.delayedTrips}
              </div>
              <div className="mt-1 text-[11px] font-medium text-amber-300/90">
                Logged in audit
              </div>
            </button>
          </StaggerItem>
          <StaggerItem>
            <button
              type="button"
              onClick={() => onNavigate('delays')}
              className="ff-card w-full p-4 text-left border-emerald-400/25 hover:border-emerald-400/65 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">On-Time Rate</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16A34A] text-white">
                  <Navigation className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-300 tabular-nums">
                {onTimeRate}%
              </div>
              <div className="mt-1 text-[11px] font-medium text-emerald-300/90">
                Punctuality score
              </div>
            </button>
          </StaggerItem>
          <StaggerItem>
            <button
              type="button"
              onClick={() => onNavigate('salaries')}
              className="ff-card w-full p-4 text-left hover:border-[#38BDF8]/60 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Pending Salary</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                  <IndianRupee className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#38BDF8] tabular-nums">
                {formatCurrency(kpis.pendingSalaryAmount)}
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-300">
                Awaiting payout
              </div>
            </button>
          </StaggerItem>
        </StaggerGrid>

        {/* Pinned Driver Workflow Storytelling */}
        <ScrollStorySection
          id="driver-workflow"
          heading="Driver Duty Flow"
          subheading="Scroll through each step of your daily trip cycle — visuals stay pinned while modules update automatically"
          steps={driverStorySteps}
        />

        {/* Driver Trips Tables */}
        <ScrollReveal
          id="driver-trips"
          className="scroll-mt-20 ff-section p-4 sm:p-5"
        >
          <div
            aria-hidden="true"
            className="ff-section-bg-shift pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#2563EB]/12 via-transparent to-[#F59E0B]/10"
          />
          <SectionLogisticsDecor variant="slate" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="ff-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-sky-400/18 px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    My Upcoming &amp; Running Trips
                  </h2>
                  <p className="text-xs text-slate-300">
                    Scheduled dispatches assigned to you
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('trips')}
                  className="ff-btn-royal h-8 px-3 text-xs"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Open My Trips</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="ff-table-head">
                    <tr>
                      <th className="px-4 py-3 font-bold">Trip</th>
                      <th className="px-4 py-3 font-bold">Route</th>
                      <th className="px-4 py-3 font-bold">Est. Arrival</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-400/12">
                    {data.upcomingTrips.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          No upcoming trips assigned yet.
                        </td>
                      </tr>
                    ) : (
                      data.upcomingTrips.map((trip) => (
                        <tr key={trip.id} className="ff-table-row">
                          <td className="px-4 py-3 font-mono font-semibold text-white whitespace-nowrap">
                            {trip.tripCode}
                          </td>
                          <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">
                            {trip.startingLocation.split(',')[0]} → {trip.destination.split(',')[0]}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                            {formatDateTime(trip.estimatedArrivalTime)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusLabel status={trip.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ff-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-sky-400/18 px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Recent Trip History
                  </h2>
                  <p className="text-xs text-slate-300">
                    Your latest completed and delayed deliveries
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('delays')}
                  className="ff-btn-warning h-8 px-3 text-xs"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>View Delays</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="ff-table-head">
                    <tr>
                      <th className="px-4 py-3 font-bold">Trip</th>
                      <th className="px-4 py-3 font-bold">Route</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold text-right">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-400/12">
                    {data.recentTrips.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          No trips recorded yet
                        </td>
                      </tr>
                    ) : (
                      data.recentTrips.map((trip) => (
                        <tr key={trip.id} className="ff-table-row">
                          <td className="px-4 py-3 font-mono font-semibold text-white whitespace-nowrap">
                            {trip.tripCode}
                          </td>
                          <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">
                            {trip.startingLocation.split(',')[0]} → {trip.destination.split(',')[0]}
                          </td>
                          <td className="px-4 py-3">
                            <StatusLabel status={trip.status} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                            {trip.delayMinutes > 0 ? formatDelayMinutes(trip.delayMinutes) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    );
  }

  // ---------------- OWNER PORTAL DASHBOARD ----------------
  const activeVehiclesCount = vehicles.filter((v) => v.status === 'On Trip').length;

  const pendingDocumentsCount =
    vehicles.reduce((sum, v) => {
      let missingOrExpiring = 0;
      if (isExpiringOrMissing(v.insuranceExpiryDate)) missingOrExpiring += 1;
      if (isExpiringOrMissing(v.registrationExpiryDate)) missingOrExpiring += 1;
      if (isExpiringOrMissing(v.fitnessExpiryDate)) missingOrExpiring += 1;
      if (isExpiringOrMissing(v.pucExpiryDate)) missingOrExpiring += 1;
      return sum + missingOrExpiring;
    }, 0) +
    drivers.reduce((sum, d) => sum + (isExpiringOrMissing(d.licenceExpiryDate) ? 1 : 0), 0);

  const kpiCards = [
    {
      label: 'Total Vehicles',
      value: String(kpis.totalVehicles),
      sub: `${kpis.maintenanceVehicles} in maintenance`,
      statusTone: kpis.maintenanceVehicles > 0 ? 'text-amber-300' : 'text-slate-300',
      tab: 'vehicles',
      icon: Truck,
      cardTint: 'border-sky-300/24 bg-gradient-to-br from-[#0B1E38]/70 via-[#08172D]/74 to-[#143054]/64 backdrop-blur-md hover:border-[#38BDF8]/65',
      iconTone: 'bg-[#183B60] text-[#38BDF8] ring-1 ring-[#38BDF8]/35',
    },
    {
      label: 'Active Vehicles',
      value: String(activeVehiclesCount),
      sub: 'Currently on road',
      statusTone: 'text-[#38BDF8]',
      tab: 'tracking',
      icon: Navigation,
      cardTint: 'border-blue-400/28 bg-gradient-to-br from-[#0B1E38]/70 via-[#081830]/74 to-[#153461]/64 backdrop-blur-md hover:border-[#2563EB]',
      iconTone: 'bg-[#2563EB] text-white',
    },
    {
      label: 'Available Vehicles',
      value: String(kpis.availableVehicles),
      sub: 'Ready for dispatch',
      statusTone: 'text-emerald-300',
      tab: 'vehicles',
      icon: CheckCircle2,
      cardTint: 'border-emerald-400/26 bg-gradient-to-br from-[#0B1E38]/70 via-[#08192E]/74 to-[#0F313D]/64 backdrop-blur-md hover:border-emerald-400/65',
      iconTone: 'bg-[#16A34A] text-white',
    },
    {
      label: 'Total Drivers',
      value: String(kpis.totalDrivers),
      sub: 'Active fleet roster',
      statusTone: 'text-indigo-300',
      tab: 'drivers',
      icon: Users,
      cardTint: 'border-indigo-400/26 bg-gradient-to-br from-[#0B1E38]/70 via-[#0A1834]/74 to-[#172C5B]/64 backdrop-blur-md hover:border-indigo-400/65',
      iconTone: 'bg-indigo-600 text-white',
    },
    {
      label: 'Ongoing Trips',
      value: String(kpis.activeTrips),
      sub: 'Running corridors',
      statusTone: 'text-[#38BDF8]',
      tab: 'trips',
      icon: MapPin,
      cardTint: 'border-sky-400/28 bg-gradient-to-br from-[#0B1E38]/70 via-[#081830]/74 to-[#103659]/64 backdrop-blur-md hover:border-[#38BDF8]',
      iconTone: 'bg-sky-500 text-[#081629]',
    },
    {
      label: 'Completed Trips',
      value: String(kpis.completedTrips),
      sub: `${kpis.delayedTrips} delayed trips logged`,
      statusTone: kpis.delayedTrips > 0 ? 'text-amber-300' : 'text-emerald-300',
      tab: 'trips',
      icon: BarChart3,
      cardTint: 'border-teal-400/26 bg-gradient-to-br from-[#0B1E38]/70 via-[#08192F]/74 to-[#0F3346]/64 backdrop-blur-md hover:border-teal-400/65',
      iconTone: 'bg-teal-500 text-[#081629]',
    },
    {
      label: 'Pending Documents',
      value: String(pendingDocumentsCount),
      sub: 'Insurance, RC, PUC & Licences',
      statusTone: pendingDocumentsCount > 0 ? 'text-red-300' : 'text-emerald-300',
      tab: 'vehicles',
      icon: FileWarning,
      cardTint:
        pendingDocumentsCount > 0
          ? 'border-red-400/32 bg-gradient-to-br from-[#0B1E38]/70 via-[#141930]/74 to-[#2C1830]/64 backdrop-blur-md hover:border-red-400/75'
          : 'border-amber-400/26 bg-gradient-to-br from-[#0B1E38]/70 via-[#0A182E]/74 to-[#222B3B]/64 backdrop-blur-md hover:border-[#F59E0B]',
      iconTone: pendingDocumentsCount > 0 ? 'bg-[#DC2626] text-white' : 'bg-[#F59E0B] text-[#081629]',
    },
    {
      label: 'Pending ₹ Payroll',
      value: `${kpis.pendingSalaryPaymentsCount} · ${formatCurrency(kpis.pendingSalaryAmount)}`,
      sub: 'Awaiting owner approval',
      statusTone: 'text-amber-300',
      tab: 'salaries',
      icon: IndianRupee,
      cardTint: 'border-amber-400/28 bg-gradient-to-br from-[#0B1E38]/70 via-[#0B192E]/74 to-[#242B3D]/64 backdrop-blur-md hover:border-[#F59E0B]',
      iconTone: 'bg-[#F59E0B] text-[#081629]',
    },
  ];

  const hasAnyData =
    kpis.totalVehicles > 0 || kpis.totalDrivers > 0 || data.recentTrips.length > 0;

  const briefingLead = hasAnyData
    ? `FleetFlow owner summary for ${user.name}: ${kpis.activeTrips} ongoing trips currently on the road, ${activeVehiclesCount} active vehicles, ${kpis.availableVehicles} available vehicles, and ${pendingDocumentsCount} pending compliance documents.`
    : `FleetFlow owner summary for ${user.name}: no vehicles, drivers, or trips have been recorded in the system yet.`;
  const briefingCoord = hasAnyData
    ? `There are ${kpis.delayedTrips} delayed trips logged across the fleet and ${kpis.pendingSalaryPaymentsCount} monthly salary statements pending approval totaling ${formatCurrency(kpis.pendingSalaryAmount)}.`
    : `Add your fleet vehicles, drivers, and first dispatch schedule to begin tracking live operations and payroll.`;

  const ownerStorySteps: StoryStep[] = [
    {
      id: 'own-rto',
      eyebrow: 'RTO One-Plate Registry',
      title: 'Instant Vehicle Onboarding from Registration Number',
      description:
        'Enter just the registration number (or upload/paste mParivahan RC text) to populate state, RTO office, manufacturer, model, fuel, insurance, fitness, PUC, and road tax expiry.',
      imageSrc: '/src/assets/images/bg_vehicles_fleet_yard_1795256519749.jpg',
      imageAlt: 'Fleet yard of registered commercial vehicles',
      highlightLabel: 'Registered Fleet',
      highlightValue: `${kpis.totalVehicles} Vehicles`,
      surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#132E52]/60',
      icon: Truck,
      actionLabel: 'Open Vehicle Registry',
      onAction: () => onNavigate('vehicles'),
    },
    {
      id: 'own-dispatch',
      eyebrow: 'Crew & Dispatch',
      title: 'Assign Drivers & Schedule Highway Corridors',
      description:
        'Link active drivers to ready vehicles, set departure and ETA windows, and keep availability automatically synced with live trip execution.',
      imageSrc: '/src/assets/images/bg_drivers_highway_crew_1795256519728.jpg',
      imageAlt: 'Commercial fleet driver crew on dispatch',
      highlightLabel: 'Roster & En Route',
      highlightValue: `${kpis.totalDrivers} Drivers · ${kpis.activeTrips} Live`,
      surfaceTint: 'bg-gradient-to-br from-[#0A1D36]/68 via-[#071529]/72 to-[#142F58]/60',
      icon: Users,
      actionLabel: 'Manage Drivers & Trips',
      onAction: () => onNavigate('trips'),
    },
    {
      id: 'own-gps',
      eyebrow: 'Live Google Maps',
      title: 'Real-Time Fleet Coordinates & ETA Visibility',
      description:
        'Watch live truck markers across India on interactive maps with speed, heading, route completion, and real-time GPS refresh.',
      imageSrc: '/src/assets/images/bg_trips_highway_corridor_1795256519073.jpg',
      imageAlt: 'Heavy transport fleet moving on highway corridor',
      highlightLabel: 'Completed Trips',
      highlightValue: `${kpis.completedTrips} Delivered`,
      surfaceTint: 'bg-gradient-to-br from-[#091B34]/68 via-[#071529]/72 to-[#103454]/60',
      icon: Navigation,
      actionLabel: 'Open Live Fleet Map',
      onAction: () => onNavigate('tracking'),
    },
    {
      id: 'own-payroll',
      eyebrow: 'Audits & ₹ Payroll',
      title: 'Categorized Delay Audits & Transparent Driver Salaries',
      description:
        'Classify traffic vs. mechanical vs. driver delays, audit root causes, and approve monthly Indian Rupee statements with zero calculation ambiguity.',
      imageSrc: '/src/assets/images/bg_payroll_operations_desk_1795256520432.jpg',
      imageAlt: 'Transport payroll and operations control desk',
      highlightLabel: 'Pending Approval',
      highlightValue: formatCurrency(kpis.pendingSalaryAmount),
      surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#152E4D]/60',
      icon: IndianRupee,
      actionLabel: 'Review ₹ Payroll',
      onAction: () => onNavigate('salaries'),
    },
  ];

  return (
    <div ref={dashboardRootRef} className="space-y-8">
      {/* Workspace Action Bar with Parallax Backdrop & Smooth Overlapping Quick Dock */}
      <div id="dash-hero" className="scroll-mt-20">
        <FeatureBanner
          imageSrc="/src/assets/images/fleet_highway_backdrop_1795256358542.jpg"
          imageAlt="Commercial transport fleet lined up at logistics terminal"
          title="Owner Control Center"
          subtitle="Fleet-wide control across vehicles, drivers, dispatches, live GPS, delay audits & ₹ payroll"
        >
          <TtsBriefingButton
            label="Voice Briefing"
            text={briefingLead}
            secondaryText={briefingCoord}
            mode="dispatch_dialogue"
          />
          <button
            type="button"
            onClick={onRefresh}
            className="ff-btn-warning h-9 px-3.5 text-xs shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </FeatureBanner>

        {/* Overlapping Essential Owner Sections Quick Bar */}
        <StaggerGrid
          className="-mt-4 relative z-20 mx-1 sm:mx-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
          staggerDelay={0.04}
        >
          {[
            { label: 'Manage Vehicles', tab: 'vehicles', icon: Truck, btnTone: 'ff-btn-primary' },
            { label: 'Manage Drivers', tab: 'drivers', icon: Users, btnTone: 'ff-btn-royal' },
            { label: 'Dispatch Trips', tab: 'trips', icon: Plus, btnTone: 'ff-btn-success' },
            { label: 'Live Fleet Map', tab: 'tracking', icon: Navigation, btnTone: 'ff-btn-primary' },
            { label: 'Delay Audits', tab: 'delays', icon: Clock, btnTone: 'ff-btn-warning' },
            { label: 'Payroll & Reports', tab: 'salaries', icon: IndianRupee, btnTone: 'ff-btn-royal' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.tab}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className={`${item.btnTone} w-full h-10 px-3 text-xs shadow-md`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        {/* Section Jump Navigation Strip */}
        <div className="mt-4">
          <SectionNavStrip
            sections={[
              { id: 'dash-kpis', label: 'Fleet KPIs' },
              { id: 'dash-workflow', label: 'Operations Tour' },
              { id: 'dash-analytics', label: 'Analytics' },
              { id: 'dash-schedules', label: 'Schedules & Trips' },
            ]}
          />
        </div>
      </div>

      {/* Control-Center 8-Card Statistic Grid */}
      <section
        id="dash-kpis"
        className="scroll-mt-20 ff-section p-4 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="ff-section-bg-shift pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#2563EB]/14 via-transparent to-[#F59E0B]/10"
        />
        <SectionLogisticsDecor variant="blue" />
        <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Live Fleet Control Metrics
            </h2>
            <p className="text-xs text-slate-300">
              Real-time overview across vehicles, drivers, active dispatches, compliance documents &amp; payroll
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-amber-400/35 bg-amber-500/18 px-2.5 py-1 text-amber-300">
              Maintenance: {kpis.maintenanceVehicles}
            </span>
            <span className="rounded-full border border-red-400/35 bg-red-500/20 px-2.5 py-1 text-red-300">
              Delayed Trips: {kpis.delayedTrips}
            </span>
          </div>
        </div>

        <StaggerGrid
          className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          staggerDelay={0.05}
        >
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <StaggerItem key={card.label}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate(card.tab)}
                  className={`group w-full rounded-2xl border p-4 text-left shadow-md hover:shadow-xl transition-all cursor-pointer ${card.cardTint}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      {card.label}
                    </span>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs ${card.iconTone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-2xl font-extrabold tracking-tight text-white tabular-nums">
                    {card.value}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className={`font-medium ${card.statusTone}`}>{card.sub}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-70 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 text-[#38BDF8]" />
                  </div>
                </motion.button>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* Pinned Scroll-Based Operations Storytelling */}
      <ScrollStorySection
        id="dash-workflow"
        heading="Fleet Operations Lifecycle"
        subheading="Scroll through each operational pillar — preview imagery stays sticky as sections progress"
        steps={ownerStorySteps}
      />

      {/* Charts Row */}
      <ScrollReveal
        id="dash-analytics"
        className="scroll-mt-20 ff-section p-4 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="ff-section-bg-shift pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#38BDF8]/10 via-transparent to-[#2563EB]/14"
        />
        <SectionLogisticsDecor variant="slate" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Monthly Trip Statistics */}
          <div className="lg:col-span-5 ff-card p-5 hover:border-sky-400/45 transition-all">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold text-white">
                Monthly Trip Statistics
              </h2>
              <p className="text-xs text-slate-300">
                Completed vs. delayed dispatches by month
              </p>
            </div>
            {data.monthlyTripStats.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                No trips recorded yet
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyTripStats} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.14)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#081629',
                        borderRadius: '10px',
                        border: '1px solid rgba(56,189,248,0.35)',
                        color: '#F1F5F9',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />
                    <Bar dataKey="completed" name="Completed" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delayed" name="Delayed" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="activeOrScheduled" name="Active / Scheduled" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Driver Performance Chart */}
          <div className="lg:col-span-4 ff-card p-5 hover:border-sky-400/45 transition-all">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold text-white">
                Driver Performance
              </h2>
              <p className="text-xs text-slate-300">
                On-time deliveries vs. delayed trips per driver
              </p>
            </div>
            {data.driverPerformance.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                No drivers added yet
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.driverPerformance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.14)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#081629',
                        borderRadius: '10px',
                        border: '1px solid rgba(56,189,248,0.35)',
                        color: '#F1F5F9',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />
                    <Bar dataKey="onTime" name="On Time" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delayed" name="Delayed" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Vehicle Utilization Chart */}
          <div className="lg:col-span-3 ff-card p-5 hover:border-sky-400/45 transition-all">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold text-white">
                Vehicle Utilization
              </h2>
              <p className="text-xs text-slate-300">
                Current fleet operational status
              </p>
            </div>
            {data.vehicleUtilization.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                No vehicles added yet
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.vehicleUtilization}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={48}
                      outerRadius={74}
                      paddingAngle={3}
                    >
                      {data.vehicleUtilization.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#081629',
                        borderRadius: '10px',
                        border: '1px solid rgba(56,189,248,0.35)',
                        color: '#F1F5F9',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#CBD5E1' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* Recent & Upcoming Tables */}
      <ScrollReveal
        id="dash-schedules"
        className="scroll-mt-20 ff-section p-4 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="ff-section-bg-shift pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#2563EB]/12 via-transparent to-[#F59E0B]/10"
        />
        <SectionLogisticsDecor variant="amber" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Trip Activities */}
          <div className="ff-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-sky-400/18 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Recent Trip Activities
                </h2>
                <p className="text-xs text-slate-300">
                  Latest completed, delayed, and active dispatches
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="ff-btn-royal h-8 px-3 text-xs"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Full Reports</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="ff-table-head">
                  <tr>
                    <th className="px-4 py-3 font-bold">Trip</th>
                    <th className="px-4 py-3 font-bold">Route</th>
                    <th className="px-4 py-3 font-bold">Driver</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-400/12">
                  {data.recentTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No trips recorded yet
                      </td>
                    </tr>
                  ) : (
                    data.recentTrips.map((trip) => (
                      <tr key={trip.id} className="ff-table-row">
                        <td className="px-4 py-3 font-mono font-semibold text-white whitespace-nowrap">
                          {trip.tripCode}
                        </td>
                        <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">
                          {trip.startingLocation.split(',')[0]} → {trip.destination.split(',')[0]}
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {driverMap.get(trip.driverId)?.name ?? trip.driverId}
                        </td>
                        <td className="px-4 py-3">
                          <StatusLabel status={trip.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {trip.delayMinutes > 0 ? formatDelayMinutes(trip.delayMinutes) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Trip Schedules */}
          <div className="ff-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-sky-400/18 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Upcoming &amp; Running Schedules
                </h2>
                <p className="text-xs text-slate-300">
                  Next scheduled departures and live routes
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('trips')}
                className="ff-btn-primary h-8 px-3 text-xs"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Manage Trips</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="ff-table-head">
                  <tr>
                    <th className="px-4 py-3 font-bold">Trip</th>
                    <th className="px-4 py-3 font-bold">Vehicle</th>
                    <th className="px-4 py-3 font-bold">Departure</th>
                    <th className="px-4 py-3 font-bold">Est. Arrival</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-400/12">
                  {data.upcomingTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No upcoming scheduled trips.
                      </td>
                    </tr>
                  ) : (
                    data.upcomingTrips.map((trip) => (
                      <tr key={trip.id} className="ff-table-row">
                        <td className="px-4 py-3 font-mono font-semibold text-white whitespace-nowrap">
                          {trip.tripCode}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                          {vehicleMap.get(trip.vehicleId)?.registrationNumber ?? trip.vehicleId}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {formatDateTime(trip.departureTime)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {formatDateTime(trip.estimatedArrivalTime)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusLabel status={trip.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
