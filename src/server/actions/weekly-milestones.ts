"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { CreateMilestoneSchema } from "@/lib/validations/weekly-task";
import { WeeklyTaskStatus } from "@prisma/client";
import { z } from "zod";

export async function assignWeeklyMilestoneToAllProjects(
  data: z.infer<typeof CreateMilestoneSchema>
) {
  // Only allow ADMIN to assign weekly milestones to all projects
  const user = await requireRole("ADMIN");

  // Validate input
  const validatedData = CreateMilestoneSchema.parse(data);

  // Upsert the weekly milestone (unique by weekNumber)
  const milestone = await prisma.weeklyMilestone.upsert({
    where: { weekNumber: validatedData.weekNumber },
    update: {
      title: validatedData.title,
      description: validatedData.description,
      startDate: validatedData.startDate,
      dueDate: validatedData.dueDate,
      isBackdated: validatedData.isBackdated ?? false,
      // Note: checklists are handled separately via the relation
    },
    create: {
      weekNumber: validatedData.weekNumber,
      title: validatedData.title,
      description: validatedData.description,
      startDate: validatedData.startDate,
      dueDate: validatedData.dueDate,
      isBackdated: validatedData.isBackdated ?? false,
    },
  });

  // Clear existing checklist items for this milestone (if updating) and create new ones
  // We'll delete all existing checklist items and recreate from the provided array
  await prisma.milestoneChecklistItem.deleteMany({
    where: { weeklyMilestoneId: milestone.id },
  });

  const checklistItems = validatedData.checklists.map((text) => ({
    text,
    weeklyMilestoneId: milestone.id,
  }));

  await prisma.milestoneChecklistItem.createMany({
    data: checklistItems,
  });

  // Fetch all projects
  const projects = await prisma.project.findMany({
    select: { id: true },
  });

  // Find existing submissions for this milestone to avoid duplicates
  const existingSubmissions = await prisma.weeklyTaskSubmission.findMany({
    where: { milestoneId: milestone.id },
    select: { projectId: true },
  });
  const existingProjectIds = new Set(
    existingSubmissions.map((sub) => sub.projectId)
  );

  // Determine which projects need a submission created
  const projectsToCreate = projects
    .filter((p) => !existingProjectIds.has(p.id))
    .map((p) => ({
      projectId: p.id,
      milestoneId: milestone.id,
      status: WeeklyTaskStatus.PENDING,
      workLog: null,
      feedback: null,
      submittedAt: null,
      reviewedAt: null,
    }));

  // Create submissions in bulk
  let createdSubmissionsCount = 0;
  if (projectsToCreate.length > 0) {
    const result = await prisma.weeklyTaskSubmission.createMany({
      data: projectsToCreate,
    });
    createdSubmissionsCount = result.count;
  }

  return {
    milestone,
    createdSubmissionsCount,
    totalProjects: projects.length,
    skippedProjects: existingSubmissions.length,
  };
}

/**
 * Fetch all weekly milestones with their checklist items.
 * Admin-only.
 */
export async function getAllWeeklyMilestones() {
  const user = await requireRole("ADMIN");
  return await prisma.weeklyMilestone.findMany({
    include: {
      checklists: {
        select: {
          text: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      weekNumber: "asc",
    },
  });
}

/**
 * Update an existing weekly milestone.
 * Admin-only.
 */
export async function updateWeeklyMilestone(
  data: z.infer<typeof UpdateMilestoneSchema>
) {
  const user = await requireRole("ADMIN");
  const validated = UpdateMilestoneSchema.parse(data);

  // Upsert the milestone (update)
  const milestone = await prisma.weeklyMilestone.update({
    where: { id: validated.id },
    data: {
      weekNumber: validated.weekNumber,
      title: validated.title,
      description: validated.description ?? undefined,
      startDate: validated.startDate,
      dueDate: validated.dueDate,
      isBackdated: validated.isBackdated ?? false,
    },
  });

  // Replace checklist items
  await prisma.milestoneChecklistItem.deleteMany({
    where: { weeklyMilestoneId: milestone.id },
  });

  const checklistItems = validated.checklists.map((text) => ({
    text,
    weeklyMilestoneId: milestone.id,
  }));

  await prisma.milestoneChecklistItem.createMany({
    data: checklistItems,
  });

  return milestone;
}

/**
 * Delete a weekly milestone and all related data (checklist, submissions, evidence, meetings).
 * Admin-only.
 */
export async function deleteWeeklyMilestone(id: string) {
  const user = await requireRole("ADMIN");
  await prisma.weeklyMilestone.delete({
    where: { id },
  });
}

/* ------------------------------------------------------------------ */
/* Zod schema for update (same as create but with id)                 */
/* ------------------------------------------------------------------ */
const UpdateMilestoneSchema = CreateMilestoneSchema.extend({
  id: z.string().cuid(),
});