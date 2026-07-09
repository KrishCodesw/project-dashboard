"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export function InviteFacultyForm({
  onInvite,
}: {
  onInvite: (formData: FormData) => Promise<{ success: boolean; error: string | null }>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { success: boolean; error: string | null } | null, formData: FormData) => {
      return onInvite(formData);
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="name"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
          placeholder="Dr. John Doe"
        />
      </div>
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
