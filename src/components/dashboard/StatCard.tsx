"use client";

import React, { useEffect, useState, memo } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: { value: number; positive: boolean };
  className?: string;
}

const colorMap: Record<string, string> = {
  indigo: "bg-muted text-primary",
  violet: "bg-muted text-primary",
  emerald: "bg-muted text-primary",
  amber: "bg-muted text-primary",
};

export const StatCard = memo(function StatCard({
  title,
  value,
  suffix = "",
  icon: Icon,
  color,
  trend,
  className,
}: StatCardProps) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 30 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [springValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-[2px] border border-border bg-card p-6 shadow-none transition-transform duration-200 ease-[0.23,1,0.32,1] hover:scale-[0.99] active:scale-[0.97]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-sans font-medium tracking-tight text-foreground">
            {displayValue}{suffix}
          </p>
          {trend && (
            <p className={cn("mt-1 text-[10px] font-mono uppercase tracking-wider", trend.positive ? "text-emerald-600" : "text-destructive")}>
              {trend.positive ? "↑" : "↓"} {trend.value}% from last month
            </p>
          )}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-[2px] border border-border", color && colorMap[color] ? colorMap[color] : "bg-muted text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
});
