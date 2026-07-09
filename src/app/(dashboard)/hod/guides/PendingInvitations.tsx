"use client";

import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cancelInvitation } from "@/server/actions/hod-dashboard";

type Invitation = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
};

export function PendingInvitations({ invitations }: { invitations: Invitation[] }) {
  const [pendingId, startTransition] = useTransition();

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending invitations.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <div>
            <p className="text-sm font-medium">
              {inv.name || inv.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {inv.email} · {formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={pendingId}
            onClick={() => {
              startTransition(async () => {
                await cancelInvitation(inv.id);
              });
            }}
            className="text-destructive hover:text-destructive"
          >
            Cancel
          </Button>
        </div>
      ))}
    </div>
  );
}
