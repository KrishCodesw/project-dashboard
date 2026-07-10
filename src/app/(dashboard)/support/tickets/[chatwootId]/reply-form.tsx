"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { replyToTicket } from "@/server/actions/support";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X } from "lucide-react";

interface ReplyFormProps {
  chatwootId: number;
}

export function ReplyForm({ chatwootId }: ReplyFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && files.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("content", content);
      for (const file of files) {
        formData.append("attachments[]", file);
      }

      await replyToTicket(chatwootId, formData);
      setContent("");
      setFiles([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
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
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <Textarea
        placeholder="Type your reply..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        aria-label="Reply message"
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
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

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="reply-attachments"
          aria-label="Attach files"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button type="submit" disabled={submitting || (!content.trim() && files.length === 0)}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
