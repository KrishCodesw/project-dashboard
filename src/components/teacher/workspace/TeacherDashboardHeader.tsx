"use client";

import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { EASE_OUT, DURATION } from "./animations";

interface TeacherDashboardHeaderProps {
  greeting: string;
  userName: string;
  date: string;
  sinceLastVisit: string;
  urgentItemCount: number;
  activeProjectCount: number;
  totalStudentCount: number;
}

export function TeacherDashboardHeader({
  greeting,
  userName,
  date,
  sinceLastVisit,
  urgentItemCount,
  activeProjectCount,
  totalStudentCount,
}: TeacherDashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE_OUT }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {userName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {date} &middot; {sinceLastVisit}
          {urgentItemCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-500">
              <CalendarClock className="h-3 w-3" />
              {urgentItemCount} item{urgentItemCount > 1 ? "s" : ""} need you
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{activeProjectCount} active projects</span>
        <span>&middot;</span>
        <span>{totalStudentCount} students</span>
      </div>
    </motion.div>
  );
}
