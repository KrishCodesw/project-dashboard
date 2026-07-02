import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
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

  // Send email to the teacher
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { email: true, name: true },
  });

  if (teacher?.email) {
    await sendEmail({
      to: teacher.email,
      subject: `Invitation delivery failed — ${project.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
          <h2 style="color: #dc2626; margin-bottom: 12px;">Invitation delivery failed</h2>
          <p style="margin: 0 0 12px;">Hi ${teacher.name},</p>
          <p style="margin: 0 0 12px;">
            The invitation sent to <strong>${validated.recipient}</strong> for project
            <strong>${project.title}</strong> could not be delivered.
          </p>
          <p style="margin: 0 0 12px;">
            Reason: ${validated.summary}
          </p>
          <p style="margin: 0 0 12px;">
            This usually means the email address you entered does not exist or is incorrect.
            Please edit the email address to fix it.
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 13px;">
            You can view and edit the invitation in your dashboard.
          </p>
        </div>
      `,
    }).catch((err) => {
      console.error("[NotificationService] Failed to send bounce email to teacher:", err?.message ?? err);
    });
  }
}
