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
  let createdSubmissions = [];
  if (projectsToCreate.length > 0) {
    createdSubmissions = await prisma.weeklyTaskSubmission.createManyAndReturn({
      data: projectsToCreate,
    });
  }

  return {
    milestone,
    createdSubmissionsCount: createdSubmissions.length,
    totalProjects: projects.length,
    skippedProjects: existingSubmissions.length,
  };
}