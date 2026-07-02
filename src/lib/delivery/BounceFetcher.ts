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
  console.log("[DBG] createGmailClient() called");
  console.log("[DBG] GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
  console.log("[DBG] GOOGLE_CLIENT_SECRET present:", !!process.env.GOOGLE_CLIENT_SECRET);
  console.log("[DBG] GOOGLE_REFRESH_TOKEN present:", !!process.env.GOOGLE_REFRESH_TOKEN);

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth });

  // Step 1: Verify authenticated account
  try {
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("[DBG] Authenticated Gmail account:", profile.data.emailAddress);
    console.log("[DBG] Profile historyId:", profile.data.historyId);
  } catch (err: any) {
    console.error("[DBG] FAILED to get Gmail profile:", err?.message ?? err);
    console.error("[DBG] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
  }

  // Step 6: Verify OAuth scopes — test gmail.modify by calling the tokeninfo endpoint
  try {
    const tokenInfo = await auth.getAccessToken();
    console.log("[DBG] Access token obtained:", tokenInfo?.token ? "yes (first 10 chars: " + tokenInfo.token.slice(0, 10) + "...)" : "no");
  } catch (err: any) {
    console.error("[DBG] FAILED to get access token:", err?.message ?? err);
  }

  return gmail;
}

export async function fetchNew(
  gmail: any,
  options?: FetchOptions,
): Promise<FetchedMessage[]> {
  const maxResults = options?.maxResults ?? 10;
  const cutoffDate = await getCutoffDate();
  const query = `has:delivery-status is:unread after:${cutoffDate}`;

  // Step 2: Log exact query
  console.log("[DBG] Gmail search query (literal):", JSON.stringify(query));
  console.log("[DBG] cutoffDate value:", cutoffDate);
  console.log("[DBG] maxResults:", maxResults);

  const listResponse: { data: { messages?: Array<{ id: string }> } } = await retryWithBackoff(() =>
    gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    }),
  );

  // Step 3: Log API response
  const messages = listResponse.data.messages ?? [];
  console.log("[DBG] messages.list() total returned:", messages.length);
  console.log("[DBG] Full listResponse.data:", JSON.stringify(listResponse.data, null, 2));

  if (messages.length === 0) {
    console.log("[DBG] Zero messages returned. Trying broader search with newer_than:30d...");

    // Step 4: Broaden search
    const broadQuery = "newer_than:30d";
    console.log("[DBG] Broad search query:", JSON.stringify(broadQuery));
    try {
      const broadResponse = await gmail.users.messages.list({
        userId: "me",
        q: broadQuery,
        maxResults: 5,
      });
      const broadMessages = broadResponse.data.messages ?? [];
      console.log("[DBG] Broad search returned:", broadMessages.length, "messages");

      for (const bm of broadMessages.slice(0, 3)) {
        const details = await gmail.users.messages.get({
          userId: "me",
          id: bm.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To"],
        });
        const headers = details.data.payload?.headers ?? [];
        const subject = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
        const from = headers.find((h: any) => h.name === "From")?.value ?? "(no from)";
        const labelIds = details.data.labelIds ?? [];
        const snippet = (details.data.snippet ?? "").slice(0, 120);
        console.log("[DBG] Broad msg:", {
          id: bm.id,
          subject,
          from,
          labelIds,
          snippet,
        });
      }
    } catch (broadErr: any) {
      console.error("[DBG] Broad search also failed:", broadErr?.message ?? broadErr);
    }

    return [];
  }

  const fetched: FetchedMessage[] = [];

  // Step 7: Verify individual message retrieval
  for (const msg of messages) {
    console.log("[DBG] Fetching message detail for ID:", msg.id);
    try {
      const getResponse: { data: { payload?: any } } = await retryWithBackoff(() =>
        gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        }),
      );

      const payload = getResponse.data.payload;
      console.log("[DBG] Message", msg.id, "payload mimeType:", payload?.mimeType);
      console.log("[DBG] Message", msg.id, "has payload parts:", !!payload?.parts, "parts count:", payload?.parts?.length ?? 0);

      if (!payload) {
        console.log("[DBG] Message", msg.id, "SKIPPED: no payload");
        continue;
      }

      const hasDS = hasDeliveryStatusPart(payload);
      console.log("[DBG] Message", msg.id, "has message/delivery-status part:", hasDS);

      if (!hasDS) {
        console.log("[DBG] Message", msg.id, "SKIPPED: not a DSN (no message/delivery-status MIME part)");
        continue;
      }

      const rawBody = extractPlainTextBody(payload);
      console.log("[DBG] Message", msg.id, "extracted rawBody length:", rawBody?.length ?? 0);

      if (!rawBody) {
        console.log("[DBG] Message", msg.id, "SKIPPED: no plain-text body extracted");
        continue;
      }

      const headers = extractHeaders(payload);
      const subject = headers["Subject"] ?? "(no subject)";
      const from = headers["From"] ?? "(no from)";
      console.log("[DBG] Message", msg.id, "ACCEPTED. Subject:", subject, "From:", from);

      fetched.push({
        gmailMessageId: msg.id,
        rawBody,
        headers,
      });
    } catch (err: any) {
      console.error("[DBG] Message", msg.id, "FETCH FAILED:", err?.message ?? err);
    }
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
