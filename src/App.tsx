import {
  AlertTriangle,
  BarChart3,
  Bell,
  Clock,
  Compass,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Truck,
  Users,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useScroll,
  useSpring,
} from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

gsap.registerPlugin(ScrollTrigger);
import { DashboardView } from './components/DashboardView.tsx';
import { FleetAmbientBackground } from './components/FleetAmbientBackground.tsx';
import { DelaysView } from './components/DelaysView.tsx';
import { DriversView } from './components/DriversView.tsx';
import { LiveTrackingView } from './components/LiveTrackingView.tsx';
import { LoginView } from './components/LoginView.tsx';
import { NearbyServicesView, type NearbyCategoryId } from './components/NearbyServicesView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SalariesView } from './components/SalariesView.tsx';
import { ScrollReveal } from './components/ScrollReveal.tsx';
import { TripsView } from './components/TripsView.tsx';
import { TtsBriefingButton } from './components/TtsBriefingButton.tsx';
import { VehiclesView } from './components/VehiclesView.tsx';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api.ts';
import type {
  AppNotification,
  DashboardPayload,
  DelayRecord,
  Driver,
  SalaryConfigRules,
  SalaryRecord,
  Trip,
  User,
  Vehicle,
} from './types.ts';

type TabId =
  | 'dashboard'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'tracking'
  | 'nearby'
  | 'delays'
  | 'salaries'
  | 'reports';

const SECTION_IDS: Record<TabId, string> = {
  dashboard: 'section-dashboard',
  vehicles: 'section-vehicles',
  drivers: 'section-drivers',
  trips: 'section-trips',
  tracking: 'section-tracking',
  nearby: 'section-nearby',
  delays: 'section-delays',
  salaries: 'section-salaries',
  reports: 'section-reports',
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fleetflow_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('fleetflow_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const programmaticScrollUntilRef = useRef<number>(0);

  const { scrollYProgress } = useScroll();
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });
  const [nearbyCategory, setNearbyCategory] = useState<NearbyCategoryId>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [loadingData, setLoadingData] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [delays, setDelays] = useState<DelayRecord[]>([]);
  const [delayDriverSummary, setDelayDriverSummary] = useState<
    Array<{
      driverId: string;
      driverName: string;
      delayedCount: number;
      totalDelayMinutes: number;
      totalDelayFormatted: string;
      pendingReviewCount: number;
    }>
  >([]);
  const [monthlyDelays, setMonthlyDelays] = useState<
    Array<{ month: string; count: number; totalMinutes: number }>
  >([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [salaryRules, setSalaryRules] = useState<SalaryConfigRules | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashRes, vehRes, drvRes, trpRes, dlyRes, salRes, notifRes] = await Promise.all([
        apiRequest<DashboardPayload>('/api/dashboard'),
        apiRequest<{ vehicles: Vehicle[] }>('/api/vehicles'),
        apiRequest<{ drivers: Driver[] }>('/api/drivers'),
        apiRequest<{ trips: Trip[] }>('/api/trips'),
        apiRequest<{
          delays: DelayRecord[];
          driverSummary: typeof delayDriverSummary;
          monthlyDelays: typeof monthlyDelays;
        }>('/api/delays'),
        apiRequest<{ salaries: SalaryRecord[]; rules: SalaryConfigRules }>('/api/salaries'),
        apiRequest<{ notifications: AppNotification[] }>('/api/notifications'),
      ]);

      setDashboardData(dashRes);
      setVehicles(vehRes.vehicles);
      setDrivers(drvRes.drivers);
      setTrips(trpRes.trips);
      setDelays(dlyRes.delays);
      setDelayDriverSummary(dlyRes.driverSummary);
      setMonthlyDelays(dlyRes.monthlyDelays);
      setSalaries(salRes.salaries);
      setSalaryRules(salRes.rules);
      setNotifications(notifRes.notifications);
    } catch {
      // Token may be invalid
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    apiRequest<{ user: User }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        return loadAllData();
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, [loadAllData]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'auto' });
    void loadAllData();
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setNotifOpen(false);
  };

  const isDriver = user?.role === 'driver';

  const navItems = useMemo(() => {
    if (!user) return [];
    const driverMode = user.role === 'driver';
    const items: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
      { id: 'dashboard', label: driverMode ? 'Driver Dashboard' : 'Owner Dashboard', icon: LayoutDashboard },
      {
        id: 'vehicles',
        label: driverMode ? 'My Vehicle' : 'Vehicles',
        icon: Truck,
      },
    ];
    if (!driverMode) {
      items.push({ id: 'drivers', label: 'Drivers', icon: Users });
    }
    items.push(
      {
        id: 'trips',
        label: driverMode ? 'My Trips' : 'Trip Management',
        icon: MapPin,
      },
      {
        id: 'tracking',
        label: driverMode ? 'My Live GPS' : 'Live Fleet Tracking',
        icon: Navigation,
      },
    );
    if (driverMode) {
      items.push({
        id: 'nearby',
        label: 'Nearby Services',
        icon: Compass,
      });
    }
    items.push(
      { id: 'delays', label: driverMode ? 'My Delays' : 'Delay Audit', icon: Clock },
      {
        id: 'salaries',
        label: driverMode ? 'My Payslips' : 'Payroll & Salaries',
        icon: IndianRupee,
      },
    );
    if (!driverMode) {
      items.push({ id: 'reports', label: 'Reports & Export', icon: BarChart3 });
    }
    return items;
  }, [user]);

  const navigateToSection = useCallback(
    (tabId: TabId, cat?: NearbyCategoryId) => {
      if (cat) {
        setNearbyCategory(cat);
      }
      if (!navItems.some((item) => item.id === tabId)) {
        return;
      }

      setActiveTab(tabId);
      programmaticScrollUntilRef.current = Date.now() + 900;

      const targetEl = document.getElementById(SECTION_IDS[tabId]);
      if (targetEl) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const headerOffset = 80;
        const targetTop = targetEl.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
    },
    [navItems],
  );

  // Automatic scroll-based active section detection synchronized with sidebar navigation
  useEffect(() => {
    if (!user || navItems.length === 0) return;

    const sectionPairs = navItems
      .map((item) => ({
        id: item.id,
        el: document.getElementById(SECTION_IDS[item.id]),
      }))
      .filter((pair): pair is { id: TabId; el: HTMLElement } => pair.el !== null);

    if (sectionPairs.length === 0) return;

    let rafId = 0;

    const updateActiveSectionFromScroll = () => {
      if (Date.now() < programmaticScrollUntilRef.current) {
        return;
      }

      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;

      if (scrollTop < 48) {
        setActiveTab((prev) => (prev === sectionPairs[0].id ? prev : sectionPairs[0].id));
        return;
      }

      if (winHeight + scrollTop >= docHeight - 36) {
        const lastId = sectionPairs[sectionPairs.length - 1].id;
        setActiveTab((prev) => (prev === lastId ? prev : lastId));
        return;
      }

      const thresholdY = 170;
      let detectedId = sectionPairs[0].id;
      for (const pair of sectionPairs) {
        const rect = pair.el.getBoundingClientRect();
        if (rect.top <= thresholdY && rect.bottom > 96) {
          detectedId = pair.id;
        }
      }

      setActiveTab((prev) => (prev === detectedId ? prev : detectedId));
    };

    const scheduleCheck = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updateActiveSectionFromScroll);
    };

    const releaseProgrammaticLock = () => {
      programmaticScrollUntilRef.current = 0;
    };

    const observer = new IntersectionObserver(
      () => {
        scheduleCheck();
      },
      {
        rootMargin: '-84px 0px -30% 0px',
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    sectionPairs.forEach((pair) => observer.observe(pair.el));
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('wheel', releaseProgrammaticLock, { passive: true });
    window.addEventListener('touchstart', releaseProgrammaticLock, { passive: true });

    updateActiveSectionFromScroll();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('wheel', releaseProgrammaticLock);
      window.removeEventListener('touchstart', releaseProgrammaticLock);
    };
  }, [user, navItems]);

  useEffect(() => {
    if (!loadingData && user) {
      const id = window.setTimeout(() => ScrollTrigger.refresh(), 100);
      return () => window.clearTimeout(id);
    }
  }, [loadingData, user]);

  const currentTabLabel =
    navItems.find((n) => n.id === activeTab)?.label ?? (isDriver ? 'My Overview' : 'Dashboard');

  if (authChecking) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen flex items-center justify-center bg-[#081629] text-sm text-slate-300">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2.5"
          >
            <Truck className="h-4 w-4 text-[#38BDF8] animate-pulse" />
            <span>Loading FleetFlow workspace...</span>
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
        />
      </MotionConfig>
    );
  }

  const refreshAll = () => loadAllData();
  const notificationBriefText =
    notifications.length === 0
      ? 'All FleetFlow alerts are clear. No expired documents or pending delay reviews.'
      : `You have ${notifications.length} active operational alerts. ${notifications
          .slice(0, 5)
          .map((n) => `${n.title}: ${n.message}`)
          .join('. ')}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen flex bg-[#0b0d12] text-slate-100">
        {/* Outermost Full-Window Cinematic Autumn Transportation Canvas */}
        <FleetAmbientBackground variant="workspace" />

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Frosted Dark Enterprise Sidebar (Sticky & Collapsible on Desktop + Drawer on Mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-amber-200/18 bg-[#0C0F17]/74 text-slate-200 shadow-2xl backdrop-blur-xl transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:z-20 lg:translate-x-0 shrink-0 ${
          sidebarCollapsed ? 'lg:w-20 w-64' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md">
              <Truck className="h-4.5 w-4.5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-display text-lg font-bold tracking-tight text-white block leading-none">
                  FleetFlow
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B]">
                  {isDriver ? 'Driver Console' : 'Owner Control'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-white/20 lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:inline-flex rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-[#2563EB] hover:text-white transition-colors cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="hidden lg:flex justify-center border-b border-white/10 py-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="inline-flex rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-[#2563EB] hover:text-white transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                aria-current={active ? 'location' : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                whileHover={{ x: sidebarCollapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
                onClick={() => navigateToSection(item.id)}
                className={`w-full flex items-center ${
                  sidebarCollapsed ? 'lg:justify-center px-3' : 'justify-between px-3.5'
                } gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-md shadow-blue-950/40 ring-1 ring-[#F59E0B]/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-300'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {active && (
                  <span
                    className={`h-2 w-2 rounded-full bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.85)] shrink-0 ${
                      sidebarCollapsed ? 'hidden lg:block' : ''
                    }`}
                    aria-hidden="true"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* User Footer Card */}
        <div className="border-t border-white/10 p-3.5 bg-[#0F223B]/70">
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'lg:flex-col' : ''}`}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover border-2 border-[#2563EB] shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white shrink-0 ring-2 ring-[#F59E0B]/60">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-300">
                  {user.role === 'driver' ? 'Driver Portal' : 'Fleet Owner'}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DC2626] text-white shadow-xs transition-all hover:bg-[#B91C1C] hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {mapsQuotaExceeded && (
          <div className="bg-amber-950/90 border-b border-amber-400/35 text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm backdrop-blur-md">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-300 hover:text-amber-200"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-amber-200/18 bg-[#0C0F17]/74 px-4 sm:px-6 backdrop-blur-xl shadow-[0_8px_24px_-8px_rgba(4,4,8,0.75)]">
          {/* Scroll Progress Indicator */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-[#38BDF8] via-[#2563EB] to-[#F59E0B]"
            style={{ scaleX: smoothScrollProgress }}
          />
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="ff-btn-primary h-9 w-9 p-0 lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              <span className="font-display font-bold text-white">FleetFlow</span>
              <span className="hidden sm:inline rounded-md border border-sky-400/30 bg-[#183B60] px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                {user.role === 'driver' ? 'Driver Portal' : 'Owner Portal'}
              </span>
              <span aria-hidden="true" className="text-sky-400/50">/</span>
              <span className="truncate font-semibold text-slate-200">{currentTabLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            {/* Notifications Trigger */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setNotifOpen((o) => !o)}
              aria-label="Toggle notifications"
              className="ff-btn-primary h-9 px-3.5 text-xs"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
              {notifications.length > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1.5 font-mono text-[11px] font-bold text-[#081629]">
                  {notifications.length}
                </span>
              )}
            </motion.button>

            {/* Theme Contrast Toggle */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to standard midnight navy' : 'Switch to ultra midnight navy'}
              className="ff-btn-secondary h-9 w-9 p-0"
            >
              {darkMode ? <Sun className="h-4 w-4 text-[#F59E0B]" /> : <Moon className="h-4 w-4 text-[#38BDF8]" />}
            </motion.button>

            {/* Animated Notifications Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="ff-modal absolute right-0 top-12 z-50 w-80 sm:w-96 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-sky-400/20 bg-[#102746] px-4 py-3 text-white">
                    <span className="font-display text-sm font-bold">
                      Operational Alerts ({notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      aria-label="Close alerts"
                      className="rounded-lg bg-white/10 p-1 text-white hover:bg-white/20 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="border-b border-sky-400/15 px-4 py-2.5 bg-[#081629]/80">
                    <TtsBriefingButton
                      label="Read Alerts Aloud"
                      text={notificationBriefText}
                      compact
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-sky-400/12">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No active operational warnings.
                      </div>
                    ) : (
                      notifications.map((n, idx) => (
                        <motion.button
                          key={n.id}
                          type="button"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => {
                            if (navItems.some((item) => item.id === n.targetTab)) {
                              navigateToSection(n.targetTab as TabId);
                            }
                            setNotifOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-[#183B60]/55 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <AlertTriangle
                              className={`h-3.5 w-3.5 shrink-0 ${
                                n.severity === 'critical'
                                  ? 'text-red-400'
                                  : n.severity === 'warning'
                                    ? 'text-[#F59E0B]'
                                    : 'text-[#38BDF8]'
                              }`}
                            />
                            <span className="text-slate-100">{n.title}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-300">
                            {n.message}
                          </p>
                        </motion.button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Single-Page Scrollable Workspace Connected to Interactive Sidebar */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-12">
          <section id={SECTION_IDS.dashboard} className="scroll-mt-20">
            <DashboardView
              user={user}
              data={dashboardData}
              loading={loadingData}
              drivers={drivers}
              vehicles={vehicles}
              onRefresh={refreshAll}
              onNavigate={(tab, cat) => {
                navigateToSection(tab as TabId, cat);
              }}
            />
          </section>

          <ScrollReveal id={SECTION_IDS.vehicles} className="scroll-mt-20">
            <VehiclesView
              role={user.role}
              vehicles={vehicles}
              drivers={drivers}
              onRefresh={refreshAll}
            />
          </ScrollReveal>

          {user.role !== 'driver' && (
            <ScrollReveal id={SECTION_IDS.drivers} className="scroll-mt-20">
              <DriversView
                role={user.role}
                drivers={drivers}
                vehicles={vehicles}
                onRefresh={refreshAll}
              />
            </ScrollReveal>
          )}

          <ScrollReveal id={SECTION_IDS.trips} className="scroll-mt-20">
            <TripsView
              role={user.role}
              trips={trips}
              drivers={drivers}
              vehicles={vehicles}
              onRefresh={refreshAll}
            />
          </ScrollReveal>

          <ScrollReveal id={SECTION_IDS.tracking} className="scroll-mt-20">
            <LiveTrackingView role={user.role} onRefreshAll={refreshAll} />
          </ScrollReveal>

          {user.role === 'driver' && (
            <ScrollReveal id={SECTION_IDS.nearby} className="scroll-mt-20">
              <NearbyServicesView
                role={user.role}
                initialCategory={nearbyCategory}
                onNavigate={(tab) => {
                  navigateToSection(tab as TabId);
                }}
              />
            </ScrollReveal>
          )}

          <ScrollReveal id={SECTION_IDS.delays} className="scroll-mt-20">
            <DelaysView
              role={user.role}
              delays={delays}
              driverSummary={delayDriverSummary}
              monthlyDelays={monthlyDelays}
              drivers={drivers}
              onRefresh={refreshAll}
            />
          </ScrollReveal>

          <ScrollReveal id={SECTION_IDS.salaries} className="scroll-mt-20">
            <SalariesView
              role={user.role}
              salaries={salaries}
              rules={salaryRules}
              drivers={drivers}
              onRefresh={refreshAll}
            />
          </ScrollReveal>

          {user.role !== 'driver' && (
            <ScrollReveal id={SECTION_IDS.reports} className="scroll-mt-20 pb-8">
              <ReportsView
                trips={trips}
                delays={delays}
                salaries={salaries}
                drivers={drivers}
                vehicles={vehicles}
              />
            </ScrollReveal>
          )}
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}
