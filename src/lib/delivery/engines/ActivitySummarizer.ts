import type { ChangeStats, RawProjectData, ScaleTier } from "@/lib/delivery/types";
import { SCALE } from "@/lib/delivery/WorkspacePolicy";

export function summarizeActivity(
  projects: RawProjectData[],
  since: Date,
): ChangeStats {
  let tasksCompleted = 0;
  let filesUploaded = 0;
  let milestonesCompleted = 0;

  for (const project of projects) {
    tasksCompleted += project.tasks.filter(
      (t) => t.status === "DONE" && t.completedAt !== null && t.completedAt >= since,
    ).length;

    filesUploaded += project.files.filter(
      (f) => f.uploadedAt >= since,
    ).length;

    milestonesCompleted += project.milestones.filter(
      (m) => m.isCompleted && m.completedAt !== null && m.completedAt >= since,
    ).length;
  }

  return { tasksCompleted, filesUploaded, commentsAdded: 0, milestonesCompleted };
}

export function computeScaleTier(projectCount: number): ScaleTier {
  if (projectCount <= SCALE.SMALL_MAX) return "SMALL";
  if (projectCount <= SCALE.MEDIUM_MAX) return "MEDIUM";
  return "LARGE";
}
