// ─── WorkspacePolicy ───────────────────────────────────────────────────────
// Single source of truth for all business constants and thresholds.
// Changing product behaviour should require editing exactly one module.

export const HEALTH = {
  EXCELLENT_MIN: 80,
  HEALTHY_MIN: 60,
  WARNING_MIN: 40,
  CRITICAL_MAX: 39,
} as const;

export const TREND = {
  SIGNIFICANT_CHANGE: 5, // points difference to count as improving/declining
} as const;

export const ATTENTION = {
  SEVERITY_CRITICAL: 800,
  SEVERITY_HIGH: 500,
  SEVERITY_MEDIUM: 200,
  REVIEW_TODAY_BASE: 800,
  REVIEW_TOMORROW_BASE: 500,
  REVIEW_LATER_BASE: 200,
  OVERDUE_MILESTONE_BASE: 300,
  BOUNCED_INVITE_BASE: 400,
  PENDING_EDIT_BASE: 200,
  BLOCKED_TASK_BASE: 150,
  OVERDUE_TASK_BASE: 100,
  NO_ACTIVITY_BASE: 250,
  INACTIVE_STUDENT_BASE: 100,
  READINESS_LOW_THRESHOLD: 50,   // % — triggers ×1.5 multiplier
  READINESS_CRITICAL_THRESHOLD: 30, // % — triggers ×1.2 multiplier
  MAX_IMMEDIATE_ACTIONS: 3,
} as const;

export const REVIEW_READINESS = {
  MILESTONE_WEIGHT: 40,     // %
  DOCUMENTATION_WEIGHT: 25, // %
  FILES_WEIGHT: 20,         // %
  TASKS_WEIGHT: 15,         // %
  GOOD_THRESHOLD: 70,       // % — green
  WARNING_THRESHOLD: 40,    // % — amber
} as const;

export const REFRESH = {
  URGENT: 30_000,         // 30s: Immediate Actions, Needs Attention
  NORMAL: 60_000,         // 60s: Projects, Reviews, Students, Changes
  BRIEF: Infinity,        // Never auto-refresh: Daily Brief
  NOTIFICATIONS: 30_000,  // 30s: Notification polling (existing)
} as const;

export const SCALE = {
  SMALL_MAX: 5,
  MEDIUM_MAX: 15,
  MEDIUM_ATTENTION_MAX: 7,
  LARGE_PROJECTS_SHOWN: 9,
  LARGE_ATTENTION_MAX: 5,
  LARGE_ACTIONS_MAX: 3,
} as const;

export const STUDENT = {
  INACTIVE_DAYS_THRESHOLD: 7,
  INACTIVE_CRITICAL_DAYS: 8,
} as const;

export const INACTIVITY = {
  DAYS_THRESHOLD: 7,
  MAX_DAYS: 30,
} as const;
