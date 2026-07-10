// components/showcase/AnimatedShowcase.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Magnetic from "@/components/ui/Magnetic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function AnimatedShowcase({ projects }: { projects: any[] }) {
  const displayProjects = projects?.length > 0 ? projects : [];

  const containerRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const maskTextGroupRef = useRef<SVGGElement>(null);
  const maskLineRefs = useRef<Array<SVGTextElement | null>>([]);
  const maskSvgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<SVGRectElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const textBgWashRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0, 0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  useGSAP(
    () => {
      const [lineOne, lineTwo, lineThree] = maskLineRefs.current;
      if (!lineOne || !lineTwo || !lineThree) return;

      const isDesktop = window.innerWidth >= 768;
      const textCenterY = 540;
      const textGap = isDesktop ? 195 : 90;

      gsap.set(lineOne, { attr: { y: textCenterY - textGap } });
      gsap.set(lineTwo, { attr: { y: textCenterY } });
      gsap.set(lineThree, { attr: { y: textCenterY + textGap } });

      gsap.set(heroContentRef.current, { opacity: 0, y: 80 });
      gsap.set(maskSvgRef.current, { opacity: 1, filter: "blur(0px)" });
      gsap.set(maskTextGroupRef.current, {
        transformBox: "view-box",
        transformOrigin: "50% 50%",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: isDesktop ? "+=400vh" : "+=400vh",
          scrub: isDesktop ? 2 : 2.5,
          pin: true,
        },
      });

      tl.to(scrollIndicatorRef.current, { opacity: 0, duration: 0.05 }, 0)
        .fromTo(
          heroImageRef.current,
          { scale: 1.22, yPercent: 2 },
          { scale: 1.02, yPercent: -1, ease: "none" },
          0
        )
        .to(
          maskTextGroupRef.current,
          {
            scale: isDesktop ? 165 : 120,
            opacity: 0.78,
            svgOrigin: `960 ${textCenterY}`,
            ease: "power3.in",
          },
          0
        )
        .to(
          maskSvgRef.current,
          { filter: "blur(9px)", ease: "power2.in" },
          0.42
        )
        .to(
          overlayRef.current,
          { opacity: 0, ease: "power2.out", duration: 0.75 },
          0.52
        )
        .to(
          maskSvgRef.current,
          { opacity: 0, ease: "power2.out", duration: 0.65 },
          0.64
        )
        .to(
          textBgWashRef.current,
          { opacity: 0.95, ease: "power2.inOut", duration: 0.9 },
          0.7
        )
        .fromTo(
          heroContentRef.current,
          { opacity: 0, y: 60 },
          { opacity: 1, y: 0, ease: "power3.out", duration: 1 },
          0.9
        );
    },
    { scope: containerRef }
  );

  return (
    <div className="text-[#111111] dark:text-[#E5E5E5] transition-colors duration-500 w-full overflow-x-hidden bg-background">
      <section
        ref={containerRef}
        className="relative h-screen w-full bg-background"
      >
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <div ref={heroImageRef} className="absolute inset-0 w-full h-full z-0">
            <Image
              src="/tcetimage.png"
              alt="TCET"
              fill
              priority
              unoptimized
              className="object-cover"
            />
          </div>

          <div
            ref={textBgWashRef}
            className="absolute inset-0 z-10 opacity-0 bg-white/20 dark:bg-black/40 backdrop-blur-[4px]"
          />

          <svg
            ref={maskSvgRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            viewBox="0 0 1920 1080"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <mask id="dive-mask">
                <rect width="1920" height="1080" fill="white" />
                <g ref={maskTextGroupRef}>
                  <text
                    ref={(el) => { maskLineRefs.current[0] = el; }}
                    x="960"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="black"
                    className="font-black text-[clamp(3.5rem,11vw,13rem)] tracking-tight"
                  >
                    EVERY
                  </text>
                  <text
                    ref={(el) => { maskLineRefs.current[1] = el; }}
                    x="960"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="black"
                    className="font-black text-[clamp(3.5rem,11vw,13rem)] tracking-tight"
                  >
                    PROJECT
                  </text>
                  <text
                    ref={(el) => { maskLineRefs.current[2] = el; }}
                    x="960"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill="black"
                    className="font-black text-[clamp(3.5rem,11vw,13rem)] tracking-tight"
                  >
                    MATTERS.
                  </text>
                </g>
              </mask>
            </defs>
            <rect
              ref={overlayRef}
              width="100%"
              height="100%"
              className="fill-background"
              mask="url(#dive-mask)"
            />
          </svg>

          <div
            ref={scrollIndicatorRef}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-40 pointer-events-none"
          >
            <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">
              Scroll to explore
            </span>
            <div className="w-px h-12 bg-black/20 dark:bg-white/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-black dark:bg-white animate-[bounce_2s_infinite]" />
            </div>
          </div>

          <div className="absolute inset-0 z-30 flex flex-col justify-end px-5 sm:px-10 lg:px-20 pb-10 sm:pb-12 pointer-events-none">
            <div
              ref={heroContentRef}
              className="w-full max-w-5xl pointer-events-auto opacity-0"
            >
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-slate-900 dark:text-cyan-400 font-bold mb-4">
                TCET Research Culture Development Cell
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[clamp(3.5rem,6vw,5.5rem)] leading-tight tracking-tight text-slate-900 dark:text-white mb-6">
                From Research to Real-World Impact
              </h1>
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                <p className="max-w-2xl text-sm sm:text-base lg:text-[clamp(1rem,1.2vw,1.25rem)] text-slate-700 dark:text-slate-200">
                  The TCET Research Culture Development Cell fosters high-impact
                  research through funded projects, industry collaborations, and
                  publication-driven innovation.
                </p>
                <div className="flex items-center gap-4">
                  <Magnetic>
                    <Link
                      href="https://tcetcercd.in"
                      className="rounded-full bg-slate-900 dark:bg-white px-8 py-4 text-sm font-bold text-white dark:text-black transition-transform hover:scale-105"
                    >
                      Explore Centre
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROJECT GRID REEL */}
      <section className="relative z-10 bg-background w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-20 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayProjects.map((p, i) => {
            const preview = (p.assets ?? [])[0];
            const projectImage = preview?.accessUrl || preview?.fileUrl || "";

            return (
              <div
                key={p.id || i}
                className="group flex flex-col bg-background border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
              >
                <div className="relative w-full aspect-video overflow-hidden bg-gray-100 dark:bg-zinc-900">
                  {projectImage ? (
                    <img
                      src={projectImage}
                      alt={p.title}
                      className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800" />
                  )}
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <h2 className="text-lg font-bold uppercase tracking-tight line-clamp-2 mb-6">
                    {p.title}
                  </h2>
                  <div className="mt-auto">
                    <Magnetic>
                      <Link
                        href={`/showcase/${p.slug || p.id}`}
                        className="flex justify-center items-center w-full border border-black/10 dark:border-white/20 px-6 py-3 text-xs font-semibold tracking-wider hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                      >
                        VIEW WORK
                      </Link>
                    </Magnetic>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
