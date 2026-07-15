"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getUsers, getAdminDashboardStats } from "@/server/actions/users";
import type { AdminDashboardStats } from "@/server/actions/users";
import {
  Users,
  GraduationCap,
  BookOpen,
  Shield,
  Presentation,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  FileText,
  Sparkles,
  MessageSquare,
  Award,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#a1a1aa",
  ACTIVE: "#10b981",
  UNDER_REVIEW: "#f59e0b",
  COMPLETED: "#6366f1",
  ARCHIVED: "#78716c",
};

const TASK_COLORS: Record<string, string> = {
  TODO: "#a1a1aa",
  IN_PROGRESS: "#3b82f6",
  IN_REVIEW: "#f59e0b",
  DONE: "#10b981",
  BLOCKED: "#ef4444",
};

export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: () => getAdminDashboardStats(),
  });

  const { data: recentUsersResult, isLoading: recentLoading } = useQuery({
    queryKey: ["admin", "recent-users"],
    queryFn: () => getUsers(undefined, { page: 1, pageSize: 10 }),
  });
  const recentUsers = recentUsersResult?.data ?? [];

  if (statsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const s = stats as AdminDashboardStats;

  const projectStatusData = s.projectsByStatus.map((p) => ({
    name: p.status.replace(/_/g, " "),
    value: p.count,
    color: STATUS_COLORS[p.status] ?? "#a1a1aa",
  }));

  const taskData = s.taskStatusDistribution.map((t) => ({
    name: t.status.replace(/_/g, " "),
    value: t.count,
    color: TASK_COLORS[t.status] ?? "#a1a1aa",
  }));

  const deptData = s.projectsByDepartment.map((d) => ({
    name: d.department.length > 20 ? d.department.slice(0, 20) + "…" : d.department,
    fullName: d.department,
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform-wide analytics and system health
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link href="/showcase">
            <Button className="w-full sm:w-auto flex items-center gap-2">
              <Presentation className="h-4 w-4" />
              Go to Showcase
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* KPI Row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <motion.div variants={item}>
          <StatCard title="Total Users" value={s.userCounts.total} icon={Users} color="indigo" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Students" value={s.userCounts.students} icon={GraduationCap} color="violet" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Teachers" value={s.userCounts.teachers} icon={BookOpen} color="emerald" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Admins" value={s.userCounts.admins} icon={Shield} color="amber" />
        </motion.div>
      </motion.div>

      {/* Platform KPI Row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <motion.div variants={item}>
          <StatCard title="Total Projects" value={s.projectsByStatus.reduce((a, b) => a + b.count, 0)} icon={Layers} color="blue" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Project Members" value={s.totalProjectMembers} icon={Users} color="cyan" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Reviews" value={s.reviewStats.total} icon={MessageSquare} color="orange" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Publications" value={s.publicationCount} icon={Award} color="rose" />
        </motion.div>
      </motion.div>

      {/* Overdue + Pending Row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <motion.div variants={item}>
          <StatCard title="Overdue Projects" value={s.projectsOverdue} icon={AlertTriangle} color="red" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Overdue Milestones" value={s.milestoneStats.overdue} icon={Clock} color="red" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Total Showcase" value={s.showcaseCount} icon={Sparkles} color="purple" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard title="Pending Review" value={s.pendingShowcaseCount} icon={FileText} color="yellow" />
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Projects by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No projects yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={projectStatusData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 13 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {projectStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taskData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={taskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {taskData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 13 }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones & Reviews Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Milestone Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-2xl font-bold">{s.milestoneStats.total}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-4">
                <p className="text-2xl font-bold text-emerald-500">{s.milestoneStats.completed}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-600/70 mt-1">Completed</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-4">
                <p className="text-2xl font-bold text-red-500">{s.milestoneStats.overdue}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-red-600/70 mt-1">Overdue</p>
              </div>
            </div>
            {s.milestoneStats.total > 0 && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((s.milestoneStats.completed / s.milestoneStats.total) * 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-2xl font-bold">{s.reviewStats.total}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-4">
                <p className="text-2xl font-bold text-blue-500">{s.reviewStats.scheduled}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-blue-600/70 mt-1">Scheduled</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-4">
                <p className="text-2xl font-bold text-emerald-500">{s.reviewStats.completed}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-600/70 mt-1">Completed</p>
              </div>
            </div>
            {s.reviewStats.total > 0 && (
              <div className="flex gap-1 h-2">
                <div
                  className="rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((s.reviewStats.completed / s.reviewStats.total) * 100)}%` }}
                />
                <div
                  className="rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round((s.reviewStats.scheduled / s.reviewStats.total) * 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects by Department */}
      {deptData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Projects by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, deptData.length * 36)}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 13 }}
                  formatter={(value: number, _name: string, props: any) => [value, props.payload.fullName]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#6366f1" : "#818cf8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent users */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border bg-card"
      >
        <div className="p-5 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Recent Users
          </h3>
        </div>
        <div className="divide-y">
          {recentLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-6 w-48" />
                </div>
              ))
            : recentUsers.map((user: any) => (
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

