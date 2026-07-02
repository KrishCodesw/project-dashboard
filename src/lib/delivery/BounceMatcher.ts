import { prisma } from "@/lib/prisma";
import type { PendingProjectAssignment } from "@prisma/client";
import type { ValidatedBounce } from "./BounceValidator";

export type AssignmentWithProject = PendingProjectAssignment & {
  project: { teacherId: string; title: string };
};

export interface MatchResult {
  assignment: AssignmentWithProject | null;
  matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  matchMethod: "messageId" | "email_single" | "email_multiple" | "none";
  candidatesFound: number;
  validatedBounce: ValidatedBounce;
}

const assignmentInclude = {
  project: { select: { teacherId: true, title: true } },
} as const;

const pendingWhere = {
  status: "PENDING",
  deliveryStatus: null,
} as const;

export async function match(
  validated: ValidatedBounce,
): Promise<MatchResult> {
  if (validated.originalMessageId) {
    const emailQueue = await prisma.emailQueue.findFirst({
      where: { messageId: validated.originalMessageId },
    });

    if (emailQueue && emailQueue.to === validated.recipient) {
      const assignment =
        await prisma.pendingProjectAssignment.findFirst({
          where: {
            email: validated.recipient,
            ...pendingWhere,
          },
          orderBy: { createdAt: "desc" },
          include: assignmentInclude,
        });

      if (assignment) {
        return {
          assignment,
          matchConfidence: "HIGH",
          matchMethod: "messageId",
          candidatesFound: 1,
          validatedBounce: validated,
        };
      }
    }
  }

  const candidates = await prisma.pendingProjectAssignment.findMany({
    where: {
      email: validated.recipient,
      ...pendingWhere,
    },
    orderBy: { createdAt: "desc" },
    include: assignmentInclude,
  });

  if (candidates.length === 1) {
    return {
      assignment: candidates[0],
      matchConfidence: "MEDIUM",
      matchMethod: "email_single",
      candidatesFound: 1,
      validatedBounce: validated,
    };
  }

  if (candidates.length > 1) {
    return {
      assignment: null,
      matchConfidence: "LOW",
      matchMethod: "email_multiple",
      candidatesFound: candidates.length,
      validatedBounce: validated,
    };
  }

  return {
    assignment: null,
    matchConfidence: "NONE",
    matchMethod: "none",
    candidatesFound: 0,
    validatedBounce: validated,
  };
}
