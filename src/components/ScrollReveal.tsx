import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { LucideIcon } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SectionLogisticsDecor } from './FleetAmbientBackground.tsx';

gsap.registerPlugin(ScrollTrigger);

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  id?: string;
}

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  y = 22,
  id,
}: ScrollRevealProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            delay,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              once: true,
            },
          },
        );
      });
    }, el);

    const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 60);

    return () => {
      window.clearTimeout(refreshId);
      ctx.revert();
      mm.revert();
    };
  }, [delay, y]);

  return (
    <div ref={elRef} id={id} className={className}>
      {children}
    </div>
  );
}

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
  id?: string;
  staggerDelay?: number;
}

export function StaggerGrid({
  children,
  className = '',
  id,
  staggerDelay = 0.06,
}: StaggerGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const items = Array.from(grid.children) as HTMLElement[];
        if (items.length === 0) return;

        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.52,
            stagger: staggerDelay,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: {
              trigger: grid,
              start: 'top 92%',
              once: true,
            },
          },
        );
      });
    }, grid);

    const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 60);

    return () => {
      window.clearTimeout(refreshId);
      ctx.revert();
      mm.revert();
    };
  }, [staggerDelay]);

  return (
    <div ref={gridRef} id={id} className={className}>
      {children}
    </div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function StaggerItem({
  children,
  className = '',
  interactive = true,
}: StaggerItemProps) {
  return (
    <motion.div
      whileHover={
        interactive
          ? {
              y: -3,
              transition: { duration: 0.2, ease: EASE_OUT_EXPO },
            }
          : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface SectionAnchor {
  id: string;
  label: string;
}

interface SectionNavStripProps {
  sections: SectionAnchor[];
  className?: string;
}

export function SectionNavStrip({ sections, className = '' }: SectionNavStripProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    if (sections.length === 0) return;

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0 && visible[0].target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-22% 0px -60% 0px', threshold: 0.01 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      aria-label="Section navigation"
      className={`flex items-center gap-1.5 overflow-x-auto rounded-xl border border-sky-400/25 bg-[#0B1D36]/90 px-2.5 py-2 backdrop-blur-md shadow-[0_10px_28px_-8px_rgba(2,8,20,0.75)] ${className}`}
    >
      <span className="hidden sm:inline px-2 text-[11px] font-bold uppercase tracking-wider text-sky-300/80 shrink-0">
        Jump to
      </span>
      {sections.map((section) => {
        const isActive = activeId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={`relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.97] cursor-pointer ${
              isActive
                ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/40'
                : 'bg-[#183B60]/75 text-slate-200 hover:bg-[#183B60] hover:text-white'
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

export interface StoryStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  highlightLabel: string;
  highlightValue: string;
  surfaceTint: string;
  icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

interface ScrollStorySectionProps {
  id?: string;
  heading: string;
  subheading: string;
  steps: StoryStep[];
}

export function ScrollStorySection({
  id,
  heading,
  subheading,
  steps,
}: ScrollStorySectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const decorRef = useRef<HTMLDivElement>(null);
  const bgWashRef = useRef<HTMLDivElement>(null);
  const stageParallaxRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 26,
    restDelta: 0.001,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          container,
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
            scrollTrigger: {
              trigger: container,
              start: 'top 90%',
              once: true,
            },
          },
        );

        if (decorRef.current) {
          gsap.fromTo(
            decorRef.current,
            { y: -14 },
            {
              y: 14,
              ease: 'none',
              scrollTrigger: {
                trigger: container,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.2,
              },
            },
          );
        }

        if (bgWashRef.current) {
          gsap.fromTo(
            bgWashRef.current,
            { opacity: 0.25 },
            {
              opacity: 0.9,
              ease: 'none',
              scrollTrigger: {
                trigger: container,
                start: 'top 75%',
                end: 'bottom 25%',
                scrub: 1.3,
              },
            },
          );
        }

        if (stageParallaxRef.current) {
          gsap.fromTo(
            stageParallaxRef.current,
            { y: -14 },
            {
              y: 14,
              ease: 'none',
              scrollTrigger: {
                trigger: container,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.1,
              },
            },
          );
        }
      });
    }, container);

    const refreshId = window.setTimeout(() => ScrollTrigger.refresh(), 60);

    return () => {
      window.clearTimeout(refreshId);
      ctx.revert();
      mm.revert();
    };
  }, []);

  useEffect(() => {
    const nodes = stepRefs.current.filter((n): n is HTMLDivElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.stepIndex);
            if (!Number.isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        });
      },
      { rootMargin: '-34% 0px -38% 0px', threshold: 0.1 },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [steps.length]);

  const safeIndex = Math.min(activeIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIndex];

  if (!currentStep) return null;

  const ActiveIcon = currentStep.icon;

  return (
    <section
      id={id}
      ref={containerRef}
      className={`scroll-mt-20 relative overflow-hidden rounded-2xl border border-sky-400/22 p-5 sm:p-7 shadow-[0_14px_38px_-14px_rgba(2,8,20,0.78)] backdrop-blur-md transition-colors duration-700 ${currentStep.surfaceTint}`}
    >
      {/* Subtle Scroll-Linked Gradient Wash & Transportation Route Accent */}
      <div
        ref={bgWashRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#2563EB]/14 via-transparent to-[#F59E0B]/10"
      />
      <div ref={decorRef} className="pointer-events-none absolute inset-0">
        <SectionLogisticsDecor variant="blue" />
      </div>

      {/* Header + Progress hairline */}
      <div className="relative z-10 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
            {heading}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
            {subheading}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-sky-300 tabular-nums">
            0{safeIndex + 1} / 0{steps.length}
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-[#081629] border border-sky-400/20">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-[#38BDF8] via-[#2563EB] to-[#F59E0B]"
              style={{ scaleX: smoothProgress }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Sticky Pinned Visual Stage */}
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="relative overflow-hidden rounded-2xl border border-sky-400/25 bg-[#081629] shadow-xl">
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <div ref={stageParallaxRef} className="absolute -top-[8%] h-[116%] w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                    className="absolute inset-0"
                  >
                    {!failedImages[currentStep.id] && (
                      <img
                        src={currentStep.imageSrc}
                        alt={currentStep.imageAlt}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [currentStep.id]: true }))
                        }
                        className="h-full w-full object-cover object-center"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1B32]/95 via-[#142B4A]/45 to-slate-950/20" />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Top Step Badge */}
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/20 bg-[#142B4A]/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                <ActiveIcon className="h-3.5 w-3.5 text-[#F59E0B]" />
                <span>{currentStep.eyebrow}</span>
              </div>

              {/* Bottom Stage Caption + Live Telemetry Highlight */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentStep.id}-caption`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                    className="flex flex-wrap items-end justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold text-white leading-snug">
                        {currentStep.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-200 line-clamp-2">
                        {currentStep.description}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/20 bg-[#142B4A]/85 px-3.5 py-2.5 backdrop-blur-md shrink-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B]">
                        {currentStep.highlightLabel}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                        {currentStep.highlightValue}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Step Dots Selector */}
          <div className="mt-3 flex items-center gap-2">
            {steps.map((step, index) => {
              const active = index === safeIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    stepRefs.current[index]?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                  }}
                  aria-label={`Focus step ${index + 1}: ${step.title}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    active
                      ? 'w-9 bg-[#38BDF8]'
                      : 'w-3 bg-[#183B60] hover:bg-sky-400/60'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Scrolling Story Chapters */}
        <div className="lg:col-span-6 space-y-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === safeIndex;
            return (
              <motion.div
                key={step.id}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
                data-step-index={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                onClick={() => setActiveIndex(index)}
                className={`cursor-pointer rounded-xl border p-5 transition-all duration-300 ${
                  isActive
                    ? 'border-[#38BDF8]/70 bg-gradient-to-br from-[#102746] to-[#183B60]/90 shadow-lg shadow-blue-950/50 scale-[1.01]'
                    : 'border-sky-400/18 bg-[#081629]/75 hover:bg-[#102746]/85 hover:border-sky-400/40'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-xs ring-1 ring-[#38BDF8]/50'
                        : 'bg-[#183B60] text-sky-300'
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#38BDF8]">
                        Step 0{index + 1} · {step.eyebrow}
                      </span>
                      <span className="font-mono text-xs font-semibold text-amber-300">
                        {step.highlightValue}
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-base font-bold text-white">
                      {step.title}
                    </h3>

                    <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-300">
                      {step.description}
                    </p>

                    {step.actionLabel && step.onAction && (
                      <div className="mt-3 pt-2.5 border-t border-sky-400/15">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            step.onAction?.();
                          }}
                          className="ff-btn-royal h-8 px-3.5 text-xs"
                        >
                          <span>{step.actionLabel}</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
