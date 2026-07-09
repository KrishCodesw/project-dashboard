"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { inviteFacultyGuide } from "@/server/actions/hod-dashboard";

export function InviteFacultyForm() {
  const [state, formAction, pending] = useActionState(inviteFacultyGuide, null);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
          placeholder="john.doe@tcetmumbai.in"
        />
      </div>
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-600">Invitation sent successfully.</p>
      )}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Sending..." : "Send Invitation"}
      </Button>
    </form>
  );
}
