# Support Center — Implementation Summary

**Status:** Code written and statically verified. Runtime verification pending.

---

## Table of Contents

1. Architecture
2. Phase 0 — Integration Blockers Resolved
3. Phase 1 — Infrastructure
4. Phase 2 — ChatwootRepository
5. Phase 3 — SupportRepository
6. Phase 4 — SupportService
7. Phase 5 — Server Actions
8. Phase 6 — Webhook Handler
9. Phase 7 — Frontend Pages & Components
10. Phase 8 — Notifications & Sidebar
11. Files Changed (Complete List)
12. Static Verification (Executed)
13. Runtime Verification (Pending)
14. Known Limitations

---

## 1. Architecture

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
 │   no permissions, no validation)         │
 │   Returns: raw Chatwoot payload shapes   │
 └────────────────┬────────────────────────┘
                  │ HTTP
                  ▼
 ┌─────────────────────────────────────────┐
 │          Chatwoot API (self-hosted)      │
 │  http://chatwoot:3000/api/...            │
 └─────────────────────────────────────────┘
```

### Layer Isolation

| Layer | Chatwoot field access | Permission checks | Normalization |
|-------|----------------------|-------------------|---------------|
| Server Actions | None | None | None |
| SupportService | None | Single source (`getTicketDetail`) | None |
| SupportRepository | All (`meta`, `sender`, `custom_attributes`, `payload`, `contact_id`) | None | All |
| ChatwootRepository | Raw response shapes (unprocessed) | None | None |
| Webhook | Event payload directly (entry point) | HMAC only | None |

---

## 2. Phase 0 — Integration Blockers Resolved

### 2.1 `requireCoeUser()` return type extended

**File:** `src/lib/resolve-user.ts`

- Added `department?: string | null` and `uid?: string | null` to `ResolvedUser` type
- Updated `upsertDashboardUser()` to select and return these fields
- Existing callers unaffected (optional fields)

**Static verification:** TypeScript compiles. All 24 existing callers of `resolveUserFromHeaders()` remain valid.

### 2.2 Middleware — webhook route whitelisted

**File:** `src/middleware.ts`

- Added `pathname.startsWith("/api/webhooks")` to the public route list

**Expected behaviour:** Webhook endpoint bypasses JWT auth, relies on HMAC verification instead. Pending runtime verification with a deployed Chatwoot instance.

### 2.3 Docker networking — shared network

**File:** `docker-compose.yml`

- Added named `default` network with `name: project-dashboard`
- Chatwoot compose (`docker-compose.chatwoot.yml`) joins this same network using `external: true`

**Expected behaviour:** `http://chatwoot:3000` resolves via Docker DNS. Pending `docker compose up` verification.

### 2.4 Prisma — NotificationType enum extended

**File:** `prisma/schema.prisma`

```prisma
enum NotificationType {
  TICKET_CREATED
  TICKET_REPLIED
}
```

**Static verification:** `prisma generate` produces the updated types. TypeScript compilation confirms the new enum values are recognized.

### 2.5 Environment variables added

**File:** `.env.example`

```env
SUPPORT_ENABLED="false"
CHATWOOT_API_URL="http://chatwoot:3000/api"
CHATWOOT_ACCOUNT_ID="1"
CHATWOOT_API_TOKEN="<chatwoot-api-token>"
CHATWOOT_WEBHOOK_SECRET="<chatwoot-webhook-secret>"
```

---

## 3. Phase 1 — Infrastructure

### 3.1 `src/lib/chatwoot/config.ts`

Loads and validates Chatwoot environment variables at module load time:

```typescript
chatwootConfig = { apiUrl, accountId, apiToken, webhookSecret }
validateChatwootConfig()  // Throws on startup if any var is empty
```

Called from `support/layout.tsx` when `SUPPORT_ENABLED=true`.

### 3.2 `src/lib/chatwoot/logger.ts`

Structured request logging for Chatwoot API calls:

```typescript
logChatwootRequest(method, path, durationMs, status, requestId?, retryCount?)
// Output: [Chatwoot] [uuid] GET /contacts → 200 (12ms) (attempt 2)
```

Never logs: API tokens, message contents, attachments, user PII.

### 3.3 `src/lib/support/feature-flag.ts`

```typescript
export const SUPPORT_ENABLED = process.env.SUPPORT_ENABLED === "true";
```

Read once at module load time. Applied in:

| Location | Behaviour when disabled |
|----------|------------------------|
| `support/layout.tsx` | Returns 404 via `notFound()` |
| `SupportService.ts` | All 4 methods throw `SupportDisabledError` |
| `Webhook route.ts` | Returns 200 OK immediately (no processing) |
| `Sidebar.tsx` | Filters out Support nav items (prop-gated) |

### 3.4 `docker-compose.chatwoot.yml`

Runs Chatwoot v4.14.0 with 4 services:
- `chatwoot` — main Rails application
- `chatwoot_sidekiq` — background job processor
- `chatwoot_db` — PostgreSQL 15
- `chatwoot_redis` — Redis 7-alpine

Joins the existing `project-dashboard` Docker network.

---

## 4. Phase 2 — ChatwootRepository

**File:** `src/lib/chatwoot/repository.ts`

### Internal `request()` helper

Implements the HTTP transport layer:

| Parameter | Behaviour |
|---|---|
| URL building | `{apiUrl}/accounts/{accountId}{path}` |
| Request IDs | `crypto.randomUUID()` (UUIDv7 in Node 24+, UUIDv4 fallback) |
| GET timeout | 5 seconds via `AbortSignal.timeout()` |
| POST timeout | 15 seconds (normal), 60 seconds (attachments) |
| GET retry | 3 attempts, 200ms/400ms exponential backoff |
| POST retry | 0 retries (not idempotent) |
| 404 retry | 0 retries (resource doesn't exist) |
| Logging | Every request logged via `logChatwootRequest()` |

### Public API

| Method | Chatwoot endpoint | Description |
|--------|-------------------|-------------|
| `findContactByIdentifier(identifier)` | `GET /contacts?identifier=` | Primary lookup by email |
| `findContactByEmailForMigration(email)` | `GET /contacts?q=` | Email search (migration/debug only) |
| `createContact(identifier, name, attrs)` | `POST /contacts` | Create contact |
| `getContact(contactId)` | `GET /contacts/{id}` | Get by Chatwoot-internal ID |
| `createConversation(contactId, attrs)` | `POST /contacts/{id}/conversations` | Create conversation |
| `listConversationsByContact(contactId)` | `GET /conversations?contact_id=` | List conversations |
| `getConversation(conversationId)` | `GET /conversations/{id}` | Get single conversation |
| `sendMessage(convId, content, type, private, attachments?)` | `POST /conversations/{id}/messages` | Send message (JSON or multipart) |
| `getMessages(conversationId)` | `GET /conversations/{id}/messages` | Get messages |

### Raw Response Types

These types map to Chatwoot v4.14.0 API response shapes as documented by Chatwoot:

- `ChatwootContactResponse` — `{ id, email, name, custom_attributes }`
- `ChatwootConversationResponse` — `{ id, subject, status, meta, custom_attributes, ... }`
- `ChatwootMessageResponse` — `{ id, content, message_type, sender, attachments, ... }`

These types are internal to `chatwoot/repository.ts` and `support/SupportRepository.ts` only. No other layer imports them.

---

## 5. Phase 3 — SupportRepository

**File:** `src/lib/support/SupportRepository.ts`

### Contact Operations

| Method | Behaviour |
|--------|-----------|
| `ensureContact(identifier, name, customAttributes?)` | Finds contact by email identifier, falls back to email search, creates if missing. Uses `React.cache()` for request-scoped memoization. |
| `findContactByIdentifier(identifier)` | Returns boolean — whether a Chatwoot contact exists for this email |
| `getContactEmail(contactId)` | Resolves email from Chatwoot-internal contact ID (used by webhook handler) |

### Conversation Operations

| Method | Behaviour |
|--------|-----------|
| `getMyTickets(identifier)` | Lists conversations → normalizes to `SupportTicket[]` |
| `getTicket(conversationId)` | Gets conversation + messages → `{ ticket, messages[] }` |
| `createConversation(identifier, description, category, attachments?)` | Creates conversation + sends initial message |

### Message Operations

| Method | Behaviour |
|--------|-----------|
| `sendReply(conversationId, content, messageType, attachments?)` | Sends reply (FormData if attachments, JSON otherwise) |

### Internal Contact Resolution

```typescript
resolveContact = cache(async (identifier, name?, customAttributes?) => Promise<number>)
  // 1. findContactByIdentifier (email identifier — primary)
  // 2. findContactByEmailForMigration (fallback for existing contacts)
  // 3. createContact (if name provided and contact doesn't exist)
```

Chatwoot contact IDs are **never exposed outside this module**. SupportService works with email only.

### Normalization

**`normalizeTicket(cw)`** — extracts `ownerEmail` from the conversation's `meta.sender.email` field (avoids an extra `getContact()` API call for permission checks). Expected Chatwoot behaviour per v4.14.0 documentation. Runtime behaviour to be confirmed during deployment testing.

**`normalizeMessage(cw)`** — maps Chatwoot message response to `SupportMessage`:
- `message_type === 2` → admin
- `message_type === 1 || 3` → user
- `sender.type === "agent"` → admin
- Attachment fields renamed from snake_case to camelCase

### Error Translation

`translateError(err)` maps network errors to typed errors:
- `ChatwootApiError` → rethrown as-is
- `ConversationNotFoundError` → rethrown as-is
- `TypeError` with "fetch" → `SupportUnavailableError`
- Everything else → `ChatwootApiError(0, message)`

---

## 6. Phase 4 — SupportService

**File:** `src/lib/support/SupportService.ts`

### Public API

| Method | Description | Requires |
|--------|-------------|----------|
| `getMyTickets(user)` | Returns normalized tickets for the current user | `user.email` |
| `getTicketDetail(user, conversationId)` | Returns ticket + messages with permission check | `user.email`, `user.role` |
| `createTicket(user, input)` | Creates contact + conversation with rate limiting | `user.email`, `name`, `role`; optional `department`, `uid` |
| `replyToTicket(user, conversationId, input)` | Sends reply with permission check + rate limiting | `user.email`, `user.role` |

### Feature Flag

Every method checks `SUPPORT_ENABLED()` (function form, evaluated at call time). Throws `SupportDisabledError` if disabled.

### Permission Model

Single source of truth — only in `getTicketDetail()`:

```typescript
const isOwner = ticket.ownerEmail === user.email;
const isAdmin = user.role === "ADMIN";
if (!isOwner && !isAdmin) throw new UnauthorizedTicketAccessError();
```

`replyToTicket()` reuses `getTicketDetail()` for permission — does not reimplement the check.

`ownerEmail` is embedded in every `SupportTicket` by `SupportRepository.normalizeTicket()` during normalization. Expected behaviour per Chatwoot v4.14.0 API documentation — `meta.sender.email` should be present in the conversation response.

### Rate Limiting

In-memory sliding window via `checkRateLimit(action, key)`:

| Action | Limit | Scope |
|--------|-------|-------|
| `createTicket` | 5 per window | Per user email |
| `replyToTicket` | 10 per window | Per user email |

Window: 60 seconds. Resets on server restart. Single-instance only — meaningless when horizontally scaled.

---

## 7. Phase 5 — Server Actions

**File:** `src/server/actions/support.ts`

### `createTicket(formData)`

```text
requireCoeUser()
  → Zod validate (subject 3-200, description 10-10000, category enum)
  → supportService.createTicket(user, parsed)
  → createBulkNotifications(active admins, TICKET_CREATED)
  → revalidatePath("/support/tickets")
  → return { ok: true, id }
```

File attachments: frontend builds FormData with `attachments[]` keys. Server action detects `formData.has("attachments[]")` and forwards the entire FormData through the service/repository stack to Chatwoot's multipart API. No intermediate storage.

### `replyToTicket(chatwootId, formData)`

```text
requireCoeUser()
  → Zod validate (content 1-10000)
  → supportService.replyToTicket(user, chatwootId, parsed)
  → supportService.getTicketDetail() → reads ticket.ownerEmail (no extra API call)
  → createNotification({ userId, TICKET_REPLIED, ... }) to other party
  → revalidatePath("/support/tickets/{chatwootId}")
  → return { ok: true }
```

### Notification API Compatibility

Both actions use the existing notification system's exact function signatures:

- `createBulkNotifications(userIds[], { type, title, message, link })` — confirmed by reading `src/lib/notifications.ts`
- `createNotification({ userId, type, title, message, link })` — single object, confirmed by reading `src/lib/notifications.ts`

---

## 8. Phase 6 — Webhook Handler

**File:** `src/app/api/webhooks/chatwoot/route.ts`

### Request Processing

```
POST /api/webhooks/chatwoot
  ├─ SUPPORT_ENABLED=false → 200 OK (no-op)
  └─ SUPPORT_ENABLED=true
       ├─ HMAC-SHA256 signature invalid → 401
       ├─ Account ID mismatch → 200 OK (ignore)
       ├─ event !== "message.created" → 200 OK (ignore)
       ├─ message_type === "incoming" → 200 OK (ignore user messages)
       ├─ No conversation contact_id → 200 OK (ignore)
       ├─ Duplicate TICKET_REPLIED notification in last 5 min → 200 OK (dedup)
       ├─ Contact not found / user not found → 200 OK (ignore)
       └─ createNotification({ userId, TICKET_REPLIED, ... }) → 200 OK
```

### HMAC Verification

Uses Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.verify`) with HMAC-SHA-256. Reads `CHATWOOT_WEBHOOK_SECRET`. Compares against `x-chatwoot-signature` header.

Implemented per Chatwoot v4.14.0 webhook documentation.

### Duplicate Notification Prevention

The handler checks for an existing `TICKET_REPLIED` notification with the same `link` value created within the last 5 minutes **before** creating a new one. This compensates for Chatwoot v4.14.0's lack of webhook-level deduplication identifiers (no event ID in the webhook payload).

**Design note:** This is a best-effort dedup. The window is coarse (5 minutes), so legitimate rapid replies on the same ticket within the window are suppressed. Acceptable for the expected usage pattern (admin replies are not automated rapid-fire).

### Error Handling

Errors during contact lookup or notification creation are caught and logged. The handler always returns 200 OK to prevent Chatwoot from retrying. Only HMAC failure returns 401.

---

## 9. Phase 7 — Frontend Pages & Components

### Route Structure

```
src/app/(dashboard)/support/
├── layout.tsx          ← Server Component
├── page.tsx            ← Server Component: redirects to /support/tickets
├── loading.tsx         ← Loading spinner
├── error.tsx           ← Error boundary with retry button
├── new/
│   ├── page.tsx        ← Client Component: create ticket form
│   └── (loading.tsx, error.tsx inherited from support/)
├── tickets/
│   ├── page.tsx        ← Server Component: lists user's tickets
│   ├── loading.tsx     ← Re-exports support/loading.tsx
│   ├── error.tsx       ← Error boundary
│   └── [chatwootId]/
│       ├── page.tsx    ← Server Component: ticket detail + message thread
│       ├── reply-form.tsx ← Client Component: reply form
│       ├── loading.tsx ← Re-exports support/loading.tsx
│       └── error.tsx   ← Error boundary
└── _components/
    ├── TicketCard.tsx       ← List card with status badge + category icon
    ├── TicketStatusBadge.tsx← Color-coded badge (open/resolved/pending/closed/spam)
    ├── CategoryIcon.tsx     ← Icon per category
    ├── TicketHeader.tsx     ← Detail header
    ├── MessageThread.tsx    ← Message timeline with attachment links
    └── EmptyTicketState.tsx ← Empty state with CTA
```

### Data Fetching

All list/detail pages are **Server Components** that call `supportService` directly during SSR. No React Query, no client-side data fetching, no `useEffect`.

The only **Client Components** are the forms (`new/page.tsx`, `reply-form.tsx`) which submit via server actions.

---

## 10. Phase 8 — Notifications & Sidebar

### NotificationPanel (`src/components/layout/NotificationPanel.tsx`)

```typescript
const typeIcons = {
  TICKET_CREATED: { color: "text-orange-400", bg: "bg-orange-500/10" },
  TICKET_REPLIED: { color: "text-cyan-400", bg: "bg-cyan-500/10" },
};
```

These are merged with the existing notification type style map. Notification click behaviour is inherited — clicking a support notification navigates to `/support/tickets/{id}`.

### Sidebar (`src/components/layout/Sidebar.tsx`)

Support nav item added to Admin and Teacher navigation arrays. The items are filtered at render time based on the `isSupportEnabled` boolean prop:

```typescript
.adminNav / .teacherNav includes { title: "Support", href: "/support/tickets", icon: LifeBuoy }
.filter(item => item.href.startsWith("/support") ? isSupportEnabled : true)
```

The prop originates from `DashboardLayout` (server component) which reads `process.env.SUPPORT_ENABLED`.

### Notification Paths

The implementation creates notifications via three paths that are expected to be mutually exclusive by origin:

**Path A — User creates ticket → notify all admins:**
```
Server action createTicket()
  → createBulkNotifications(all active ADMINS, TICKET_CREATED)
```
Only the platform creates tickets. No webhook fires for ticket creation.

**Path B1 — Reply from platform → notify other party:**
```
Server action replyToTicket()
  → createNotification({ userId: otherParty.id, TICKET_REPLIED })
```
Uses `ticket.ownerEmail` embedded in the normalized SupportTicket — no extra Chatwoot API call.

**Path B2 — Reply from Chatwoot native UI → notify user:**
```
Chatwoot webhook POST /api/webhooks/chatwoot
  → HMAC → event filter → getContactEmail → createNotification({ userId, TICKET_REPLIED })
```
Implemented per Chatwoot v4.14.0 webhook documentation.

**Expected exclusivity:** The dual-path strategy relies on the documented Chatwoot v4.14.0 behaviour that webhooks are not emitted for API-token-created messages. This is described in Chatwoot's documentation but **has not been verified against a running Chatwoot instance**. If this assumption is incorrect, platform-originated replies will generate duplicate notifications via both Path B1 and Path B2. The 5-minute dedup window in the webhook handler provides partial mitigation.

---

## 11. Files Changed (Complete List)

### New Files (21)

```
docker-compose.chatwoot.yml                              ~50 lines

src/lib/chatwoot/
├── config.ts                                             ~20 lines
├── logger.ts                                             ~12 lines
└── repository.ts                                         ~130 lines

src/lib/support/
├── SupportService.ts                                     ~70 lines
├── SupportRepository.ts                                  ~140 lines
├── types.ts                                              ~35 lines
├── errors.ts                                             ~45 lines
├── constants.ts                                          ~6 lines
├── rate-limiter.ts                                       ~30 lines
├── health.ts                                             ~35 lines
└── feature-flag.ts                                       ~3 lines

src/server/actions/support.ts                             ~100 lines

src/app/api/webhooks/chatwoot/route.ts                    ~90 lines

src/app/(dashboard)/support/
├── layout.tsx                                            ~12 lines
├── page.tsx                                              ~5 lines
├── loading.tsx                                           ~12 lines
├── error.tsx                                             ~25 lines
├── new/page.tsx                                          ~110 lines
├── tickets/page.tsx                                      ~40 lines
├── tickets/loading.tsx                                   ~1 line
├── tickets/error.tsx                                     ~25 lines
├── tickets/[chatwootId]/page.tsx                         ~20 lines
├── tickets/[chatwootId]/reply-form.tsx                   ~100 lines
├── tickets/[chatwootId]/loading.tsx                      ~1 line
├── tickets/[chatwootId]/error.tsx                        ~27 lines
└── _components/                                          ~140 lines
    ├── TicketCard.tsx
    ├── TicketStatusBadge.tsx
    ├── CategoryIcon.tsx
    ├── TicketHeader.tsx
    ├── MessageThread.tsx
    └── EmptyTicketState.tsx

Total: ~1,100 lines of new code
```

### Modified Files (7)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +2 NotificationType enum values |
| `.env.example` | +5 Chatwoot env vars |
| `src/middleware.ts` | +1 webhook route whitelist |
| `src/lib/resolve-user.ts` | Extended `ResolvedUser` with `department`, `uid` |
| `docker-compose.yml` | Added named network for cross-compose DNS |
| `src/components/layout/Sidebar.tsx` | +Support nav item (prop-gated by `isSupportEnabled`) |
| `src/components/layout/NotificationPanel.tsx` | +2 TICKET_* icon/color mappings |

### Files NOT Created (intentional per design guide)

- No new Prisma models
- No new React Query hooks
- No new API routes (except webhook handler)
- No new Zustand stores
- No new context providers

---

## 12. Static Verification (Executed)

These checks were run against the codebase with the results shown:

### Commands Executed

```text
npx tsc --noEmit                          → No errors found
npx prisma generate                        → Client generated successfully
npx next lint                              → No new warnings (pre-existing only in admin pages)
```

### Architecture Verification

| Check | Method | Result |
|-------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | ✅ No errors |
| Prisma client generation | `npx prisma generate` | ✅ All types generated |
| Imports resolve | Static analysis of all new files | ✅ Every import resolves to an existing module |
| No circular dependencies | Manual trace of dependency graph | ✅ SupportService → SupportRepo → ChatwootRepo (acyclic) |
| Layer isolation — Chatwoot fields | `grep` for `meta\|sender\|custom_attributes\|payload\|contact_id` in support code | ✅ Chatwoot fields only in `SupportRepository.ts` and `chatwoot/repository.ts` |
| No MinIO in support code | `grep` for `minio\|MinIO\|S3` in support/chatwoot dirs | ✅ Zero matches |
| All error classes exist | Read `src/lib/support/errors.ts` | ✅ 7 classes, all with correct `this.name` |
| Server action pattern | Read `src/server/actions/support.ts` | ✅ Both follow: auth → validate → service → notify → revalidate |
| Feature flag coverage | `grep` for `SUPPORT_ENABLED` across all relevant files | ✅ layout, service, webhook, sidebar |
| Permission single source | Manual trace of `ownerEmail`, `UnauthorizedTicketAccessError` | ✅ Only in `SupportService.getTicketDetail()` |
| Route-level loading/error states | `glob` for `**/support/**/{loading,error}.tsx` | ✅ Every route directory has both |
| Notification type style coverage | Read `NotificationPanel.tsx` | ✅ TICKET_CREATED, TICKET_REPLIED mapped |
| Webhook dedup implementation | Read `route.ts` | ✅ 5-minute window check implemented |
| FormData attachment key consistency | Read frontend + server action | ✅ Both use `"attachments[]"` (fixed during verification) |

### Code Quality Checks

| Check | Method | Result |
|-------|--------|--------|
| No `any` types | Manual scan of new files | ✅ Zero occurrences |
| No `@ts-ignore` / `@ts-expect-error` | Manual scan of new files | ✅ Zero occurrences |
| No TODO comments | Manual scan of new files | ✅ Zero occurrences |
| No placeholder implementations | Manual scan of new files | ✅ All functions have real bodies |
| Unused imports | `npx next lint` output review | ✅ No unused imports in new files |

---

## 13. Runtime Verification (Pending)

These scenarios require a running Chatwoot v4.14.0 instance to verify. Each is listed with its implementation approach and the specific expected behaviour that must be tested.

### Prerequisites

- Chatwoot v4.14.0 deployed via `docker compose -f docker-compose.chatwoot.yml up`
- Environment variables configured: `SUPPORT_ENABLED=true`, `CHATWOOT_API_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_API_TOKEN`, `CHATWOOT_WEBHOOK_SECRET`
- Chatwoot webhook configured to `https://dashboard.coe.example.com/api/webhooks/chatwoot`
- `CHATWOOT_API_TOKEN` has appropriate agent permissions

### Runtime Test Matrix

| # | Scenario | Expected Behaviour | Status |
|---|----------|-------------------|--------|
| 1 | Docker networking | `http://chatwoot:3000` resolves from Next.js container | Pending |
| 2 | Chatwoot API reachable | `chatwootRepo.findContactByIdentifier()` returns expected data | Pending |
| 3 | Contact creation | A new platform user creates a ticket → Chatwoot contact is created | Pending |
| 4 | Existing contact reuse | Same user creates another ticket → existing contact reused | Pending |
| 5 | Ticket creation full flow | User submits createTicket form → ticket appears in Chatwoot | Pending |
| 6 | Ticket listing | User visits `/support/tickets` → sees only their tickets | Pending |
| 7 | Ticket detail | User clicks a ticket → sees messages with correct sender labels | Pending |
| 8 | Reply from platform | User/Admin replies → message appears in Chatwoot thread | Pending |
| 9 | Permission enforcement | User A tries to view User B's ticket → `UnauthorizedTicketAccessError` | Pending |
| 10 | Admin override | Admin views any user's ticket → succeeds | Pending |
| 11 | Notification — ticket created | Admin receives `TICKET_CREATED` notification | Pending |
| 12 | Notification — platform reply | Other party receives `TICKET_REPLIED` notification | Pending |
| 13 | Notification — Chatwoot reply | Webhook delivers `TICKET_REPLIED` notification to user | Pending |
| 14 | No duplicate notifications | Webhook retry → same notification not created twice (5-min dedup) | Pending |
| 15 | Attachment upload (single file) | Single file attached → appears in Chatwoot message | Pending |
| 16 | Attachment upload (multiple files) | 3 files attached → all appear in Chatwoot message | Pending |
| 17 | Invalid file rejection | .exe file → rejected by server action (MIME check) | Pending |
| 18 | Oversized file rejection | 30MB file → rejected by server action (size check) | Pending |
| 19 | Attachment rendering | Image shows inline thumbnail; PDF shows download link | Pending |
| 20 | Webhook HMAC verification | Valid signature → processed; invalid → 401 | Pending |
| 21 | Webhook event filtering | Non-`message.created` events → ignored (200 OK) | Pending |
| 22 | Webhook account filtering | Events from wrong Chatwoot account → ignored (200 OK) | Pending |
| 23 | Health check | `checkSupportHealth()` returns reachable+tokenValid+accountAccessible | Pending |
| 24 | Rate limiting | 6 rapid ticket creations → 6th blocked with `RateLimitError` | Pending |
| 25 | Feature flag disabled | `SUPPORT_ENABLED=false` → routes 404, sidebar hidden, actions throw | Pending |
| 26 | Chatwoot offline | Chatwoot container stopped → typed `SupportUnavailableError` shown | Pending |
| 27 | Webhook disabled | `SUPPORT_ENABLED=false` → webhook returns 200 without processing | Pending |
| 28 | SSR loading state | Slow Chatwoot response → loading spinner shown during SSR | Pending |
| 29 | Error boundary | Chatwoot 500 on ticket detail → `error.tsx` shown with retry | Pending |
| 30 | Empty state | No tickets → `EmptyTicketState` with "Create Ticket" CTA | Pending |

---

## 14. Known Limitations

| Limitation | Root Cause | Impact | Future Improvement |
|-----------|------------|--------|-------------------|
| Rate limiter resets on server restart | In-memory `Map` — no persistence | Rate limits are meaningless after deploy. User can burst immediately after restart. | Replace with database-backed or Redis-based rate limiter |
| Rate limiter is per-process | Single-instance `Map` | With horizontal scaling, each replica has its own window. Rate limit effectively multiplies by replica count. | Centralized rate store (Redis) |
| Webhook dedup is best-effort | 5-minute fixed window | Legitimate rapid replies on same ticket within window are suppressed. | Replace window with webhook event ID (requires Chatwoot to emit one) |
| Email change orphans conversations | Chatwoot uses email as canonical identifier | If a user's email changes in CoE SSO, old tickets are attached to the old email. The user sees an empty ticket list. | Add `SupportContact` mapping table linking platform user ID to Chatwoot contact ID (requires Prisma model — deferred from MVP) |
| React `cache()` is per-request | Next.js `React.cache()` scoped to one SSR render or one server action | Two concurrent requests for the same new user could both attempt to create a Chatwoot contact. Rare — the second creation would succeed but leave a duplicate Chatwoot contact. | Accept for MVP. Mitigation: Chatwoot allows duplicate identifiers. |
| Webhook + platform reply exclusivity unverified | Relies on undocumented Chatwoot behaviour | If Chatwoot v4.14.0 fires webhooks for API-created messages, every platform reply generates a duplicate notification. The 5-min dedup window in the webhook provides partial mitigation. | Add `SUPPORT_USE_WEBHOOK_FOR_NOTIFICATIONS` feature flag to switch between dual-path and webhook-only mode during Chatwoot upgrades. Or replace with exclusively webhook-based notifications. |
| No admin ticket list page | Intentional per architecture guide | Admins must use Chatwoot native UI for full inbox management. No SSO bridge between the dashboard and Chatwoot. | Intentional — out of scope for MVP. |

---

## Appendix: Unverified Chatwoot Behaviour Assumptions

These behaviours are **implemented per Chatwoot v4.14.0 documentation** but have **not been verified against a running instance**.

| Assumption | Location | Impact if Wrong |
|-----------|----------|----------------|
| `GET /contacts?identifier={email}` returns contacts with `identifier` set to `user.email` | ChatwootRepository | Contact lookup fails at every step |
| `meta.sender.email` contains the contact's email in conversation responses | SupportRepository (`normalizeTicket`) | `ownerEmail` is `null` → permission check falls through to admin-only access, admin sees all tickets |
| `meta.sender` exists and has shape `{ id: number, email?: string }` | SupportRepository (`normalizeTicket`) | `ownerEmail` is `null` |
| Webhook payload has shape `{ event, message_type, conversation: { contact_id, id }, account: { id }, content: { text } }` | Webhook handler | Payload parsing fails or silently ignores events |
| `x-chatwoot-signature` header contains HMAC-SHA-256 hex digest | Webhook handler | All webhooks return 401 |
| Chatwoot does not fire `message.created` webhooks for API-token-created messages | Entire notification dual-path strategy | Every platform-originated reply generates duplicate notifications via both Path B1 and Path B2 |
| Multipart upload endpoint accepts `attachments[]` field names | ChatwootRepository | File uploads silently fail |
| Custom attributes can be written on conversation creation | ChatwootRepository (`createConversation`) | Ticket category is not stored in Chatwoot |
| `POST /contacts` with `identifier` field works as documented | ChatwootRepository | Contact creation fails |
