"use client";

import { useEffect, useState, useTransition } from "react";
import { submitWorkLog } from "@/server/actions/faculty-work-log";

export function WorkLogModal({ hasSubmittedToday }: { hasSubmittedToday: boolean }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!hasSubmittedToday) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, [hasSubmittedToday]);

  if (!open || submitted) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const summary = (fd.get("summary") as string | null)?.trim() ?? "";
    if (!summary) { setError("Please write a brief summary before submitting."); return; }
    if (summary.length > 5000) { setError("Summary too long (max 5 000 chars)."); return; }
    setError("");
    startTransition(async () => {
      try {
        await submitWorkLog(fd);
        setSubmitted(true);
        setOpen(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-[2px] border border-border bg-card shadow-xl">
        <div className="p-5 border-b border-border">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Daily Work Log · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="text-lg font-semibold">What did you work on today?</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            A brief summary of your academic activities — appears in the Principal&apos;s daily feed.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <textarea
              name="summary"
              rows={5}
              maxLength={5000}
              placeholder="e.g. Conducted project review for Group 3 (AIML). Reviewed 2 mini-project proposals. Updated evaluation rubric…"
              className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              onChange={(e) => setCharCount(e.target.value.length)}
            />
            <div className="flex justify-between mt-1">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <span className="text-[10px] text-muted-foreground ml-auto">{charCount}/5000</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center h-9 px-5 rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? "Submitting…" : "Submit Work Log"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
