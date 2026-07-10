import { cache } from "react";
import { chatwootRepo, type ChatwootConversationResponse, type ChatwootMessageResponse } from "@/lib/chatwoot/repository";
import type { SupportTicket, SupportMessage } from "./types";
import {
  SupportUnavailableError,
  ConversationNotFoundError,
  ChatwootApiError,
} from "./errors";
import { CW_ATTR } from "./constants";

// ── Contact resolution helpers (internal — Chatwoot contact IDs never leave this module) ──

const resolveContact = cache(async (identifier: string, name?: string, customAttributes?: Record<string, string>): Promise<number> => {
  let cw = await chatwootRepo.findContactByIdentifier(identifier);
  if (!cw) {
    cw = await chatwootRepo.findContactByEmailForMigration(identifier);
  }
  if (!cw && name) {
    cw = await chatwootRepo.createContact(identifier, name, customAttributes ?? {});
  }
  if (!cw) throw new ConversationNotFoundError(0);
  return cw.id;
});

const lookupContact = cache(async (identifier: string): Promise<number | null> => {
  const cw = await chatwootRepo.findContactByIdentifier(identifier);
  return cw?.id ?? null;
});

export const supportRepo = {
  // ── Contact operations ─────────────────────────────────────────────────
  async ensureContact(identifier: string, name: string, customAttributes?: Record<string, string>): Promise<void> {
    await resolveContact(identifier, name, customAttributes);
  },

  async findContactByIdentifier(identifier: string): Promise<boolean> {
    const id = await lookupContact(identifier);
    return id !== null;
  },

  async getContactEmail(contactId: number): Promise<string | null> {
    try {
      const cw = await chatwootRepo.getContact(contactId);
      return cw?.email ?? null;
    } catch {
      return null;
    }
  },

  // ── Conversation operations ────────────────────────────────────────────
  async getMyTickets(identifier: string): Promise<SupportTicket[]> {
    const contactId = await lookupContact(identifier);
    if (!contactId) return [];
    const conversations = await chatwootRepo.listConversationsByContact(contactId);
    return conversations.map(normalizeTicket);
  },

  async getTicket(conversationId: number): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    try {
      const [conversation, messages] = await Promise.all([
        chatwootRepo.getConversation(conversationId),
        chatwootRepo.getMessages(conversationId),
      ]);

      return {
        ticket: normalizeTicket(conversation),
        messages: messages.map(normalizeMessage),
      };
    } catch (err) {
      if (err instanceof ChatwootApiError && err.statusCode === 404) {
        throw new ConversationNotFoundError(conversationId);
      }
      throw translateError(err);
    }
  },

  async createConversation(
    identifier: string,
    description: string,
    category: string,
    attachments?: FormData,
  ): Promise<{ id: number }> {
    const contactId = await resolveContact(identifier);
    const conversation = await chatwootRepo.createConversation(contactId, {
      [CW_ATTR.CATEGORY]: category,
    });

    if (attachments) {
      attachments.set("content", description);
      attachments.set("message_type", "incoming");
      attachments.set("private", "false");
      await chatwootRepo.sendMessage(conversation.id, "", "incoming", false, attachments);
    } else {
      await chatwootRepo.sendMessage(conversation.id, description, "incoming", false);
    }

    return { id: conversation.id };
  },

  // ── Message operations ─────────────────────────────────────────────────
  async sendReply(
    conversationId: number,
    content: string,
    messageType: "incoming" | "outgoing",
    attachments?: FormData,
  ): Promise<void> {
    if (attachments) {
      attachments.set("content", content);
      attachments.set("message_type", messageType);
      attachments.set("private", "false");
      await chatwootRepo.sendMessage(conversationId, "", messageType, false, attachments);
    } else {
      await chatwootRepo.sendMessage(conversationId, content, messageType, false);
    }
  },
};

// ── Normalization ─────────────────────────────────────────────────────────

function normalizeTicket(cw: ChatwootConversationResponse): SupportTicket {
  const ownerEmail: string | null =
    cw.meta?.sender && "email" in cw.meta.sender
      ? (cw.meta.sender as { email?: string }).email ?? null
      : null;

  return {
    id: cw.id,
    subject: cw.subject ?? "(No subject)",
    description: cw.custom_attributes?.[CW_ATTR.CATEGORY] ?? null,
    status: cw.status ?? "open",
    priority: cw.priority,
    category: cw.custom_attributes?.[CW_ATTR.CATEGORY] ?? "OTHER",
    ownerEmail,
    createdAt: new Date(cw.created_at * 1000).toISOString(),
    lastActivityAt: new Date(cw.last_activity_at * 1000).toISOString(),
    messageCount: cw.messages_count ?? 0,
    labels: cw.labels ?? [],
  };
}

function normalizeMessage(cw: ChatwootMessageResponse): SupportMessage {
  let senderType: "user" | "admin" | "system" = "system";
  if (cw.sender?.type === "agent" || cw.message_type === 2) senderType = "admin";
  else if (cw.message_type === 1 || cw.message_type === 3) senderType = "user";

  return {
    id: cw.id,
    content: cw.content ?? "",
    senderName: cw.sender?.name ?? "System",
    senderType,
    createdAt: new Date(cw.created_at * 1000).toISOString(),
    attachments: (cw.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.file_name ?? "Unknown file",
      fileUrl: a.file_url ?? "",
      fileType: a.file_type ?? "application/octet-stream",
      fileSize: a.file_size,
    })),
    isInternal: cw.private ?? false,
  };
}

function translateError(err: unknown): never {
  if (err instanceof ChatwootApiError || err instanceof ConversationNotFoundError) {
    throw err;
  }
  if (err instanceof TypeError && (err as Error).message.includes("fetch")) {
    throw new SupportUnavailableError();
  }
  throw new ChatwootApiError(0, (err as Error)?.message ?? "Unknown error");
}
