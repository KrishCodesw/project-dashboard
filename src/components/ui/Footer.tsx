"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Magnetic from "./Magnetic";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Footer() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [-60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.6, 1], [0, 0, 1]);

  return (
    <footer
      ref={containerRef}
      className="fixed bottom-0 left-0 w-full h-[50vh] sm:h-[60vh] md:h-[80vh] bg-background text-foreground flex flex-col items-center justify-center z-0"
    >
      <div className="flex flex-col items-center text-center px-8 md:px-12 w-full max-w-7xl mx-auto">
        {/* UPPER LABEL */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="h-px w-8 bg-foreground/10" />
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40">
            Leave Your Mark
          </p>
          <div className="h-px w-8 bg-foreground/10" />
        </motion.div>

        {/* HEADLINE */}
        <motion.div
          style={{ y, opacity }}
          className="flex flex-col items-center mb-16 select-none"
        >
          <h2 className="text-[clamp(3rem,12vw,10rem)] leading-[0.85] font-black tracking-tighter uppercase text-center">
            Build
            <br />
            <span className="text-foreground/20">Something</span>
            <br />
            Better.
          </h2>
        </motion.div>

        {/* CTA */}
      </div>

      {/* BOTTOM METADATA */}
      <div className="absolute bottom-0 left-0 w-full border-t border-foreground/5 py-8 px-8 md:px-12 bg-background"></div>
    </footer>
  );
}
