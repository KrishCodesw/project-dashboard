"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { computeHealth } from "@/lib/delivery/engines/HealthEngine";
import { computeAttentionItems } from "@/lib/delivery/engines/AttentionEngine";
import { generateRecommendations } from "@/lib/delivery/engines/RecommendationEngine";
import { aggregateChanges } from "@/lib/delivery/engines/ChangeAggregator";
import { generateBrief } from "@/lib/delivery/engines/BriefGenerator";
import { computeReviewReadiness } from "@/lib/delivery/engines/ReviewReadinessEngine";
import { summarizeActivity, computeScaleTier } from "@/lib/delivery/engines/ActivitySummarizer";
import type {
  TeacherDashboardData,
  RawProjectData,
  RawTaskData,
  RawMemberData,
  RawReviewData,
  RawMilestoneData,
  RawFileData,
  RawPendingAssignmentData,
  HealthResult,
  ActionCard,
  ScoredAttentionItem,
  ProjectHealthCardData,
  ReviewCardData,
  ReviewReadiness,
  CompletedItem,
  CompletedItemType,
  StudentAttentionData,
  HeaderData,
} from "@/lib/delivery/types";

// ─── Mapping Helpers ──────────────────────────────────────────────────────

function mapProjectToRaw(
  p: Awaited<ReturnType<typeof queryProjects>>[number],
): RawProjectData {
  return {
    id: p.id,
    title: p.title,
    domain: p.domain,
    status: p.status,
    completionPercentage: p.completionPercentage,
    startDate: p.startDate,
    endDate: p.endDate,
    teacherId: p.teacherId,
    isPinned: p.isPinned,
    hasPendingEdit: p.hasPendingEdit,
    tasks: p.tasks.map(
      (t): RawTaskData => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignedToId: t.assignedToId,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }),
    ),
    milestones: p.milestones.map(
      (m): RawMilestoneData => ({
        id: m.id,
        title: m.title,
        dueDate: m.dueDate,
        isCompleted: m.isCompleted,
        completedAt: m.completedAt,
      }),
    ),
    reviews: p.reviews.map(
      (r): RawReviewData => ({
        id: r.id,
        reviewType: r.reviewType,
        scheduledAt: r.scheduledAt,
        conductedAt: r.conductedAt,
        status: r.status,
        reviewerId: r.reviewerId,
      }),
    ),
    files: p.files.map(
      (f): RawFileData => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        uploadedAt: f.uploadedAt,
      }),
    ),
    members: p.members.map(
      (m): RawMemberData => ({
        id: m.id,
        studentId: m.studentId,
        role: m.role,
        student: m.student
          ? { name: m.student.name, email: m.student.email }
          : null,
      }),
    ),
    pendingAssignments: p.pendingAssignments.map(
      (pa): RawPendingAssignmentData => ({
        id: pa.id,
        email: pa.email,
        deliveryStatus: pa.deliveryStatus,
        bounceReason: pa.bounceReason,
      }),
    ),
  } as RawProjectData;
}

function toActionCard(item: ScoredAttentionItem): ActionCard {
  return {
    id: item.id,
    type: item.type,
    score: item.score,
    title: item.message,
    description: item.reason,
    reason: item.reason,
    primaryAction: { label: item.actionLabel, href: item.actionHref },
    dismissible: false,
  };
}

function buildCompletedItem(
  entity: { id: string; projectId: string; projectTitle: string; message: string; completedAt: Date },
  type: CompletedItemType,
): CompletedItem {
  return {
    id: entity.id,
    type,
    projectId: entity.projectId,
    projectTitle: entity.projectTitle,
    message: entity.message,
    completedAt: entity.completedAt,
  };
}

// ─── Prisma Query Helpers ─────────────────────────────────────────────────

async function queryProjects(userId: string) {
  return prisma.project.findMany({
    where: { teacherId: userId },
    include: {
      tasks: true,
      milestones: true,
      reviews: true,
      files: true,
      members: { include: { student: { select: { name: true, email: true } } } },
      pendingAssignments: true,
    },
  });
}

async function queryRecentCompletedItems(
  userId: string,
  since: Date,
): Promise<[CompletedItem[], CompletedItem[]]> {
  const [reviews, milestones] = await Promise.all([
    prisma.review.findMany({
      where: {
        project: { teacherId: userId },
        status: "COMPLETED",
        conductedAt: { gte: since },
      },
      include: { project: { select: { id: true, title: true } } },
    }),
    prisma.milestone.findMany({
      where: {
        project: { teacherId: userId },
        isCompleted: true,
        completedAt: { gte: since },
      },
      include: { project: { select: { id: true, title: true } } },
    }),
  ]);

  const reviewItems = reviews.map((r) =>
    buildCompletedItem(
      {
        id: `review-${r.id}`,
        projectId: r.project.id,
        projectTitle: r.project.title,
        message: `Review completed for ${r.project.title}`,
        completedAt: r.conductedAt!,
      },
      "REVIEW_COMPLETED",
    ),
  );

  const milestoneItems = milestones.map((m) =>
    buildCompletedItem(
      {
        id: `milestone-${m.id}`,
        projectId: m.project.id,
        projectTitle: m.project.title,
        message: `Milestone '${m.title}' completed`,
        completedAt: m.completedAt!,
      },
      "MILESTONE_COMPLETED",
    ),
  );

  return [reviewItems, milestoneItems];
}

async function queryPinnedProjectIds(
  userId: string,
): Promise<string[]> {
  const rows = await prisma.project.findMany({
    where: { teacherId: userId, isPinned: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ─── Students Needing Attention ───────────────────────────────────────────

function computeStudentsNeedingAttention(
  rawProjects: RawProjectData[],
  _since: Date,
): StudentAttentionData[] {
  const results: StudentAttentionData[] = [];
  const now = new Date();
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  for (const project of rawProjects) {
    // ── Overdue tasks per student ──────────────────────────────────────
    const overdueTasksByStudent = new Map<string, number>();
    for (const task of project.tasks) {
      if (task.status === "DONE") continue;
      if (!task.dueDate || task.dueDate >= now) continue;
      if (task.assignedToId) {
        overdueTasksByStudent.set(
          task.assignedToId,
          (overdueTasksByStudent.get(task.assignedToId) ?? 0) + 1,
        );
      }
    }

    // ── Recent completions per student ─────────────────────────────────
    const recentlyCompletedByStudent = new Set<string>();
    for (const task of project.tasks) {
      if (
        task.completedAt &&
        task.completedAt >= eightDaysAgo &&
        task.assignedToId
      ) {
        recentlyCompletedByStudent.add(task.assignedToId);
      }
    }

    // ── Check each member ──────────────────────────────────────────────
    for (const member of project.members) {
      const overdueCount = overdueTasksByStudent.get(member.studentId) ?? 0;
      const hasRecentCompletion = recentlyCompletedByStudent.has(member.studentId);
      const studentName = member.student?.name ?? "Unknown";
      const email = member.student?.email ?? "";

      if (overdueCount > 0) {
        results.push({
          studentId: member.studentId,
          studentName,
          email,
          projectId: project.id,
          projectTitle: project.title,
          reason: "OVERDUE_TASKS",
          detail: `${overdueCount} overdue task(s)`,
          actionLinks: [
            { label: "Open Project", href: `/teacher/projects/${project.id}` },
          ],
        });
      }

      if (!hasRecentCompletion && overdueCount === 0) {
        results.push({
          studentId: member.studentId,
          studentName,
          email,
          projectId: project.id,
          projectTitle: project.title,
          reason: "INACTIVE_8D",
          detail: "No completions in 8+ days",
          actionLinks: [
            { label: "Open Project", href: `/teacher/projects/${project.id}` },
          ],
        });
      }
    }

    // ── Bounced invites ────────────────────────────────────────────────
    for (const pa of project.pendingAssignments) {
      if (pa.deliveryStatus === "BOUNCED") {
        results.push({
          studentId: pa.email,
          studentName: pa.email,
          email: pa.email,
          projectId: project.id,
          projectTitle: project.title,
          reason: "BOUNCED_INVITE",
          detail: pa.bounceReason ?? "Invitation delivery failed",
          actionLinks: [
            { label: "Open Project", href: `/teacher/projects/${project.id}` },
          ],
        });
      }
    }
  }

  return results;
}

// ─── Header Data ──────────────────────────────────────────────────────────

function buildGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(since: Date): string {
  const diffMs = Date.now() - since.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────

export async function getTeacherDashboardData(): Promise<TeacherDashboardData> {
  const authUser = await requireRole("TEACHER");
  // Fetch full user from DB to get lastVisitedAt
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, name: true, lastVisitedAt: true },
  });
  if (!dbUser) throw new Error("User not found");
  const user = dbUser;
  const since = user.lastVisitedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  // ── Parallel data fetch ──────────────────────────────────────────────
  const [projects, [reviewItems, milestoneItems], pinnedProjectIds] =
    await Promise.all([
      queryProjects(user.id),
      queryRecentCompletedItems(user.id, since),
      queryPinnedProjectIds(user.id),
    ]);

  // ── Map to raw data for engines ──────────────────────────────────────
  const rawProjects = projects.map(mapProjectToRaw);

  // ── Engine computations ──────────────────────────────────────────────
  const changeStats = summarizeActivity(rawProjects, since);
  const attentionItems = computeAttentionItems(rawProjects, since);
  const { grouped, chronological } = aggregateChanges(rawProjects, since);
  const recommendations = generateRecommendations(attentionItems, rawProjects);
  const completedItems = [...reviewItems, ...milestoneItems];
  const brief = generateBrief(changeStats, completedItems, attentionItems, recommendations);

  // ── Health per project ───────────────────────────────────────────────
  const healthMap = new Map<string, HealthResult>();
  for (const rp of rawProjects) {
    healthMap.set(rp.id, computeHealth(rp));
  }

  // ── Review readiness ─────────────────────────────────────────────────
  const readinessMap = new Map<string, ReviewReadiness>();
  for (const rp of rawProjects) {
    readinessMap.set(rp.id, computeReviewReadiness(rp));
  }

  // ── Students needing attention ───────────────────────────────────────
  const studentsNeedingAttention = computeStudentsNeedingAttention(rawProjects, since);

  // ── Header data ──────────────────────────────────────────────────────
  const header: HeaderData = {
    greeting: buildGreeting(),
    userName: user.name,
    date: formatDate(),
    sinceLastVisit: relativeTime(since),
    urgentItemCount: attentionItems.length,
    activeProjectCount: projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "COMPLETED").length,
    totalStudentCount: projects.reduce((sum, p) => sum + p.members.length, 0),
    scaleTier: computeScaleTier(projects.length),
  };

  // ── Immediate actions & needs attention ──────────────────────────────
  const immediateActions: ActionCard[] = attentionItems
    .slice(0, 3)
    .map(toActionCard);

  const needsAttention: ScoredAttentionItem[] = attentionItems.slice(3);

  // ── Projects health cards ────────────────────────────────────────────
  const projectsHealthCards: ProjectHealthCardData[] = projects.map((p) => {
    const health = healthMap.get(p.id);
    const now = new Date();
    const msRemaining = p.endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const pendingTaskCount = p.tasks.filter(
      (t) => t.status !== "DONE",
    ).length;
    const completedTaskCount = p.tasks.filter(
      (t) => t.status === "DONE",
    ).length;
    const blockedTaskCount = p.tasks.filter((t) => t.status === "BLOCKED").length;

    return {
      id: p.id,
      title: p.title,
      health: {
        level: health?.level ?? "HEALTHY",
        oneLiner: health?.oneLiner ?? "On track",
        score: health?.score ?? 100,
      },
      trend: health?.trend ?? "STABLE",
      completionPercentage: p.completionPercentage,
      pendingTaskCount,
      completedTaskCount,
      blockedTaskCount,
      daysRemaining,
      isPinned: pinnedProjectIds.includes(p.id),
    };
  });

  // ── Upcoming reviews ─────────────────────────────────────────────────
  const upcomingReviews: ReviewCardData[] = [];
  for (const p of projects) {
    const upcoming = p.reviews.filter(
      (r) => r.status !== "COMPLETED" && r.scheduledAt >= new Date(),
    );
    for (const review of upcoming) {
      const now = new Date();
      const daysUntil = Math.ceil(
        (review.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const rawProject = rawProjects.find((rp) => rp.id === p.id);
      const readiness = rawProject ? readinessMap.get(p.id) ?? computeReviewReadiness(rawProject) : computeReviewReadiness(
        // Fallback: map from project data
        {
          id: p.id,
          title: p.title,
          domain: p.domain,
          status: p.status,
          completionPercentage: p.completionPercentage,
          startDate: p.startDate,
          endDate: p.endDate,
          teacherId: p.teacherId,
          isPinned: p.isPinned,
          tasks: p.tasks.map((t): RawTaskData => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignedToId: t.assignedToId,
            dueDate: t.dueDate,
            completedAt: t.completedAt,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
          milestones: p.milestones.map((m): RawMilestoneData => ({
            id: m.id,
            title: m.title,
            dueDate: m.dueDate,
            isCompleted: m.isCompleted,
            completedAt: m.completedAt,
          })),
          reviews: p.reviews.map((r): RawReviewData => ({
            id: r.id,
            reviewType: r.reviewType,
            scheduledAt: r.scheduledAt,
            conductedAt: r.conductedAt,
            status: r.status,
            reviewerId: r.reviewerId,
          })),
          files: p.files.map((f): RawFileData => ({
            id: f.id,
            fileName: f.fileName,
            fileType: f.fileType,
            uploadedAt: f.uploadedAt,
          })),
          members: p.members.map((m): RawMemberData => ({
            id: m.id,
            studentId: m.studentId,
            role: m.role,
            student: m.student
              ? { name: m.student.name, email: m.student.email }
              : null,
          })),
          pendingAssignments: p.pendingAssignments.map(
            (pa): RawPendingAssignmentData => ({
              id: pa.id,
              email: pa.email,
              deliveryStatus: pa.deliveryStatus,
              bounceReason: pa.bounceReason,
            }),
          ),
        } as RawProjectData,
      );

      upcomingReviews.push({
        id: review.id,
        projectId: p.id,
        projectTitle: p.title,
        reviewType: review.reviewType,
        scheduledAt: review.scheduledAt,
        daysUntil: Math.max(0, daysUntil),
        studentCount: p.members.length,
        readiness,
      });
    }
  }

  // Sort upcoming reviews by scheduled date
  upcomingReviews.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  // ── Background update lastVisitedAt ──────────────────────────────────
  prisma.user
    .update({ where: { id: user.id }, data: { lastVisitedAt: new Date() } })
    .catch(() => {
      // Fire-and-forget: non-critical
    });

  return {
    header,
    dailyBrief: brief,
    immediateActions,
    needsAttention,
    recentChanges: grouped,
    chronologicalEvents: chronological,
    projects: projectsHealthCards,
    upcomingReviews,
    studentsNeedingAttention,
  };
}

// ─── Partial Exports ──────────────────────────────────────────────────────

export async function getTeacherDashboardUrgentData(): Promise<{
  immediateActions: ActionCard[];
  needsAttention: ScoredAttentionItem[];
}> {
  const authUser = await requireRole("TEACHER");
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { lastVisitedAt: true },
  });
  const since = dbUser?.lastVisitedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const projects = await queryProjects(authUser.id);
  const rawProjects = projects.map(mapProjectToRaw);
  const attentionItems = computeAttentionItems(rawProjects, since);

  return {
    immediateActions: attentionItems.slice(0, 3).map(toActionCard),
    needsAttention: attentionItems.slice(3),
  };
}

export async function getTeacherDashboardProjectsData(): Promise<{
  projects: ProjectHealthCardData[];
}> {
  const user = await requireRole("TEACHER");
  const [projects, pinnedProjectIds] = await Promise.all([
    queryProjects(user.id),
    queryPinnedProjectIds(user.id),
  ]);

  const rawProjects = projects.map(mapProjectToRaw);
  const pinnedSet = new Set(pinnedProjectIds);

  const projectsHealthCards: ProjectHealthCardData[] = projects.map((p, i) => {
    const health = computeHealth(rawProjects[i]);
    const now = new Date();
    const msRemaining = p.endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const pendingTaskCount = p.tasks.filter(
      (t) => t.status !== "DONE",
    ).length;
    const completedTaskCount = p.tasks.filter(
      (t) => t.status === "DONE",
    ).length;
    const blockedTaskCount = p.tasks.filter((t) => t.status === "BLOCKED").length;

    return {
      id: p.id,
      title: p.title,
      health: {
        level: health.level,
        oneLiner: health.oneLiner,
        score: health.score,
      },
      trend: health.trend,
      completionPercentage: p.completionPercentage,
      pendingTaskCount,
      completedTaskCount,
      blockedTaskCount,
      daysRemaining,
      isPinned: pinnedSet.has(p.id),
    };
  });

  return { projects: projectsHealthCards };
}

export async function getTeacherDashboardReviewsData(): Promise<{
  upcomingReviews: ReviewCardData[];
}> {
  const user = await requireRole("TEACHER");

  const projects = await prisma.project.findMany({
    where: { teacherId: user.id },
    include: {
      reviews: true,
      tasks: true,
      milestones: true,
      files: true,
      pendingAssignments: true,
      members: { include: { student: { select: { name: true, email: true } } } },
    },
  });

  const upcomingReviews: ReviewCardData[] = [];

  for (const p of projects) {
    const upcoming = p.reviews.filter(
      (r) => r.status !== "COMPLETED" && r.scheduledAt >= new Date(),
    );
    if (upcoming.length === 0) continue;

    const rawProject: RawProjectData = {
      id: p.id,
      title: p.title,
      domain: p.domain,
      status: p.status,
      completionPercentage: p.completionPercentage,
      startDate: p.startDate,
      endDate: p.endDate,
      teacherId: p.teacherId,
      tasks: p.tasks.map((t): RawTaskData => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignedToId: t.assignedToId,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      milestones: p.milestones.map((m): RawMilestoneData => ({
        id: m.id,
        title: m.title,
        dueDate: m.dueDate,
        isCompleted: m.isCompleted,
        completedAt: m.completedAt,
      })),
      reviews: p.reviews.map((r): RawReviewData => ({
        id: r.id,
        reviewType: r.reviewType,
        scheduledAt: r.scheduledAt,
        conductedAt: r.conductedAt,
        status: r.status,
        reviewerId: r.reviewerId,
      })),
      files: p.files.map((f): RawFileData => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        uploadedAt: f.uploadedAt,
      })),
      members: p.members.map((m): RawMemberData => ({
        id: m.id,
        studentId: m.studentId,
        role: m.role,
        student: m.student
          ? { name: m.student.name, email: m.student.email }
          : null,
      })),
      pendingAssignments: p.pendingAssignments.map(
        (pa): RawPendingAssignmentData => ({
          id: pa.id,
          email: pa.email,
          deliveryStatus: pa.deliveryStatus,
          bounceReason: pa.bounceReason,
        }),
      ),
    };

    const readiness = computeReviewReadiness(rawProject);

    for (const review of upcoming) {
      const now = new Date();
      const daysUntil = Math.max(
        0,
        Math.ceil(
          (review.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      upcomingReviews.push({
        id: review.id,
        projectId: p.id,
        projectTitle: p.title,
        reviewType: review.reviewType,
        scheduledAt: review.scheduledAt,
        daysUntil,
        studentCount: p.members.length,
        readiness,
      });
    }
  }

  upcomingReviews.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return { upcomingReviews };
}
