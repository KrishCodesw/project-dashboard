"use client";

import { cn } from "@/lib/utils";

type ViewMode = "grouped" | "chronological";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5">
      {(["grouped", "chronological"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all",
            view === option
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option === "grouped" ? "Grouped" : "Chronological"}
        </button>
      ))}
    </div>
  );
}
