import type { SupportMessage } from "@/lib/support/types";

export function MessageThread({ messages }: { messages: SupportMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`rounded-lg border p-4 ${msg.senderType === "admin" ? "bg-muted/30" : ""}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{msg.senderName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          {msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {msg.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  {att.fileName}
                </a>
              ))}
            </div>
          )}
          {msg.isInternal && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Internal note
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
