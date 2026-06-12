"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "01",
    title: "INITIATION",
    description: "System bootstrap and configuration mapping. Establishing core parameters for optimal operational execution.",
    image: "/tcetlogo.png" // Placeholder
  },
  {
    id: "02",
    title: "PROCESSING",
    description: "Continuous integration phase. Transforming unrefined data models into structural schematics.",
    image: "/tcetimage.png" // Placeholder
  },
  {
    id: "03",
    title: "VALIDATION",
    description: "Algorithmic integrity checks. Ensuring rigid compliance with architectural definitions.",
    image: "/tcetlogo.png" // Placeholder
  }
];

export default function InteractiveWorkflow() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-32 border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 relative">
        
        {/* Left Column: Steps */}
        <div className="space-y-8">
          <h2 className="font-serif text-4xl mb-16 tracking-tight">OPERATIONAL<br/>WORKFLOW</h2>
          
          {STEPS.map((step, index) => (
            <div 
              key={step.id}
              className="cursor-pointer group relative border-l pl-6 border-border"
              onClick={() => setActiveStep(index)}
            >
              <div 
                className={cn(
                  "absolute left-[-1px] top-0 bottom-0 w-[1px] bg-primary transition-all duration-500",
                  activeStep === index ? "h-full opacity-100" : "h-0 opacity-0"
                )}
              />
              <div className="flex items-baseline gap-4 mb-2">
                <span className="font-mono text-[10px] text-muted-foreground">{step.id}</span>
                <h3 className={cn(
                  "font-sans text-xl font-medium tracking-tight transition-opacity duration-300",
                  activeStep === index ? "opacity-100" : "opacity-40 group-hover:opacity-60"
                )}>
                  {step.title}
                </h3>
              </div>
              
              <AnimatePresence>
                {activeStep === index && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="font-sans text-muted-foreground text-sm leading-relaxed max-w-sm overflow-hidden"
                  >
                    <span className="block pt-2">{step.description}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Right Column: Sticky Image Display */}
        <div className="hidden md:block relative h-[60vh] sticky top-[20vh]">
          <div className="w-full h-full relative overflow-hidden bg-muted border border-border rounded-[2px] flex items-center justify-center p-8">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStep}
                src={STEPS[activeStep].image}
                alt={STEPS[activeStep].title}
                initial={{ opacity: 0, scale: 0.95, filter: "grayscale(100%)" }}
                animate={{ opacity: 0.6, scale: 1, filter: "grayscale(100%)" }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-screen opacity-60"
              />
            </AnimatePresence>
            
            {/* Animated Scan Line */}
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 4, ease: "linear", repeat: Infinity }}
              className="absolute left-0 right-0 h-[2px] bg-primary/40 shadow-[0_0_10px_rgba(var(--primary),0.5)] z-10"
            />
          </div>
        </div>

      </div>
    </section>
  );
}
