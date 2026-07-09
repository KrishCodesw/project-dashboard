"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Target, Sparkles, Award } from "lucide-react";
import type { CompletedItem, CompletedItemType } from "@/lib/delivery/types";

interface RecentlyCompletedListProps {
  items: CompletedItem[];
}

const typeConfig: Record<CompletedItemType, { icon: typeof CheckCircle2; label: string }> = {
  REVIEW_COMPLETED: { icon: CheckCircle2, label: "Review completed" },
  SHOWCASE_APPROVED: { icon: Sparkles, label: "Showcase approved" },
  MILESTONE_COMPLETED: { icon: Target, label: "Milestone completed" },
  SPRINT_FINISHED: { icon: Award, label: "Sprint finished" },
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export function RecentlyCompletedList({ items }: RecentlyCompletedListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[2px] border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground text-center py-4">
          No completed items since your last visit.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-1"
    >
      {items.map((item) => {
        const config = typeConfig[item.type];
        const Icon = config.icon;

        return (
          <motion.div
            key={item.id}
            variants={itemVariants}
            className="flex items-start gap-3 rounded-[2px] border border-border px-4 py-3"
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                {item.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.projectTitle}
              </p>
            </div>
            <time
              dateTime={item.completedAt.toISOString()}
              className="text-xs text-muted-foreground shrink-0 mt-0.5 tabular-nums"
            >
              {relativeTime(item.completedAt)}
            </time>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
