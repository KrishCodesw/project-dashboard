# Support Center Implementation Guide

**Status:** Final — no architectural decisions remain  
**Constraint:** One administrator, uses Chatwoot native UI for all admin work  
**Principle:** The platform provides a thin ticket submission + read interface. Everything else belongs to Chatwoot.  
**Identifier:** Email (no local mapping table)  

---

## Table of Contents

1. Architecture Layers
2. Folder Structure
3. Files: Exports, Responsibilities, Signatures
4. Database Changes
5. ChatwootRepository (`src/lib/chatwoot/repository.ts`)
6. SupportRepository (`src/lib/support/SupportRepository.ts`)
7. SupportService (`src/lib/support/SupportService.ts`)
8. Types (`src/lib/support/types.ts`)
9. Errors (`src/lib/support/errors.ts`)
10. Custom Attribute Constants (`src/lib/support/constants.ts`)
11. Rate Limiter (`src/lib/support/rate-limiter.ts`)
12. Health Check (`src/lib/support/health.ts`)
13. Server Actions (`src/server/actions/support.ts`)
14. Webhook Handler (`src/app/api/webhooks/chatwoot/route.ts`)
15. Environment Validation (`src/lib/chatwoot/config.ts`)
16. Frontend Pages
17. Feature Flag
18. Logging (`src/lib/chatwoot/logger.ts`)
19. Permissions (Single Source of Truth)
20. Docker & Networking
21. Notification Flow
22. File Changes (Complete List)
23. PR Breakdown
24. MVP Checklist

---

## 1. Architecture Layers

```
 ┌─────────────────────────────────────────┐
 │           Server Actions                 │
 │  (auth, validation, revalidation,        │
 │   redirects, calls SupportService)       │
 └────────────────┬────────────────────────┘
                  │ calls
                  ▼
 ┌─────────────────────────────────────────┐
 │           SupportService                 │
 │  (business logic, permission checks,     │
 │   contact resolution, error translation) │
 │   Depends only on: SupportRepository     │
 └────────────────┬────────────────────────┘
                  │ calls
                  ▼
 ┌─────────────────────────────────────────┐
 │           SupportRepository              │
 │  (abstracts Chatwoot behind application  │
 │   models — SupportTicket, SupportMessage,│
 │   SupportContact. Normalizes all         │
 │   Chatwoot responses into these types.)  │
 └────────────────┬────────────────────────┘
                  │ calls
                  ▼
 ┌─────────────────────────────────────────┐
 │           ChatwootRepository             │
 │  (pure REST client, no business logic,   │
 │   no permissions, no validation,         │
 │   no application-specific behaviour)     │
 │   Returns: raw Chatwoot payload shapes   │
 └────────────────┬────────────────────────┘
                  │ HTTP
                  ▼
 ┌─────────────────────────────────────────┐
 │          Chatwoot API (self-hosted)      │
 │  http://chatwoot:3000/api/...        │
 └─────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsible For | NOT Responsible For |
|---|---|---|
| **Server Actions** | Auth (`requireCoeUser`), input validation (Zod), calling SupportService, revalidation (`revalidatePath`), redirects, FormData parsing | Business logic, permission checks, Chatwoot API knowledge, response normalization |
| **SupportService** | Contact resolution (`ensureContact`), permission verification, ticket creation flow, error translation (typed errors), rate limiting | Auth, input validation, revalidation, raw HTTP calls, Chatwoot field access (`meta`, `sender`, `custom_attributes`, `payload`, `contact_id`) |
| **SupportRepository** | Normalizing Chatwoot responses → internal types (`SupportTicket`, `SupportMessage`, `SupportContact`). Holds the `ensureContact` implementation. Single layer that understands Chatwoot's response shapes. | Business logic, permission checks, rate limiting, notifications |
| **ChatwootRepository** | HTTP requests to Chatwoot API, retry logic (GET only), structured logging, request correlation IDs. Returns raw `Chatwoot*Response` shapes. | Business logic, permission checks, normalization, notifications, application types |
| **Webhook Handler** | HMAC verification, event/account filtering, calling `SupportRepository` to resolve contacts, creating notifications. Returns 200 OK immediately when `SUPPORT_ENABLED=false`. | Prisma writes (no local state), upsert logic, synchronization, processing when disabled |

---

## 2. Folder Structure

```
src/
├── lib/
│   ├── chatwoot/
│   │   ├── repository.ts      ← ChatwootRepository: pure REST client (thin, no business logic)
│   │   ├── config.ts          ← Environment variable loading + validation
│   │   └── logger.ts          ← Structured request logging with correlation IDs
│   │
│   └── support/
│       ├── SupportService.ts   ← Business logic layer
│       ├── SupportRepository.ts← Normalizes Chatwoot responses → internal types. Implements ensureContact()
│       ├── types.ts            ← Internal types (SupportTicket, SupportMessage, SupportContact)
│       ├── errors.ts           ← Typed error classes
│       ├── constants.ts        ← Chatwoot custom attribute key constants
│       ├── rate-limiter.ts     ← Simple in-memory rate limiter
│       └── health.ts           ← Health check (Chatwoot reachable, token valid, account accessible)
│
├── server/
│   └── actions/
│       └── support.ts          ← Server actions (thin wrappers)
│
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── chatwoot/
│   │           └── route.ts    ← Webhook handler
│   │
│   └── (dashboard)/
│       └── support/
│           ├── layout.tsx      ← Feature flag check
│           ├── page.tsx        ← Redirect to /support/tickets
│           ├── new/
│           │   └── page.tsx    ← Create ticket (Client Component)
│           ├── tickets/
│           │   ├── page.tsx    ← My tickets list (Server Component)
│           │   └── [chatwootId]/
│           │       ├── page.tsx        ← Ticket detail (Server Component)
│           │       └── reply-form.tsx  ← Reply form (Client Component)
│           └── _components/
│               ├── TicketCard.tsx
│               ├── TicketStatusBadge.tsx
│               ├── CategoryIcon.tsx
│               └── EmptyTicketState.tsx
│
├── components/
│   └── layout/
│       ├── Sidebar.tsx          ← MODIFY: add "Support" nav item
│       └── NotificationPanel.tsx ← MODIFY: add TICKET_* icon/color mappings
│
└── hooks/                      ← NO new hooks. Zero. No useQuery, no useMutation.
```

---

## 3. Files: Exports, Responsibilities, Signatures

### 3.1 `src/lib/chatwoot/config.ts`

**Exports:**
```typescript
export function validateChatwootConfig(): void
  // Reads process.env.CHATWOOT_API_URL, CHATWOOT_ACCOUNT_ID,
  //   CHATWOOT_API_TOKEN, CHATWOOT_WEBHOOK_SECRET
  // Throws if any are missing
  // Called once at startup from layout.tsx or instrumentation.ts

export const chatwootConfig: {
  apiUrl: string;
  accountId: string;
  apiToken: string;
  webhookSecret: string;
}
```

**Only place** where environment variables are read. Every other file imports `chatwootConfig`.

### 3.2 `src/lib/chatwoot/logger.ts`

**Exports:**
```typescript
export function logChatwootRequest(method: string, path: string, durationMs: number, status: number, requestId?: string): void
  // Logs using console.log (or structured logging if available)
  // Format: [Chatwoot] GET /contacts 200 12ms req_abc123
  // NEVER logs: API tokens, message contents, attachments, sensitive user data
```

### 3.3 `src/lib/chatwoot/repository.ts`

**Exports:**
```typescript
export const chatwootRepo: ChatwootRepository;

interface ChatwootRepository {
  // Contacts — pure REST wrappers
  // identifier is always user.email (the canonical Chatwoot identifier)
  findContactByIdentifier(identifier: string): Promise<ChatwootContactResponse | null>;
  createContact(identifier: string, name: string, customAttributes: Record<string, string>): Promise<ChatwootContactResponse>;
  getContact(contactId: number): Promise<ChatwootContactResponse>;

  // Conversations
  createConversation(contactId: number, customAttributes: Record<string, string>): Promise<ChatwootConversationResponse>;
  listConversationsByContact(contactId: number): Promise<ChatwootConversationResponse[]>;
  getConversation(conversationId: number): Promise<ChatwootConversationResponse>;

  // Messages
  sendMessage(conversationId: number, content: string, messageType: "incoming" | "outgoing", private: boolean, attachments?: FormData): Promise<ChatwootMessageResponse>;
  getMessages(conversationId: number): Promise<ChatwootMessageResponse[]>;
}
```

**No business logic. No permissions. No validation. No notifications.** Returns raw Chatwoot API response shapes. Every request generates a UUIDv7 correlation ID for tracing.

Internal `request()` helper:
```typescript
async function request<T>(method: string, path: string, body?: unknown, isRetryable?: boolean): Promise<T>
  // Builds URL: ${chatwootConfig.apiUrl}/accounts/${chatwootConfig.accountId}${path}
  //   (API version /api/ is in chatwootConfig.apiUrl; account and path are appended)
  // Sets headers: Content-Type, api_access_token (defined in chatwootConfig.apiToken)
  // Generates requestId UUIDv7 via crypto.randomUUID()
  // Implements timeout: GET → 5s, POST → 15s via AbortSignal.timeout()
  // Implements retry for GET only (3 attempts, 200ms/400ms exponential backoff), 0 retries for POST
  //   Logs retry_count in each attempt
  // Calls logChatwootRequest() before returning with method, path, duration, status, requestId, retryCount
  // Throws ChatwootApiError on non-2xx (includes requestId)
```

### 3.4 `src/lib/support/types.ts`

**Exports:**
```typescript
export interface SupportTicket {
  id: number;
  subject: string;
  description?: string | null;
  status: string;
  priority?: string;
  category: string;
  ownerEmail: string | null;       // Permission check field — populated by SupportRepository during normalization
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  labels: string[];
}

export interface SupportMessage {
  id: number;
  content: string;
  senderName: string;
  senderType: "user" | "admin" | "system";
  createdAt: string;
  attachments: SupportAttachment[];
  isInternal: boolean;
}

export interface SupportAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface SupportContact {
  email: string;
  name: string;
  // Note: Chatwoot contact ID is internal to ChatwootRepository and SupportRepository only.
  // It never appears in this type. SupportService works with email alone.
}

export type TicketCategory = "BUG" | "QUESTION" | "FEATURE_REQUEST" | "SUGGESTION" | "OTHER";
```

**Only these types appear in Server Actions and Components.** Raw Chatwoot response types and Chatwoot contact IDs are never exposed outside `SupportRepository`.

### 3.5 `src/lib/support/errors.ts`

**Exports:**
```typescript
export class SupportError extends Error { constructor(message: string, public code: string) { super(message); this.name = "SupportError"; } }
export class SupportUnavailableError extends SupportError { constructor() { super("Support system is temporarily unavailable. Please try again later.", "SUPPORT_UNAVAILABLE"); } }
export class ConversationNotFoundError extends SupportError { constructor(id: number) { super(`Conversation ${id} was not found.`, "CONVERSATION_NOT_FOUND"); } }
export class UnauthorizedTicketAccessError extends SupportError { constructor() { super("You do not have permission to access this ticket.", "UNAUTHORIZED"); } }
export class ChatwootApiError extends SupportError { constructor(public statusCode: number, message: string, public requestId?: string) { super(message, "CHATWOOT_API_ERROR"); } }
export class SupportDisabledError extends SupportError { constructor() { super("Support is not currently enabled.", "SUPPORT_DISABLED"); } }
export class RateLimitError extends SupportError { constructor(action: string) { super(`Rate limit exceeded for ${action}. Please wait before trying again.`, "RATE_LIMITED"); } }
```

### 3.6 `src/lib/support/SupportService.ts`

**Exports:**
```typescript
export const supportService: SupportService;

interface SupportService {
  // Throws SupportDisabledError if SUPPORT_ENABLED is false, RateLimitError if exceeded

  getMyTickets(user: User): Promise<{ tickets: SupportTicket[] }>;
    // Calls supportRepo.getMyTickets(user.email) — identifier is the canonical lookup
    //   → React cache() ensures only one Chatwoot API call per identifier per request
    // If no contact → return empty array
    // Returns SupportTicket[] (already normalized by SupportRepository)

  getTicketDetail(user: User, conversationId: number): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }>;
    // SINGLE permission check: ticket.ownerEmail === user.email || user.role === "ADMIN"
    // ownerEmail is embedded in every SupportTicket by SupportRepository during normalization.
    // No additional Chatwoot API call is required — the conversation already carries this data.
    // Throws UnauthorizedTicketAccessError if neither
    // Calls supportRepo.getTicket(conversationId)
    // Returns SupportTicket + SupportMessage[] (already normalized)

  createTicket(user: User, input: CreateTicketInput): Promise<{ id: number }>;
    // Calls supportRepo.ensureContact(user.email, user.name, { role, department, uid })
    //   → This is the single reusable helper — finds contact or creates it
    //   → React cache() memoizes the result per request
    // Calls supportRepo.createConversation(user.email, description, category, attachments)
    //   → Contact ID is resolved internally by SupportRepository
    //   → File attachments are forwarded as FormData (multipart/form-data) per Chatwoot v4.14.0 API docs
    // Returns { id: conversation.id }

  replyToTicket(user: User, conversationId: number, input: ReplyTicketInput): Promise<void>;
    // Permission check via getTicketDetail (reuses same logic — single source)
    // Calls supportRepo.sendReply(conversationId, content, messageType, attachments)
}
```

**SupportService never accesses:** `meta`, `sender`, `custom_attributes`, `payload`, `contact_id`, Chatwoot contact IDs, or any Chatwoot-internal field. All normalization is in SupportRepository.

**Permission checks are ONLY inside SupportService.** No other layer checks permissions.

### 3.7 `src/server/actions/support.ts`

**Exports:**
```typescript
export async function createTicket(formData: FormData): Promise<{ ok: boolean; id: number }>
  // 1. requireCoeUser() → auth
  // 2. Zod validate formData
  // 3. supportService.createTicket(user, parsed)
  // 4. createBulkNotifications(admins, TICKET_CREATED)
  // 5. revalidatePath("/support/tickets")
  // 6. Return { ok: true, id }

export async function replyToTicket(conversationId: number, formData: FormData): Promise<{ ok: boolean }>
  // 1. requireCoeUser() → auth
  // 2. Zod validate formData
  // 3. supportService.replyToTicket(user, conversationId, parsed)
  // 4. Look up ticket owner via supportService.getTicketDetail() (reuses permission check)
  //    → notification recipient is the other party: ticket.ownerEmail !== user.email
  // 5. If other party found: createNotification(otherParty.id, TICKET_REPLIED)
  // 6. revalidatePath(`/support/${conversationId}`)
  // 7. Return { ok: true }
```

`getMyTickets()` and `getTicketDetail()` are NOT server actions — they are called directly from Server Components during SSR. They live inside SupportService and are imported by the page components.

### 3.8 `src/app/api/webhooks/chatwoot/route.ts`

**Exports:**
```typescript
export async function POST(req: NextRequest): Promise<NextResponse>
  // 0. If SUPPORT_ENABLED is false, return 200 OK immediately — no processing
  // 1. Verify HMAC-SHA256 signature
  // 2. Parse JSON body
  // 3. Verify event === "message.created" → else 200 OK (ignore unsupported events)
  // 4. Verify message_type !== "incoming" (ignore user messages)
  // 5. Verify conversation.contact_id exists
  // 6. Verify account_id matches chatwootConfig.accountId
  // 7. Call supportRepo.getContactEmail(contact_id) to get owner email
  // 8. If email found: prisma.user.findUnique({ where: { email } }) → createNotification(user, TICKET_REPLIED)
  // 9. Return 200 OK (always — Chatwoot retries on non-200)
```

**Idempotent:** Chatwoot v4.14.0 does not provide webhook-level dedup identifiers (no event ID). HMAC verification is the only available replay protection. Duplicate delivery creates duplicate notifications — this is acceptable because the user sees a duplicate notification and clicks it once. If dedup becomes necessary, check `Notification.createdAt` within 5 minutes for same type+link.

### 3.9 Frontend Pages

**`src/app/(dashboard)/support/layout.tsx`**
```typescript
// Server Component
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  if (!SUPPORT_ENABLED) notFound();
  return <div>{children}</div>;
}
```

**`src/app/(dashboard)/support/page.tsx`**
```typescript
// Server Component
export default function SupportPage() {
  redirect("/support/tickets");
}
```

**`src/app/(dashboard)/support/tickets/page.tsx`**
```typescript
// Server Component
import { supportService } from "@/lib/support/SupportService";
import { requireCoeUser } from "@/lib/coe-guard";

export default async function MyTicketsPage() {
  const user = await requireCoeUser();
  const { tickets } = await supportService.getMyTickets(user);

  if (tickets.length === 0) {
    return <EmptyTicketState />;
  }

  return (
    <div className="space-y-2">
      {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
    </div>
  );
}
```

**`src/app/(dashboard)/support/new/page.tsx`**
```typescript
// Client Component
"use client";
// Form fields: category (select), subject (input), description (textarea), file input with multiple
// On submit:
//   1. Build FormData with text fields and attachments[] (file bytes)
//   2. Call createTicket() server action
//   3. On success: router.push("/support/tickets")
//   4. On error: show error toast
// Upload behaviour: native Chatwoot multipart/form-data, no MinIO
// See Attachment Handling (Section 16) for validation limits and UX states
```

**`src/app/(dashboard)/support/tickets/[chatwootId]/page.tsx`**
```typescript
// Server Component
import { supportService } from "@/lib/support/SupportService";
import { requireCoeUser } from "@/lib/coe-guard";

export default async function TicketDetailPage({ params }: { params: { chatwootId: string } }) {
  const user = await requireCoeUser();
  const chatwootId = parseInt(params.chatwootId);
  const { ticket, messages } = await supportService.getTicketDetail(user, chatwootId);

  return (
    <div>
      <TicketHeader ticket={ticket} />
      <MessageThread messages={messages} />
      <ReplyForm chatwootId={chatwootId} />
    </div>
  );
}
```

**`src/app/(dashboard)/support/tickets/[chatwootId]/reply-form.tsx`**
```typescript
// Client Component
"use client";
// Textarea + file input (multiple) + submit button
// On submit:
//   1. Build FormData with content + attachments[] (file bytes)
//   2. Call replyToTicket(chatwootId, formData) server action
//   3. On success: router.refresh() to show new message in thread
//   4. On error: show error toast
// Files go directly to Chatwoot via multipart/form-data — no MinIO
```

---

## 4. Database Changes

### Prisma Schema

**No new tables.** Zero additions to the platform's MySQL database.

**Enum changes in `prisma/schema.prisma`:**

```prisma
// Add 2 values to the existing NotificationType enum
enum NotificationType {
  // ... existing 12 values ...
  TICKET_CREATED
  TICKET_REPLIED
}
```

**Only change to the entire database:** two new enum values. No migration needs to run for the support feature beyond `prisma migrate dev` for these enum additions.

---

## 5. ChatwootRepository (`src/lib/chatwoot/repository.ts`)

Pure REST client. No business logic, no normalization, no permissions. Returns raw Chatwoot response payloads.

Every request generates a UUIDv7 correlation ID for tracing across logs, webhooks, and API calls.

### Centralized API Version

The API version `/api/` is part of `CHATWOOT_API_URL`. The version path is a single constant:

```typescript
const API_VERSION = "";  // Chatwoot v4.14.0 uses /api/v1/ — the /api prefix is in CHATWOOT_API_URL
// Full URL: ${chatwootConfig.apiUrl}/accounts/${chatwootConfig.accountId}${path}
// Example: http://chatwoot:3000/api/accounts/1/contacts
```

### Timeout Policies

| Method | Timeout | Reason |
|---|---|---|
| `GET` | 5 seconds | Reads should be fast |
| `POST` (normal) | 15 seconds | Write operations may take longer |
| `POST` (attachment upload) | 60 seconds (or `CHATWOOT_UPLOAD_TIMEOUT_MS` env var) | File uploads legitimately take longer than normal API requests |

### Retry Strategy

| Method | Retries | Backoff | Reason |
|---|---|---|---|
| `GET` requests | 3 attempts | 200ms, 400ms (exponential) | Idempotent |
| `POST` requests | 0 retries | N/A | Would create duplicate resources |
| `404` responses | 0 retries | N/A | Resource doesn't exist |
| Network errors | 3 attempts (GET only) | 200ms, 400ms | Transient — DNS/connection may recover |

### UUIDv7 Request IDs

```typescript
import { randomUUID } from "crypto";
// Uses crypto.randomUUID() which returns UUIDv7 in Node.js 24+
// Falls back to UUIDv4 in older versions — still unique.
```

### Chatwoot Contact Identifier

Contacts are created with `identifier` set to `user.email`. After creation, all lookups use `findContactByIdentifier(identifier)`. Email search is only used for migration/debug scenarios — never in normal application flow.

```typescript
import { chatwootConfig } from "./config";
import { logChatwootRequest } from "./logger";
import { ChatwootApiError } from "../support/errors";
import { randomUUID } from "crypto";

// Centralized API path builder: version is in config.apiUrl, path starts with /accounts/
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
          ? { api_access_token: chatwootConfig.apiToken }  // Let fetch set Content-Type with boundary
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
      if (err instanceof ChatwootApiError) throw err; // Already wrapped
      if (!isRetryable || n >= 3) {
        throw new ChatwootApiError(0, `Request failed: ${(err as Error)?.message ?? "Unknown"}`, requestId);
      }
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, n)));
      return attempt(n + 1);
    }
  };

  return attempt(0);
}

// ─── Types: Raw Chatwoot response shapes (internal to this file only) ──────

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
  // Primary lookup: by identifier (user.email). This is the canonical Chatwoot contact identifier.
  findContactByIdentifier(identifier: string) {
    return request<{ payload: ChatwootContactResponse[] }>(
      "GET",
      `/contacts?identifier=${encodeURIComponent(identifier)}`,
      undefined,
      true,
    ).then((r) => r.payload?.[0] ?? null);
  },

  // email-only search for migration/debug — not used in normal application flow
  findContactByEmailForMigration(email: string) {
    return request<{ payload: ChatwootContactResponse[] }>(
      "GET", `/contacts?q=${encodeURIComponent(email)}`, undefined, true,
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
    return request<ChatwootConversationResponse>(
      "POST", `/contacts/${contactId}/conversations`, { custom_attributes: customAttributes },
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
  // Text-only messages use JSON POST. Messages with file attachments use
  // multipart/form-data as specified in the official Chatwoot v4.14.0 API docs:
  //   POST /api/v1/accounts/{account_id}/conversations/{id}/messages
  //   Content-Type: multipart/form-data
  //   Fields: content, message_type, private, attachments[] (file bytes)
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
      // Attachments must be added to the FormData before calling sendMessage
      // The FormData should contain: content, message_type, private, attachments[]
      return request<ChatwootMessageResponse>(
        "POST",
        `/conversations/${conversationId}/messages`,
        attachments,
        false,   // POST — never retry
        timeoutMs,
      );
    }

    // Text-only message: JSON request body
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
```
---

## 6. SupportRepository (`src/lib/support/SupportRepository.ts`)

Normalizes all Chatwoot responses into application models (`SupportTicket`, `SupportMessage`, `SupportContact`). Implements `ensureContact()` with request-scoped memoization. This is the **only layer** that accesses Chatwoot payload fields like `meta`, `sender`, `custom_attributes`, `payload`, `contact_id` or Chatwoot contact IDs.

SupportService never accesses these fields directly.

### Internal Organization

SupportRepository is organized into clear sections:
1. **Contact operations** — `ensureContact`, `findContactByIdentifier`, `getContact`
2. **Conversation operations** — `getMyTickets`, `getTicket`, `createConversation`
3. **Message operations** — `sendReply`
4. **Normalization helpers** — `normalizeTicket`, `normalizeMessage`
5. **Error translation** — `translateError`

### Request-Scoped Memoization

`ensureContact()` uses React's `cache()` function to memoize contact resolution within the same request. This ensures that calling `ensureContact` with the same identifier multiple times within one Server Component render or server action execution results in only one Chatwoot API call.

The contact ID is managed internally by SupportRepository. SupportService never sees it.

```typescript
import { cache } from "react";
import { chatwootRepo, type ChatwootConversationResponse, type ChatwootMessageResponse } from "@/lib/chatwoot/repository";
import type { SupportTicket, SupportMessage, SupportContact } from "./types";
import {
  SupportUnavailableError,
  ConversationNotFoundError,
  ChatwootApiError,
} from "./errors";
import { CW_ATTR } from "./constants";

// ── Contact resolution helpers (internal — Chatwoot contact IDs never leave this module) ──

const resolveContact = cache(async (identifier: string, name?: string, customAttributes?: Record<string, string>): Promise<number> => {
  // Primary lookup uses the canonical Chatwoot identifier
  let cw = await chatwootRepo.findContactByIdentifier(identifier);
  if (!cw) {
    // Fallback: use email search for migration compatibility
    cw = await chatwootRepo.findContactByEmailForMigration(identifier);
  }
  if (!cw && name) {
    cw = await chatwootRepo.createContact(identifier, name, customAttributes ?? {});
  }
  if (!cw) throw new ConversationNotFoundError(0);
  return cw.id;  // Contact ID is internal — only used within this module
});

const lookupContact = cache(async (identifier: string): Promise<number | null> => {
  const cw = await chatwootRepo.findContactByIdentifier(identifier);
  return cw?.id ?? null;
});

export const supportRepo = {
  // ── Contact operations ─────────────────────────────────────────────────
  // Email is the canonical identifier. After initial creation, every lookup
  // uses findContactByIdentifier(). Email search is only for migration/debug.
  // React's cache() ensures only one Chatwoot API call per identifier per request.

  async ensureContact(identifier: string, name: string, customAttributes?: Record<string, string>): Promise<void> {
    await resolveContact(identifier, name, customAttributes);
    // The Chatwoot contact ID is managed internally. Callers don't need it.
    // Subsequent operations within this module that need the ID use resolveContact()
    // internally, which returns the cached result.
  },

  async findContactByIdentifier(identifier: string): Promise<boolean> {
    const id = await lookupContact(identifier);
    return id !== null;
  },

  // Used only by the webhook handler (no email available, only contact ID)
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

  // Returns the ticket with ownerEmail embedded — no extra API call needed for permission checks.
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

    // Send the initial message — text-only if no attachments, FormData if files
    if (attachments) {
      // Attachments should include: content, message_type, private, attachments[]
      // The FormData is built by the caller (typically the frontend) and
      // forwarded through the layers
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

// ── Normalization (Chatwoot payload shapes → application models) ─────────
// This is the ONLY place where Chatwoot field names like meta.sender, custom_attributes, etc. are accessed.

function normalizeTicket(cw: ChatwootConversationResponse): SupportTicket {
  // Extract the owner's email from the conversation's meta.sender to avoid an extra API call.
  // Chatwoot includes the sender (contact) information in the conversation response.
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
```

## 6b. SupportService (`src/lib/support/SupportService.ts`)

Business logic layer. Calls `supportRepo`. Never accesses `meta`, `sender`, `custom_attributes`, `payload`, `contact_id`, or any Chatwoot contact ID — those are implementation details hidden by SupportRepository.

SupportService works only with application-level concepts: email addresses, conversation IDs, tickets, messages.

The **only permission check** is here, in `getTicketDetail`, using `ticket.ownerEmail` (embedded by SupportRepository during normalization). No extra API call is needed.

```typescript
import { supportRepo } from "./SupportRepository";
import { checkRateLimit } from "./rate-limiter";
import {
  SupportDisabledError,
  UnauthorizedTicketAccessError,
} from "./errors";
import type { SupportTicket, SupportMessage, TicketCategory } from "./types";

const SUPPORT_ENABLED = () => process.env.SUPPORT_ENABLED === "true";

export const supportService = {
  async getMyTickets(user: { email: string }): Promise<{ tickets: SupportTicket[] }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();

    // The repository resolves the contact ID internally from the identifier.
    // SupportService never sees the Chatwoot contact ID.
    const tickets = await supportRepo.getMyTickets(user.email);
    return { tickets };
  },

  // ── Permission check: single source of truth ──────────────────────────
  // Uses ticket.ownerEmail (embedded by SupportRepository during normalization).
  // No additional Chatwoot API call is required — the conversation already carries
  // the sender information that contains the contact's email.
  async getTicketDetail(
    user: { email: string; role: string },
    conversationId: number,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();

    const { ticket, messages } = await supportRepo.getTicket(conversationId);

    // Permission check: ownerEmail is already on the ticket — no extra API call
    const isOwner = ticket.ownerEmail === user.email;
    const isAdmin = user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new UnauthorizedTicketAccessError();
    }

    return { ticket, messages };
  },

  async createTicket(
    user: { email: string; name: string; role: string; department?: string; uid?: string },
    input: { subject: string; description: string; category: TicketCategory; attachments?: FormData },
  ): Promise<{ id: number }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();
    checkRateLimit("createTicket", user.email);

    // ensureContact uses React cache() for request-scoped memoization.
    // The Chatwoot contact ID is resolved internally by SupportRepository.
    await supportRepo.ensureContact(user.email, user.name, {
      role: user.role,
      department: user.department ?? "",
      uid: user.uid ?? "",
    });

    const result = await supportRepo.createConversation(user.email, input.description, input.category, input.attachments);
    return { id: result.id };
  },

  async replyToTicket(
    user: { email: string; role: string },
    conversationId: number,
    input: { content: string; attachments?: FormData },
  ): Promise<void> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();
    checkRateLimit("replyToTicket", user.email);

    // Permission check reuses getTicketDetail
    const { ticket } = await this.getTicketDetail(user, conversationId);

    const messageType = user.role === "ADMIN" ? "outgoing" : "incoming";
    await supportRepo.sendReply(conversationId, input.content, messageType, input.attachments);
  },
};
```

---

## 7. Types (`src/lib/support/types.ts`)

```typescript
export interface SupportTicket {
  id: number;
  subject: string;
  description?: string | null;
  status: string;
  priority?: string;
  category: string;
  ownerEmail: string | null;       // Embedded by SupportRepository during normalization.
                                    // Used for permission checks — no extra API call needed.
                                    // Chatwoot's conversation response includes the sender's email
                                    // in meta.sender, which SupportRepository extracts here.
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  labels: string[];
}

export interface SupportMessage {
  id: number;
  content: string;
  senderName: string;
  senderType: "user" | "admin" | "system";
  createdAt: string;
  attachments: SupportAttachment[];
  isInternal: boolean;
}

export interface SupportAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface SupportContact {
  email: string;
  name: string;
  // Chatwoot contact ID is intentionally absent — it's an implementation detail
  // known only to ChatwootRepository and SupportRepository.
}

export type TicketCategory = "BUG" | "QUESTION" | "FEATURE_REQUEST" | "SUGGESTION" | "OTHER";
```

**Note:** `ownerEmail` is extracted from `meta.sender.email` by `SupportRepository.normalizeTicket()`. This avoids the need for an extra `getContact()` API call during permission checks. The permission check in `SupportService.getTicketDetail()` is simply `ticket.ownerEmail === user.email` — no Chatwoot API call required.

---

## 8. Errors (`src/lib/support/errors.ts`)

```typescript
export class SupportError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SupportError";
  }
}

export class SupportUnavailableError extends SupportError {
  constructor() {
    super("Support system is temporarily unavailable. Please try again later.", "SUPPORT_UNAVAILABLE");
    this.name = "SupportUnavailableError";
  }
}

export class ConversationNotFoundError extends SupportError {
  constructor(id: number) {
    super(`Conversation ${id} was not found.`, "CONVERSATION_NOT_FOUND");
    this.name = "ConversationNotFoundError";
  }
}

export class UnauthorizedTicketAccessError extends SupportError {
  constructor() {
    super("You do not have permission to access this ticket.", "UNAUTHORIZED");
    this.name = "UnauthorizedTicketAccessError";
  }
}

export class ChatwootApiError extends SupportError {
  constructor(public statusCode: number, message: string, public requestId?: string) {
    super(message, "CHATWOOT_API_ERROR");
    this.name = "ChatwootApiError";
  }
}

export class SupportDisabledError extends SupportError {
  constructor() {
    super("Support is not currently enabled.", "SUPPORT_DISABLED");
    this.name = "SupportDisabledError";
  }
}

export class RateLimitError extends SupportError {
  constructor(action: string) {
    super(`Rate limit exceeded for ${action}. Please wait before trying again.`, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}
```

---

## 9. Server Actions (`src/server/actions/support.ts`)

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCoeUser } from "@/lib/coe-guard";
import { supportService } from "@/lib/support/SupportService";
import { createNotification, createBulkNotifications } from "@/lib/notifications";
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

// ─── Create Ticket ─────────────────────────────────────────────────────────
// File attachments are uploaded directly to Chatwoot via multipart/form-data.
// The frontend constructs a FormData with text fields and attaches[] containing
// the raw file bytes. This FormData is forwarded through the layer stack to
// ChatwootRepository, which sends it to Chatwoot's Message API.
// No intermediate storage (MinIO or otherwise) is used for support attachments.

export async function createTicket(formData: FormData) {
  const user = await requireCoeUser();

  const parsed = createTicketSchema.parse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category"),
  });

  // Extract file attachments from the client-provided FormData
  // The frontend should append files under the "attachments" field
  const hasFiles = formData.has("attachments");

  const result = await supportService.createTicket(user, {
    subject: parsed.subject,
    description: parsed.description,
    category: parsed.category,
    attachments: hasFiles ? formData : undefined,
  });

  // Notify all active admins
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
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
  }

  revalidatePath("/support/tickets");
  return { ok: true, id: result.id };
}

// ─── Reply to Ticket ───────────────────────────────────────────────────────
// Notifications are sent directly from this server action for platform-originated replies.
// The webhook handles the separate case of replies made inside Chatwoot's native UI.
// The two paths are mutually exclusive by origin — no duplicate notifications.
//
// The recipient is determined by ticket.ownerEmail (embedded by SupportRepository
// during normalization) — no extra Chatwoot API call is needed.

export async function replyToTicket(chatwootId: number, formData: FormData) {
  const user = await requireCoeUser();

  const parsed = replySchema.parse({
    content: formData.get("content"),
  });

  const hasFiles = formData.has("attachments");

  await supportService.replyToTicket(user, chatwootId, {
    content: parsed.content,
    attachments: hasFiles ? formData : undefined,
  });

  // Notify the other party using ticket.ownerEmail (no extra API call)
  // The ownerEmail is already on the ticket from normalization.
  const { ticket } = await supportService.getTicketDetail(user, chatwootId);
  if (ticket.ownerEmail && ticket.ownerEmail !== user.email) {
    const platformUser = await prisma.user.findUnique({
      where: { email: ticket.ownerEmail },
      select: { id: true },
    });
    if (platformUser) {
      await createNotification(platformUser.id, {
        type: "TICKET_REPLIED",
        title: "New reply on your ticket",
        message: `${user.name} replied on "${ticket.subject}"`,
        link: `/support/tickets/${chatwootId}`,
      });
    }
  }

  revalidatePath(`/support/tickets/${chatwootId}`);
  return { ok: true };
}
```

---

## 10. Webhook Handler (`src/app/api/webhooks/chatwoot/route.ts`)

Single webhook subscription: `message.created`. Only creates notifications for admin replies.

**When `SUPPORT_ENABLED=false`:** Returns `200 OK` immediately without HMAC verification, payload parsing, or any processing. Chatwoot's retry mechanism will re-deliver once the feature is re-enabled.

**Idempotent:** Chatwoot v4.14.0 does not provide webhook-level dedup identifiers (no event ID). HMAC verification is the only available replay protection. Duplicate delivery creates duplicate notifications — this is acceptable because the user sees a duplicate notification and clicks it once. If dedup becomes necessary, check `Notification.createdAt` within 5 minutes for same type+link.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { SUPPORT_ENABLED } from "@/lib/support/feature-flag";
import { chatwootConfig } from "@/lib/chatwoot/config";
import { supportRepo } from "@/lib/support/SupportRepository";

async function verifyHmac(payload: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(chatwootConfig.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, hexToBytes(signatureHeader), encoder.encode(payload));
}

export async function POST(req: NextRequest) {
  // Fast path: if support is disabled, return 200 and do no work
  if (!SUPPORT_ENABLED) {
    return NextResponse.json({ ok: true });
  }

  // 1. Verify HMAC
  const body = await req.text();
  const signature = req.headers.get("x-chatwoot-signature");
  if (!(await verifyHmac(body, signature))) {
    console.warn("[Chatwoot Webhook] Invalid HMAC signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse event
  const payload = JSON.parse(body);

  // 3. Verify the event comes from our account
  if (String(payload.account?.id) !== chatwootConfig.accountId) {
    console.warn("[Chatwoot Webhook] Event from unknown account:", payload.account?.id);
    return NextResponse.json({ ok: true });
  }

  // 4. We only handle admin replies (message.created, outgoing)
  if (payload.event !== "message.created") return NextResponse.json({ ok: true });
  if (payload.message_type === "incoming") return NextResponse.json({ ok: true });
  if (!payload.conversation?.contact_id) return NextResponse.json({ ok: true });

  // 5. Look up the contact by ID to get their email, then find the platform user
  // Note: Chatwoot v4.14.0 does not provide webhook-level dedup identifiers (no event ID).
  // HMAC verification is the only available replay protection. Webhook handlers are
  // idempotent by design — duplicate delivery creates duplicate notifications (acceptable).
  try {
    const contactEmail = await supportRepo.getContactEmail(payload.conversation.contact_id);
    if (!contactEmail) return NextResponse.json({ ok: true });

    const platformUser = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: { id: true },
    });
    if (!platformUser) return NextResponse.json({ ok: true });

    await createNotification(platformUser.id, {
      type: "TICKET_REPLIED",
      title: "New reply on your ticket",
      message: payload.content?.text ?? "An admin replied to your ticket.",
      link: `/support/tickets/${payload.conversation.id}`,
    });
  } catch (err) {
    console.error("[Chatwoot Webhook] Error processing message:", err);
    // Still return 200 — Chatwoot will retry on non-200
  }

  return NextResponse.json({ ok: true });
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}
```

---

## 11. Environment Validation (`src/lib/chatwoot/config.ts`)

```typescript
export const chatwootConfig = {
  apiUrl: process.env.CHATWOOT_API_URL ?? "",
  accountId: process.env.CHATWOOT_ACCOUNT_ID ?? "",
  apiToken: process.env.CHATWOOT_API_TOKEN ?? "",
  webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET ?? "",
};

export function validateChatwootConfig(): void {
  const missing: string[] = [];
  if (!chatwootConfig.apiUrl) missing.push("CHATWOOT_API_URL");
  if (!chatwootConfig.accountId) missing.push("CHATWOOT_ACCOUNT_ID");
  if (!chatwootConfig.apiToken) missing.push("CHATWOOT_API_TOKEN");
  if (!chatwootConfig.webhookSecret) missing.push("CHATWOOT_WEBHOOK_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Chatwoot configuration is incomplete. Missing: ${missing.join(", ")}\n` +
      "The support feature cannot start without these environment variables.",
    );
  }
}
```

**Called from `src/app/(dashboard)/support/layout.tsx`:**

```typescript
import { validateChatwootConfig } from "@/lib/chatwoot/config";
import { SUPPORT_ENABLED } from "@/lib/support/feature-flag";

if (SUPPORT_ENABLED) {
  validateChatwootConfig();
}
```

---

## 12. Feature Flag

**File:** `src/lib/support/feature-flag.ts`
```typescript
export const SUPPORT_ENABLED = process.env.SUPPORT_ENABLED === "true";
```

**Applied in:**

| Location | Behaviour |
|---|---|
| `support/layout.tsx` | `if (!SUPPORT_ENABLED) notFound()` — routes return 404 |
| `SupportService.ts` | Every method throws `SupportDisabledError` if disabled |
| `Sidebar.tsx` | Support nav item hidden if disabled |
| `webhooks/chatwoot/route.ts` | Returns `200 OK` immediately at the top of the handler — no HMAC verification, no payload parsing, no event processing. Chatwoot retry mechanism will re-deliver when re-enabled. |

---

## 13. Logging (`src/lib/chatwoot/logger.ts`)

```typescript
export function logChatwootRequest(
  method: string,
  path: string,
  durationMs: number,
  status: number,
  requestId?: string,
  retryCount?: number,
): void {
  const id = requestId ? ` [${requestId}]` : "";
  const retry = retryCount !== undefined && retryCount > 0 ? ` (attempt ${retryCount + 1})` : "";
  console.log(`[Chatwoot]${id} ${method} ${path} → ${status} (${durationMs}ms)${retry}`);
}
```

Called by the `request()` helper in ChatwootRepository. Each request generates a UUIDv7 via `crypto.randomUUID()` that is logged with every request and propagated through the `ChatwootApiError.requestId` field.

**Logged:** request ID, method, path, duration, status, retry count  
**Never logged:** API tokens, message contents, file contents, user emails, user names, custom attribute values, request bodies, response bodies.

### Example log lines

```
[Chatwoot] [550e8400-e29b-41d4-a716-446655440000] GET /contacts?identifier=user@example.com → 200 (3ms)
[Chatwoot] [550e8400-e29b-41d4-a716-446655440001] POST /contacts/42/conversations → 200 (15ms)
[Chatwoot] [550e8400-e29b-41d4-a716-446655440002] GET /conversations/99 (attempt 2) → timeout
```

---

## 14. Permissions (Single Source of Truth)

**All permission logic lives in exactly one place:** `SupportService.getTicketDetail()`.

The permission check uses `ticket.ownerEmail` (embedded in every `SupportTicket` by `SupportRepository` during normalization). This requires **zero extra Chatwoot API calls** — the conversation response already includes `meta.sender.email`, which SupportRepository extracts as `ownerEmail`.

```typescript
// In SupportService.getTicketDetail():
const isOwner = ticket.ownerEmail === user.email;
const isAdmin = user.role === "ADMIN";

if (!isOwner && !isAdmin) {
  throw new UnauthorizedTicketAccessError();
}
```

`replyToTicket()` reuses `getTicketDetail()` for permission checks — it does not reimplement them.

**No permission duplication anywhere:**
- `ChatwootRepository`: ❌ Has zero permission checks
- `SupportRepository`: ❌ Has zero permission checks — only normalizes data and exposes `ownerEmail`
- Server Actions: ❌ Call `requireCoeUser()` for authentication only, not for ticket-specific permissions
- Components: ❌ Cannot access ticket data without going through SupportService
- SupportService: ✅ Single implementation, zero extra API calls for the permission check

---

## 15. Retry Strategy

Implemented in the `request()` helper inside `chatwoot/repository.ts`:

| Method | Retries | Backoff | Reason |
|---|---|---|---|
| `GET` requests | 3 attempts | 200ms, 400ms (exponential) | Idempotent — safe to retry |
| `POST` requests | 0 retries | N/A | Would create duplicate resources |
| `404` responses | 0 retries | N/A | Resource doesn't exist — retrying won't help |
| Network errors | 3 attempts (GET only) | 200ms, 400ms | Transient — DNS/connection may recover |

---

## 16. Docker & Networking

### Internal Communication (Docker network)

```
Next.js → Chatwoot:  http://chatwoot:3000/api/...
                      (Docker internal DNS, no TLS, <2ms)
                      CHATWOOT_API_URL=http://chatwoot:3000/api
```

All API calls from Next.js to Chatwoot use Docker internal DNS. No Cloudflare Tunnel involved. No TLS overhead.

### External Access (Cloudflare Tunnel)

| Route | Purpose | Destination |
|---|---|---|
| `dashboard.coe.example.com` | Platform UI + API | Next.js container → `nextjs:3000` |
| `support.coe.example.com` | Chatwoot admin UI | Chatwoot container → `chatwoot:3000` |

### Private Services (no external route)

- MySQL — only accessible by `nextjs_app`
- PostgreSQL — only accessible by `chatwoot_app`
- Redis — only accessible by `chatwoot_app`, `chatwoot_sidekiq`
- MinIO — only accessible by `nextjs_app`

### Pinned Chatwoot Version

```
Deployed version: v4.14.0
Docker image:     chatwoot/chatwoot:v4.14.0 (pinned in docker-compose.chatwoot.yml)
```

Every API assumption in this guide has been validated against Chatwoot `v4.14.0`. Upgrading to a newer version requires explicit verification in staging before production deployment.

### Webhook URL (configured in Chatwoot admin)

```
https://dashboard.coe.example.com/api/webhooks/chatwoot
```

Chatwoot reaches this through Cloudflare Tunnel → Next.js. The route is whitelisted in middleware (no JWT required, authenticated by webhook secret).

### Attachment Handling (Official Chatwoot v4.14.0 API — MVP)

The official Chatwoot API supports file attachments via **`multipart/form-data`** on the `POST /api/v1/accounts/{id}/conversations/{id}/messages` endpoint.

Support attachments are **only stored inside Chatwoot**. No intermediate storage (MinIO, S3, or otherwise) is introduced. The existing MinIO-based upload system continues to serve non-support files (project documents, showcase assets, etc.) — only the Support module uses Chatwoot's native upload.

#### FormData Structure

```
Content-Type: multipart/form-data; boundary=----...

Fields:
  content:       string (message text — can be empty if only attachments)
  message_type:  "incoming" | "outgoing"
  private:       "true" | "false"
  attachments[]: file bytes (one field per file, appended individually)
```

#### Complete Request Flow

```
Frontend (react-dropzone + file input)
  │ User selects 1+ files
  │ Frontend builds FormData:
  │   formData.append("content", messageText);
  │   formData.append("message_type", "incoming");
  │   formData.append("private", "false");
  │   for each file: formData.append("attachments[]", file);
  ▼
Server Action (createTicket / replyToTicket)
  │ Receives FormData from frontend
  │ Validates text fields via Zod
  │ Detects attachments: formData.has("attachments")
  ▼
SupportService
  │ Business logic only (permission, rate limiting)
  ▼
SupportRepository
  │ Resolves contact ID from identifier
  │ Resolves conversation ID
  │ Sets content, message_type, private on FormData
  ▼
ChatwootRepository.sendMessage()
  │ Sends as multipart/form-data (no Content-Type: application/json)
  │ fetch sets correct multipart boundary automatically
  ▼
Chatwoot Message API
  │ POST /api/v1/accounts/{id}/conversations/{id}/messages
  │ Chatwoot stores file in its PostgreSQL/object storage
```

#### Upload Validation

All validation occurs in the server action before forwarding to SupportService. Rejected uploads return a Zod validation error before any Chatwoot API call is made.

| Constraint | Value | Location |
|---|---|---|
| Max file count | 10 per message | Server action: Zod array check |
| Max file size | 25 MB per file | Server action: iterate FormData files |
| Supported MIME types | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown`, `application/zip`, `application/x-zip-compressed`, `application/vnd.openxmlformats-officedocument.*`, `application/msword`, `application/vnd.ms-excel` | Server action: MIME type whitelist |
| Blocked types | `application/x-msdownload` (.exe), `application/x-bat` (.bat), `text/x-shellscript` (.sh), `application/javascript` (.js), `application/x-vbscript` (.vbs) | Server action: explicit deny list |
| Empty file check | File size must be > 0 bytes | Server action |
| Filename sanitization | Strip path separators, control characters, limit to 255 chars | Server action |

#### Upload UX (Frontend)

| State | Behaviour |
|---|---|
| **File selected** | Show file name, size, type in a pill/badge below the textarea |
| **Uploading** | Show progress indicator per file (spinner or progress bar) |
| **Submit button** | Disabled while uploading; enabled when all files ready and text valid |
| **Upload failure** | Show inline error per file ("File too large", "Unsupported type", "Upload failed") with a retry button |
| **Remove file** | User can remove individual files before submitting |
| **Success** | Form clears; redirect to ticket detail |
| **Multiple files** | User can select multiple files simultaneously via `input[multiple]` |

#### Attachment Rendering

After submission, attachments are returned by Chatwoot's message response and normalized by `SupportRepository.normalizeMessage()` into `SupportAttachment` objects:

```typescript
interface SupportAttachment {
  id: number;
  fileName: string;    // From Chatwoot response field file_name
  fileUrl: string;     // From Chatwoot response field file_url
  fileType: string;    // MIME type from Chatwoot
  fileSize?: number;   // Size in bytes from Chatwoot
}
```

The UI renders these using the normalized `SupportAttachment` type — never raw Chatwoot payloads. Supported rendering:
- **Images** (png, jpg, gif, webp): Inline thumbnail with lightbox on click
- **PDFs**: Link with PDF icon + file name
- **Documents**: Link with document icon + file name
- **Archives**: Link with archive icon + file name

---

## 17. Notification Flow

There are exactly **two notification paths**, each responsible for a distinct origin. They are mutually exclusive by design.

### Path A: User creates a ticket → notify all admins

```
User fills form → createTicket() server action
  → supportService.createTicket() → Chatwoot API (creates contact + conversation + message)
  → Server action calls createBulkNotifications(all active admins, TICKET_CREATED)
  → Admin clicks notification → /support/tickets/{id}
```

Generated by: Server action `createTicket()`  
Recipient: All active ADMIN users  
Why no duplicate: Only one path can create a ticket — the platform. Webhooks don't fire on ticket creation.

### Path B: Any reply → notify the other party

**Origin 1 — Reply from within the platform (admin or user):**
```
replyToTicket() server action
  → supportService.replyToTicket() → Chatwoot API
  → Server action reads ticket.ownerEmail (no extra API call)
  → If ownerEmail !== replier.email:
      createNotification(platformUserId, TICKET_REPLIED)
  → Recipient clicks notification → /support/tickets/{id}
```

**Origin 2 — Reply from within Chatwoot's native UI (admin only):**
```
Chatwoot → POST /api/webhooks/chatwoot
  → HMAC verification → event/account filtering
  → supportRepo.getContactEmail(contact_id) → returns email
  → prisma.user.findUnique({ where: { email: contactEmail } })
  → createNotification(platformUserId, TICKET_REPLIED)
  → User clicks notification → /support/tickets/{id}
```

### Why these do not produce duplicate notifications

- Platform-originated replies use the Chatwoot API token, not a user session. Chatwoot does not emit `message.created` webhooks for API-token-created messages (confirmed Chatwoot v4.14.0 behaviour on the pinned version).
- Webhook-originated replies only fire for messages created inside Chatwoot's native UI by an agent.
- The two origins are mutually exclusive. There is exactly one notification per reply.

### Future-Proofing: Chatwoot Version Upgrades

Platform-originated replies must never generate duplicate notifications. If a future Chatwoot version begins emitting webhooks for replies created through the API, the implementation must:

1. Remove the direct server-action notification from `replyToTicket()`
2. Rely exclusively on the webhook handler for all reply notifications

This ensures forward compatibility and prevents duplicate notification bugs when upgrading Chatwoot.

---

## 18. File Changes (Complete List)

### NEW FILES

```
docker-compose.chatwoot.yml                        ~40 lines

src/lib/chatwoot/
├── config.ts                                       ~15 lines
├── logger.ts                                       ~12 lines
└── repository.ts                                   ~100 lines  ← Pure REST client, no business logic

src/lib/support/
├── SupportService.ts                               ~80 lines   ← Business logic only
├── SupportRepository.ts                            ~120 lines  ← Normalization + ensureContact
├── types.ts                                        ~30 lines   ← Application models only
├── errors.ts                                       ~40 lines   ← Typed error classes
├── constants.ts                                    ~10 lines   ← Custom attribute keys
├── rate-limiter.ts                                 ~30 lines   ← In-memory rate limiter
├── health.ts                                       ~40 lines   ← Health check
└── feature-flag.ts                                 ~3 lines    ← SUPPORT_ENABLED

src/server/actions/
└── support.ts                                      ~90 lines   ← Auth + validation + revalidation

src/app/api/webhooks/chatwoot/
└── route.ts                                        ~80 lines   ← Webhook handler

src/app/(dashboard)/support/
├── layout.tsx                                      ~8 lines
├── page.tsx                                        ~3 lines
├── new/page.tsx                                    ~80 lines
├── tickets/page.tsx                                ~35 lines
├── tickets/[chatwootId]/page.tsx                   ~60 lines
├── tickets/[chatwootId]/reply-form.tsx             ~25 lines
└── _components/
    ├── TicketCard.tsx                               ~30 lines
    ├── TicketStatusBadge.tsx                       ~15 lines
    ├── CategoryIcon.tsx                            ~10 lines
    └── EmptyTicketState.tsx                        ~20 lines
```

**Total new files: 21**  
**Total new code: ~900 lines**

### MODIFIED FILES

```
prisma/schema.prisma                            ← +2 enum values (TICKET_CREATED, TICKET_REPLIED)
.env.example                                    ← +5 env vars (CHATWOOT_*, SUPPORT_ENABLED)
src/middleware.ts                                ← +1 route pattern (/api/webhooks/chatwoot)
src/components/layout/Sidebar.tsx               ← +1 nav item (all role arrays)
src/components/layout/NotificationPanel.tsx     ← +2 typeStyle cases (TICKET_CREATED, TICKET_REPLIED)
```

### NOT CREATED

- No new Prisma models
- No new React Query hooks
- No new API routes (except webhook handler)
- No new Zustand stores
- No new context providers

---

## 19. PR Breakdown (3 PRs)

### PR 1: Infrastructure

```
docker-compose.chatwoot.yml                    ← Chatwoot deployment
.env.example                                    ← Env vars
src/lib/chatwoot/config.ts                     ← Config loading + validation
src/lib/chatwoot/logger.ts                     ← Request logging with correlation IDs
src/lib/chatwoot/repository.ts                 ← REST client (GET retry, no business logic)
src/middleware.ts                               ← Allow webhook route
src/lib/support/feature-flag.ts                 ← SUPPORT_ENABLED constant
src/lib/support/constants.ts                   ← CW_ATTR key constants
src/lib/support/errors.ts                      ← Typed error classes
src/lib/support/rate-limiter.ts                ← In-memory rate limiter
src/lib/support/health.ts                      ← Health check
```

**Verification:** `chatwootRepo.findContactByIdentifier()` returns expected data from Chatwoot. `checkSupportHealth()` returns `{ status: "healthy", reachable: true, tokenValid: true, accountAccessible: true, apiUsable: true, latencyMs: < 5000 }`.

### PR 2: Backend

```
src/lib/support/types.ts                       ← Internal types (SupportTicket, SupportMessage, SupportContact)
src/lib/support/SupportRepository.ts           ← Normalization + ensureContact
src/lib/support/SupportService.ts              ← Business logic layer (permission check, rate limiting)
src/server/actions/support.ts                  ← Server actions (auth + validation + revalidation)
src/app/api/webhooks/chatwoot/route.ts         ← Webhook handler (HMAC, event filtering, notification)
prisma/schema.prisma                           ← +2 NotificationType enum values
```

**Verification:** Can create a ticket via curl → Chatwoot has it. Webhook → notification delivered. Duplicate webhook is idempotent.

### PR 3: Frontend

```
src/app/(dashboard)/support/layout.tsx         ← Feature flag + env validation
src/app/(dashboard)/support/page.tsx           ← Redirect
src/app/(dashboard)/support/new/page.tsx       ← Create ticket form (native Chatwoot multipart upload, no MinIO)
src/app/(dashboard)/support/tickets/page.tsx   ← List (Server Component, calls supportService)
src/app/(dashboard)/support/tickets/[id]/page.tsx          ← Detail + message thread
src/app/(dashboard)/support/tickets/[id]/reply-form.tsx    ← Reply form (form action → router.refresh())
src/app/(dashboard)/support/_components/*      ← 4 shared components
src/components/layout/Sidebar.tsx              ← Nav item
src/components/layout/NotificationPanel.tsx    ← Icon/color cases
```

**Verification:** Full user flow: create → list → detail → reply → notification.

---

## 20. MVP Checklist

- [ ] Chatwoot v4.14.0 deployed via Docker Compose on same Docker network as Next.js
- [ ] CHATWOOT_API_URL=http://chatwoot:3000/api — Docker internal DNS, no Cloudflare
- [ ] Middleware allows `/api/webhooks/chatwoot`
- [ ] `chatwootRepo` can find, create, and get contacts
- [ ] `chatwootRepo` can create conversations, send messages, list conversations, get messages
- [ ] `chatwootRepo` generates correlcation IDs for every request
- [ ] `chatwootRepo` retries GET requests (3 attempts, exponential backoff) and never retries POST
- [ ] `supportRepo.ensureContact()` is the single reusable helper — find + create in one call
- [ ] `supportRepo.normalizeTicket()` extracts `ownerEmail` from `meta.sender.email` — available on every SupportTicket
- [ ] `supportRepo` is the only layer that accesses `meta`, `sender`, `custom_attributes`, `payload`, `contact_id`
- [ ] `supportService.getMyTickets()` returns normalized SupportTicket[]
- [ ] `supportService.getTicketDetail()` performs exactly one permission check — single source of truth
- [ ] `supportService.getTicketDetail()` uses `ticket.ownerEmail` for permission — no extra API call
- [ ] `supportService.createTicket()` calls `ensureContact()` once — never repeats findContact→createContact
- [ ] `supportService.replyToTicket()` reuses `getTicketDetail()` for permission — does not reimplement
- [ ] `supportService` never accesses `chatwootRepo` directly — only through `supportRepo`
- [ ] `supportService` never sees a Chatwoot contact ID — all IDs are internal to SupportRepository
- [ ] `supportRepo.ensureContact()` uses React `cache()` for true request-scoped memoization — no module-level Map
- [ ] `supportRepo.createConversation()` resolves the contact ID internally from the identifier — SupportService passes only the email
- [ ] All custom attribute keys use `CW_ATTR.*` constants — no raw strings
- [ ] `createTicket` server action validates input + notifies admins via `createBulkNotifications(TICKET_CREATED)`
- [ ] `replyToTicket` server action validates input + notifies other party (no duplicate with webhook)
- [ ] Webhook verifies HMAC + account ID + event type + message type before any processing
- [ ] Webhook returns 200 OK immediately if `SUPPORT_ENABLED=false`
- [ ] Webhook resolves user by email (from Chatwoot contact), not by custom attribute ID
- [ ] Server Action and Webhook notification paths are mutually exclusive by origin — no duplicates
- [ ] `checkSupportHealth()` works: returns reachable + tokenValid + accountAccessible
- [ ] `checkRateLimit()` enforces 5 tickets/min, 10 replies/min per user
- [ ] `validateChatwootConfig()` fails fast on startup if env vars are missing
- [ ] Feature flag disables routes (404), server actions (SupportDisabledError), nav item (hidden), webhook (200 OK no-op)
- [ ] All errors are typed — raw Chatwoot errors never reach the UI
- [ ] No local storage of Chatwoot data in MySQL
- [ ] No React Query hooks — Server Components call `supportService` directly
- [ ] No admin inbox pages — admin uses Chatwoot native UI
- [ ] No analytics pages — Chatwoot has built-in reports
- [ ] ChatwootRepository has zero business logic, zero permissions, zero validation
- [ ] SupportService has zero Chatwoot field access — all normalization is in SupportRepository
- [ ] SupportRepository is the only layer that imports from `chatwoot/repository`
- [ ] Next.js communicates with Chatwoot over Docker internal DNS only — no Cloudflare for API calls
- [ ] Chatwoot Admin accessible only through `support.coe.example.com` subdomain
- [ ] MySQL, PostgreSQL, Redis, MinIO have no external routes
