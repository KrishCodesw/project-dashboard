// ─── Health Engine ──────────────────────────────────────────────────────────
// Pure function that calculates project health scores and trends from raw data.
// Zero side effects, zero framework imports.

import { HealthLevel, HealthResult, RawProjectData, TrendDirection } from "@/lib/delivery/types";
import { HEALTH, TREND } from "@/lib/delivery/WorkspacePolicy";

export function computeHealth(project: RawProjectData, previousScore?: number): HealthResult {
  const now = new Date();

  // ── Milestone completion: 30% weight ───────────────────────────────────
  const totalMilestones = project.milestones.length;
  const completedMilestones = project.milestones.filter((m) => m.isCompleted).length;
  const milestoneRatio = totalMilestones > 0 ? completedMilestones / totalMilestones : 1;
  const milestoneScore = milestoneRatio * 30;

  // ── Task completion: 25% weight ────────────────────────────────────────
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const taskRatio = totalTasks > 0 ? completedTasks / totalTasks : 1;
  const taskScore = taskRatio * 25;

  // ── Overdue tasks penalty: -15% ────────────────────────────────────────
  const overdueTasks = project.tasks.filter((t) => {
    if (t.status === "DONE") return false;
    if (!t.dueDate) return false;
    return t.dueDate < now;
  });
  const overduePenalty = overdueTasks.length > 0 ? 15 : 0;

  // ── Blocked tasks penalty: -10% ────────────────────────────────────────
  const blockedTasks = project.tasks.filter((t) => t.status === "BLOCKED");
  const blockedPenalty = blockedTasks.length > 0 ? 10 : 0;

  // ── Activity recency: 20% weight ───────────────────────────────────────
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity =
    project.tasks.some(
      (t) =>
        (t.createdAt && t.createdAt >= sevenDaysAgo) ||
        (t.updatedAt && t.updatedAt >= sevenDaysAgo) ||
        (t.completedAt && t.completedAt >= sevenDaysAgo)
    ) ||
    project.milestones.some((m) => m.completedAt && m.completedAt >= sevenDaysAgo) ||
    project.files.some((f) => f.uploadedAt >= sevenDaysAgo);
  const activityScore = recentActivity ? 20 : 0;

  // ── Days since last activity (for reasons / oneLiner) ──────────────────
  const allTimestamps: number[] = [];
  project.tasks.forEach((t) => {
    allTimestamps.push(t.createdAt.getTime(), t.updatedAt.getTime());
    if (t.completedAt) allTimestamps.push(t.completedAt.getTime());
  });
  project.milestones.forEach((m) => {
    if (m.completedAt) allTimestamps.push(m.completedAt.getTime());
  });
  project.files.forEach((f) => {
    allTimestamps.push(f.uploadedAt.getTime());
  });
  const latestActivity = allTimestamps.length > 0 ? Math.max(...allTimestamps) : null;
  const daysSinceActivity =
    latestActivity !== null ? Math.floor((now.getTime() - latestActivity) / (1000 * 60 * 60 * 24)) : null;

  // ── Assignment completion: 10% weight ──────────────────────────────────
  const assignmentScore = project.pendingAssignments.length === 0 ? 10 : 0;

  // ── Days remaining bonus: up to +5 ─────────────────────────────────────
  const msRemaining = project.endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const daysBonus = daysRemaining > 30 ? 5 : 0;

  // ── Composite score (clamped to 0-100) ─────────────────────────────────
  const rawScore =
    milestoneScore + taskScore + activityScore + assignmentScore - overduePenalty - blockedPenalty + daysBonus;
  const score = Math.max(0, Math.min(100, rawScore));

  // ── Health level ───────────────────────────────────────────────────────
  let level: HealthLevel;
  if (score >= HEALTH.EXCELLENT_MIN) {
    level = "EXCELLENT";
  } else if (score >= HEALTH.HEALTHY_MIN) {
    level = "HEALTHY";
  } else if (score >= HEALTH.WARNING_MIN) {
    level = "WARNING";
  } else {
    level = "CRITICAL";
  }

  // ── Trend ──────────────────────────────────────────────────────────────
  let trend: TrendDirection;
  if (previousScore === undefined) {
    trend = "STABLE";
  } else {
    const diff = score - previousScore;
    if (diff >= TREND.SIGNIFICANT_CHANGE) {
      trend = "IMPROVING";
    } else if (diff <= -TREND.SIGNIFICANT_CHANGE) {
      trend = "DECLINING";
    } else {
      trend = "STABLE";
    }
  }

  // ── Reasons ────────────────────────────────────────────────────────────
  const reasons: string[] = [];

  reasons.push(`${completedMilestones}/${totalMilestones} milestones completed`);

  reasons.push(`${completedTasks}/${totalTasks} tasks completed`);

  if (overdueTasks.length > 0) {
    const noun = overdueTasks.length === 1 ? "task" : "tasks";
    reasons.push(`${overdueTasks.length} ${noun} overdue`);
  }

  if (blockedTasks.length > 0) {
    const noun = blockedTasks.length === 1 ? "task" : "tasks";
    reasons.push(`${blockedTasks.length} blocked ${noun}`);
  }

  if (recentActivity) {
    reasons.push("Activity within last 7 days");
  } else if (daysSinceActivity !== null) {
    reasons.push(`No activity in ${daysSinceActivity} days`);
  } else {
    reasons.push("No activity recorded");
  }

  if (project.pendingAssignments.length === 0) {
    reasons.push("All team slots filled");
  } else {
    const noun = project.pendingAssignments.length === 1 ? "assignment" : "assignments";
    reasons.push(`${project.pendingAssignments.length} pending ${noun}`);
  }

  if (daysBonus > 0) {
    reasons.push("Days remaining bonus applied (+5)");
  }

  // ── oneLiner (prioritised: overdue milestones > blocked > activity) ────
  const overdueMilestones = project.milestones.filter((m) => !m.isCompleted && m.dueDate < now);
  const parts: string[] = [];

  if (overdueMilestones.length > 0) {
    const noun = overdueMilestones.length === 1 ? "milestone" : "milestones";
    parts.push(`${overdueMilestones.length} overdue ${noun}`);
  }

  if (blockedTasks.length > 0 && parts.length < 2) {
    const noun = blockedTasks.length === 1 ? "task" : "tasks";
    parts.push(`${blockedTasks.length} blocked ${noun}`);
  }

  if (overdueTasks.length > 0 && parts.length < 2 && blockedTasks.length === 0) {
    const noun = overdueTasks.length === 1 ? "task" : "tasks";
    parts.push(`${overdueTasks.length} ${noun} overdue`);
  }

  if (!recentActivity && parts.length < 2 && daysSinceActivity !== null) {
    parts.push(`No activity in ${daysSinceActivity}d`);
  }

  if (project.pendingAssignments.length > 0 && parts.length < 2) {
    const noun = project.pendingAssignments.length === 1 ? "assignment" : "assignments";
    parts.push(`${project.pendingAssignments.length} pending ${noun}`);
  }

  let oneLiner: string;
  if (parts.length > 0) {
    oneLiner = parts.join(", ");
  } else if (completedMilestones === totalMilestones && totalMilestones > 0) {
    oneLiner = "All milestones completed, on track";
  } else {
    oneLiner = "On track";
  }

  return { level, score, oneLiner, trend, reasons };
}
