"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FolderKanban, CheckCircle2, Clock, ClipboardCheck, Presentation } from "lucide-react";
import { useTeacherDashboardStats, useTeacherProjects } from "@/hooks/useProjects";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Button } from "@/components/ui/button";
import { ProjectCompletionChart } from "@/components/charts/ProjectCompletionChart";
import { TaskDistributionDonut } from "@/components/charts/TaskDistributionDonut";
import { Skeleton } from "@/components/ui/skeleton";

type TeacherDashboardClientProps = {
  userId: string;
  userName: string;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function TeacherDashboardClient({
  userId,
  userName,
}: TeacherDashboardClientProps) {
  const { data: stats, isLoading: statsLoading } = useTeacherDashboardStats(userId);
  const { data: projects, isLoading: projectsLoading } = useTeacherProjects(userId);

  const greeting = getGreeting();

  return (
    <div className="space-y-8">
      {/* Greeting & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold">
            {greeting}, {userName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/showcase">
            <Button className="w-full sm:w-auto flex items-center gap-2 shadow-sm">
              <Presentation className="h-4 w-4" />
              Go to Showcase
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <motion.div variants={item}>
              <StatCard
                title="Total Projects"
                value={stats?.totalProjects ?? 0}
                icon={FolderKanban}
                color="indigo"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Active Projects"
                value={stats?.activeProjects ?? 0}
                icon={Clock}
                color="violet"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Avg. Completion"
                value={stats?.averageCompletion ?? 0}
                suffix="%"
                icon={CheckCircle2}
                color="emerald"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Reviews Due"
                value={stats?.reviewsDue ?? 0}
                icon={ClipboardCheck}
                color="amber"
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border bg-card p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Project Completion</h3>
          {projectsLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <ProjectCompletionChart
              data={(projects ?? []).map((p: any) => ({
                name: p.title.length > 20 ? p.title.slice(0, 20) + "…" : p.title,
                completion: p.completionPercentage,
              }))}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border bg-card p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Task Distribution</h3>
          {projectsLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <TaskDistributionDonut
              data={aggregateTaskDistribution(projects ?? [])}
            />
          )}
        </motion.div>
      </div>

      {/* Projects grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Your Projects</h3>
        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {(projects ?? []).map((project: any) => (
              <motion.div key={project.id} variants={item}>
                <ProjectCard project={project} href={`/teacher/projects/${project.id}`} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function aggregateTaskDistribution(projects: any[]) {
  const counts: Record<string, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
    BLOCKED: 0,
  };

  for (const p of projects) {
    if (p.tasks) {
      for (const t of p.tasks) {
        counts[t.status] = (counts[t.status] || 0) + 1;
      }
    }
  }

  return {
    todo: counts.TODO,
    inProgress: counts.IN_PROGRESS,
    inReview: counts.IN_REVIEW,
    done: counts.DONE,
    blocked: counts.BLOCKED,
  };
}