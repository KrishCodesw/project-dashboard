"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/server/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, X, Send } from "lucide-react";

const CATEGORIES = [
  { value: "BUG", label: "Bug Report" },
  { value: "QUESTION", label: "Question" },
  { value: "FEATURE_REQUEST", label: "Feature Request" },
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "OTHER", label: "Other" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !category) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("subject", subject);
      formData.set("description", description);
      formData.set("category", category);
      for (const file of files) {
        formData.append("attachments[]", file);
      }

      const result = await createTicket(formData);
      router.push(`/support/tickets/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected].slice(0, 10));
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Ticket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a support request
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger id="category" aria-label="Category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your issue"
            required
            minLength={3}
            maxLength={200}
            aria-label="Subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue in detail..."
            rows={6}
            required
            minLength={10}
            maxLength={10000}
            aria-label="Description"
          />
        </div>

        <div className="space-y-2">
          <Label>Attachments (optional, max 10 files)</Label>
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="ticket-attachments"
            aria-label="Attach files"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Attach files
          </Button>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${file.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <Button type="submit" disabled={submitting || !subject.trim() || !description.trim() || !category}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Submitting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Submit
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
