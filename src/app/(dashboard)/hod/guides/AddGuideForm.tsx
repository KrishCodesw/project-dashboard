"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { searchFaculty, addGuide } from "@/server/actions/hod-dashboard";

type FacultyResult = {
  id: string;
  name: string;
  email: string;
  department: string | null;
};

export function AddGuideForm() {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FacultyResult[]>([]);
  const [selected, setSelected] = useState<FacultyResult | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (selected) return;
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await searchFaculty(query);
      setResults(res);
      setOpen(res.length > 0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  const handleSelect = (faculty: FacultyResult) => {
    setSelected(faculty);
    setQuery(faculty.email);
    setOpen(false);
    setResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const email = selected?.email || query.trim();
    if (!email || !email.includes("@")) {
      setStatus({ type: "error", message: "Valid email is required." });
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      try {
        await addGuide(formData);
        setStatus({ type: "success", message: "Faculty has been added as a guide." });
        setQuery("");
        setSelected(null);
      } catch (err) {
        // redirect happens on success, so if we get here it's an error
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to add guide." });
      }
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <label htmlFor="guideEmail" className="block text-xs font-medium text-muted-foreground mb-1">
            Faculty Email
          </label>
          <input
            ref={inputRef}
            id="guideEmail"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Type faculty email..."
            className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
            autoComplete="off"
          />
          {open && results.length > 0 && (
            <ul className="absolute z-50 top-full mt-1 w-full rounded-[2px] border border-border bg-background shadow-lg max-h-48 overflow-auto">
              {results.map((faculty) => (
                <li
                  key={faculty.id}
                  onClick={() => handleSelect(faculty)}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted border-b border-border last:border-0"
                >
                  <span className="font-medium">{faculty.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{faculty.email}</span>
                  {faculty.department && (
                    <span className="text-[10px] text-muted-foreground ml-2">({faculty.department})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {open && results.length === 0 && query.length >= 2 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              No faculty found
            </div>
          )}
        </div>
        {status && (
          <p className={`text-xs ${status.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center h-9 px-4 rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent transition-all duration-300 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add Guide"}
        </button>
      </form>
    </div>
  );
}
