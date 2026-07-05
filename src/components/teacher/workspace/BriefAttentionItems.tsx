"use client";

import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BriefAttentionItem, Severity } from "@/lib/delivery/types";

interface BriefAttentionItemsProps {
  items: BriefAttentionItem[];
}

const severityConfig: Record<
  Severity,
  { icon: typeof AlertTriangle; border: string; bg: string; text: string }
> = {
  CRITICAL: {
    icon: AlertTriangle,
    border: "border-rose-500/30",
    bg: "bg-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
  },
  HIGH: {
    icon: AlertCircle,
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
  },
  MEDIUM: {
    icon: Info,
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
  },
  LOW: {
    icon: Info,
    border: "border-border",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export function BriefAttentionItems({ items }: BriefAttentionItemsProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Needs Attention
      </h4>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        {items.slice(0, 3).map((item) => {
          const config = severityConfig[item.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={`${item.projectId}-${item.message.slice(0, 20)}`}
              variants={itemVariants}
              className={cn(
                "flex items-start gap-3 rounded-[2px] border px-4 py-3",
                config.border,
                config.bg
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.text)} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {item.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.projectTitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
