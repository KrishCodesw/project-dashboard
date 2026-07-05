"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Ban, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StudentAttentionReason } from "@/lib/delivery/types";

interface StudentRowProps {
  studentId: string;
  studentName: string;
  email: string;
  projectId: string;
  projectTitle: string;
  reason: StudentAttentionReason;
  detail: string;
  actionLinks: Array<{ label: string; href: string }>;
  index?: number;
}

const reasonConfig: Record<
  StudentAttentionReason,
  { label: string; icon: typeof AlertTriangle; variant: "warning" | "destructive" | "secondary" }
> = {
  INACTIVE_8D: {
    label: "Inactive 8d+",
    icon: AlertTriangle,
    variant: "warning",
  },
  OVERDUE_TASKS: {
    label: "Overdue tasks",
    icon: AlertTriangle,
    variant: "destructive",
  },
  BOUNCED_INVITE: {
    label: "Bounced invite",
    icon: Ban,
    variant: "destructive",
  },
};

export function StudentRow({
  studentId,
  studentName,
  email,
  projectId,
  projectTitle,
  reason,
  detail,
  actionLinks,
  index = 0,
}: StudentRowProps) {
  const config = reasonConfig[reason];
  const initials = studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-[10px] font-medium bg-muted text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Student info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{studentName}</p>
        <p className="text-[11px] text-muted-foreground truncate">{email}</p>
      </div>

      {/* Project */}
      <div className="hidden sm:block text-xs text-muted-foreground truncate max-w-[120px]">
        {projectTitle}
      </div>

      {/* Reason badge */}
      <Badge
        variant={config.variant}
        className="shrink-0 gap-1 text-[10px] font-normal"
      >
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>

      {/* Detail */}
      <span className="hidden md:block text-[11px] text-muted-foreground truncate max-w-[140px]">
        {detail}
      </span>

      {/* Action link */}
      {actionLinks[0] && (
        <Link
          href={actionLinks[0].href}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {actionLinks[0].label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
}
