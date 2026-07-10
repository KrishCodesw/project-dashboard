import { Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyTicketState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium">No tickets yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Create a ticket to get help from the support team.
      </p>
      <Button asChild>
        <Link href="/support/new">Create Ticket</Link>
      </Button>
    </div>
  );
}
