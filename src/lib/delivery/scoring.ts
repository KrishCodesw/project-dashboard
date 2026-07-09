// ─── Attention Scoring ─────────────────────────────────────────────────────
// Pure scoring functions for attention items.
// Scores range from 0–1000. Higher = more urgent.

import { ATTENTION } from "./WorkspacePolicy";
import type { AttentionType, Severity } from "./types";

export interface ScoringContext {
  daysUntil?: number;
  readiness?: number;
  overdueCount?: number;
  daysInactive?: number;
  inactiveStudentCount?: number;
  totalMilestones?: number;
}

export function scoreAttentionItem(
  type: AttentionType,
  context: ScoringContext
): number {
  switch (type) {
    case "UPCOMING_REVIEW": {
      const base =
        context.daysUntil === 0
          ? ATTENTION.REVIEW_TODAY_BASE
          : context.daysUntil === 1
            ? ATTENTION.REVIEW_TOMORROW_BASE
            : ATTENTION.REVIEW_LATER_BASE;
      const readinessMultiplier =
        (context.readiness ?? 100) < ATTENTION.READINESS_LOW_THRESHOLD
          ? 1.5
          : (context.readiness ?? 100) < ATTENTION.READINESS_CRITICAL_THRESHOLD
            ? 1.2
            : 1;
      return Math.round(base * readinessMultiplier);
    }

    case "OVERDUE_MILESTONE":
      return ATTENTION.OVERDUE_MILESTONE_BASE * (context.overdueCount ?? 1);

    case "BOUNCED_INVITE":
      return ATTENTION.BOUNCED_INVITE_BASE;

    case "PENDING_EDIT":
      return ATTENTION.PENDING_EDIT_BASE;

    case "BLOCKED_TASK":
      return ATTENTION.BLOCKED_TASK_BASE * (context.overdueCount ?? 1);

    case "OVERDUE_TASKS":
      return ATTENTION.OVERDUE_TASK_BASE * Math.min((context.overdueCount ?? 1), 5);

    case "NO_ACTIVITY": {
      const days = Math.min(context.daysInactive ?? 7, 30);
      return Math.min(750, Math.round(ATTENTION.NO_ACTIVITY_BASE * (days / 7)));
    }

    default:
      return 0;
  }
}

export function scoreToSeverity(score: number): Severity {
  if (score >= ATTENTION.SEVERITY_CRITICAL) return "CRITICAL";
  if (score >= ATTENTION.SEVERITY_HIGH) return "HIGH";
  if (score >= ATTENTION.SEVERITY_MEDIUM) return "MEDIUM";
  return "LOW";
}
