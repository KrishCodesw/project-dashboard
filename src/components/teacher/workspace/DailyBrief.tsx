"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { EASE_OUT, DURATION } from "./animations";
import { BriefStatGroup } from "./BriefStatGroup";
import { RecentlyCompletedList } from "./RecentlyCompletedList";
import { BriefAttentionItems } from "./BriefAttentionItems";
import { BriefRecommendations } from "./BriefRecommendations";
import type { ChangeStats, CompletedItem, BriefAttentionItem, Recommendation } from "@/lib/delivery/types";

interface DailyBriefProps {
  sinceLastVisit: ChangeStats;
  recentlyCompleted: CompletedItem[];
  attentionItems: BriefAttentionItem[];
  recommendations: Recommendation[];
}

export function DailyBrief({
  sinceLastVisit,
  recentlyCompleted,
  attentionItems,
  recommendations,
}: DailyBriefProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE_OUT }}
      className="rounded-xl border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Daily Brief
        </h2>
      </div>

      {/* Since your last visit stats */}
      <BriefStatGroup
        tasksCompleted={sinceLastVisit.tasksCompleted}
        filesUploaded={sinceLastVisit.filesUploaded}
        commentsAdded={sinceLastVisit.commentsAdded}
        milestonesCompleted={sinceLastVisit.milestonesCompleted}
      />

      {/* Recently Completed */}
      {recentlyCompleted.length > 0 && (
        <>
          <div className="my-4 border-t" />
          <RecentlyCompletedList items={recentlyCompleted} />
        </>
      )}

      {/* Attention items */}
      {attentionItems.length > 0 && (
        <>
          <div className="my-4 border-t" />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs attention
            </h3>
            <BriefAttentionItems items={attentionItems} />
          </div>
        </>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <>
          <div className="my-4 border-t" />
          <BriefRecommendations recommendations={recommendations} />
        </>
      )}
    </motion.div>
  );
}
