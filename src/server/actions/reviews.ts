"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { z } from "zod";
import { parseOrThrow } from "@/lib/zod-utils";
import { revalidatePath } from "next/cache";
import { createBulkNotifications } from "@/lib/notifications";
import { updateProjectCompletion } from "@/lib/completion";
import { sendReviewScheduledEmail, sendFeedbackEmail } from "@/lib/email";

const scheduleReviewSchema = z.object({
  projectId: z.string(),
  reviewType: z.string().min(1),
  scheduledAt: z.string(),
});

const conductReviewSchema = z.object({
  reviewId: z.string(),
  overallScore: z.number().min(0).max(10),
  feedback: z.string().min(1),
  criteria: z.array(
    z.object({
      criteriaName: z.string(),
      score: z.number().min(0).max(10),
      remarks: z.string().optional(),
    })
  ),
});

export async function scheduleReview(data: z.infer<typeof scheduleReviewSchema>) {
  const user = await requireRole("TEACHER");
  const userId = user.id;

  const validated = parseOrThrow(scheduleReviewSchema, data);
  const review = await prisma.review.create({
    data: {
      projectId: validated.projectId,
      reviewerId: userId,
      reviewType: validated.reviewType,
      scheduledAt: new Date(validated.scheduledAt),
    },
  });

  // Notify team members
  const members = await prisma.projectMember.findMany({
    where: { projectId: validated.projectId },
    include: { student: { select: { id: true, email: true } } },
  });

  const project = await prisma.project.findUnique({
    where: { id: validated.projectId },
    select: { title: true },
  });

  if (members.length > 0 && project) {
    await createBulkNotifications(
      members.map((m) => m.studentId),
      {
        type: "REVIEW_SCHEDULED",
        title: "Review Scheduled",
        message: `${validated.reviewType} review for ${project.title} has been scheduled`,
        link: `/student/projects/${validated.projectId}`,
      }
    );

    // Send emails
    for (const member of members) {
      await sendReviewScheduledEmail(
        member.student.email,
        project.title,
        new Date(validated.scheduledAt),
        validated.reviewType
      );
    }
  }

  revalidatePath(`/teacher/projects/${validated.projectId}/reviews`);
  return review;
}

export async function conductReview(data: z.infer<typeof conductReviewSchema>) {
  await requireRole("TEACHER");

  const validated = parseOrThrow(conductReviewSchema, data);

  const review = await prisma.review.update({
    where: { id: validated.reviewId },
    data: {
      status: "COMPLETED",
      conductedAt: new Date(),
      overallScore: validated.overallScore,
      feedback: validated.feedback,
      criteriaScores: {
        deleteMany: {},
        create: validated.criteria.map((c) => ({
          criteriaName: c.criteriaName,
          score: c.score,
          remarks: c.remarks,
        })),
      },
    },
    include: {
      project: {
        include: {
          members: {
            include: { student: { select: { id: true, email: true } } },
          },
        },
      },
    },
  });

  await updateProjectCompletion(review.projectId);

  // Notify and email students
  const members = review.project.members;
  if (members.length > 0) {
    await createBulkNotifications(
      members.map((m) => m.studentId),
      {
        type: "FEEDBACK_GIVEN",
        title: "Review Feedback",
        message: `Review feedback for ${review.project.title} has been submitted. Score: ${validated.overallScore}/10`,
        link: `/student/projects/${review.projectId}`,
      }
    );

    for (const member of members) {
      await sendFeedbackEmail(
        member.student.email,
        review.project.title,
        validated.overallScore,
        validated.feedback
      );
    }
  }

  revalidatePath(`/teacher/projects/${review.projectId}/reviews`);
  return review;
}

export async function updateReviewStatus(
  reviewId: string,
  status: "SCHEDULED" | "MISSED" | "RESCHEDULED",
  newDate?: string
) {
  await requireRole("TEACHER");

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: {
      status,
      ...(newDate && { scheduledAt: new Date(newDate) }),
    },
  });

  revalidatePath(`/teacher/projects/${review.projectId}/reviews`);
  return review;
}

export async function getProjectReviews(projectId: string) {
  return prisma.review.findMany({
    where: { projectId },
    include: {
      reviewer: { select: { id: true, name: true } },
      criteriaScores: true,
    },
    orderBy: { scheduledAt: "desc" },
  });
}
