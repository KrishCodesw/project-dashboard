import type { SupportTicket } from "@/lib/support/types";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { CategoryIcon } from "./CategoryIcon";

export function TicketHeader({ ticket }: { ticket: SupportTicket }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <CategoryIcon category={ticket.category} className="h-6 w-6" />
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <TicketStatusBadge status={ticket.status} />
      </div>
      {ticket.description && (
        <p className="text-sm text-muted-foreground">{ticket.description}</p>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
        <span>{ticket.messageCount} messages</span>
        {ticket.priority && <span>Priority: {ticket.priority}</span>}
      </div>
    </div>
  );
}
