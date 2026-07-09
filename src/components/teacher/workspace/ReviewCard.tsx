"use client";

import { motion } from "framer-motion";
import { Users, CheckCircle2, XCircle, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EASE_OUT, DURATION, STAGGER } from "./animations";
import type { ReviewReadiness } from "@/lib/delivery/types";

interface ReviewCardProps {
  id: string;
  projectId: string;
  projectTitle: string;
  reviewType: string;
  scheduledAt: Date;
  daysUntil: number;
  studentCount: number;
  readiness: ReviewReadiness;
  index?: number;
}

const scoreColor = (score: number) => {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
};

const scoreLabel = (score: number) => {
  if (score >= 70) return "Good";
  if (score >= 40) return "Needs work";
  return "At risk";
};

const urgencyBadge = (daysUntil: number) => {
  if (daysUntil <= 0)
    return { label: "Today", variant: "destructive" as const };
  if (daysUntil === 1) return { label: "Tomorrow", variant: "destructive" as const };
  if (daysUntil <= 7) return { label: `${daysUntil} days`, variant: "warning" as const };
  return { label: `${daysUntil} days`, variant: "secondary" as const };
};

export function ReviewCard({
  id,
  projectId,
  projectTitle,
  reviewType,
  daysUntil,
  studentCount,
  readiness,
  index = 0,
}: ReviewCardProps) {
  const badge = urgencyBadge(daysUntil);
  const { score, milestonesCompleted, totalMilestones, filesSubmitted, documentationSubmitted, warnings } =
    readiness;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER.NORMAL, duration: DURATION.SLOW, ease: EASE_OUT }}
    >
      <div className="group/card rounded-[2px] border border-border bg-card text-card-foreground transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0">
        {/* Top row: title + score ring */}
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-medium text-foreground">
                {projectTitle}
              </h3>
              <span className="shrink-0 rounded-[2px] bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {reviewType}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <Badge variant={badge.variant} className="px-1.5 py-0 text-[10px]">
                  {badge.label}
                </Badge>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {studentCount} student{studentCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Readiness score ring */}
          <div className="relative flex shrink-0 items-center justify-center">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${(score / 100) * 176} 176`}
                strokeLinecap="round"
                className={cn("transition-all duration-700", scoreColor(score))}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-bold leading-none", scoreColor(score))}>
                {score}
              </span>
              <span className={cn("text-[9px] font-mono uppercase tracking-wider", scoreColor(score))}>
                %
              </span>
            </div>
          </div>
        </div>

        {/* Score label */}
        <div className="px-5 pb-2">
          <span
            className={cn(
              "text-[10px] font-mono uppercase tracking-wider",
              scoreColor(score)
            )}
          >
            {scoreLabel(score)}
          </span>
        </div>

        {/* Checklist */}
        <div className="border-t border-border px-5 py-3">
          <div className="space-y-1.5">
            <CheckItem
              checked={true}
              label="Milestones"
              detail={`${milestonesCompleted}/${totalMilestones} completed`}
            />
            <CheckItem
              checked={documentationSubmitted}
              label="Documentation"
              detail={documentationSubmitted ? "submitted" : "missing"}
            />
            <CheckItem
              checked={filesSubmitted}
              label="Files"
              detail={filesSubmitted ? "submitted" : "missing"}
            />
            {warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-rose-500"
              >
                <XCircle className="h-3 w-3 shrink-0" />
                <span className="truncate">{warning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <Link href={`/teacher/projects/${projectId}/reviews/${id}`}>
            <Button size="sm" variant="default">
              Open Review
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
          <Link
            href={`/teacher/projects/${projectId}/reviews/${id}/reschedule`}
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
          >
            Reschedule
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function CheckItem({
  checked,
  label,
  detail,
}: {
  checked: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {checked ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-3 w-3 shrink-0 text-rose-500" />
      )}
      <span className="text-muted-foreground">{label}:</span>
      <span className={checked ? "text-foreground" : "text-rose-500"}>
        {detail}
      </span>
    </div>
  );
}

