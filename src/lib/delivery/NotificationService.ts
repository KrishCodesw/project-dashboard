import { prisma } from "@/lib/prisma";
import type { MatchResult } from "./BounceMatcher";

export async function notifyBounce(match: MatchResult): Promise<void> {
  const assignment = match.assignment!;
  const validated = match.validatedBounce;
  const project = (assignment as any).project;
  const teacherId = project.teacherId;
  const projectId = assignment.projectId;

  // Check if a bounce notification already exists for this assignment record
  const existing = await prisma.notification.findFirst({
    where: {
      userId: teacherId,
      type: "PROJECT_UPDATED",
      link: `/teacher/projects/${projectId}`,
      createdAt: { gte: assignment.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return; // Deduplicate — at most 1 per assignment record lifetime

  await prisma.notification.create({
    data: {
      userId: teacherId,
      type: "PROJECT_UPDATED",
      title: "Invitation delivery failed",
      message: `The invitation sent to ${validated.recipient} bounced: ${validated.summary}`,
      link: `/teacher/projects/${projectId}`,
    },
  });
}
