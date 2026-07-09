"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EASE_OUT, DURATION, STAGGER } from "./animations";
import type { AttentionType, Severity } from "@/lib/delivery/types";

interface NeedsAttentionItemProps {
  id: string;
  projectId: string;
  projectTitle: string;
  type: AttentionType;
  score: number;
  severity: Severity;
  message: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
  index?: number;
}

const severityDotClass: Record<Severity, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-slate-400",
};

const severityBadgeVariant: Record<Severity, "danger" | "warning" | "default" | "outline"> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "default",
  LOW: "outline",
};

export function NeedsAttentionItem({
  projectTitle,
  severity,
  score,
  message,
  reason,
  actionHref,
  index = 0,
}: NeedsAttentionItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER.FAST, duration: DURATION.NORMAL, ease: EASE_OUT }}
    >
      <Link
        href={actionHref}
        className={cn(
          "group/item flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5",
          "transition-all duration-150 hover:bg-accent hover:border-border active:scale-[0.99]",
          "-mx-3",
        )}
      >
        {/* Severity dot */}
        <div
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            severityDotClass[severity],
          )}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {projectTitle}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground leading-normal">
            {message}
          </p>
          <p className="mt-0.5 text-[11px] italic text-muted-foreground/60 leading-tight">
            {reason}
          </p>
        </div>

        {/* Score badge + arrow */}
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={severityBadgeVariant[severity]} className="text-[10px] tabular-nums">
            {score}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-all duration-150 group-hover/item:text-muted-foreground group-hover/item:translate-x-0.5" />
        </div>
      </Link>
    </motion.div>
  );
}
