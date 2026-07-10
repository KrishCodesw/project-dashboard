import type { SupportTicket } from "@/lib/support/types";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { CategoryIcon } from "./CategoryIcon";

export function TicketCard({ ticket }: { ticket: SupportTicket }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
      <CategoryIcon category={ticket.category} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{ticket.subject}</h3>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {ticket.messageCount} {ticket.messageCount === 1 ? "message" : "messages"}
        </p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        {new Date(ticket.lastActivityAt).toLocaleDateString()}
      </div>
    </div>
  );
}
