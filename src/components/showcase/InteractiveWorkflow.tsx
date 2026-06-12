"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "01",
    title: "INITIATION",
    description: "System bootstrap and configuration mapping. Establishing core parameters for optimal operational execution.",
    image: "/tcetlogo.png"
  },
  {
    id: "02",
    title: "PROCESSING",
    description: "Continuous integration phase. Transforming unrefined data models into structural schematics.",
    image: "/tcetimage.png"
  },
  {
    id: "03",
    title: "VALIDATION",
    description: "Algorithmic integrity checks. Ensuring rigid compliance with architectural definitions.",
    image: "/tcetlogo.png"
  }
];

export default function InteractiveWorkflow() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-32 border-t border-black/5 dark:border-white/5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
        
        {/* Left Column: Steps */}
        <div className="space-y-12">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">
              Operational Framework
            </h3>
            <h2 className="text-4xl font-black tracking-tighter leading-none">
              OUR WORKFLOW.
            </h2>
          </div>
          
          <div className="space-y-4">
            {STEPS.map((step, index) => (
              <button 
                key={step.id}
                className="w-full text-left group outline-none"
                onClick={() => setActiveStep(index)}
              >
                <div className={cn(
                  "p-8 rounded-sm transition-all duration-300 border",
                  activeStep === index 
                    ? "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10" 
                    : "bg-transparent border-transparent hover:border-black/5 dark:hover:border-white/5"
                )}>
                  <div className="flex items-center gap-6 mb-2">
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums transition-colors duration-300",
                      activeStep === index ? "text-black dark:text-white" : "text-black/20 dark:text-white/20"
                    )}>
                      {step.id}
                    </span>
                    <h3 className={cn(
                      "text-xl font-bold tracking-tight transition-all duration-300",
                      activeStep === index ? "translate-x-0" : "-translate-x-2 opacity-40 group-hover:opacity-60"
                    )}>
                      {step.title}
                    </h3>
                  </div>
                  
                  <AnimatePresence initial={false}>
                    {activeStep === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pt-4 text-sm text-black/40 dark:text-white/40 leading-relaxed font-medium">
                          {step.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Visualizer */}
        <div className="hidden md:block sticky top-[20vh] h-[60vh]">
          <div className="w-full h-full relative overflow-hidden bg-black/5 dark:bg-white/5 rounded-sm border border-black/10 dark:border-white/10 flex items-center justify-center p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(10px) grayscale(1)" }}
                animate={{ opacity: 0.8, scale: 1, filter: "blur(0px) grayscale(1)" }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(10px) grayscale(1)" }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="w-full h-full relative"
              >
                <Image
                  src={STEPS[activeStep].image}
                  alt={STEPS[activeStep].title}
                  fill
                  className="object-contain opacity-60 mix-blend-multiply dark:mix-blend-screen"
                />
              </motion.div>
            </AnimatePresence>
            
            {/* SCAN LINE */}
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 4, ease: "linear", repeat: Infinity }}
              className="absolute left-0 right-0 h-px bg-black/20 dark:bg-white/20 z-10"
            />
            
            {/* GRID OVERLAY */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
                 style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }} 
            />
          </div>
        </div>

      </div>
    </section>
  );
}
