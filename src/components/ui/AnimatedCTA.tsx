"use client";

import React, { useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCTAProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
}

export default function AnimatedCTA({ children, className, ...props }: AnimatedCTAProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden inline-flex items-center justify-center border border-primary bg-primary text-primary-foreground px-8 py-3 rounded-sm transition-all duration-300",
        className
      )}
      {...props}
    >
      <motion.span
        animate={{ 
          letterSpacing: isHovered ? "0.4em" : "0.25em" 
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 font-mono text-[10px] uppercase whitespace-nowrap pl-[0.25em]"
      >
        {children}
      </motion.span>
      
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: isHovered ? "0%" : "100%" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 bg-white/20 z-0"
      />
    </motion.button>
  );
}
