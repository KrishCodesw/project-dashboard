// ─── AttentionEngine ───────────────────────────────────────────────────
// Pure engine that transforms raw project data into scored attention items.
// No React, no Prisma, no side effects.

import type { RawProjectData, ScoredAttentionItem } from "../types";
import { scoreAttentionItem, scoreToSeverity } from "../scoring";

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor(
    (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function computeAttentionItems(
  projects: RawProjectData[],
  since: Date
): ScoredAttentionItem[] {
  const items: ScoredAttentionItem[] = [];
  const inAWeek = new Date(since.getTime() + 7 * 24 * 60 * 60 * 1000);
  const aWeekAgo = new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000);
  let seq = 0;

  for (const project of projects) {
    // ── UPCOMING_REVIEW ─────────────────────────────────────────────────
    for (const review of project.reviews) {
      if (review.status === "COMPLETED") continue;
      if (review.scheduledAt < since || review.scheduledAt > inAWeek) continue;

      const daysUntil = daysBetween(since, review.scheduledAt);
      const score = scoreAttentionItem("UPCOMING_REVIEW", { daysUntil });
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "UPCOMING_REVIEW",
        score,
        severity: scoreToSeverity(score),
        message: `Review for ${project.title} coming up`,
        reason: `Scheduled ${daysUntil} days away`,
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── OVERDUE_MILESTONE ──────────────────────────────────────────────
    const overdueMilestones = project.milestones.filter(
      (m) => !m.isCompleted && m.dueDate < since
    );
    if (overdueMilestones.length > 0) {
      const score = scoreAttentionItem("OVERDUE_MILESTONE", {
        overdueCount: overdueMilestones.length,
      });
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "OVERDUE_MILESTONE",
        score,
        severity: scoreToSeverity(score),
        message: `${overdueMilestones.length} milestone(s) overdue in ${project.title}`,
        reason: `Due ${overdueMilestones[0].dueDate.toLocaleDateString()}`,
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── BOUNCED_INVITE ─────────────────────────────────────────────────
    for (const pa of project.pendingAssignments) {
      if (pa.deliveryStatus !== "BOUNCED") continue;

      const score = scoreAttentionItem("BOUNCED_INVITE", {});
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "BOUNCED_INVITE",
        score,
        severity: scoreToSeverity(score),
        message: `Invitation bounced for ${pa.email}`,
        reason: "Delivery failed",
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── PENDING_EDIT ───────────────────────────────────────────────────
    const hasPendingEdit = project.hasPendingEdit;
    if (hasPendingEdit) {
      const score = scoreAttentionItem("PENDING_EDIT", {});
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "PENDING_EDIT",
        score,
        severity: scoreToSeverity(score),
        message: `Edit request pending for ${project.title}`,
        reason: "Pending approval",
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── BLOCKED_TASK ───────────────────────────────────────────────────
    const blockedTasks = project.tasks.filter((t) => t.status === "BLOCKED");
    if (blockedTasks.length > 0) {
      const score = scoreAttentionItem("BLOCKED_TASK", {
        overdueCount: blockedTasks.length,
      });
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "BLOCKED_TASK",
        score,
        severity: scoreToSeverity(score),
        message: `${blockedTasks.length} blocked task(s) in ${project.title}`,
        reason: "Blocked",
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── OVERDUE_TASKS ──────────────────────────────────────────────────
    const overdueTasks = project.tasks.filter(
      (t) => t.status !== "DONE" && t.dueDate !== null && t.dueDate < since
    );
    if (overdueTasks.length > 0) {
      const score = scoreAttentionItem("OVERDUE_TASKS", {
        overdueCount: overdueTasks.length,
      });
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "OVERDUE_TASKS",
        score,
        severity: scoreToSeverity(score),
        message: `${overdueTasks.length} overdue task(s) in ${project.title}`,
        reason: "Past due",
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }

    // ── NO_ACTIVITY ────────────────────────────────────────────────────
    let latestActivity: Date | null = null;

    for (const t of project.tasks) {
      if (t.updatedAt > (latestActivity ?? t.updatedAt)) {
        latestActivity = t.updatedAt;
      }
    }
    for (const m of project.milestones) {
      if (m.completedAt && m.completedAt > (latestActivity ?? m.completedAt)) {
        latestActivity = m.completedAt;
      }
    }
    for (const f of project.files) {
      if (f.uploadedAt > (latestActivity ?? f.uploadedAt)) {
        latestActivity = f.uploadedAt;
      }
    }

    if (latestActivity !== null && latestActivity < aWeekAgo) {
      const daysInactive = daysBetween(latestActivity, since);
      const score = scoreAttentionItem("NO_ACTIVITY", { daysInactive });
      items.push({
        id: `attention-${++seq}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "NO_ACTIVITY",
        score,
        severity: scoreToSeverity(score),
        message: `No activity in ${daysInactive} days`,
        reason: "Inactive",
        actionLabel: "Open Project",
        actionHref: `/teacher/projects/${project.id}`,
      });
    }
  }

  return items.sort((a, b) => b.score - a.score);
}
