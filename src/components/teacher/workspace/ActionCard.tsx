"use client";

import { motion } from "framer-motion";
import { X, ArrowRight, AlertTriangle, AlertCircle, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EASE_OUT, DURATION, STAGGER } from "./animations";
import type { ActionCard as ActionCardType } from "@/lib/delivery/types";

interface ActionCardProps {
  id: string;
  type: ActionCardType["type"];
  score: number;
  title: string;
  description: string;
  reason: string;
  primaryAction: { label: string; href: string };
  dismissible: boolean;
  onDismiss?: (id: string) => void;
  index?: number;
}

type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SCORE_CRITICAL = 800;
const SCORE_HIGH = 500;
const SCORE_MEDIUM = 200;

function getSeverity(score: number): SeverityLevel {
  if (score >= SCORE_CRITICAL) return "CRITICAL";
  if (score >= SCORE_HIGH) return "HIGH";
  if (score >= SCORE_MEDIUM) return "MEDIUM";
  return "LOW";
}

const severityConfig: Record<SeverityLevel, {
  icon: typeof AlertTriangle;
  borderClass: string;
  iconClass: string;
  dotClass: string;
}> = {
  CRITICAL: {
    icon: AlertTriangle as typeof AlertTriangle,
    borderClass: "border-l-rose-500",
    iconClass: "text-rose-500",
    dotClass: "bg-rose-500",
  },
  HIGH: {
    icon: AlertCircle as typeof AlertCircle,
    borderClass: "border-l-amber-500",
    iconClass: "text-amber-500",
    dotClass: "bg-amber-500",
  },
  MEDIUM: {
    icon: Clock as typeof Clock,
    borderClass: "border-l-blue-500",
    iconClass: "text-blue-500",
    dotClass: "bg-blue-500",
  },
  LOW: {
    icon: Info as typeof Info,
    borderClass: "border-l-slate-400",
    iconClass: "text-slate-400",
    dotClass: "bg-slate-400",
  },
};

export function ActionCard({
  id,
  score,
  title,
  description,
  reason,
  primaryAction,
  dismissible,
  onDismiss,
  index = 0,
}: ActionCardProps) {
  const severity = getSeverity(score);
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER.NORMAL, duration: DURATION.SLOW, ease: EASE_OUT }}
      className={cn(
        "group/card relative flex items-start gap-3 rounded-lg border border-border bg-card p-4 border-l-4",
        "transition-all duration-200 ease-out hover:shadow-sm active:scale-[0.99]",
        config.borderClass,
      )}
    >
      {/* Severity icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("h-5 w-5", config.iconClass)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-normal">
          {description}
        </p>
        <p className="mt-1 text-[11px] italic text-muted-foreground/70 leading-tight">
          {reason}
        </p>
      </div>

      {/* Primary action */}
      <div className="shrink-0 pt-0.5">
        <Link href={primaryAction.href}>
          <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap">
            {primaryAction.label}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Dismiss */}
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className={cn(
            "absolute right-2 top-2 rounded p-0.5 text-muted-foreground/40",
            "opacity-0 transition-opacity duration-150 group-hover/card:opacity-100",
            "hover:text-muted-foreground hover:bg-accent active:scale-90",
          )}
          aria-label="Dismiss this action"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
