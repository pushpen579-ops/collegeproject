import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogisticsHeroPatternOverlay } from './FleetAmbientBackground.tsx';

gsap.registerPlugin(ScrollTrigger);

interface FeatureBannerProps {
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function FeatureBanner({
  imageSrc,
  imageAlt,
  title,
  subtitle,
  children,
}: FeatureBannerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const bgParallaxRef = useRef<HTMLDivElement>(null);
  const routeOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc]);

  useEffect(() => {
    const bannerEl = bannerRef.current;
    if (!bannerEl) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (bgParallaxRef.current) {
          gsap.fromTo(
            bgParallaxRef.current,
            { y: -16 },
            {
              y: 16,
              ease: 'none',
              scrollTrigger: {
                trigger: bannerEl,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1,
              },
            },
          );
        }

        if (routeOverlayRef.current) {
          gsap.fromTo(
            routeOverlayRef.current,
            { y: -8 },
            {
              y: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: bannerEl,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.2,
              },
            },
          );
        }
      });
    }, bannerEl);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  return (
    <motion.div
      ref={bannerRef}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="ff-anim-autumn-glow relative overflow-hidden rounded-2xl border border-[#D99A32]/30 bg-gradient-to-br from-[#211B19]/78 via-[#481D22]/74 to-[#56352B]/66 p-5 sm:p-6 backdrop-blur-md"
    >
      {!imgFailed && (
        <motion.div
          ref={bgParallaxRef}
          initial={{ scale: 1.07, opacity: 0.65 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
          className="pointer-events-none absolute inset-x-0 -top-6 -bottom-6"
        >
          <img
            src={imageSrc}
            alt={imageAlt}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover object-center opacity-28 mix-blend-luminosity"
          />
        </motion.div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#211B19]/88 via-[#481D22]/74 to-[#56352B]/60" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#E87524]/14 via-transparent to-[#D99A32]/16"
      />
      <div ref={routeOverlayRef} className="pointer-events-none absolute inset-0">
        <LogisticsHeroPatternOverlay />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: EASE_OUT_EXPO }}
          className="min-w-0"
        >
          <div className="mb-1.5 inline-flex items-center gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-[#E87524]" />
            <span className="h-1.5 w-2 rounded-full bg-[#D99A32]" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#FFF1DC] [text-wrap:balance]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#EBD9C3] max-w-2xl">{subtitle}</p>
        </motion.div>
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: EASE_OUT_EXPO }}
            className="flex flex-wrap items-center gap-2"
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
