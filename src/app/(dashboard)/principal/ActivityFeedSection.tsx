"use client";

import { useState, useTransition } from "react";
import { Users, FileText, BookOpen, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityFeedDay } from "@/server/actions/principal-dashboard";

interface Props {
  initialFeed: ActivityFeedDay;
  fetchFeed: (date: string) => Promise<ActivityFeedDay>;
}

export function ActivityFeedSection({ initialFeed, fetchFeed }: Props) {
  const [feed, setFeed] = useState<ActivityFeedDay>(initialFeed);
  const [isPending, startTransition] = useTransition();

  const isToday = feed.date === new Date().toLocaleDateString('en-CA');

  function changeDate(offset: number) {
    const d = new Date(feed.date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    startTransition(async () => setFeed(await fetchFeed(d.toISOString().slice(0, 10))));
  }

  // Group work logs by department
  const byDept = new Map<string, typeof feed.workLogs>();
  for (const entry of feed.workLogs) {
    const key = entry.department ?? "No Department";
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(entry);
  }

  return (
    <div className="rounded-[2px] border border-border bg-card">
      {/* Header */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Daily Activity Feed</h2>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Faculty work logs &amp; events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} disabled={isPending}
            className="p-1.5 rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-40">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-mono min-w-[110px] text-center">
            {new Date(feed.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            {isToday && <span className="ml-1 text-[9px] text-primary">(Today)</span>}
          </span>
          <button onClick={() => changeDate(1)} disabled={isPending || isToday}
            className="p-1.5 rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-40">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 border-b border-border divide-x divide-border">
        {([
          { icon: BookOpen,      label: "New Projects",   value: feed.newProjects },
          { icon: FileText,      label: "Files Uploaded", value: feed.newFiles },
          { icon: MessageSquare, label: "Reviews",        value: feed.newReviews },
        ] as const).map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-4 flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="p-5 min-h-[120px]">
        {isPending ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !feed.hasActivity ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No activity logged for this day</p>
            <p className="text-xs text-muted-foreground/60 mt-1">No work logs or project events recorded.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {feed.workLogs.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No faculty work logs submitted for this date.</p>
            )}
            {Array.from(byDept.entries()).map(([dept, entries]) => (
              <div key={dept}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{dept}</p>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <div key={e.facultyId} className="rounded-[2px] border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium">{e.facultyName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(e.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{e.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
