"use server";

import { prisma } from "@/lib/prisma";
import { requireHOD } from "@/lib/coe-guard";
import { sendEmail, wrapEmailBody } from "@/lib/email";
import { revalidatePath } from "next/cache";

export type SendNoticeResult = {
  sent: number;
  failed: number;
  total: number;
  department: string;
};

/**
 * HOD sends an email notice to all active students in their own department.
 * Deduplicates recipients, skips blank / invalid emails, returns a summary.
 */
export async function sendNoticeToStudents(
  formData: FormData
): Promise<SendNoticeResult> {
  const hod = await requireHOD();
  const dept = hod.department;
  if (!dept) throw new Error("HOD has no department assigned.");

  const subject = (formData.get("subject") as string | null)?.trim() ?? "";
  const body    = (formData.get("body")    as string | null)?.trim() ?? "";

  if (!subject) throw new Error("Subject is required.");
  if (!body)    throw new Error("Notice body is required.");
  if (subject.length > 200)   throw new Error("Subject too long (max 200 chars).");
  if (body.length > 10_000)   throw new Error("Body too long (max 10 000 chars).");

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", department: dept, isActive: true },
    select: { id: true, name: true, email: true },
  });

  if (students.length === 0)
    throw new Error(`No active students found in "${dept}".`);

  // Deduplicate & validate
  const seen = new Set<string>();
  const unique = students.filter((s) => {
    const e = s.email.toLowerCase().trim();
    if (!e.includes("@") || seen.has(e)) return false;
    seen.add(e);
    return true;
  });

  let sent = 0, failed = 0;

  for (const student of unique) {
    try {
      await sendEmail({
        to: student.email,
        subject: `[${dept}] ${subject}`,
        html: wrapEmailBody(`
          <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">${subject}</h2>
          <div style="color:#434651;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:16px 0;">${body}</div>
          <hr style="border:none;border-top:1px solid #c4c6d3;margin:16px 0;"/>
          <p style="color:#747782;font-size:12px;margin:0;">
            Sent by HOD <strong>${hod.name}</strong> · ${dept} Department
          </p>`,
      });
      sent++;
    } catch { failed++; }
  }

  revalidatePath("/hod");
  return { sent, failed, total: unique.length, department: dept };
}
