"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inviteFacultyGuide } from "@/server/actions/hod-dashboard";

export function InviteFacultyForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; error: string | null } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    e.currentTarget.reset();
    startTransition(async () => {
      const res = await inviteFacultyGuide(formData);
      setResult(res);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1">
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
      {result?.error && (
        <p className="text-xs text-destructive">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-xs text-emerald-600">Invitation sent successfully.</p>
      )}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Sending..." : "Send Invitation"}
      </Button>
    </form>
  );
}
