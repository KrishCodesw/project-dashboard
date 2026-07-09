"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { revalidatePath } from "next/cache";

/**
 * Toggle the pinned state of a project for the current teacher.
 * Uses Project.isPinned directly (teacher-owned projects).
 */
export async function togglePinProject(projectId: string) {
  const user = await requireRole("TEACHER");

  const project = await prisma.project.findFirst({
    where: { id: projectId, teacherId: user.id },
    select: { id: true, isPinned: true },
  });

  if (!project) {
    throw new Error("Project not found or access denied");
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { isPinned: !project.isPinned },
  });

  revalidatePath("/teacher");
  revalidatePath(`/teacher/projects/${projectId}`);

  return { ok: true, isPinned: !project.isPinned };
}

export async function dismissAction(_actionId: string) {
  // Session-only dismiss in Phase 1 — no server persistence needed
  // The frontend manages dismiss state locally via useState
  // Phase 2 will persist dismissed action IDs on the User model
  return { ok: true };
}

export async function recordLastVisited() {
  const user = await requireRole("TEACHER");
  await prisma.user.update({
    where: { id: user.id },
    data: { lastVisitedAt: new Date() },
  });
  return { ok: true };
}
