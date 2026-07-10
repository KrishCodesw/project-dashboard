"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function TicketDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Ticket Detail Error]", error);
  }, [error]);

  const message = error.message || "Failed to load ticket.";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
