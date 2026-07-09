"use client";

import { motion } from "framer-motion";
import { CheckCircle2, FileUp, MessageSquare, Target, ArrowRight } from "lucide-react";
import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { cn } from "@/lib/utils";
import { EASE_OUT, DURATION, STAGGER } from "./animations";
import type { HealthLevel, TrendDirection } from "@/lib/delivery/types";

interface ChangeGroupProps {
  projectId: string;
  projectTitle: string;
  health: HealthLevel;
  trend: TrendDirection;
  sinceLastVisit: {
    tasksCompleted: number;
    filesUploaded: number;
    commentsAdded: number;
    milestonesCompleted: number;
  };
  index?: number;
}

const statItems = [
  { key: "tasksCompleted" as const, icon: CheckCircle2, label: "tasks", color: "text-emerald-500" },
  { key: "filesUploaded" as const, icon: FileUp, label: "files", color: "text-indigo-500" },
  { key: "commentsAdded" as const, icon: MessageSquare, label: "comments", color: "text-sky-500" },
  { key: "milestonesCompleted" as const, icon: Target, label: "milestones", color: "text-amber-500" },
] as const;

export function ChangeGroup({
  projectId,
  projectTitle,
  health,
  trend,
  sinceLastVisit,
  index = 0,
}: ChangeGroupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE_OUT, delay: index * STAGGER.NORMAL }}
      className="group/card rounded-xl border bg-card p-4 transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {projectTitle}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <HealthBadge level={health} trend={trend} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {statItems.map(({ key, icon: Icon, label, color }) => {
          const value = sinceLastVisit[key];
          return (
            <span
              key={key}
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                value > 0 ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", value > 0 && color)} />
              {value} {label}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          href={`/teacher/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground group-hover/card:gap-1.5"
        >
          Open Project
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  );
}
