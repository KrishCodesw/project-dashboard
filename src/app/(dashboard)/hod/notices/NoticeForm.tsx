"use client";

import { useState, useTransition } from "react";
import { sendNoticeToStudents } from "@/server/actions/hod-notices";

export function NoticeForm({ department }: { department: string }) {
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [bodyCount, setBodyCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setResult(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await sendNoticeToStudents(fd);
        setResult(res);
        (e.target as HTMLFormElement).reset();
        setBodyCount(0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to send notice.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="subject" className="block text-xs font-medium text-muted-foreground mb-1">Subject *</label>
        <input id="subject" name="subject" type="text" maxLength={200} required
          placeholder="e.g. Reminder: Mini-Project submission deadline — 20 July"
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label htmlFor="body" className="block text-xs font-medium text-muted-foreground mb-1">Notice Body *</label>
        <textarea id="body" name="body" rows={8} maxLength={10000} required
          placeholder="Write your notice here…"
          onChange={(e) => setBodyCount(e.target.value.length)}
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        <p className="text-[10px] text-muted-foreground mt-1 text-right">{bodyCount}/10 000</p>
      </div>
      {error && (
        <div className="rounded-[2px] border border-red-300 bg-red-50 dark:bg-red-950/20 px-3 py-2">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {result && (
        <div className="rounded-[2px] border border-green-300 bg-green-50 dark:bg-green-950/20 px-3 py-2">
          <p className="text-xs text-green-700 dark:text-green-400">
            ✓ Sent to {result.sent} / {result.total} students
            {result.failed > 0 && ` · ${result.failed} failed`}
          </p>
        </div>
      )}
      <button type="submit" disabled={isPending}
        className="inline-flex h-9 items-center px-5 rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
        {isPending ? "Sending…" : `Send to All ${department} Students`}
      </button>
    </form>
  );
}
