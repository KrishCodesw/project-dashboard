"use server";

import { prisma } from "@/lib/prisma";
import { WeeklyTaskStatus } from "@prisma/client";
import { requireCoeUser } from "@/lib/coe-guard";

/**
 * Calculates project completion metrics across all assigned weekly milestones.
 */
export async function getProjectWeeklyMetrics(projectId: string) {
  const user = await requireCoeUser();
  if (!await verifyGuideAccess(user.id, projectId)) {
    throw new Error("Unauthorized");
  }
  const submissions = await prisma.weeklyTaskSubmission.findMany({
    where: { projectId },
    select: { status: true },
  });

  const total = submissions.length;
  const approved = submissions.filter((s) => s.status === WeeklyTaskStatus.APPROVED).length;
  const underReview = submissions.filter((s) => s.status === WeeklyTaskStatus.UNDER_REVIEW).length;
  const pending = submissions.filter((s) => s.status === WeeklyTaskStatus.PENDING).length;

  return {
    totalWeeks: total,
    approvedWeeks: approved,
    underReviewWeeks: underReview,
    pendingWeeks: pending,
    completionPercentage: total > 0 ? Math.round((approved / total) * 100) : 0,
  };
}

/**
 * Utility to verify if a user has guide access for a given project.
 */
export async function verifyGuideAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      teacherId: userId,
    },
    select: { id: true },
  });
  return Boolean(project);
}

/**
 * Fetches weekly task submissions for a project with milestone, evidence links, and sync meetings.
 */
export async function getProjectWeeklySubmissions(projectId: string) {
  const user = await requireCoeUser();
  if (!await verifyGuideAccess(user.id, projectId)) {
    throw new Error("Unauthorized");
  }
  return await prisma.weeklyTaskSubmission.findMany({
    where: { projectId },
    include: {
      milestone: {
        select: {
          weekNumber: true,
          title: true,
          description: true,
          startDate: true,
          dueDate: true,
          checklists: {
            select: {
              text: true,
            },
          },
        },
      },
      evidenceLinks: true,
      syncMeetings: true,
    },
    orderBy: {
      milestone: {
        weekNumber: "asc",
      },
    },
  });
}