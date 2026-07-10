"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Send, X } from "lucide-react";
import { toast } from "sonner";
import { resendPendingInvitation, cancelPendingAssignment } from "@/server/actions/projects";
import { useQueryClient } from "@tanstack/react-query";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface PendingInvitationsSectionProps {
  projectId: string;
  pendingMembers: Array<{
    id: string;
    email: string;
    memberRole: string;
    status: string;
    invitedByName: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export function PendingInvitationsSection({
  projectId,
  pendingMembers: initialMembers,
}: PendingInvitationsSectionProps) {
  const [pending, setPending] = useState(initialMembers);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Sync with prop changes when parent re-fetches
  React.useEffect(() => {
    setPending(initialMembers);
  }, [initialMembers]);

  if (pending.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Pending Invitations ({pending.length})
      </h4>
      {pending.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2"
        >
          <div className="text-sm min-w-0 flex-1">
            <p className="font-medium flex items-center gap-1.5 truncate">
              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Invitation sent · {timeAgo(p.createdAt)}
              {p.memberRole === "LEAD" ? ` · Role: ${p.memberRole}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={actionLoading === p.id}
              onClick={async () => {
                setActionLoading(p.id);
                const r = await resendPendingInvitation(projectId, p.id);
                if (r.success) toast.success("Invitation re-sent");
                else toast.error(r.error || "Failed to resend");
                setActionLoading(null);
              }}
            >
              {actionLoading === p.id ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Resend
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={actionLoading === p.id}
              onClick={async () => {
                if (!confirm("Remove this invitation?")) return;
                setActionLoading(p.id);
                const r = await cancelPendingAssignment(projectId, p.id);
                if (r.success) {
                  toast.success("Invitation removed");
                  // Optimistically remove from UI
                  setPending((prev) => prev.filter((item) => item.id !== p.id));
                  // Invalidate parent query to refresh server state
                  queryClient.invalidateQueries({
                    queryKey: ["admin", "projects", "manage"],
                  });
                } else {
                  toast.error(r.error || "Failed to remove");
                }
                setActionLoading(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
