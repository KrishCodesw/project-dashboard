"use server";

import { prisma } from "@/lib/prisma";
import { WeeklyTaskStatus } from "@prisma/client";
import { requireCoeUser } from "@/lib/coe-guard";
import { z } from "zod";

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
 * Utility to verify if a user has access to a project (as guide or member).
 */
export async function verifyGuideAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { teacherId: userId },
        {
          members: {
            some: {
              studentId: userId,
            },
          },
        },
      ],
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

/**
 * Updates the status of a weekly task submission.
 * Only users with access to the project (teacher or member) can change the status.
 */
export async function updateWeeklyTaskStatus(
  submissionId: string,
  status: WeeklyTaskStatus
) {
  const user = await requireCoeUser();

  // Verify submission exists and user has access to its project
  const submission = await prisma.weeklyTaskSubmission.findUnique({
    where: { id: submissionId },
    include: {
      project: {
        select: {
          id: true,
          teacherId: true,
          members: {
            select: { studentId: true },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const hasAccess =
    submission.project.teacherId === user.id ||
    submission.project.members.some((m) => m.studentId === user.id);

  if (!hasAccess) {
    throw new Error("Unauthorized");
  }

  // Update the status
  await prisma.weeklyTaskSubmission.update({
    where: { id: submissionId },
    data: { status },
  });

  return { success: true };
}