import { cancelInvitation } from "@/server/actions/hod-dashboard";

type Invitation = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
};

export function PendingInvitations({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <div>
            <p className="text-sm font-medium">{inv.name || inv.email}</p>
            <p className="text-xs text-muted-foreground">
              {inv.email}
            </p>
          </div>
          <form action={cancelInvitation}>
            <input type="hidden" name="invitationId" value={inv.id} />
            <button
              type="submit"
              className="text-xs text-destructive hover:text-destructive/80 underline"
            >
              Cancel
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
