import Link from "next/link";
import { supportService } from "@/lib/support/SupportService";
import { requireCoeUser } from "@/lib/coe-guard";
import { TicketCard } from "../_components/TicketCard";
import { EmptyTicketState } from "../_components/EmptyTicketState";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function MyTicketsPage() {
  const user = await requireCoeUser();
  const { tickets } = await supportService.getMyTickets(user);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>
        <Button asChild>
          <Link href="/support/new">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyTicketState />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/support/tickets/${t.id}`}>
              <TicketCard ticket={t} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
