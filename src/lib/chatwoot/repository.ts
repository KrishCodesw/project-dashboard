import { randomUUID } from "crypto";
import { chatwootConfig } from "./config";
import { logChatwootRequest } from "./logger";
import { ChatwootApiError } from "../support/errors";

const BASE = `${chatwootConfig.apiUrl}/accounts/${chatwootConfig.accountId}`;

async function request<T>(
  method: string,
  path: string,
  body?: unknown | FormData,
  isRetryable: boolean = false,
  timeoutMs?: number,
): Promise<T> {
  const requestId = randomUUID();
  const effectiveTimeout = timeoutMs ?? (method === "GET" ? 5_000 : 15_000);
  const start = Date.now();

  const attempt = async (n: number): Promise<T> => {
    try {
      const isFormData = body instanceof FormData;
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: isFormData
          ? { api_access_token: chatwootConfig.apiToken }
          : {
              "Content-Type": "application/json",
              api_access_token: chatwootConfig.apiToken,
            },
        body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(effectiveTimeout),
      });

      logChatwootRequest(method, path, Date.now() - start, res.status, requestId, n);

      if (!res.ok) {
        if (res.status === 404) throw new ChatwootApiError(404, `Resource not found: ${path}`, requestId);
        throw new ChatwootApiError(res.status, `Chatwoot returned ${res.status}: ${await res.text().catch(() => "Unknown")}`, requestId);
      }

      return res.json();
    } catch (err) {
      if (err instanceof ChatwootApiError) throw err;
      if (!isRetryable || n >= 3) {
        throw new ChatwootApiError(0, `Request failed: ${(err as Error)?.message ?? "Unknown"}`, requestId);
      }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, n)));
      return attempt(n + 1);
    }
  };

  return attempt(0);
}

// ─── Types: Raw Chatwoot response shapes ──────────────────────────────────

export interface ChatwootContactResponse {
  id: number;
  email: string;
  name: string;
  custom_attributes: Record<string, string>;
}

export interface ChatwootConversationResponse {
  id: number;
  subject?: string;
  status: string;
  priority?: string;
  labels: string[];
  meta?: { sender?: { id: number; email?: string } };
  custom_attributes: Record<string, string>;
  created_at: number;
  last_activity_at: number;
  messages_count?: number;
}

export interface ChatwootMessageResponse {
  id: number;
  content: string;
  message_type: number;
  private: boolean;
  sender?: { id: number; name: string; type?: string };
  attachments?: Array<{ id: number; file_name: string; file_url: string; file_type: string; file_size?: number }>;
  created_at: number;
}

// ─── Public API ────────────────────────────────────────────────────────────

export const chatwootRepo = {
  // ── Contacts ──────────────────────────────────────────────────────────
  findContactByIdentifier(identifier: string) {
    return request<{ payload: ChatwootContactResponse[] }>(
      "GET", `/contacts/search?q=${encodeURIComponent(identifier)}`, undefined, true,
    ).then((r) => r.payload?.[0] ?? null);
  },

  /** @deprecated Use findContactByIdentifier instead. Both use the same search endpoint now. */
  findContactByEmailForMigration(email: string) {
    return request<{ payload: ChatwootContactResponse[] }>(
      "GET", `/contacts/search?q=${encodeURIComponent(email)}`, undefined, true,
    ).then((r) => r.payload?.[0] ?? null);
  },

  createContact(identifier: string, name: string, customAttributes: Record<string, string>) {
    return request<{ payload: { contact: ChatwootContactResponse } }>(
      "POST", "/contacts", { identifier, email: identifier, name, custom_attributes: customAttributes },
    ).then((r) => r.payload.contact);
  },

  getContact(contactId: number) {
    return request<{ payload: { contact: ChatwootContactResponse } }>(
      "GET", `/contacts/${contactId}`, undefined, true,
    ).then((r) => r.payload.contact);
  },

  // ── Conversations ─────────────────────────────────────────────────────
  createConversation(contactId: number, customAttributes: Record<string, string>) {
    const sourceId = randomUUID();
    return request<ChatwootConversationResponse>(
      "POST", "/conversations", {
        source_id: sourceId,
        contact_id: contactId,
        custom_attributes: customAttributes,
      },
    );
  },

  listConversationsByContact(contactId: number) {
    return request<{ payload: ChatwootConversationResponse[] }>(
      "GET", `/conversations?contact_id=${contactId}`, undefined, true,
    ).then((r) => r.payload ?? []);
  },

  getConversation(conversationId: number) {
    return request<ChatwootConversationResponse>(
      "GET", `/conversations/${conversationId}`, undefined, true,
    );
  },

  // ── Messages ──────────────────────────────────────────────────────────
  sendMessage(
    conversationId: number,
    content: string,
    messageType: "incoming" | "outgoing",
    isPrivate: boolean,
    attachments?: FormData,
  ) {
    const hasAttachments = attachments !== undefined;
    const timeoutMs = hasAttachments ? 60_000 : undefined;

    if (hasAttachments) {
      return request<ChatwootMessageResponse>(
        "POST", `/conversations/${conversationId}/messages`, attachments,
        false, timeoutMs,
      );
    }

    return request<ChatwootMessageResponse>("POST", `/conversations/${conversationId}/messages`, {
      content,
      message_type: messageType,
      private: isPrivate,
    }, false, timeoutMs);
  },

  getMessages(conversationId: number) {
    return request<{ payload: ChatwootMessageResponse[] }>(
      "GET", `/conversations/${conversationId}/messages`, undefined, true,
    ).then((r) => r.payload ?? []);
  },
};
