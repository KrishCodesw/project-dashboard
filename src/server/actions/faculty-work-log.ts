"use server";

import { prisma } from "@/lib/prisma";
import { requireCoeUser } from "@/lib/coe-guard";
import { revalidatePath } from "next/cache";

/** Submit (or overwrite) today's work log — one per faculty per day via upsert. */
export async function submitWorkLog(formData: FormData) {
  const user = await requireCoeUser();
  if (user.role !== "TEACHER") throw new Error("Only faculty can submit work logs.");

  const summary = (formData.get("summary") as string | null)?.trim() ?? "";
  if (!summary) throw new Error("Summary cannot be empty.");
  if (summary.length > 5000) throw new Error("Summary too long — max 5 000 characters.");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.facultyWorkLog.upsert({
    where: { facultyId_date: { facultyId: user.id, date: today } },
    update: { summary, updatedAt: new Date() },
    create: {
      facultyId: user.id,
      date: today,
      summary,
      department: user.department ?? undefined,
    },
  });

  revalidatePath("/teacher");
  return { success: true };
}

/** Returns true when the logged-in faculty member has already submitted today. */
export async function hasSubmittedTodayLog(): Promise<boolean> {
  const user = await requireCoeUser();
  if (user.role !== "TEACHER") return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.facultyWorkLog.count({
    where: { facultyId: user.id, date: today },
  });
  return count > 0;
}
