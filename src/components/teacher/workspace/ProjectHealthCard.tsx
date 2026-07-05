"use client";

import { motion } from "framer-motion";
import { Pin, PinOff, ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { CompletionBar } from "@/components/dashboard/CompletionBar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EASE_OUT, DURATION, STAGGER } from "./animations";
import type { HealthLevel, TrendDirection } from "@/lib/delivery/types";

interface ProjectHealthCardProps {
  id: string;
  title: string;
  health: { level: HealthLevel; oneLiner: string; score: number };
  trend: TrendDirection;
  completionPercentage: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  daysRemaining: number;
  isPinned: boolean;
  onTogglePin?: (projectId: string) => void;
  index?: number;
}

const borderColors: Record<HealthLevel, string> = {
  EXCELLENT: "border-l-emerald-500",
  HEALTHY: "border-l-indigo-500",
  WARNING: "border-l-amber-500",
  CRITICAL: "border-l-rose-500",
};

export function ProjectHealthCard({
  id,
  title,
  health,
  trend,
  completionPercentage,
  pendingTaskCount,
  completedTaskCount,
  blockedTaskCount,
  daysRemaining,
  isPinned,
  onTogglePin,
  index = 0,
}: ProjectHealthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER.NORMAL, duration: DURATION.SLOW, ease: EASE_OUT }}
    >
      <Card
        className={cn(
          "group/card relative border-l-4 overflow-hidden p-5 transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
          "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
          borderColors[health.level]
        )}
      >
        {/* Pin toggle */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onTogglePin?.(id);
          }}
          className={cn(
            "absolute top-3 right-3 transition-all duration-150",
            "text-muted-foreground/40 hover:text-foreground active:scale-75",
            isPinned && "text-primary"
          )}
          aria-label={isPinned ? "Unpin project" : "Pin project"}
        >
          {isPinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Title + Health */}
        <div className="flex items-start gap-2 pr-8">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
          </div>
          <HealthBadge level={health.level} trend={trend} />
        </div>

        {/* One-liner */}
        <p className="mt-1 text-[11px] text-muted-foreground">{health.oneLiner}</p>

        {/* Completion bar */}
        <div className="mt-3">
          <CompletionBar value={completionPercentage} />
        </div>

        {/* Task summary */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="text-emerald-600">{completedTaskCount} completed</span>
          {pendingTaskCount > 0 && <span className="text-amber-600">{pendingTaskCount} pending</span>}
          {blockedTaskCount > 0 && <span className="text-rose-600">{blockedTaskCount} blocked</span>}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{daysRemaining > 0 ? `${daysRemaining}d remaining` : "Overdue"}</span>
          </div>
          <Link
            href={`/teacher/projects/${id}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
          >
            Open <ArrowRight className="h-3 w-3 transition-transform group-hover/card:translate-x-0.5" />
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
