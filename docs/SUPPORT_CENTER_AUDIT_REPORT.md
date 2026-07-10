# Support Center — Pre-Deployment Audit Report

## 1. Files Removed

| File | Reason |
|------|--------|
| `.omo/plans/support-center-hyperplan.md` | Temporary hyperplan planning document. The architecture guide (`SUPPORT_CENTER_IMPLEMENTATION_GUIDE.md`) is the single source of truth. The plan was already consumed during implementation. |

**Kept:** `SUPPORT_CENTER_IMPLEMENTATION_GUIDE.md` (the authoritative architecture doc), `SUPPORT_CENTER_IMPLEMENTATION_SUMMARY.md` (verification results, what needs testing, known limitations, and Chatwoot assumptions that have not been verified).

---

## 2. Code Changes (Production Readiness)

| Change | File | Reason |
|--------|------|--------|
| Removed unused `SupportContact` import | `src/lib/support/SupportRepository.ts` | Imported but never referenced. Dead code. |
| Removed unused `contact` variable | `src/lib/support/health.ts` | Variable assigned but never read. Was only used to test connectivity — changed to bare `await`. |
| Added file validation helper + applied to `createTicket` and `replyToTicket` | `src/server/actions/support.ts` | Security gap: files were forwarded to Chatwoot without any validation. Now validates: max 10 files, max 25MB each, blocked MIME types (exe, bat, sh, js, vbs), empty files. |
| Integrated email delivery via existing OAuth2 Gmail `sendEmail()` | `src/server/actions/support.ts` | Support events now send emails via the existing `@/lib/email` infrastructure. `createTicket()` emails admins; `replyToTicket()` emails the other party. Non-blocking — failures are caught silently. |
| Integrated email delivery via existing OAuth2 Gmail `sendEmail()` | `src/app/api/webhooks/chatwoot/route.ts` | Webhook-triggered notifications now also send email to the user via the existing OAuth2 pipeline. |
| Fixed Next.js 15 `params` type | `src/app/(dashboard)/support/tickets/[chatwootId]/page.tsx` | Changed `{ params: { chatwootId: string } }` to `{ params: Promise<{ chatwootId: string }> }` with `await params`. Required for Next.js 15 App Router. |

---

## 3. Security Fixes

| Issue | Severity | Fix |
|-------|----------|-----|
| No file validation on upload — arbitrary files could be sent to Chatwoot | **HIGH** | Added `validateFiles()` and `collectFiles()` to both server actions. Blocks: .exe, .bat, .sh, .js, .vbs; enforces 25MB limit; rejects empty files. |
| Webhook dedup absent — duplicate deliveries create duplicate notifications | **MEDIUM** | Added 5-minute window check before creating `TICKET_REPLIED` notifications. Queries `Notification.createdAt` for same type+link within last 5 minutes. |

**Already secure (no changes needed):**

| Area | Status |
|------|--------|
| Authentication | `requireCoeUser()` called in both server actions |
| Authorization | `getTicketDetail()` is the single permission gate (`ownerEmail === user.email \|\| role === ADMIN`) |
| Input validation | Zod schemas validate text fields in both server actions |
| HMAC verification | Web Crypto API with SHA-256 on every webhook request |
| Rate limiting | In-memory sliding window: 5 create/min, 10 reply/min per user |
| Secret handling | `api_access_token` only in request headers, never logged |
| Sensitive data in logs | Logger only logs method, path, duration, status code, request ID — no tokens, content, PII |
| Error leakage | Webhook errors caught and logged server-side; always returns 200 OK to caller |
| SSR safety | All data-fetching pages are Server Components — no client-side data exposure |

---

## 4. Architecture Compliance

| Check | Status | Evidence |
|-------|--------|----------|
| Layer isolation | ✅ | Chatwoot fields (`meta`, `sender`, `custom_attributes`) only accessed in `SupportRepository.ts` |
| No Chatwoot leakage in Service | ✅ | `SupportService.ts` has zero references to Chatwoot payload fields |
| No Chatwoot leakage in Server Actions | ✅ | `support.ts` has zero references to Chatwoot payload fields |
| No Chatwoot leakage in Frontend | ✅ | All components import from `types.ts` only (SupportTicket, SupportMessage) |
| Permission single-sourced | ✅ | Only `SupportService.getTicketDetail()` has the `ownerEmail` check |
| Feature flag consistency | ✅ | SUPPORT_ENABLED gates: layout (404), service (throws), webhook (200), sidebar (filtered) |
| Notification paths | ✅ | Path A: createTicket → `createBulkNotifications(admins, TICKET_CREATED)`. Path B1: replyToTicket → `createNotification(user, TICKET_REPLIED)`. Path B2: webhook → `createNotification(user, TICKET_REPLIED)` |
| No MinIO in support flow | ✅ | Zero MinIO/S3 references in support/chatwoot code |
| No extra API calls for permissions | ✅ | `ownerEmail` extracted from `meta.sender.email` during normalization |

---

## 5. Unverified Chatwoot Assumptions (Remain for Deployer)

All documented in the `SUPPORT_CENTER_IMPLEMENTATION_SUMMARY.md` appendix. Key items that must be verified during deployment testing:

1. **`meta.sender.email` existence** in conversation API responses — permission check depends on this
2. **Webhook not triggered for API-created messages** — entire dual-path notification strategy rests on this
3. **Multipart upload with `attachments[]` field name** — file uploads depend on this
4. **HMAC header name `x-chatwoot-signature`** — webhook authentication depends on this

---

## 6. Dependency Audit

Zero new npm packages added. The implementation uses only:
- `zod` — already in the project
- `next/cache`, `next/navigation`, `next/server`, `next/link` — Next.js built-in
- `react` (`cache`, `useState`, `useRef`) — already in the project
- `crypto` (`randomUUID`) — Node.js built-in
- `lucide-react`, `@/components/ui/*`, `@/lib/*` — existing project code

---

## 7. Code Quality

| Check | Result |
|-------|--------|
| No `any` in new code | ✅ |
| No `@ts-ignore` / `@ts-expect-error` | ✅ |
| No TODOs | ✅ |
| No placeholder implementations | ✅ |
| No dead code (after fixes) | ✅ |
| No debug `console.log` (only production-appropriate structured logging) | ✅ |
| Consistent error handling (typed Error classes) | ✅ |
| Consistent naming (camelCase, PascalCase for types) | ✅ |
| Section comments only where flow is non-obvious (webhook step comments) | ✅ |

---

## 8. Performance

| Check | Result |
|-------|--------|
| No N+1 queries in data fetching | ✅ — `getTicket()` fetches conversation+messages in single `Promise.all` |
| React `cache()` prevents duplicate Chatwoot contact lookups per request | ✅ |
| `ownerEmail` embedded in ticket normalization — no extra API call for permissions | ✅ |
| `lookupContact` + `resolveContact` both use React `cache()` for request-scoped memoization | ✅ |
| No client-side data fetching — all SSR via Server Components | ✅ |

---

## 9. Repository Cleanliness

| Check | Result |
|-------|--------|
| `.omo/plans/support-center-hyperplan.md` | Removed |
| Other `.omo/` files | System files (run-continuation, note.md) — left untouched |
| No backup/config files | ✅ |
| No test artifacts | ✅ |

---

## 10. Remaining Runtime Verification (Requires Live Chatwoot)

The following scenarios must be verified against a running Chatwoot v4.14.0 deployment before production use. Full 30-item matrix is in `docs/SUPPORT_CENTER_IMPLEMENTATION_SUMMARY.md`.

### Critical Path

| Scenario | Why Critical |
|----------|-------------|
| Chatwoot reachable via Docker DNS | Contact lookup, ticket creation, replies fail without it |
| Contact creation + reuse | User cannot create tickets without a contact |
| Ticket creation + listing + detail | Core user flow |
| Reply from platform + Chatwoot UI | Core user flow; also validates no-duplicate assumption |
| Webhook HMAC + event filtering | Notification delivery for Chatwoot-native replies |
| Permission enforcement (owner only, admin override) | Security requirement |

### Pre-Deployment Setup

1. Configure `.env` with `SUPPORT_ENABLED=true`, `CHATWOOT_*` vars
2. `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (dev)
3. `docker compose -f docker-compose.chatwoot.yml up -d`
4. Configure webhook URL in Chatwoot admin: `https://dashboard.coe.example.com/api/webhooks/chatwoot`
5. Run `npm run build` and deploy

---

## 11. Email Delivery Unification

All support emails now go through the existing OAuth2 Gmail pipeline (`@/lib/email`). No new email infrastructure was introduced.

### Notification Flow

```
Support Event (ticket created / reply sent)
  → In-app notification via createNotification() / createBulkNotifications()
  → Email via sendEmail() from @/lib/email (OAuth2 Gmail nodemailer transport)
```

| Trigger | In-app Notification | Email Recipient | Email Delivery |
|---------|-------------------|-----------------|----------------|
| User creates ticket | TICKET_CREATED → all active admins | All active admin email addresses | `sendEmail()` via existing OAuth2 pipeline |
| Admin replies (platform) | TICKET_REPLIED → ticket owner | Platform user email from DB | `sendEmail()` via existing OAuth2 pipeline |
| Admin replies (Chatwoot UI) | TICKET_REPLIED → ticket owner | Platform user email resolved via webhook | `sendEmail()` via existing OAuth2 pipeline |

### What Was Changed

- `src/server/actions/support.ts`: Added `sendEmail()` calls after notification creation in both `createTicket()` and `replyToTicket()`. Imports `sendEmail` from `@/lib/email`.
- `src/app/api/webhooks/chatwoot/route.ts`: Added `sendEmail()` call after notification creation. Imports `sendEmail` from `@/lib/email`.

### What WAS NOT Created

- No new email utilities
- No new mail providers
- No new email template system
- No new notification engine
- No SMTP configuration in Chatwoot (docker-compose.chatwoot.yml has zero SMTP vars)

### Graceful Degradation

If SMTP is not configured, `sendEmail()` silently logs and skips (returns `{ messageId: null }`). All `sendEmail()` calls use `.catch(() => {})` so email failures never crash the server action or webhook. In-app notifications are always created regardless of email delivery status.
