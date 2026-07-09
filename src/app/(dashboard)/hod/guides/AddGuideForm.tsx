"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assignGuide, inviteFacultyGuide } from "@/server/actions/hod-dashboard";

export function AddGuideForm() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await assignGuide(email);
        if (result.success) {
          setStatus({ type: "success", message: "Faculty assigned as guide." });
          setEmail("");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Faculty not found in this department.";
        const formData = new FormData();
        formData.append("email", email);
        const invite = await inviteFacultyGuide(formData);
        if (invite.success) {
          setStatus({ type: "success", message: "Faculty not found locally. An invitation email has been sent." });
          setEmail("");
        } else {
          setStatus({ type: "error", message: invite.error || message });
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="addEmail" className="block text-xs font-medium text-muted-foreground mb-1">
          Faculty Email
        </label>
        <input
          id="addEmail"
          name="addEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
          placeholder="faculty@tcetmumbai.in"
        />
      </div>
      {status && (
        <p className={`text-xs ${status.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
          {status.message}
        </p>
      )}
      <Button type="submit" disabled={pending || !email.trim()} size="sm">
        {pending ? "Processing..." : "Add Guide"}
      </Button>
    </form>
  );
}
