"use client";

import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { ProjectHealthCard } from "./ProjectHealthCard";
import { EmptySectionState } from "./EmptySectionState";
import { Button } from "@/components/ui/button";
import type { ProjectHealthCardData, ScaleTier } from "@/lib/delivery/types";
import { SCALE } from "@/lib/delivery/WorkspacePolicy";

interface MyProjectsSectionProps {
  projects: ProjectHealthCardData[];
  scaleTier: ScaleTier;
  onTogglePin?: (projectId: string) => void;
}

export function MyProjectsSection({
  projects,
  scaleTier,
  onTogglePin,
}: MyProjectsSectionProps) {
  // Empty state
  if (projects.length === 0) {
    return (
      <section>
        <SectionTitle count={0} />
        <EmptySectionState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to get started."
          action={{ label: "Create Project", href: "/teacher/projects/new" }}
        />
      </section>
    );
  }

  // Scale logic
  let visibleProjects: ProjectHealthCardData[];
  const totalCount = projects.length;
  let viewAllLink: string | null = null;

  // Sort: pinned first, then by health score (ascending = worst first)
  const sorted = [...projects].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.health.score - b.health.score;
  });

  if (scaleTier === "SMALL" || projects.length <= SCALE.SMALL_MAX) {
    visibleProjects = sorted;
  } else if (scaleTier === "MEDIUM" || projects.length <= SCALE.MEDIUM_MAX) {
    // Pinned first, then attention-needed projects
    const pinned = sorted.filter((p) => p.isPinned);
    const attention = sorted.filter(
      (p) => !p.isPinned && p.health.level !== "EXCELLENT"
    );
    const rest = sorted.filter(
      (p) => !p.isPinned && p.health.level === "EXCELLENT"
    );
    visibleProjects = [...pinned, ...attention, ...rest].slice(
      0,
      SCALE.MEDIUM_ATTENTION_MAX
    );
    viewAllLink = "/teacher/projects";
  } else {
    // LARGE: pinned + critical only, max 9
    const pinned = sorted.filter((p) => p.isPinned);
    const critical = sorted.filter(
      (p) =>
        !p.isPinned &&
        (p.health.level === "CRITICAL" || p.health.level === "WARNING")
    );
    visibleProjects = [...pinned, ...critical].slice(
      0,
      SCALE.LARGE_PROJECTS_SHOWN
    );
    viewAllLink = "/teacher/projects";
  }

  return (
    <section>
      <SectionTitle count={totalCount} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProjects.map((project, i) => (
          <ProjectHealthCard
            key={project.id}
            id={project.id}
            title={project.title}
            health={project.health}
            trend={project.trend}
            completionPercentage={project.completionPercentage}
            pendingTaskCount={project.pendingTaskCount}
            completedTaskCount={project.completedTaskCount}
            blockedTaskCount={project.blockedTaskCount}
            daysRemaining={project.daysRemaining}
            isPinned={project.isPinned}
            onTogglePin={onTogglePin}
            index={i}
          />
        ))}
      </div>

      {viewAllLink && totalCount > visibleProjects.length && (
        <div className="mt-4 text-center">
          <Link href={viewAllLink}>
            <Button variant="outline" size="sm">
              View all {totalCount} projects
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <FolderKanban className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        My Projects
      </h2>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </div>
  );
}
