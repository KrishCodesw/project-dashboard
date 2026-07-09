import type {
  RawProjectData,
  ProjectChangeGroup,
  ChangeStats,
  ActivityEvent,
} from "@/lib/delivery/types";

function computeStats(
  project: RawProjectData,
  since: Date,
): ChangeStats {
  const tasksCompleted = project.tasks.filter(
    (t) => t.status === "DONE" && t.completedAt !== null && t.completedAt >= since,
  ).length;

  const filesUploaded = project.files.filter(
    (f) => f.uploadedAt >= since,
  ).length;

  const milestonesCompleted = project.milestones.filter(
    (m) => m.isCompleted && m.completedAt !== null && m.completedAt >= since,
  ).length;

  return { tasksCompleted, filesUploaded, commentsAdded: 0, milestonesCompleted };
}

function collectEvents(
  project: RawProjectData,
  since: Date,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const t of project.tasks) {
    if (t.status === "DONE" && t.completedAt !== null && t.completedAt >= since) {
      events.push({
        id: `${project.id}-task-${t.id}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "task_completed",
        message: `Task '${t.title}' completed`,
        timestamp: t.completedAt,
      });
    }
  }

  for (const f of project.files) {
    if (f.uploadedAt >= since) {
      events.push({
        id: `${project.id}-file-${f.id}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "file_uploaded",
        message: `File '${f.fileName}' uploaded`,
        timestamp: f.uploadedAt,
      });
    }
  }

  for (const m of project.milestones) {
    if (m.isCompleted && m.completedAt !== null && m.completedAt >= since) {
      events.push({
        id: `${project.id}-milestone-${m.id}`,
        projectId: project.id,
        projectTitle: project.title,
        type: "milestone_completed",
        message: `Milestone '${m.title}' completed`,
        timestamp: m.completedAt,
      });
    }
  }

  return events;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function aggregateChanges(
  projects: RawProjectData[],
  since: Date,
): { grouped: ProjectChangeGroup[]; chronological: ActivityEvent[] } {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const grouped: ProjectChangeGroup[] = [];
  const allEvents: ActivityEvent[] = [];

  for (const project of projects) {
    grouped.push({
      projectId: project.id,
      projectTitle: project.title,
      health: "HEALTHY",
      trend: "STABLE",
      sinceLastVisit: computeStats(project, since),
      since7d: computeStats(project, sevenDaysAgo),
    });

    allEvents.push(...collectEvents(project, since));
  }

  allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return { grouped, chronological: allEvents.slice(0, 50) };
}
