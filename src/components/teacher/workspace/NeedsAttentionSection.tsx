"use client";

import { motion } from "framer-motion";
import { ListChecks, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NeedsAttentionItem } from "./NeedsAttentionItem";
import type { ScoredAttentionItem, ScaleTier } from "@/lib/delivery/types";

interface NeedsAttentionSectionProps {
  items: ScoredAttentionItem[];
  maxVisible?: number;
  scaleTier?: ScaleTier;
}

export function NeedsAttentionSection({
  items,
  maxVisible,
  scaleTier = "SMALL",
}: NeedsAttentionSectionProps) {
  if (items.length === 0) return null;

  const effectiveMax =
    maxVisible ?? (scaleTier === "LARGE" ? 5 : 7);
  const displayItems = items.slice(0, effectiveMax);
  const truncated = items.length > effectiveMax;

  return (
    <section>
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
          <ListChecks className="h-4 w-4 text-amber-500" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          Needs Attention
        </h2>
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>

      {/* Items list */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
        className="divide-y divide-border/50 rounded-lg border border-border"
      >
        {displayItems.map((item, i) => (
          <NeedsAttentionItem
            key={item.id}
            id={item.id}
            projectId={item.projectId}
            projectTitle={item.projectTitle}
            type={item.type}
            score={item.score}
            severity={item.severity}
            message={item.message}
            reason={item.reason}
            actionLabel={item.actionLabel}
            actionHref={item.actionHref}
            index={i}
          />
        ))}
      </motion.div>

      {/* View all link */}
      {truncated && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/teacher/projects"
              className={cn(
                "gap-1.5 text-xs text-muted-foreground",
                "hover:text-foreground",
              )}
            >
              View all {items.length} items
              <ChevronDown className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
