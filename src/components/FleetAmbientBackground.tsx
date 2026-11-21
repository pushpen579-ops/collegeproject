import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useId, useRef } from 'react';

gsap.registerPlugin(ScrollTrigger);

interface FleetAmbientBackgroundProps {
  variant?: 'workspace' | 'hero';
  backdropSrc?: string;
  onBackdropError?: () => void;
}

const OUTER_TRUCK_BACKDROP = '/assets/aistudio/Autumn_Forest_Red_Lorry_Portrait_4697276b.png';

const AUTUMN_LEAVES = [
  { left: '6%', size: 18, color: '#F59E0B', variant: 'a', duration: '23s', delay: '-3s' },
  { left: '14%', size: 15, color: '#EA580C', variant: 'b', duration: '28s', delay: '-11s' },
  { left: '23%', size: 20, color: '#DC2626', variant: 'a', duration: '26s', delay: '-16s' },
  { left: '34%', size: 14, color: '#FBBF24', variant: 'b', duration: '22s', delay: '-7s' },
  { left: '43%', size: 17, color: '#EA580C', variant: 'a', duration: '30s', delay: '-20s' },
  { left: '54%', size: 19, color: '#F59E0B', variant: 'b', duration: '25s', delay: '-5s' },
  { left: '64%', size: 15, color: '#DC2626', variant: 'a', duration: '27s', delay: '-14s' },
  { left: '74%', size: 21, color: '#FBBF24', variant: 'b', duration: '24s', delay: '-9s' },
  { left: '84%', size: 16, color: '#EA580C', variant: 'a', duration: '31s', delay: '-18s' },
  { left: '92%', size: 18, color: '#F59E0B', variant: 'b', duration: '26s', delay: '-2s' },
  { left: '28%', size: 14, color: '#DC2626', variant: 'b', duration: '29s', delay: '-24s' },
  { left: '68%', size: 16, color: '#F59E0B', variant: 'a', duration: '25s', delay: '-21s' },
] as const;

export function FleetAmbientBackground({
  variant = 'workspace',
  backdropSrc,
  onBackdropError,
}: FleetAmbientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const photoParallaxRef = useRef<HTMLDivElement>(null);
  const glowLayerRef = useRef<HTMLDivElement>(null);
  const scrollTintRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<HTMLDivElement>(null);

  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const gridPatternId = `ff-grid-${uid}`;
  const routeGradId = `ff-route-grad-${uid}`;
  const routeAmberGradId = `ff-route-amber-${uid}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (photoParallaxRef.current) {
          gsap.fromTo(
            photoParallaxRef.current,
            { yPercent: 0, scale: 1.07 },
            {
              yPercent: -5.5,
              scale: 1.02,
              ease: 'none',
              scrollTrigger: {
                trigger: document.documentElement,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 1.35,
              },
            },
          );
        }

        if (routeLayerRef.current) {
          gsap.to(routeLayerRef.current, {
            yPercent: -5,
            ease: 'none',
            scrollTrigger: {
              trigger: document.documentElement,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 1.2,
            },
          });
        }

        if (glowLayerRef.current) {
          gsap.to(glowLayerRef.current, {
            yPercent: -8,
            ease: 'none',
            scrollTrigger: {
              trigger: document.documentElement,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 1.5,
            },
          });
        }

        if (scrollTintRef.current) {
          gsap.fromTo(
            scrollTintRef.current,
            { opacity: 0.12 },
            {
              opacity: 0.58,
              ease: 'none',
              scrollTrigger: {
                trigger: document.documentElement,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 1.4,
              },
            },
          );
        }
      });
    }, container);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  if (variant === 'hero') {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-[#211B19] via-[#481D22] to-[#56352B]"
      >
        <div ref={glowLayerRef} className="absolute -inset-12">
          <div className="ff-anim-drift absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#E87524]/22 blur-3xl" />
          <div className="ff-anim-drift-alt absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#481D22]/35 blur-3xl" />
          <div className="ff-anim-drift absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-[#D99A32]/16 blur-3xl" />
        </div>
        <div ref={routeLayerRef} className="absolute inset-0">
          <LogisticsNetworkSvg
            gridPatternId={gridPatternId}
            routeGradId={routeGradId}
            routeAmberGradId={routeAmberGradId}
            tone="dark"
          />
        </div>
      </div>
    );
  }

  const effectiveBackdrop = backdropSrc || OUTER_TRUCK_BACKDROP;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="ff-main-canvas pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Layer 1: Uploaded Autumn Forest & Red Freight Lorry Photograph with Scroll Parallax & Gentle Motion */}
      <div ref={photoParallaxRef} className="absolute -inset-y-10 inset-x-0">
        <div
          style={{ backgroundImage: `url('${effectiveBackdrop}')` }}
          className="ff-anim-autumn-breathe h-full w-full bg-cover bg-[center_54%] bg-no-repeat"
        />
        <img
          src={effectiveBackdrop}
          alt=""
          referrerPolicy="no-referrer"
          onError={onBackdropError}
          className="sr-only"
        />
      </div>

      {/* Layer 2: Warm Golden Sunlight Filtering Gently Through Autumn Maple Canopy */}
      <div ref={glowLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="ff-anim-sunbeams absolute -inset-10"
          style={{
            background:
              'radial-gradient(52% 58% at 46% 34%, rgba(251, 191, 36, 0.28) 0%, rgba(245, 158, 11, 0.14) 38%, transparent 72%), linear-gradient(128deg, rgba(253, 224, 71, 0.14) 8%, rgba(245, 158, 11, 0.08) 36%, transparent 64%)',
          }}
        />
        <div
          className="ff-anim-leaf-sway absolute left-[18%] top-[8%] h-72 w-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.18) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Layer 3: Subtle Floating & Slowly Falling Autumn Leaves */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {AUTUMN_LEAVES.map((leaf, idx) => (
          <div
            key={idx}
            className={`absolute top-0 ${leaf.variant === 'a' ? 'ff-anim-leaf-a' : 'ff-anim-leaf-b'}`}
            style={{
              left: leaf.left,
              animationDuration: leaf.duration,
              animationDelay: leaf.delay,
            }}
          >
            <svg
              width={leaf.size}
              height={leaf.size}
              viewBox="0 0 24 24"
              fill={leaf.color}
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] opacity-85"
            >
              <path d="M12 2L14.2 7.2L19.5 6.1L16.4 10.6L21 13.4L15.7 15.1L16.5 19.6L12.6 16.9L12 22L11.4 16.9L7.5 19.6L8.3 15.1L3 13.4L7.6 10.6L4.5 6.1L9.8 7.2L12 2Z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Layer 4: Balanced Dark Transparent Readability Overlay & Gentle Scroll Dusk Transition */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0C0B0F]/46 via-[#120F0E]/32 to-[#0A0C12]/58" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A0C12]/50 via-[#120F0E]/16 to-[#0A0C12]/36" />
      <div
        ref={scrollTintRef}
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#110D0C]/20 via-[#0E0F15]/28 to-[#090B10]/45 opacity-12"
      />
    </div>
  );
}

interface LogisticsHeroPatternOverlayProps {
  className?: string;
}

export function LogisticsHeroPatternOverlay({ className = '' }: LogisticsHeroPatternOverlayProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="ff-anim-drift absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#E87524]/18 blur-3xl" />
      <div className="ff-anim-drift-alt absolute -right-14 -bottom-16 h-60 w-60 rounded-full bg-[#D99A32]/16 blur-3xl" />
      <LogisticsNetworkSvg
        gridPatternId={`hero-grid-${uid}`}
        routeGradId={`hero-rg-${uid}`}
        routeAmberGradId={`hero-ra-${uid}`}
        tone="dark"
      />
    </div>
  );
}

interface SectionLogisticsDecorProps {
  variant?: 'blue' | 'amber' | 'slate';
}

export function SectionLogisticsDecor({ variant = 'amber' }: SectionLogisticsDecorProps) {
  const strokeColor =
    variant === 'amber'
      ? 'text-[#D99A32]/22'
      : variant === 'slate'
        ? 'text-[#E87524]/18'
        : 'text-[#D99A32]/20';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <svg
        viewBox="0 0 800 220"
        preserveAspectRatio="none"
        className={`h-full w-full ${strokeColor}`}
        fill="none"
      >
        <path
          d="M -20 185 C 160 155, 290 65, 490 95 C 630 116, 715 45, 830 30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          className="ff-anim-route-flow"
        />
        <path
          d="M -20 205 C 210 185, 360 120, 560 145 C 690 160, 760 110, 830 92"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.7"
        />
        <circle cx="490" cy="95" r="3.5" fill="currentColor" className="ff-anim-node-pulse" />
        <circle cx="715" cy="45" r="3" fill="currentColor" className="ff-anim-node-pulse" />
      </svg>
    </div>
  );
}

interface LogisticsNetworkSvgProps {
  gridPatternId: string;
  routeGradId: string;
  routeAmberGradId: string;
  tone: 'adaptive' | 'dark';
  showGpsMovers?: boolean;
}

function LogisticsNetworkSvg({
  gridPatternId,
  routeGradId,
  routeAmberGradId,
  tone,
  showGpsMovers = false,
}: LogisticsNetworkSvgProps) {
  const isDarkHero = tone === 'dark';
  const mainHighwayPath = 'M -60 720 C 230 620, 460 390, 770 430 C 1030 464, 1210 250, 1500 180';
  const secondaryHighwayPath = 'M -40 230 C 260 275, 490 520, 820 495 C 1080 475, 1260 660, 1500 620';
  const amberCorridorPath = 'M 150 925 C 360 720, 620 670, 910 580 C 1140 508, 1300 390, 1490 420';

  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      fill="none"
    >
      <defs>
        <pattern id={gridPatternId} width="72" height="72" patternUnits="userSpaceOnUse">
          <path
            d="M 72 0 L 0 0 0 72"
            stroke={isDarkHero ? 'rgba(217, 154, 50, 0.11)' : 'rgba(232, 117, 36, 0.06)'}
            strokeWidth="1"
          />
          <path
            d="M 36 0 V 72 M 0 36 H 72"
            stroke={isDarkHero ? 'rgba(232, 117, 36, 0.05)' : 'rgba(217, 154, 50, 0.03)'}
            strokeWidth="0.75"
            strokeDasharray="3 6"
          />
          <circle
            cx="0"
            cy="0"
            r="1.3"
            fill={isDarkHero ? 'rgba(217, 154, 50, 0.28)' : 'rgba(86, 53, 43, 0.15)'}
          />
        </pattern>

        <linearGradient id={routeGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            stopColor={isDarkHero ? '#E87524' : '#56352B'}
            stopOpacity={isDarkHero ? '0.14' : '0.06'}
          />
          <stop
            offset="50%"
            stopColor={isDarkHero ? '#D99A32' : '#E87524'}
            stopOpacity={isDarkHero ? '0.45' : '0.24'}
          />
          <stop
            offset="100%"
            stopColor={isDarkHero ? '#FFF1DC' : '#481D22'}
            stopOpacity={isDarkHero ? '0.16' : '0.06'}
          />
        </linearGradient>

        <linearGradient id={routeAmberGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D99A32" stopOpacity="0.05" />
          <stop offset="50%" stopColor="#E87524" stopOpacity={isDarkHero ? '0.42' : '0.22'} />
          <stop offset="100%" stopColor="#D99A32" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Faint Transportation Map & Coordinate Grid */}
      <rect width="1440" height="900" fill={`url(#${gridPatternId})`} />

      {/* Very Faint Topographic / Regional Map Contours */}
      <g
        stroke={isDarkHero ? 'rgba(217, 154, 50, 0.09)' : 'rgba(232, 117, 36, 0.05)'}
        strokeWidth="1"
      >
        <path d="M -30 140 Q 220 90 420 190 T 860 150 T 1470 110" strokeDasharray="4 8" />
        <path d="M -20 820 Q 320 770 610 830 T 1180 760 T 1470 835" strokeDasharray="4 8" />
        <circle cx="770" cy="430" r="145" strokeDasharray="6 10" opacity="0.65" />
        <circle cx="770" cy="430" r="245" strokeDasharray="3 12" opacity="0.4" />
        <circle cx="295" cy="308" r="90" strokeDasharray="5 9" opacity="0.5" />
      </g>

      {/* Curved Multi-Lane Highway Corridors */}
      <path d={mainHighwayPath} stroke={`url(#${routeGradId})`} strokeWidth="8" opacity="0.16" />
      <path d={mainHighwayPath} stroke={`url(#${routeGradId})`} strokeWidth="2" />
      <path d={secondaryHighwayPath} stroke={`url(#${routeGradId})`} strokeWidth="6" opacity="0.12" />
      <path d={secondaryHighwayPath} stroke={`url(#${routeGradId})`} strokeWidth="1.5" />
      <path d={amberCorridorPath} stroke={`url(#${routeAmberGradId})`} strokeWidth="1.6" />

      {/* Animated Flowing Road & GPS Route Lines */}
      <path
        d={mainHighwayPath}
        stroke={isDarkHero ? 'rgba(217, 154, 50, 0.55)' : 'rgba(232, 117, 36, 0.28)'}
        strokeWidth="2.2"
        strokeDasharray="14 26"
        strokeLinecap="round"
        className="ff-anim-route-flow"
      />
      <path
        d={secondaryHighwayPath}
        stroke={isDarkHero ? 'rgba(255, 241, 220, 0.35)' : 'rgba(86, 53, 43, 0.2)'}
        strokeWidth="1.8"
        strokeDasharray="10 28"
        strokeLinecap="round"
        className="ff-anim-route-flow-reverse"
      />
      <path
        d={amberCorridorPath}
        stroke={isDarkHero ? 'rgba(232, 117, 36, 0.52)' : 'rgba(217, 154, 50, 0.26)'}
        strokeWidth="1.8"
        strokeDasharray="8 32"
        strokeLinecap="round"
        className="ff-anim-route-flow"
      />

      {/* Connected GPS Hub Mesh Lines */}
      <g
        stroke={isDarkHero ? 'rgba(217, 154, 50, 0.24)' : 'rgba(232, 117, 36, 0.16)'}
        strokeWidth="1"
      >
        <line x1="295" y1="308" x2="465" y2="495" strokeDasharray="4 6" />
        <line x1="465" y1="495" x2="770" y2="430" strokeDasharray="4 6" />
        <line x1="770" y1="430" x2="910" y2="580" strokeDasharray="4 6" />
        <line x1="910" y1="580" x2="1210" y2="250" strokeDasharray="4 6" />
        <line x1="295" y1="308" x2="770" y2="430" strokeDasharray="2 8" opacity="0.65" />
      </g>

      {/* Moving GPS Connection Points Along Highways */}
      {showGpsMovers && (
        <g className="ff-gps-mover">
          <g>
            <circle r="7" fill="rgba(232, 117, 36, 0.28)" />
            <circle r="3" fill="#E87524" />
            <animateMotion dur="26s" repeatCount="indefinite" path={mainHighwayPath} />
          </g>
          <g>
            <circle r="6.5" fill="rgba(217, 154, 50, 0.26)" />
            <circle r="2.8" fill="#D99A32" />
            <animateMotion dur="32s" begin="-10s" repeatCount="indefinite" path={amberCorridorPath} />
          </g>
          <g>
            <circle r="6" fill="rgba(255, 241, 220, 0.22)" />
            <circle r="2.5" fill="#FFF1DC" />
            <animateMotion
              dur="30s"
              begin="-14s"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              repeatCount="indefinite"
              path={secondaryHighwayPath}
            />
          </g>
        </g>
      )}

      {/* Pulsing GPS Waypoint Nodes + Sonar Rings */}
      <g>
        <circle
          cx="295"
          cy="308"
          r="9"
          stroke="rgba(217, 154, 50, 0.45)"
          strokeWidth="1.2"
          className="ff-anim-gps-ring"
        />
        <circle
          cx="295"
          cy="308"
          r="4.5"
          fill={isDarkHero ? 'rgba(217, 154, 50, 0.85)' : 'rgba(232, 117, 36, 0.35)'}
          className="ff-anim-node-pulse"
        />

        <circle
          cx="465"
          cy="495"
          r="8"
          stroke="rgba(232, 117, 36, 0.45)"
          strokeWidth="1.2"
          className="ff-anim-gps-ring"
          style={{ animationDelay: '1.4s' }}
        />
        <circle
          cx="465"
          cy="495"
          r="4.5"
          fill={isDarkHero ? 'rgba(232, 117, 36, 0.85)' : 'rgba(217, 154, 50, 0.38)'}
          className="ff-anim-node-pulse"
          style={{ animationDelay: '1.1s' }}
        />

        <circle
          cx="770"
          cy="430"
          r="10"
          stroke="rgba(217, 154, 50, 0.5)"
          strokeWidth="1.2"
          className="ff-anim-gps-ring"
          style={{ animationDelay: '2.1s' }}
        />
        <circle
          cx="770"
          cy="430"
          r="5"
          fill={isDarkHero ? 'rgba(217, 154, 50, 0.85)' : 'rgba(232, 117, 36, 0.36)'}
          className="ff-anim-node-pulse"
          style={{ animationDelay: '2s' }}
        />

        <circle
          cx="910"
          cy="580"
          r="4.5"
          fill={isDarkHero ? 'rgba(255, 241, 220, 0.7)' : 'rgba(86, 53, 43, 0.28)'}
          className="ff-anim-node-pulse"
          style={{ animationDelay: '0.6s' }}
        />

        <circle
          cx="1210"
          cy="250"
          r="9"
          stroke="rgba(232, 117, 36, 0.45)"
          strokeWidth="1.2"
          className="ff-anim-gps-ring"
          style={{ animationDelay: '2.8s' }}
        />
        <circle
          cx="1210"
          cy="250"
          r="5"
          fill={isDarkHero ? 'rgba(232, 117, 36, 0.85)' : 'rgba(217, 154, 50, 0.35)'}
          className="ff-anim-node-pulse"
          style={{ animationDelay: '2.8s' }}
        />
      </g>

      {/* Subtle Floating Logistics Geometric Elements */}
      <g
        stroke={isDarkHero ? 'rgba(217, 154, 50, 0.24)' : 'rgba(232, 117, 36, 0.14)'}
        strokeWidth="1.25"
      >
        <g className="ff-anim-float">
          <rect x="190" y="130" width="28" height="28" rx="6" transform="rotate(18 204 144)" />
        </g>
        <g className="ff-anim-float-alt">
          <polygon points="1160,120 1184,134 1184,162 1160,176 1136,162 1136,134" />
        </g>
        <g className="ff-anim-float" style={{ animationDelay: '3s' }}>
          <circle cx="1290" cy="705" r="18" strokeDasharray="5 5" />
        </g>
        <g className="ff-anim-float-alt" style={{ animationDelay: '1.8s' }}>
          <rect
            x="245"
            y="690"
            width="22"
            height="22"
            rx="4"
            stroke={isDarkHero ? 'rgba(232, 117, 36, 0.28)' : 'rgba(217, 154, 50, 0.18)'}
            transform="rotate(45 256 701)"
          />
        </g>
      </g>
    </svg>
  );
}
