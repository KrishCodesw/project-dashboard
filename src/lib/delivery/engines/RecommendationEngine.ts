// ─── RecommendationEngine ──────────────────────────────────────────────────
// Pure engine: scored attention items + raw project data → actionable
// recommendations. One recommendation per project (highest-priority rule
// wins), returned in priority order.

import type {
  Recommendation,
  ScoredAttentionItem,
  RawProjectData,
} from "@/lib/delivery/types";

export function generateRecommendations(
  attentionItems: ScoredAttentionItem[],
  projects: RawProjectData[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const processedProjectIds = new Set<string>();

  // Quick lookup by project id
  const projectMap = new Map<string, RawProjectData>();
  for (const project of projects) {
    projectMap.set(project.id, project);
  }

  // Track which projects have attention items (needed for rule 6)
  const projectHasAttention = new Set<string>();
  for (const item of attentionItems) {
    projectHasAttention.add(item.projectId);
  }

  // Priority ordering for attention-based rules (highest first)
  const rulePriority: Record<string, number> = {
    OVERDUE_MILESTONE: 1,
    NO_ACTIVITY: 2,
    BOUNCED_INVITE: 3,
    PENDING_EDIT: 4,
  };

  const sortedItems = [...attentionItems].sort(
    (a, b) => (rulePriority[a.type] ?? 99) - (rulePriority[b.type] ?? 99),
  );

  const now = new Date();

  // ── Rules 1-4: Attention-based ───────────────────────────────────────

  for (const item of sortedItems) {
    if (processedProjectIds.has(item.projectId)) continue;

    const project = projectMap.get(item.projectId);
    if (!project) continue;

    // Rule 1: OVERDUE_MILESTONE + review within 3 days
    if (item.type === "OVERDUE_MILESTONE") {
      const threeDaysFromNow = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      );
      const upcomingReview = project.reviews.find((r) => {
        return r.scheduledAt >= now && r.scheduledAt <= threeDaysFromNow;
      });
      if (upcomingReview !== undefined) {
        const daysUntil = Math.ceil(
          (upcomingReview.scheduledAt.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        );
        recommendations.push({
          message: `Review ${item.projectTitle}'s milestones`,
          reason: `Milestone overdue, review scheduled in ${daysUntil} days`,
          actionHref: `/teacher/projects/${item.projectId}`,
        });
        processedProjectIds.add(item.projectId);
        continue;
      }
    }

    // Rule 2: NO_ACTIVITY
    if (item.type === "NO_ACTIVITY") {
      const daysInactive = extractDays(item.reason) ?? 7;
      recommendations.push({
        message: `Follow up with ${item.projectTitle} team`,
        reason: `No activity in ${daysInactive} days`,
        actionHref: `/teacher/projects/${item.projectId}`,
      });
      processedProjectIds.add(item.projectId);
      continue;
    }

    // Rule 3: BOUNCED_INVITE
    if (item.type === "BOUNCED_INVITE") {
      const bouncedEmail = project.pendingAssignments.find(
        (pa) => pa.deliveryStatus === "BOUNCED",
      )?.email;
      const studentLabel =
        bouncedEmail ?? item.message.replace(/bounced invite/i, "").trim();
      recommendations.push({
        message: `Fix ${studentLabel}'s email`,
        reason: "Invitation bounced",
        actionHref: `/teacher/projects/${item.projectId}`,
      });
      processedProjectIds.add(item.projectId);
      continue;
    }

    // Rule 4: PENDING_EDIT
    if (item.type === "PENDING_EDIT") {
      recommendations.push({
        message: `Review edit request for ${item.projectTitle}`,
        reason: "Edit request pending",
        actionHref: `/teacher/projects/${item.projectId}`,
      });
      processedProjectIds.add(item.projectId);
      continue;
    }
  }

  // ── Rule 5: Review completed in last 24h (not attention-based) ───────

  for (const project of projects) {
    if (processedProjectIds.has(project.id)) continue;

    const twentyFourHoursAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    );
    const recentReview = project.reviews.find((r) => {
      return (
        r.conductedAt !== null &&
        r.conductedAt >= twentyFourHoursAgo &&
        r.conductedAt <= now
      );
    });
    if (recentReview !== undefined) {
      recommendations.push({
        message: `Review ${project.title}'s review feedback`,
        reason: "Review completed recently",
        actionHref: `/teacher/projects/${project.id}`,
      });
      processedProjectIds.add(project.id);
    }
  }

  // ── Rule 6: Multiple inactive students in one project ────────────────

  for (const project of projects) {
    if (processedProjectIds.has(project.id)) continue;

    // Only flag projects that have known issues (attention items exist)
    // AND have multiple members — signalling a team-wide concern.
    if (projectHasAttention.has(project.id) && project.members.length >= 2) {
      recommendations.push({
        message: `Check on ${project.title}'s team`,
        reason: `${project.members.length} students need attention`,
        actionHref: `/teacher/projects/${project.id}`,
      });
      processedProjectIds.add(project.id);
    }
  }

  return recommendations;
}

/**
 * Extract the first integer from a string. Returns null when none is found.
 */
function extractDays(text: string): number | null {
  const match = text.match(/\d+/);
  return match !== null ? Number.parseInt(match[0], 10) : null;
}
