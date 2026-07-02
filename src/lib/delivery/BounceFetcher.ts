import { google } from "googleapis";

export interface FetchedMessage {
  gmailMessageId: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface FetchOptions {
  maxResults?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createGmailClient(): Promise<any> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.gmail({ version: "v1", auth });
}

export async function fetchNew(
  gmail: any,
  options?: FetchOptions,
): Promise<FetchedMessage[]> {
  const maxResults = options?.maxResults ?? 10;
  const cutoffDate = await getCutoffDate();
  // Dedup is handled by deliveryStatus IS NULL filter in BounceMatcher.
  // No is:unread needed — Gmail DSNs often arrive already read.
  const query = `has:delivery-status after:${cutoffDate}`;

  console.log("[FETCH] Query:", query);

  const listResponse: { data: { messages?: Array<{ id: string }> } } = await retryWithBackoff(() =>
    gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    }),
  );

  const messages = listResponse.data.messages ?? [];
  console.log("[FETCH] has:delivery-status + after returned:", messages.length, "messages");

  if (messages.length === 0) {
    // Try without has:delivery-status to see what's in the inbox
    console.log("[FETCH] Trying broad fallback: in:inbox after:", cutoffDate);
    try {
      const fallback = await gmail.users.messages.list({
        userId: "me",
        q: `in:inbox after:${cutoffDate}`,
        maxResults: 5,
      });
      const fallbackMessages = fallback.data.messages ?? [];
      console.log("[FETCH] Broad fallback returned:", fallbackMessages.length, "messages");
      for (const fm of fallbackMessages.slice(0, 3)) {
        const details = await gmail.users.messages.get({
          userId: "me",
          id: fm.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To"],
        });
        const headers = details.data.payload?.headers ?? [];
        const subject = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
        const from = headers.find((h: any) => h.name === "From")?.value ?? "(no from)";
        const labelIds = details.data.labelIds ?? [];
        console.log("[FETCH] Fallback msg:", { id: fm.id, subject, from, labelIds });
      }
    } catch (e: any) {
      console.error("[FETCH] Fallback error:", e.message);
    }
    return [];
  }

  const fetched: FetchedMessage[] = [];

  for (const msg of messages) {
    const getResponse: { data: { payload?: any } } = await retryWithBackoff(() =>
      gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      }),
    );

    const payload = getResponse.data.payload;
    if (!payload) continue;

    if (!hasDeliveryStatusPart(payload)) continue;

    const rawBody = extractPlainTextBody(payload);
    if (!rawBody) continue;

    const headers = extractHeaders(payload);

    fetched.push({
      gmailMessageId: msg.id,
      rawBody,
      headers,
    });
  }

  return fetched;
}

export async function markRead(
  gmail: any,
  gmailMessageId: string,
): Promise<void> {
  await retryWithBackoff(() =>
    gmail.users.messages.modify({
      userId: "me",
      id: gmailMessageId,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    }),
  );
}

export async function getCutoffDate(): Promise<string> {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function hasDeliveryStatusPart(payload: any): boolean {
  if (payload.mimeType === "message/delivery-status") return true;
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (hasDeliveryStatusPart(part)) return true;
    }
  }
  return false;
}

function extractPlainTextBody(payload: any): string | null {
  if (
    payload.mimeType === "text/plain" &&
    payload.body?.data
  ) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const result = extractPlainTextBody(part);
      if (result) return result;
    }
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  return null;
}

function extractHeaders(payload: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (payload.headers && Array.isArray(payload.headers)) {
    for (const h of payload.headers) {
      if (h.name && h.value !== undefined) {
        headers[h.name] = h.value;
      }
    }
  }
  return headers;
}

function decodeBase64(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

// ponytail: global backoff, per-call backoff state if concurrent calls matter
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxDelayMs = 300_000,
): Promise<T> {
  let delay = 1_000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.code === 429 || err?.status === 429) {
        const retryAfter = parseInt(
          err?.response?.headers?.["retry-after"] ?? "0",
          10,
        );
        const wait = retryAfter > 0
          ? Math.min(retryAfter * 1000, maxDelayMs)
          : Math.min(delay, maxDelayMs);
        console.warn(
          `[BounceFetcher] Rate limited (attempt ${attempt}), waiting ${wait}ms`,
        );
        await sleep(wait);
        delay *= 2;
        if (delay > maxDelayMs) delay = maxDelayMs;
        continue;
      }
      console.error(
        `[BounceFetcher] Gmail API error (attempt ${attempt}):`,
        err?.message ?? err,
      );
      throw err;
    }
  }
}
