"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { 
  StudentSubmissionSchema, 
  GuideReviewSchema 
} from "@/lib/validations/weekly-task";
import { WeeklyTaskStatus } from "@prisma/client";
import { z } from "zod";

/**
 * Student submits work log and evidence links for a weekly task submission.
 * Sets status to UNDER_REVIEW and timestamps submittedAt.
 */
export async function submitWeeklyTaskWorkLog(
  data: z.infer<typeof StudentSubmissionSchema>
) {
  // Only students can submit their own weekly task work log
  const user = await requireRole("STUDENT");

  const validated = StudentSubmissionSchema.parse(data);

  // Verify the submission belongs to a project where the user is a member
  const submission = await prisma.weeklyTaskSubmission.findUnique({
    where: { id: validated.submissionId },
    include: {
      milestone: true,
      project: {
        include: {
          members: {
            include: {
              student: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Ensure the user is a member of the project
  const isMember = submission.project.members.some(
    (m) => m.studentId === user.id
  );
  if (!isMember) {
    throw new Error("Unauthorized: not a member of this project");
  }

  // Update work log, submittedAt, and status to UNDER_REVIEW
  // Replace evidence links
  await prisma.$transaction([
    // Delete existing evidence links
    prisma.weeklyEvidenceLink.deleteMany({
      where: { submissionId: validated.submissionId },
    }),
    // Update submission
    prisma.weeklyTaskSubmission.update({
      where: { id: validated.submissionId },
      data: {
        workLog: validated.workLog,
        submittedAt: new Date(),
        status: WeeklyTaskStatus.UNDER_REVIEW,
        // evidenceLinks will be handled below
      },
    }),
    // Create new evidence links if any
    ...(validated.evidenceLinks ?? []).map((link) =>
      prisma.weeklyEvidenceLink.create({
        data: {
          title: link.title,
          url: link.url,
          type: link.type,
          submissionId: validated.submissionId,
        },
      })
    ),
  ]);

  return { success: true };
}

/**
 * Guide reviews a weekly task submission.
 * Sets status to APPROVED or REVISION_REQUESTED, leaves feedback, timestamps reviewedAt.
 */
export async function reviewWeeklyTaskSubmission(
  data: z.infer<typeof GuideReviewSchema>
) {
  // Only teachers (guides) can review
  const user = await requireRole("TEACHER");

  const validated = GuideReviewSchema.parse(data);

  // Verify submission exists and user is guide/teacher of the project
  const submission = await prisma.weeklyTaskSubmission.findUnique({
    where: { id: validated.submissionId },
    include: {
      project: {
        include: {
          teacher: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Ensure the user is the teacher of the project
  if (submission.project.teacherId !== user.id) {
    throw new Error("Unauthorized: not the teacher of this project");
  }

  // Update submission with status, feedback, reviewedAt
  await prisma.weeklyTaskSubmission.update({
    where: { id: validated.submissionId },
    data: {
      status: validated.status === "APPROVED" 
        ? WeeklyTaskStatus.APPROVED 
        : WeeklyTaskStatus.REVISION_REQUESTED,
      feedback: validated.feedback ?? null,
      reviewedAt: new Date(),
    },
  });

  return { success: true };
}