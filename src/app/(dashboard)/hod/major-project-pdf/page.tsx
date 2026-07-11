"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
type State = "idle" | "uploading" | "success" | "error";

export default function MajorProjectPDFPage() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") { setState("error"); setMessage("Only PDF files are accepted."); return; }
    if (file.size > MAX_BYTES) { setState("error"); setMessage(`File too large. Max ${MAX_MB} MB (yours: ${(file.size/1024/1024).toFixed(1)} MB).`); return; }
    if (file.size === 0) { setState("error"); setMessage("File appears empty or corrupted."); return; }

    setFileName(file.name); setState("uploading"); setProgress(10);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "REPORT");
    fd.append("projectId", "__major-project-signed__");

    try {
      const timer = setInterval(() => setProgress((p) => Math.min(p + 10, 95)), 200);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      clearInterval(timer); setProgress(100);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Upload failed (${res.status})`); }
      setState("success"); setMessage(`"${file.name}" uploaded successfully.`);
    } catch (err: unknown) {
      setState("error"); setMessage(err instanceof Error ? err.message : "Upload failed."); setProgress(0);
    }
  }

  function reset() { setState("idle"); setMessage(""); setFileName(""); setProgress(0); if (inputRef.current) inputRef.current.value = ""; }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Signed Major Project PDF</h1>
        <p className="text-sm text-muted-foreground">Centralised upload for the principal-signed Major Project document</p>
      </div>
      <div className="max-w-xl rounded-[2px] border border-border bg-card p-6 space-y-5">
        <div className="rounded-[2px] bg-muted/50 border border-border/60 p-4 space-y-1">
          <p className="text-xs font-medium">Upload guidelines</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>PDF files only · Max {MAX_MB} MB</li>
            <li>Ensure the document is signed and not corrupted</li>
            <li>Re-uploading replaces the existing file</li>
          </ul>
        </div>

        {state === "idle" && (
          <label className="flex flex-col items-center gap-3 rounded-[2px] border-2 border-dashed border-border hover:border-primary/50 bg-background hover:bg-muted/30 p-10 cursor-pointer transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">Click to select or drag &amp; drop</p>
              <p className="text-xs text-muted-foreground">PDF only · max {MAX_MB} MB</p>
            </div>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={handleChange} className="hidden" />
          </label>
        )}

        {state === "uploading" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm truncate text-muted-foreground">{fileName}</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex items-start gap-3 rounded-[2px] border border-green-300 bg-green-50 dark:bg-green-950/20 p-4">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Upload successful</p>
              <p className="text-xs text-green-600/80 mt-0.5">{message}</p>
              <button onClick={reset} className="mt-2 text-xs underline text-green-700 dark:text-green-400">Upload another</button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex items-start gap-3 rounded-[2px] border border-red-300 bg-red-50 dark:bg-red-950/20 p-4">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Upload failed</p>
              <p className="text-xs text-red-600/80 mt-0.5">{message}</p>
              <button onClick={reset} className="mt-2 text-xs underline text-red-700 dark:text-red-400">Try again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
