"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ChangeGroup } from "./ChangeGroup";
import { ViewToggle } from "./ViewToggle";
import { EmptySectionState } from "./EmptySectionState";
import type { ProjectChangeGroup, ActivityEvent } from "@/lib/delivery/types";

interface RecentChangesSectionProps {
  grouped: ProjectChangeGroup[];
  chronological: ActivityEvent[];
}

export function RecentChangesSection({
  grouped,
  chronological,
}: RecentChangesSectionProps) {
  const [view, setView] = useState<"grouped" | "chronological">("grouped");

  const hasAnyChanges = grouped.length > 0;

  if (!hasAnyChanges) {
    return (
      <section>
        <SectionTitle>
          <ViewToggle view={view} onChange={setView} />
        </SectionTitle>
        <EmptySectionState
          icon={Activity}
          title="No recent changes"
          description="No activity since your last visit."
          action={{ label: "View all projects", href: "/teacher/projects" }}
        />
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>
        <ViewToggle view={view} onChange={setView} />
      </SectionTitle>

      {view === "grouped" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {grouped.map((group, i) => (
            <ChangeGroup
              key={group.projectId}
              projectId={group.projectId}
              projectTitle={group.projectTitle}
              health={group.health}
              trend={group.trend}
              sinceLastVisit={group.sinceLastVisit}
              index={i}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border bg-card p-4">
          {chronological.slice(0, 50).map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-2 py-1.5 text-sm"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
              <span className="text-[11px] text-muted-foreground shrink-0 w-14">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                })}
              </span>
              <span className="text-sm text-foreground truncate">
                {event.message}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                in{" "}
                <Link
                  href={`/teacher/projects/${event.projectId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {event.projectTitle}
                </Link>
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Recent Changes
        </h2>
      </div>
      {children}
    </div>
  );
}
