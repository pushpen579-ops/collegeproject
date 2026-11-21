import {
  ArrowDown,
  ArrowUp,
  Building2,
  Compass,
  Eye,
  EyeOff,
  FileCheck2,
  IndianRupee,
  Lock,
  Mail,
  Moon,
  Navigation,
  Phone,
  ShieldCheck,
  Sun,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest, setStoredToken } from '../lib/api.ts';
import type { User } from '../types.ts';
import {
  FleetAmbientBackground,
  LogisticsHeroPatternOverlay,
  SectionLogisticsDecor,
} from './FleetAmbientBackground.tsx';
import {
  ScrollReveal,
  ScrollStorySection,
  SectionNavStrip,
  StaggerGrid,
  StaggerItem,
  type StoryStep,
} from './ScrollReveal.tsx';

gsap.registerPlugin(ScrollTrigger);

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

type PortalType = 'owner' | 'driver';
type AuthMode = 'signin' | 'register';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const PORTAL_INFO = {
  owner: {
    title: 'Fleet Owner',
    badge: 'Owner Portal',
    description: 'Manage vehicles, drivers, dispatches, live fleet GPS, delay reviews & ₹ payroll.',
    quickEmail: 'owner@fleetflow.io',
    quickPassword: 'owner123',
    icon: Building2,
  },
  driver: {
    title: 'Driver',
    badge: 'Driver Portal',
    description:
      'View assigned trips, broadcast live GPS, locate nearby petrol/hospitals/garages & ₹ salary.',
    quickEmail: 'driver@fleetflow.io',
    quickPassword: 'driver123',
    icon: Truck,
  },
} as const;

const PLATFORM_PILLARS = [
  {
    title: 'RTO One-Plate Auto-Sync',
    detail:
      'Enter just the vehicle registration number to decode RTO office, manufacturer, model, fuel, and policy expiries.',
    icon: FileCheck2,
    tone: 'text-sky-300 bg-[#183B60]/75 border-sky-400/30',
  },
  {
    title: 'Live Google Maps Tracking',
    detail:
      'Monitor fleet coordinates, live speed, heading, and ETA corridors with dedicated Driver GPS broadcasting.',
    icon: Navigation,
    tone: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30',
  },
  {
    title: '7 Roadside Driver Services',
    detail:
      'Find nearest petrol pumps, police stations, hotels, tyre shops, medicals, hospitals, and repair garages.',
    icon: Compass,
    tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
  },
  {
    title: 'Delay Audits & ₹ Payroll',
    detail:
      'Automatic delay classification alongside transparent monthly Indian Rupee salary statements and exports.',
    icon: IndianRupee,
    tone: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
  },
];

const LOGIN_STORY_STEPS: StoryStep[] = [
  {
    id: 'tour-portals',
    eyebrow: 'Dual Role Workspace',
    title: 'Tailored Dashboards for Owners & Drivers',
    description:
      'Fleet Owners access fleet-wide KPIs, RTO management, dispatch scheduling, delay classification, and reports. Drivers see a focused duty cockpit with live trips, GPS share, roadside help, and ₹ payslips.',
    imageSrc: '/src/assets/images/fleet_highway_backdrop_1795256358542.jpg',
    imageAlt: 'Commercial transport fleet aligned at dawn depot',
    highlightLabel: 'Access Roles',
    highlightValue: 'Owner + Driver',
    surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#132E52]/60',
    icon: ShieldCheck,
  },
  {
    id: 'tour-rto',
    eyebrow: 'Smart Vahan & RC Sync',
    title: 'Registration-First Vehicle Onboarding',
    description:
      'Add a truck by its Indian registration number or paste mParivahan RC details—FleetFlow parses manufacturer, model, chassis/engine metadata, insurance policy, fitness, PUC, and road tax validity.',
    imageSrc: '/src/assets/images/bg_vehicles_fleet_yard_1795256519749.jpg',
    imageAlt: 'Commercial trucks parked in logistics yard',
    highlightLabel: 'RTO Lookup',
    highlightValue: 'Auto-Populated',
    surfaceTint: 'bg-gradient-to-br from-[#0A1D36]/68 via-[#071529]/72 to-[#142F58]/60',
    icon: Truck,
  },
  {
    id: 'tour-maps',
    eyebrow: 'Live Maps & Highway Help',
    title: 'Real-Time Fleet Coordinates + Nearest Roadside Radar',
    description:
      'Owners monitor every active vehicle on Google Maps. Drivers open the Roadside Finder to discover the closest fuel pumps, hospitals, police stations, tyre shops, and garages.',
    imageSrc: '/src/assets/images/bg_nearby_roadside_station_1795256520028.jpg',
    imageAlt: 'Highway fuel station and service hub',
    highlightLabel: 'Roadside Categories',
    highlightValue: '7 Service Types',
    surfaceTint: 'bg-gradient-to-br from-[#091B34]/68 via-[#071529]/72 to-[#103454]/60',
    icon: Compass,
  },
  {
    id: 'tour-payroll',
    eyebrow: 'Operational Integrity',
    title: 'Delay Accountability & Transparent Monthly ₹ Salaries',
    description:
      'Every late arrival enters an objective delay audit log so payroll incentives and deductions remain clear for owners and drivers alike.',
    imageSrc: '/src/assets/images/bg_payroll_operations_desk_1795256520432.jpg',
    imageAlt: 'Fleet operations and payroll ledger desk',
    highlightLabel: 'Currency & Audit',
    highlightValue: 'INR ₹ Payroll',
    surfaceTint: 'bg-gradient-to-br from-[#0B1E38]/68 via-[#071529]/72 to-[#152E4D]/60',
    icon: IndianRupee,
  },
];

export function LoginView({ onLoginSuccess, darkMode, onToggleDarkMode }: LoginViewProps) {
  const [portal, setPortal] = useState<PortalType>('owner');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heroSectionRef = useRef<HTMLDivElement>(null);
  const heroNetworkRef = useRef<HTMLDivElement>(null);
  const belowFoldRef = useRef<HTMLDivElement>(null);
  const belowFoldTintRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: pageProgress } = useScroll();
  const smoothPageProgress = useSpring(pageProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroSectionRef,
    offset: ['start start', 'end start'],
  });
  const heroImgParallaxY = useTransform(heroScrollProgress, [0, 1], [0, 90]);
  const heroTextParallaxY = useTransform(heroScrollProgress, [0, 1], [0, 32]);

  useEffect(() => {
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (heroNetworkRef.current && heroSectionRef.current) {
          gsap.fromTo(
            heroNetworkRef.current,
            { y: 0 },
            {
              y: 44,
              ease: 'none',
              scrollTrigger: {
                trigger: heroSectionRef.current,
                start: 'top top',
                end: 'bottom top',
                scrub: 1.1,
              },
            },
          );
        }

        if (belowFoldTintRef.current && belowFoldRef.current) {
          gsap.fromTo(
            belowFoldTintRef.current,
            { opacity: 0 },
            {
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: belowFoldRef.current,
                start: 'top 70%',
                end: 'bottom bottom',
                scrub: 1.4,
              },
            },
          );
        }
      });
    });

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter both email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      setStoredToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const performRegister = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Full name, email address, and password are required.');
      return;
    }
    if (portal === 'driver' && !phone.trim()) {
      setError('Phone number is required for driver accounts.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          role: portal,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          licenceNumber: portal === 'driver' ? licenceNumber.trim() || undefined : undefined,
          password,
        }),
      });
      setStoredToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      void performRegister();
    } else {
      void performLogin(email, password);
    }
  };

  const scrollToElement = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative bg-[#0b0d12] text-slate-100">
      {/* Outermost Full-Window Cinematic Autumn Transportation Canvas */}
      <FleetAmbientBackground variant="workspace" />

      {/* Top Scroll Progress Indicator */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-[#38BDF8] via-[#2563EB] to-[#F59E0B]"
        style={{ scaleX: smoothPageProgress }}
      />

      {/* Above-the-Fold Split Portal & Hero */}
      <div
        id="login-top"
        ref={heroSectionRef}
        className="relative z-10 scroll-mt-4 min-h-screen grid lg:grid-cols-12"
      >
        {/* Left Hero Column with Animated Logistics Network & Scroll Parallax */}
        <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0B1B32] via-[#142B4A] to-[#1D3E6E] p-10">
          <motion.div
            style={{ y: heroImgParallaxY }}
            initial={{ scale: 1.08, opacity: 0.75 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
            className="pointer-events-none absolute -top-8 -bottom-16 inset-x-0"
          >
            <img
              src="/src/assets/images/fleet_login_hero_1795108378081.jpg"
              alt="FleetFlow commercial logistics depot at dawn"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover opacity-60"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B32]/95 via-[#142B4A]/72 to-[#1D3E6E]/45" />
          <div ref={heroNetworkRef} className="pointer-events-none absolute inset-0">
            <LogisticsHeroPatternOverlay />
          </div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="relative z-10 flex items-center justify-between gap-3 text-white"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md ring-2 ring-[#F59E0B]/70">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display text-xl font-bold tracking-tight block leading-none">
                  FleetFlow
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B]">
                  Logistics &amp; Fleet SaaS
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => scrollToElement('login-tour')}
              className="ff-btn-warning h-9 px-3.5 text-xs"
            >
              <span>Explore Platform Tour</span>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          <motion.div
            style={{ y: heroTextParallaxY }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="relative z-10 max-w-xl space-y-5"
          >
            <h1 className="font-display text-3xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              One transport workspace built for Fleet Owners and their Drivers.
            </h1>
            <p className="text-sm leading-relaxed text-slate-200">
              Owners manage vehicles, dispatch schedules, delay audits, and monthly ₹ payroll. Drivers
              track their assigned trips, broadcast live GPS, find nearby roadside services, and view
              transparent salary statements.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-white/20 bg-[#142B4A]/75 p-3.5 backdrop-blur shadow-sm"
              >
                <div className="text-xs font-bold text-[#F59E0B]">For Fleet Owners</div>
                <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                  Fleet registry, driver assignments, live GPS map, delay classification &amp; ₹ salary approvals.
                </p>
              </motion.div>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-white/20 bg-[#142B4A]/75 p-3.5 backdrop-blur shadow-sm"
              >
                <div className="text-xs font-bold text-blue-300">For Drivers</div>
                <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                  Assigned trips, arrival updates, nearby petrol pumps, hospitals &amp; garages, plus monthly payslips.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Right Sign-In / Sign-Up Column */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
          className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-[#0C0F17]/76 border-l border-amber-200/18 backdrop-blur-xl text-slate-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                <Truck className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                FleetFlow
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollToElement('login-tour')}
                className="ff-btn-warning lg:hidden h-9 px-3 text-xs"
              >
                <span>Tour</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="ff-btn-secondary h-9 px-3 text-xs"
              >
                {darkMode ? (
                  <Sun className="h-4 w-4 text-[#F59E0B]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#38BDF8]" />
                )}
                <span>{darkMode ? 'Night Theme' : 'Midnight Blue'}</span>
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md py-6 space-y-5">
            {/* Two User Types Selector */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Select Account Type
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(['owner', 'driver'] as const).map((type) => {
                  const info = PORTAL_INFO[type];
                  const Icon = info.icon;
                  const active = portal === type;
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setPortal(type);
                        setError(null);
                      }}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#38BDF8]/50 bg-[#2563EB] text-white shadow-md ring-1 ring-[#38BDF8]/30'
                          : 'border-sky-400/20 bg-[#102746]/85 text-slate-200 hover:bg-[#183B60] hover:border-[#38BDF8]/45'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? 'bg-[#F59E0B] text-[#081629]'
                            : 'bg-[#081629] text-[#38BDF8]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight">{info.title}</div>
                        <div
                          className={`text-[11px] truncate ${
                            active ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {info.badge}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-white">
                  {authMode === 'signin'
                    ? `Sign in as ${PORTAL_INFO[portal].title}`
                    : `Create ${PORTAL_INFO[portal].title} Account`}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {PORTAL_INFO[portal].description}
                </p>
              </div>
            </div>

            {/* Sign In / Register Mode Switch */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-sky-400/20 bg-[#081629]/85 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                }}
                className={`rounded-lg py-2 transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'text-slate-300 hover:bg-[#183B60]/70 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError(null);
                }}
                className={`rounded-lg py-2 transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                    : 'text-slate-300 hover:bg-[#183B60]/70 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-400/35 bg-red-950/60 px-4 py-3 text-xs font-medium text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authMode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-semibold text-slate-200 mb-1"
                    >
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={portal === 'owner' ? 'Enter owner name' : 'Enter driver full name'}
                        className="ff-input pl-10"
                      />
                    </div>
                  </div>

                  <div className={portal === 'driver' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                    <div>
                      <label
                        htmlFor="reg-phone"
                        className="block text-xs font-semibold text-slate-200 mb-1"
                      >
                        Phone Number {portal === 'driver' ? '*' : '(Optional)'}
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="reg-phone"
                          type="tel"
                          required={portal === 'driver'}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98XXXXXXXX"
                          className="ff-input pl-10"
                        />
                      </div>
                    </div>

                    {portal === 'driver' && (
                      <div>
                        <label
                          htmlFor="reg-licence"
                          className="block text-xs font-semibold text-slate-200 mb-1"
                        >
                          Licence No. (Optional)
                        </label>
                        <input
                          id="reg-licence"
                          type="text"
                          value={licenceNumber}
                          onChange={(e) => setLicenceNumber(e.target.value)}
                          placeholder="DL number"
                          className="ff-input"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-200 mb-1"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={portal === 'owner' ? 'owner@company.com' : 'driver@company.com'}
                    className="ff-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-200 mb-1"
                >
                  Password *
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={authMode === 'register' ? 'Minimum 6 characters' : 'Enter password'}
                    className="ff-input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#183B60] p-1.5 text-slate-200 hover:bg-[#1E4775] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="ff-btn-royal h-10 w-full px-4 text-sm"
              >
                {submitting
                  ? authMode === 'register'
                    ? 'Creating Account...'
                    : 'Signing in...'
                  : authMode === 'register'
                    ? `Create ${PORTAL_INFO[portal].title} Account`
                    : `Sign In as ${PORTAL_INFO[portal].title}`}
              </button>
            </form>

            {/* Two Portal Quick Access */}
            <div className="pt-4 border-t border-sky-400/20 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Quick Portal Access
              </p>
              <div className="grid gap-2">
                {(['owner', 'driver'] as const).map((type) => {
                  const info = PORTAL_INFO[type];
                  const Icon = info.icon;
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      disabled={submitting}
                      whileHover={{ x: 2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setPortal(type);
                        setAuthMode('signin');
                        setEmail(info.quickEmail);
                        setPassword(info.quickPassword);
                        void performLogin(info.quickEmail, info.quickPassword);
                      }}
                      className="flex items-center justify-between rounded-xl border border-sky-400/20 bg-[#102746]/80 px-3.5 py-2.5 text-left transition-all hover:border-[#38BDF8]/50 hover:bg-[#183B60]/75 hover:shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white shrink-0">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white">
                            {info.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {info.badge}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-md bg-[#2563EB] px-2 py-1 font-mono text-[11px] font-semibold text-white shrink-0">
                        {info.quickEmail}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FleetFlow Owner &amp; Driver Operations Platform</span>
            <button
              type="button"
              onClick={() => scrollToElement('login-tour')}
              className="ff-btn-secondary hidden sm:inline-flex h-7 px-2.5 text-[11px]"
            >
              <span>Platform Tour</span>
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Below-the-Fold Scroll Storytelling Presentation */}
      <div
        ref={belowFoldRef}
        className="relative z-10 overflow-hidden bg-gradient-to-b from-[#0E0D12]/48 via-[#121015]/36 to-[#0B0D14]/56 border-t border-amber-200/18"
      >
        {/* Scroll-Reactive Background Transition & Drifting ambient glows */}
        <div
          ref={belowFoldTintRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#14100E]/42 via-[#11131C]/35 to-[#0D1018]/32 opacity-0"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="ff-anim-drift absolute -left-24 top-20 h-96 w-96 rounded-full bg-[#EA580C]/14 blur-3xl" />
          <div className="ff-anim-drift-alt absolute -right-24 bottom-24 h-96 w-96 rounded-full bg-[#F59E0B]/14 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-14">
          {/* Sticky Section Navigation Bar */}
          <div className="sticky top-4 z-30 flex justify-center">
            <SectionNavStrip
              sections={[
                { id: 'login-top', label: 'Portal Sign In' },
                { id: 'login-tour', label: 'Interactive Tour' },
                { id: 'login-pillars', label: 'Core Modules' },
              ]}
            />
          </div>

          {/* Sticky Scroll Storytelling Section */}
          <ScrollStorySection
            id="login-tour"
            heading="Built for Real Indian Road Transport Operations"
            subheading="Scroll through FleetFlow's workflow — pinned operational scenes transition automatically as each capability enters focus"
            steps={LOGIN_STORY_STEPS}
          />

          {/* Staggered Core Pillars */}
          <section
            id="login-pillars"
            className="scroll-mt-24 ff-section p-5 sm:p-7 space-y-6"
          >
            <SectionLogisticsDecor variant="slate" />
            <ScrollReveal className="relative z-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                  Everything Your Fleet Needs in One Workspace
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Designed cleanly around owner control, driver safety, RTO precision, and transparent payouts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToElement('login-top')}
                className="ff-btn-primary h-9 px-4 text-xs"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </ScrollReveal>

            <StaggerGrid
              className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              staggerDelay={0.07}
            >
              {PLATFORM_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <StaggerItem key={pillar.title}>
                    <div className="ff-card h-full p-5">
                      <div
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${pillar.tone}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-display text-base font-bold text-white">
                        {pillar.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-300">
                        {pillar.detail}
                      </p>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </section>
        </div>
      </div>
    </div>
  );
}
