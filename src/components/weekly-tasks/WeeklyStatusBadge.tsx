import React from "react";
import { WeeklyTaskStatus } from "@prisma/client";

const statusConfig: Record<
  WeeklyTaskStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  REVISION_REQUESTED: {
    label: "Revision Requested",
    className: "bg-rose-100 text-rose-800 border-rose-300",
  },
};

export function WeeklyStatusBadge({ status }: { status: WeeklyTaskStatus }) {
  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
