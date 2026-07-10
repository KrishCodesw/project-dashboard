"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoeUser } from "@/lib/coe-guard";
import { supportService } from "@/lib/support/SupportService";
import { createNotification, createBulkNotifications } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// ─── Schemas ───────────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(10000),
  category: z.enum(["BUG", "QUESTION", "FEATURE_REQUEST", "SUGGESTION", "OTHER"]),
});

const replySchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(10000),
});

// ─── File validation ───────────────────────────────────────────────────────

const BLOCKED_MIME_PREFIXES = [
  "application/x-msdownload",
  "application/x-bat",
  "text/x-shellscript",
  "application/javascript",
  "application/x-vbscript",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 10;

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Maximum ${MAX_FILES} files allowed.`;
  for (const f of files) {
    if (f.size === 0) return `File "${f.name}" is empty.`;
    if (f.size > MAX_FILE_SIZE) return `File "${f.name}" exceeds 25 MB limit.`;
    if (BLOCKED_MIME_PREFIXES.some((p) => f.type.startsWith(p))) {
      return `File type "${f.type}" is not allowed.`;
    }
  }
  return null;
}

function collectFiles(formData: FormData): File[] {
  const entries = formData.getAll("attachments[]");
  return entries.filter((e): e is File => e instanceof File);
}

// ─── Create Ticket ─────────────────────────────────────────────────────────

export async function createTicket(formData: FormData) {
  const user = await requireCoeUser();

  const parsed = createTicketSchema.parse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category"),
  });

  const files = collectFiles(formData);
  const validationError = files.length > 0 ? validateFiles(files) : null;
  if (validationError) throw new Error(validationError);

  const hasFiles = files.length > 0;

  const result = await supportService.createTicket({
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department ?? undefined,
    uid: user.uid ?? undefined,
  }, {
    subject: parsed.subject,
    description: parsed.description,
    category: parsed.category,
    attachments: hasFiles ? formData : undefined,
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true },
  });

  if (admins.length > 0) {
    await createBulkNotifications(
      admins.map((a) => a.id),
      {
        type: "TICKET_CREATED",
        title: "New support ticket",
        message: `${user.name} reported: ${parsed.subject}`,
        link: `/support/tickets/${result.id}`,
      },
    );

    const ticketLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/support/tickets/${result.id}`;
    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: `[Support] ${user.name} reported: ${parsed.subject}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>New Support Ticket</h2>
            <p><strong>From:</strong> ${user.name} (${user.email})</p>
            <p><strong>Subject:</strong> ${parsed.subject}</p>
            <p><strong>Description:</strong></p>
            <p>${parsed.description}</p>
            <p><a href="${ticketLink}">View ticket in dashboard</a></p>
          </div>
        `,
      }).catch(() => {});
    }
  }

  revalidatePath("/support/tickets");
  return { ok: true, id: result.id };
}

// ─── Reply to Ticket ───────────────────────────────────────────────────────

export async function replyToTicket(chatwootId: number, formData: FormData) {
  const user = await requireCoeUser();

  const parsed = replySchema.parse({
    content: formData.get("content"),
  });

  const files = collectFiles(formData);
  const validationError = files.length > 0 ? validateFiles(files) : null;
  if (validationError) throw new Error(validationError);

  const hasFiles = files.length > 0;

  await supportService.replyToTicket(user, chatwootId, {
    content: parsed.content,
    attachments: hasFiles ? formData : undefined,
  });

  const { ticket } = await supportService.getTicketDetail(user, chatwootId);
  if (ticket.ownerEmail && ticket.ownerEmail !== user.email) {
    const platformUser = await prisma.user.findUnique({
      where: { email: ticket.ownerEmail },
      select: { id: true, email: true },
    });
    if (platformUser) {
      await createNotification({
        userId: platformUser.id,
        type: "TICKET_REPLIED",
        title: "New reply on your ticket",
        message: `${user.name} replied on "${ticket.subject}"`,
        link: `/support/tickets/${chatwootId}`,
      });

      const ticketLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/support/tickets/${chatwootId}`;
      sendEmail({
        to: platformUser.email,
        subject: `[Support] ${user.name} replied on "${ticket.subject}"`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>New Reply on Your Ticket</h2>
            <p><strong>From:</strong> ${user.name}</p>
            <p><strong>Ticket:</strong> ${ticket.subject}</p>
            <p><strong>Reply:</strong></p>
            <p>${parsed.content}</p>
            <p><a href="${ticketLink}">View in dashboard</a></p>
          </div>
        `,
      }).catch(() => {});
    }
  }

  revalidatePath(`/support/tickets/${chatwootId}`);
  return { ok: true };
}
