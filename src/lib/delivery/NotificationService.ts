import { prisma } from "@/lib/prisma";
import { sendEmail, wrapEmailBody } from "@/lib/email";
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
      html: wrapEmailBody(`
        <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Invitation Delivery Failed</h2>
        <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${teacher.name}</strong>,</p>
        <p style="color:#434651;font-size:14px;margin:12px 0;">
          The invitation sent to <strong>${validated.recipient}</strong> for project
          <strong>${project.title}</strong> could not be delivered.
        </p>
        <div style="background:#ffdad6;border-left:4px solid #ba1a1a;padding:12px 16px;margin:16px 0;">
          <p style="margin:0;color:#93000a;font-weight:bold;font-size:12px;">BOUNCE REASON</p>
          <p style="margin:4px 0 0;color:#434651;">${validated.summary}</p>
        </div>
        <p style="color:#434651;font-size:14px;margin:12px 0;">This usually means the email address you entered does not exist or is incorrect. Please edit the email address to fix it.</p>
        <p style="color:#747782;font-size:12px;margin:0;">You can view and edit the invitation in your Members tab.</p>
      `),
    }).catch((err) => {
      console.error("[NotificationService] Failed to send bounce email to teacher:", err?.message ?? err);
    });
  }
}
