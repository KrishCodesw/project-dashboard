"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { STAGGER } from "./animations";
import { ActionCard } from "./ActionCard";
import { AllClearedState } from "./AllClearedState";
import type { ActionCard as ActionCardType } from "@/lib/delivery/types";

interface ImmediateActionsSectionProps {
  actions: ActionCardType[];
  onDismiss?: (id: string) => void;
}

export function ImmediateActionsSection({
  actions,
  onDismiss,
}: ImmediateActionsSectionProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = actions.filter((a) => !dismissedIds.has(a.id));

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  return (
    <section>
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          Immediate Actions
        </h2>
        {visible.length > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/10 px-1.5 text-[11px] font-medium text-rose-500">
            {visible.length}
          </span>
        )}
      </div>

      {/* Cards */}
      {visible.length === 0 ? (
        <AllClearedState />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: STAGGER.NORMAL } },
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.slice(0, 3).map((action, i) => (
            <ActionCard
              key={action.id}
              id={action.id}
              type={action.type}
              score={action.score}
              title={action.title}
              description={action.description}
              reason={action.reason}
              primaryAction={action.primaryAction}
              dismissible={action.dismissible}
              onDismiss={handleDismiss}
              index={i}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}
