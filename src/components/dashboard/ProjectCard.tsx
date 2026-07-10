"use client";

import React, { useMemo, memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface ProjectCardProps {
  project: {
    id: string;
    title: string;
    domain: string;
    status: string;
    completionPercentage: number;
    endDate: Date | string;
    groupNo?: string | null;
    isRblProject?: boolean;
    members?: Array<{
      student?: { name: string; avatarUrl?: string | null };
      name?: string;
    }>;
    tags?: Array<{
      tag?: { name: string; color: string };
      name?: string;
      color?: string;
    }>;
  };
  href: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  UNDER_REVIEW: "warning",
  COMPLETED: "default",
  ARCHIVED: "outline",
};

export const ProjectCard = memo(function ProjectCard({
  project,
  href,
}: ProjectCardProps) {
  const {
    title,
    domain,
    status = "DRAFT",
    completionPercentage = 0,
    endDate,
    groupNo,
    isRblProject,
    members: projectMembers,
    tags: projectTags,
  } = project;

  // Memoize members array to avoid recreating on each render
  const members = useMemo(() => {
    const raw = projectMembers ?? [];
    return raw.map((m: any) => ({
      name: m.student?.name ?? m.name ?? "?",
    }));
  }, [projectMembers]);

  // Memoize tags array since can vary in size and content
  const tags = useMemo(() => {
    const raw = projectTags ?? [];
    return raw.map((t: any) => ({
      name: t.tag?.name ?? t.name ?? "",
      color: t.tag?.color ?? t.color ?? "#6366f1",
    }));
  }, [projectTags]);

  // Memoize completion circle math (saves on re-renders with same percentage)
  const { circumference, strokeDashoffset } = useMemo(() => {
    const c = 2 * Math.PI * 36;
    return {
      circumference: c,
      strokeDashoffset: c - (completionPercentage / 100) * c,
    };
  }, [completionPercentage]);

  return (
    <Link href={href}>
      <motion.div
        className="group cursor-pointer rounded-[2px] border border-border bg-card p-5 shadow-none transition-all duration-200 ease-[0.23,1,0.32,1] hover:scale-[0.99] hover:border-primary active:scale-[0.97]"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge
                variant={statusColors[status] as any}
                className="rounded-[2px] font-mono text-[9px] uppercase tracking-wider"
              >
                {status.replace("_", " ")}
              </Badge>
              {isRblProject && (
                <Badge
                  variant="secondary"
                  className="rounded-[2px] font-mono text-[9px] uppercase tracking-wider border border-border bg-muted text-foreground"
                >
                  RBL Project
                </Badge>
              )}
              {groupNo && (
                <Badge
                  variant="outline"
                  className="rounded-[2px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                >
                  {groupNo}
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-sans font-medium tracking-tight truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1 truncate">
              {domain}
            </p>
          </div>

          {/* Completion Ring */}
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="4"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinecap="square"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[11px] font-mono tracking-wider font-bold text-foreground">
                {Math.round(completionPercentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.name}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}15`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(endDate), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((m, i) => (
                <Avatar key={i} className="h-6 w-6 rounded-[2px] border border-card">
                  <AvatarFallback className="text-[9px] font-mono tracking-wider bg-muted text-foreground rounded-[2px]">
                    {m.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-muted text-[9px] font-mono tracking-wider border border-card text-foreground">
                  +{members.length - 3}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
});
