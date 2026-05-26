"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/server/actions/users";
import {
  Users,
  GraduationCap,
  BookOpen,
  Shield,
  ArrowRight,
  Sparkles,
  Presentation,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function AdminOverviewPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getUsers(),
  });

  const stats = React.useMemo(() => {
    if (!users) return { total: 0, students: 0, teachers: 0, admins: 0 };
    return {
      total: users.length,
      students: users.filter((u: any) => u.role === "STUDENT").length,
      teachers: users.filter((u: any) => u.role === "TEACHER").length,
      admins: users.filter((u: any) => u.role === "ADMIN").length,
    };
  }, [users]);

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Admin Overview</h1>
          <p className="text-muted-foreground mt-1">
            System-wide statistics and management
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

      {/* Admin Module Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              New Module
            </p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              Showcase System
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review submissions, add feedback, and publish approved projects.
            </p>
          </div>
          <Link href="/admin/showcase">
            <Button>
              Open Showcase
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Bulk Assignment
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              CSV Project Assignment Upload
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign users to projects via CSV and queue all notification emails
              asynchronously.
            </p>
          </div>
          <Link href="/admin/project-assignments">
            <Button variant="outline">
              Open Upload
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Project Control
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              Manage Projects, Mentors, and Members
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit any project, assign or change mentor, and manage member roles
              from one place.
            </p>
          </div>
          <Link href="/admin/projects">
            <Button variant="outline">
              Open Projects
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* User Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <motion.div variants={item}>
              <StatCard
                title="Total Users"
                value={stats.total}
                icon={Users}
                color="indigo"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Students"
                value={stats.students}
                icon={GraduationCap}
                color="violet"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Teachers"
                value={stats.teachers}
                icon={BookOpen}
                color="emerald"
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Admins"
                value={stats.admins}
                icon={Shield}
                color="amber"
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Recent users */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border bg-card"
      >
        <div className="p-6 border-b">
          <h3 className="font-semibold">Recent Users</h3>
        </div>
        <div className="divide-y">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-6 w-48" />
                </div>
              ))
            : (users ?? []).slice(0, 10).map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 text-sm"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "bg-amber-500/20 text-amber-400"
                          : user.role === "TEACHER"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-indigo-500/20 text-indigo-400"
                      }`}
                    >
                      {user.role}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        user.isActive ? "bg-emerald-400" : "bg-zinc-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
        </div>
      </motion.div>
    </div>
  );
}

