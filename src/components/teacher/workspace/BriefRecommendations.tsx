"use client";

import { motion } from "framer-motion";
import { Lightbulb, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/delivery/types";

interface BriefRecommendationsProps {
  recommendations: Recommendation[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export function BriefRecommendations({ recommendations }: BriefRecommendationsProps) {
  if (recommendations.length === 0) return null;

  const items = recommendations.slice(0, 3);

  return (
    <div>
      <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Recommendations
      </h4>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-1"
      >
        {items.map((rec, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Link
              href={rec.actionHref}
              className={cn(
                "group flex items-start gap-3 rounded-[2px] border border-border px-4 py-3",
                "transition-colors duration-150 hover:bg-muted/50"
              )}
            >
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
                  {rec.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rec.reason}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
