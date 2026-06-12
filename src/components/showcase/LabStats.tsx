"use client";

import { useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useInView } from "framer-motion";
import gsap from "gsap";

export default function LabStats({ images = [] }: { images?: string[] }) {
  const containerRef = useRef<HTMLElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  // --- RE-IMPLEMENTING PREVIOUS LOGO/IMAGE PADDING LOGIC ---
  // We use useMemo to ensure these arrays don't trigger re-renders or effect restarts
  const { scrollData, reversedScrollData } = useMemo(() => {
    const baseImages = images.length > 0 ? images : ["/tcetlogo.png"];
    
    // Repeat images multiple times to ensure the column is much taller than the container
    // Original code used 4x repeat
    const longSet = [...baseImages, ...baseImages, ...baseImages, ...baseImages];
    
    return {
      scrollData: [...longSet, ...longSet],
      reversedScrollData: [...longSet].reverse().concat([...longSet].reverse())
    };
  }, [images]);

  useEffect(() => {
    const col1 = col1Ref.current;
    const col2 = col2Ref.current;

    if (!col1 || !col2) return;

    // Use a fresh context for animations
    const ctx = gsap.context(() => {
      // 1. BULLETPROOF INFINITE SCROLL
      // Original code used duration: 15 for a faster, tighter loop
      gsap.to(col1, {
        yPercent: -50,
        repeat: -1,
        duration: 15,
        ease: "none",
      });

      gsap.fromTo(
        col2,
        { yPercent: -50 },
        {
          yPercent: 0,
          repeat: -1,
          duration: 15,
          ease: "none",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [scrollData, reversedScrollData]);

  return (
    <section 
      ref={containerRef} 
      className="relative z-10 bg-background px-6 py-24 max-w-7xl mx-auto border-t border-black/5 dark:border-white/5"
    >
      <div className="mb-16">
        <h2 className="text-4xl font-black tracking-tighter mb-4 leading-none uppercase">
          Behind the Screens
        </h2>
        <p className="text-black/40 dark:text-white/40 font-medium max-w-md">
          The culture, the caffeine, and the raw metrics that power our college labs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[600px]">
        {/* INFINITE MARQUEE BOX */}
        <div className="md:col-span-2 md:row-span-2 overflow-hidden relative group border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 h-[350px] md:h-full rounded-xl flex gap-4 p-4">
          
          {/* COLUMN 1: Scrolls Up */}
          <div ref={col1Ref} className="flex-1 flex flex-col gap-4">
            {scrollData.map((src, i) => (
              <div key={`c1-${i}`} className="relative aspect-[4/3] w-full rounded-lg overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/5 bg-zinc-100 dark:bg-zinc-900">
                <img 
                  src={src} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* COLUMN 2: Scrolls Down */}
          <div ref={col2Ref} className="flex-1 flex flex-col gap-4">
            {reversedScrollData.map((src, i) => (
              <div key={`c2-${i}`} className="relative aspect-[4/3] w-full rounded-lg overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/5 bg-zinc-100 dark:bg-zinc-900">
                <img 
                  src={src} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* TEXT OVERLAY */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent p-8 flex items-end z-10 pointer-events-none">
            <p className="font-bold text-white text-lg">
              The culture of creation.
            </p>
          </div>
        </div>

        {/* STAT BOXES */}
        <StatBox label="Projects Deployed" value={142} isInView={isInView} />
        <StatBox label="Active Builders" value={350} isInView={isInView} />
        <StatBox label="Research Patents" value={20} isInView={isInView} />
      </div>
    </section>
  );
}

function StatBox({ label, value, isInView }: { label: string, value: number, isInView: boolean }) {
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isInView && countRef.current) {
      gsap.to(countRef.current, {
        innerHTML: value,
        duration: 2,
        snap: { innerHTML: 1 },
        ease: "power2.out",
      });
    }
  }, [isInView, value]);

  return (
    <div className="bg-black/5 dark:bg-white/5 p-8 flex flex-col justify-end border border-black/10 dark:border-white/10 rounded-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/40 dark:text-white/40 mb-2">
        {label}
      </p>
      <h3 className="text-5xl font-black tracking-tighter tabular-nums">
        <span ref={countRef}>0</span>+
      </h3>
    </div>
  );
}
