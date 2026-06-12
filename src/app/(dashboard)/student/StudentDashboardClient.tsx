"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FolderKanban,
  ListChecks,
  Clock,
  TrendingUp,
  Presentation,
} from "lucide-react";
import {
  useStudentDashboardStats,
  useStudentProjects,
} from "@/hooks/useProjects";
import { useStudentTasks } from "@/hooks/useTasks";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type StudentDashboardClientProps = {
  userId: string;
  userName: string;
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function StudentDashboardClient({
  userId,
  userName,
}: StudentDashboardClientProps) {
  const { data: stats, isLoading: statsLoading } =
    useStudentDashboardStats(userId);
  const { data: projects, isLoading: projectsLoading } =
    useStudentProjects(userId);
  const { data: tasks } = useStudentTasks(userId);

  const greeting = getGreeting();

  const upcomingMilestones = (projects ?? []).flatMap((p: any) =>
    (p.milestones ?? []).filter((m: any) => !m.isCompleted),
  );

  return (
    <div className="space-y-8">
      {/* Greeting & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">
            {greeting}, {userName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your projects and tasks
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
                title="My Projects"
                value={stats?.totalProjects ?? 0}
                icon={FolderKanban}
                color="indigo"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Tasks Due Today"
                value={stats?.tasksDueToday ?? 0}
                icon={Clock}
                color="amber"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Completed Tasks"
                value={stats?.completedTasks ?? 0}
                icon={ListChecks}
                color="emerald"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Overall Progress"
                value={stats?.overallProgress ?? 0}
                suffix="%"
                icon={TrendingUp}
                color="violet"
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Projects */}
      <div>
        <h3 className="text-lg font-semibold mb-4">My Projects</h3>
        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (projects ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            You haven&apos;t been assigned to any projects yet.
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
                <ProjectCard
                  project={project}
                  href={`/student/projects/${project.id}`}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border bg-card p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Upcoming Milestones</h3>
          <MilestoneTimeline milestones={upcomingMilestones.slice(0, 5)} />
        </motion.div>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
