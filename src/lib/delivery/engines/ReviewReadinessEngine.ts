import type { RawProjectData, ReviewReadiness } from "@/lib/delivery/types";
import { REVIEW_READINESS } from "@/lib/delivery/WorkspacePolicy";

export function computeReviewReadiness(
  project: RawProjectData,
): ReviewReadiness {
  const warnings: string[] = [];

  // ── 1. Milestone completion (40%) ────────────────────────────────────────
  const totalMilestones = project.milestones.length;
  const milestonesCompleted = project.milestones.filter(
    (m) => m.isCompleted,
  ).length;

  let milestoneScore = 0;
  if (totalMilestones > 0) {
    milestoneScore =
      (milestonesCompleted / totalMilestones) * REVIEW_READINESS.MILESTONE_WEIGHT;
  } else {
    warnings.push("No milestones defined");
  }

  // ── 2. Documentation submitted (25%) ─────────────────────────────────────
  const hasDocFiles = project.files.some((f) => {
    if (!f.fileType) return false;
    const ft = f.fileType.toLowerCase();
    return ft.includes("pdf") || ft.includes("doc");
  });

  const documentationScore = hasDocFiles
    ? REVIEW_READINESS.DOCUMENTATION_WEIGHT
    : 0;

  if (!hasDocFiles) {
    warnings.push("No documentation (PDF/DOC) files");
  }

  // ── 3. Files uploaded (20%) ──────────────────────────────────────────────
  const filesSubmitted = project.files.length > 0;
  const filesScore = filesSubmitted ? REVIEW_READINESS.FILES_WEIGHT : 0;

  if (!filesSubmitted) {
    warnings.push("No files uploaded");
  }

  // ── 4. Tasks completion (15%) ────────────────────────────────────────────
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter(
    (t) => t.status === "DONE",
  ).length;

  let taskScore = 0;
  if (totalTasks > 0) {
    taskScore =
      (completedTasks / totalTasks) * REVIEW_READINESS.TASKS_WEIGHT;
  } else {
    warnings.push("No tasks defined");
  }

  // ── Score ────────────────────────────────────────────────────────────────
  const score = Math.round(milestoneScore + documentationScore + filesScore + taskScore);

  // ── Common warnings ──────────────────────────────────────────────────────
  if (score < REVIEW_READINESS.WARNING_THRESHOLD) {
    warnings.push("Testing report missing");
  }

  return {
    score,
    milestonesCompleted,
    totalMilestones,
    filesSubmitted,
    documentationSubmitted: hasDocFiles,
    warnings,
  };
}
