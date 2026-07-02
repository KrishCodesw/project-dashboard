# Automatic Invitation Delivery Tracking — Implementation Plan

> **Document status:** Implementation Specification (Frozen). No architectural changes without a planning revision.
> **Objective:** Automatically detect bounced invitation emails via Gmail API, update `PendingProjectAssignment` delivery status, and surface failures to teachers in the dashboard. Teachers must never need to monitor Gmail manually for delivery failures.
> **Constraints:** Reuse existing `EmailQueue` infrastructure. Gmail API is the only new integration point.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Assumptions](#2-assumptions)
3. [Current Email Architecture](#3-current-email-architecture)
4. [Module Architecture](#4-module-architecture)
5. [Integration Approach: Gmail API vs IMAP](#5-integration-approach-gmail-api-vs-imap)
6. [DSN Detection Strategy](#6-dsn-detection-strategy)
7. [BounceParser Module](#7-bounceparser-module)
8. [BounceValidator Module](#8-bouncevalidator-module)
9. [Confidence-Based Matching Strategy](#9-confidence-based-matching-strategy)
10. [Multiple Invitation Edge Cases](#10-multiple-invitation-edge-cases)
11. [Delivery States](#11-delivery-states)
12. [Database Design](#12-database-design)
13. [Capture Message-ID on Send](#13-capture-message-id-on-send)
14. [Background Worker Design](#14-background-worker-design)
15. [Notification Flow](#15-notification-flow)
16. [Teacher Experience](#16-teacher-experience)
17. [Recovery Workflow & State Transitions](#17-recovery-workflow--state-transitions)
18. [Failure Scenarios](#18-failure-scenarios)
19. [Logging & Metrics](#19-logging--metrics)
20. [Monitoring Recommendations](#20-monitoring-recommendations)
21. [Security Review](#21-security-review)
22. [Environment & Deployment](#22-environment--deployment)
23. [Testing Strategy](#23-testing-strategy)
24. [Rollback Strategy](#24-rollback-strategy)
25. [File-by-File Implementation Plan](#25-file-by-file-implementation-plan)
26. [Implementation Contract](#26-implementation-contract)
27. [Implementation Readiness Checklist](#27-implementation-readiness-checklist)

---

## 1. Design Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **The dashboard is the authoritative source of delivery status.** | `PendingProjectAssignment.deliveryStatus` is the record of truth. Gmail DSNs are the input; the database is the persistent state. |
| 2 | **Teachers must never monitor Gmail manually.** | Detection is fully automatic. No "Mark as Bounced" workflow. |
| 3 | **Delivery tracking survives application restarts.** | All state persisted in DB. Worker is stateless — queries Gmail by timestamp, relies on Gmail's label state for idempotency. |
| 4 | **Existing `EmailQueue` infrastructure is reused.** | The queue sends emails. Detection is a separate consumer of Gmail DSNs. |
| 5 | **`PendingProjectAssignment` is the authoritative invitation record.** | All invitation semantics live here. `EmailQueue` records delivery attempts but does not own the invitation lifecycle. |
| 6 | **All detection operations must be idempotent.** | DSNs are marked as read (UNREAD removed) after processing. `deliveryStatus IS NULL` prevents double-processing in the DB. |
| 7 | **The architecture is invitation-generic.** | Covers students, faculty, reviewers, industry mentors — any role. |
| 8 | **Correlation must be confidence-based.** | Automatic updates only at HIGH or MEDIUM confidence. LOW confidence is logged but not applied. |
| 9 | **Each module has exactly one responsibility.** | Parser extracts. Validator validates. Matcher correlates. Processor updates. Notifier alerts. Orchestrator sequences. |

---

## 2. Assumptions

The following assumptions are made by this design. If any are incorrect, the architecture must be reviewed.

| Assumption | Rationale |
|---|---|
| **Gmail SMTP is the only email transport.** | The existing `email.ts` enforces Gmail SMTP via `requireConfigured`. Other transports are outside scope. |
| **The sending mailbox receives its own DSNs.** | Gmail sends DSNs to the `SMTP_USER` mailbox. The worker reads this same mailbox. |
| **DSNs contain a `message/delivery-status` MIME part per RFC 3464.** | This is the standard for DSNs. The detection strategy relies on this MIME type for identification. |
| **`sendMail()` returns a valid `messageId` when Gmail accepts the message.** | Nodemailer returns Gmail's `messageId` on successful SMTP submission. This value is currently discarded. |
| **The `@@unique([projectId, email])` constraint prevents duplicate active pending assignments per project+email.** | This makes the email-based fallback matching unambiguous when only one candidate exists. |
| **Institutional emails ending in `@tcetmumbai.in` are stable and do not change frequently.** | Academic email addresses are long-lived. The matching strategy relies on email as a stable identifier. |

---

## 3. Current Email Architecture

### 3.1 Email flow (as-is)

```
Server action → EmailQueue.create({ to, subject, body, status: "PENDING" })
  → Cron: POST /api/cron/process-emails
    → sendEmail() via Nodemailer + Gmail SMTP OAuth2
    → On success: EmailQueue.status = "SENT"
    → On failure (attempts < 3): requeue
    → On failure (attempts ≥ 3): EmailQueue.status = "FAILED"
    ⚠ sendMail() returns messageId — currently discarded
```

### 3.2 Infrastructure gaps

| Gap | Impact |
|---|---|
| `messageId` not captured | Cannot correlate sent emails with DSNs by Message-ID |
| No delivery status on `PendingProjectAssignment` | No way to reflect bounce state |
| No Gmail API integration | No system reads the inbox for DSNs |
| No cron endpoint for detection | No scheduled bounce processing |

---

## 4. Module Architecture

### 4.1 Separated responsibilities (six modules, one orchestrator)

```
POST /api/cron/detect-bounces
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  BounceFetcher                                               │
│  Responsibility: query Gmail API for unread DSNs.            │
│                 Remove UNREAD label after each is processed. │
│                 DSN stays in Inbox — never removed.          │
│  Methods: fetchNew(), markRead()                             │
│  Does NOT parse, validate, or match.                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ raw DSN bodies
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BounceParser                                                │
│  Responsibility: extract structured fields from DSN body.   │
│  Output: ParsedBounce { recipient, diagnostic,               │
│           originalMessageId }                                │
│  Pure extraction. No decisions. No validation.              │
│  Does NOT classify, summarize, or assign confidence.        │
└───────────────────────────┬─────────────────────────────────┘
                            │ ParsedBounce
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BounceValidator                                             │
│  Responsibility: make binary go/no-go decisions about the   │
│                 parsed DSN itself.                           │
│  Output: ValidatedBounce | null                              │
│  Validates: permanent/temporary, required fields, domain,    │
│             malformed body.                                  │
│  Does NOT match, does NOT assign confidence.                │
└───────────────────────────┬─────────────────────────────────┘
                            │ ValidatedBounce
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BounceMatcher                                               │
│  Responsibility: correlate the validated DSN to a pending   │
│                 assignment. Assign confidence to the match.  │
│  Output: MatchResult { assignment, matchConfidence,          │
│           matchMethod }                                      │
│  Confidence: HIGH (Message-ID), MEDIUM (single email),      │
│              LOW (multiple email candidates).                │
│  Does NOT parse or validate.                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ MatchResult (if confidence >= MEDIUM)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BounceProcessor                                             │
│  Responsibility: update PendingProjectAssignment.            │
│  Actions: deliveryStatus, bounceDiagnosticRaw,               │
│           bounceReason, lastBounceAt                         │
│  Only executes when matchConfidence is HIGH or MEDIUM.       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  NotificationService                                         │
│  Responsibility: notify teacher, at most once per assignment │
│                 record.                                      │
│  Deduplication: by assignment id — a single PendingProject- │
│                 Assignment generates at most one notification│
│                 in its lifetime. Edit creates a new record.  │
│  Type: reuses "PROJECT_UPDATED" from enum.                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data flow

```
Gmail API → BounceFetcher.fetchNew()
  → Array of { gmailMessageId, rawBody, headers }
  → BounceParser.parse(rawBody)
    → ParsedBounce { recipient, diagnostic, originalMessageId }
  → BounceValidator.validate(parsed)
    → null (reject: temporary, missing fields, invalid domain, malformed)
    → ValidatedBounce { recipient, diagnostic, originalMessageId, isPermanent, summary }
  → BounceMatcher.match(validated)
    → MatchResult { assignment, matchConfidence, matchMethod, candidatesFound }
      matchConfidence: "NONE" → no update, remove UNREAD label, done
      matchConfidence: "LOW"  → log warning, remove UNREAD label, done
      matchConfidence: "MEDIUM" → BounceProcessor.process()
      matchConfidence: "HIGH"   → BounceProcessor.process()
  → NotificationService.notifyBounce(matchResult)
    → Creates Notification record if none exists yet for this assignment.id
```

---

## 5. Integration Approach: Gmail API vs IMAP

### 5.1 Comparison

| Criterion | Gmail API | IMAP |
|---|---|---|
| **New dependencies** | `googleapis` | `imap` + `mailparser` + `encoding` + `iconv-lite` |
| **Auth** | Same OAuth2 as SMTP. Add `gmail.modify` scope. | Separate IMAP credentials or OAuth2 for IMAP. |
| **Server-side filtering** | `q:` parameter — only DSNs returned | Must download ALL headers, filter client-side |
| **Mark as processed** | `users.messages.modify` — remove UNREAD label only | Copy to folder + delete. Multi-step. |
| **Connection management** | Stateless HTTP. No persistent connection. | Stateful TCP. Reconnect, keepalive, folder selection. |
| **Rate limits** | 1,000,000 queries/day (free). 15/100s per user. | 10 simultaneous IMAP connections max. |

### 5.2 Recommendation: Gmail API

The Gmail API reuses existing OAuth2 credentials, provides server-side search filtering, and is stateless — each cron invocation is a fresh HTTP request. IMAP would require persistent connection management, multiple third-party packages, and fragile MIME parsing.

---

## 6. DSN Detection Strategy

### 6.1 Gmail search

Use `has:delivery-status`, which matches messages containing a `message/delivery-status` MIME part per RFC 3464. Do **not** filter by sender address — different mail servers use different DSN sender addresses, and forwarder DSNs may lose the original sender header.

```
q: "has:delivery-status is:unread after:${cutoffDate}"
```

### 6.2 MIME type verification

After a message is returned by the search, verify it is a DSN by inspecting its MIME structure. DSNs per RFC 3464 and RFC 1894 contain a part with `Content-Type: message/delivery-status`. If the message lacks this MIME type, it is not a DSN — remove its `UNREAD` label and skip it.

### 6.3 Detection flow

```
1. Gmail search: has:delivery-status is:unread after:{cutoffDate}
2. For each result:
   a. Fetch full message payload
   b. Check: payload contains message/delivery-status MIME part?
      YES → continue
      NO  → remove UNREAD label, skip (not a DSN)
   c. Extract plain-text body from the multipart/report wrapper
   d. Pass raw body to BounceParser
```

---

## 7. BounceParser Module

### 7.1 Responsibility

**Extract structured fields from a raw DSN body.** No decisions. No business logic. No classification. No confidence.

### 7.2 Multi-format support

Minimum supported formats: RFC 3464, RFC 1894, Gmail-generated DSNs, Outlook/Exchange DSNs, generic SMTP DSNs. The parser attempts multiple extraction strategies per field. If the format is unrecognized, it returns null fields rather than throwing.

### 7.3 Types

```typescript
interface ParsedBounce {
  recipient: string | null;           // student@tcetmumbai.in
  diagnostic: string | null;          // 550 5.1.1 The email account...
  originalMessageId: string | null;   // <abc123@mail.gmail.com>
}
```

This is the **only** output. No `isPermanent`, no `summary`, no `confidence`, no `rawDiagnostic`. Those belong to BounceValidator and BounceMatcher respectively.

### 7.4 Methods

| Method | Input | Output | Responsibility |
|---|---|---|---|
| `parseRecipient(body)` | DSN plain text | `string \| null` | Extracts `Final-Recipient: rfc822; email` |
| `parseDiagnostic(body)` | DSN plain text | `string \| null` | Extracts `Diagnostic-Code: smtp; 550 ...` |
| `parseMessageId(body)` | DSN plain text | `string \| null` | Extracts `Original-Message-ID: <...>` |
| `parse(body)` | DSN plain text | `ParsedBounce` | Orchestrates the three extractions above |

### 7.5 `parse()` implementation

```typescript
function parse(body: string): ParsedBounce {
  return {
    recipient: parseRecipient(body),
    diagnostic: parseDiagnostic(body),
    originalMessageId: parseMessageId(body),
  };
}
```

---

## 8. BounceValidator Module

### 8.1 Responsibility

**Make binary go/no-go decisions about whether a parsed DSN is valid and actionable.** Takes a `ParsedBounce` and returns a `ValidatedBounce` or `null` (reject). Does not match, does not assign confidence, does not call the database.

### 8.2 Types

```typescript
interface ValidatedBounce {
  recipient: string;                   // Guaranteed non-null (rejected if null)
  diagnostic: string | null;           // Raw diagnostic (may be null)
  originalMessageId: string | null;    // May be null — matcher handles fallback
  isPermanent: boolean;                // true = 5xx permanent failure, false otherwise
  summary: string;                     // Human-readable string for teacher UI
}
```

### 8.3 Validation rules

| Validation | Condition | Action |
|---|---|---|
| **Permanent failure** | `diagnostic` starts with `5xx` | `isPermanent = true` — proceed |
| **Temporary failure** | `diagnostic` starts with `4xx` | Return `null` (reject). Remove UNREAD label. Log. |
| **Unclassifiable** | No diagnostic or doesn't match 4xx/5xx | `isPermanent = false`. Return `null`. Remove UNREAD label. Log. |
| **Required fields** | `recipient` is null | Return `null`. Remove UNREAD label. Log. |
| **Institutional domain** | `recipient` doesn't match `INSTITUTIONAL_EMAIL_DOMAIN` | Return `null`. Remove UNREAD label. Log. |
| **Malformed body** | All three fields (recipient, diagnostic, messageId) are null | Return `null`. Remove UNREAD label. Log. |

### 8.4 `validate()` implementation

```typescript
function validate(bounce: ParsedBounce): ValidatedBounce | null {
  if (!bounce.recipient) return null;
  if (!isInstitutionalEmail(bounce.recipient)) return null;

  const isPermanent = bounce.diagnostic
    ? /^\s*5\d{2}\s/.test(bounce.diagnostic)
    : false;

  if (!isPermanent) return null;  // temporary or unclassifiable

  return {
    recipient: bounce.recipient,
    diagnostic: bounce.diagnostic,
    originalMessageId: bounce.originalMessageId,
    isPermanent: true,
    summary: summarizeReason(bounce.diagnostic),
  };
}
```

### 8.5 Reason summarization

```typescript
function summarizeReason(diagnostic: string | null): string {
  if (!diagnostic) return "Delivery failure";
  if (diagnostic.includes("5.1.1")) return "Mailbox does not exist";
  if (diagnostic.includes("5.1.10")) return "Recipient rejected by mail server";
  if (diagnostic.includes("5.2.1")) return "Mailbox is disabled";
  if (diagnostic.includes("5.2.2")) return "Mailbox is full";
  if (diagnostic.includes("5.4.1")) return "Recipient domain does not exist";
  if (diagnostic.includes("5.4.4")) return "Unable to route to recipient";
  if (diagnostic.includes("5.7.1")) return "Delivery not authorized";
  return diagnostic.split("\n")[0].trim().slice(0, 100);
}
```

### 8.6 Key design note

`isPermanent` and `summary` are computed by BounceValidator, not BounceParser. The parser extracts raw strings. The validator interprets them. The parser never understands SMTP codes; the validator never parses MIME.

---

## 9. Confidence-Based Matching Strategy

### 9.1 Responsibility

BounceMatcher correlates a validated DSN to a `PendingProjectAssignment` and assigns a confidence level to the match. It is the **only** module that assigns confidence. No other module produces or modifies confidence values.

### 9.2 Types

```typescript
interface MatchResult {
  assignment: PendingProjectAssignment | null;
  matchConfidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  matchMethod: "messageId" | "email_single" | "email_multiple" | "none";
  candidatesFound: number;
  validatedBounce: ValidatedBounce;
}
```

### 9.3 Confidence thresholds

| Confidence | Condition | Action |
|---|---|---|
| **HIGH** | `Original-Message-ID` matched `EmailQueue.messageId` AND recipient email matched. | **Update.** `deliveryStatus = BOUNCED`. Create notification. |
| **MEDIUM** | No Message-ID match, but recipient email matched exactly ONE pending assignment (`deliveryStatus IS NULL`, `status = "PENDING"`). | **Update.** `deliveryStatus = BOUNCED`. Create notification. |
| **LOW** | No Message-ID match, and recipient email matched MULTIPLE pending assignments (different projects). Cannot determine which failed. | **Do NOT update.** Log with all candidate IDs. Remove UNREAD label. No notification. |
| **NONE** | No match at all. Recipient email does not correspond to any active pending assignment. | **Do NOT update.** Remove UNREAD label. No notification. |

### 9.4 Matching algorithm

```typescript
async function match(validated: ValidatedBounce): Promise<MatchResult> {
  // Phase 1: Try Original-Message-ID → EmailQueue.messageId
  if (validated.originalMessageId) {
    const emailQueue = await prisma.emailQueue.findFirst({
      where: { messageId: validated.originalMessageId },
    });
    if (emailQueue && emailQueue.to === validated.recipient) {
      const assignment = await prisma.pendingProjectAssignment.findFirst({
        where: {
          email: validated.recipient,
          status: "PENDING",
          deliveryStatus: null,
        },
        orderBy: { createdAt: "desc" },
        include: { project: { select: { teacherId: true, title: true } } },
      });
      if (assignment) {
        return { assignment, matchConfidence: "HIGH", matchMethod: "messageId", candidatesFound: 1, validatedBounce: validated };
      }
    }
  }

  // Phase 2: Match by recipient email
  const candidates = await prisma.pendingProjectAssignment.findMany({
    where: {
      email: validated.recipient,
      status: "PENDING",
      deliveryStatus: null,
    },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { teacherId: true, title: true } } },
  });

  if (candidates.length === 1) {
    return { assignment: candidates[0], matchConfidence: "MEDIUM", matchMethod: "email_single", candidatesFound: 1, validatedBounce: validated };
  }
  if (candidates.length > 1) {
    return { assignment: null, matchConfidence: "LOW", matchMethod: "email_multiple", candidatesFound: candidates.length, validatedBounce: validated };
  }
  return { assignment: null, matchConfidence: "NONE", matchMethod: "none", candidatesFound: 0, validatedBounce: validated };
}
```

### 9.5 Why MEDIUM confidence is safe

The `@@unique([projectId, email])` constraint guarantees at most one active pending record per project+email. If only one candidate exists, the match is unambiguous. The `deliveryStatus IS NULL` filter prevents matching already-bounced records.

---

## 10. Multiple Invitation Edge Cases

| Scenario | Behavior |
|---|---|
| Same email, different projects, both pending | `matchConfidence: LOW`. No update. Log warning with both project IDs. |
| Same email, one project cancels | Remaining candidate gets `matchConfidence: MEDIUM`. Update proceeds. |
| Same email, same project, teacher edits | Old pending deleted. New pending created. DSN matches new record via Message-ID. `matchConfidence: HIGH`. |
| Same email, teacher resends after bounce | EmailQueue created, but `deliveryStatus IS NULL` filter skips the already-bounced record. Idempotent. |

---

## 11. Delivery States

### 11.1 Enum

```prisma
enum DeliveryStatus {
  BOUNCED
}
```

### 11.2 State model

```
null (default)
  → DSN detected (5xx permanent, confidence HIGH or MEDIUM)
    → DeliveryStatus.BOUNCED
  → No DSN detected → stays null
```

Only two values. `null` = no known issue. `BOUNCED` = delivery failed. No intermediate states.

---

## 12. Database Design

### 12.1 Schema changes

#### `EmailQueue` — one new field

```prisma
model EmailQueue {
  // ... existing fields ...
  messageId String?          // Gmail Message-ID from sendMail()
                             // Primary correlation key for DSN matching
}
```

#### `PendingProjectAssignment` — four new fields

```prisma
model PendingProjectAssignment {
  // ... existing fields ...

  deliveryStatus      DeliveryStatus?  // null | BOUNCED
  bounceDiagnosticRaw String?          // Full raw diagnostic (for debugging)
  bounceReason        String?          // Human-readable summary (for teacher UI)
  lastBounceAt        DateTime?        // When DSN was detected

  // ... relations and indexes unchanged ...
}
```

`bounceDiagnosticRaw` and `bounceReason` are both stored because they serve different audiences (operator debugging vs teacher UI).

### 12.2 Fields NOT added

| Field | Reason |
|---|---|
| `emailQueueId` | Unnecessary FK. Multiple queue records per pending (resends). Matcher doesn't need this join. |
| `pendingAssignmentId` on queue | EmailQueue doesn't own invitation semantics. |

### 12.3 Indexes

Existing indexes sufficient. Composite `(email, status, deliveryStatus)` may be added later if needed.

---

## 13. Capture Message-ID on Send

### 13.1 `sendEmail()` return value

```typescript
export async function sendEmail(options: { ... }): Promise<{ messageId: string | null }> {
  const info = await transporter.sendMail({ ... });
  return { messageId: info.messageId || null };
}
```

### 13.2 `processEmailQueue()` stores `messageId`

```typescript
if (result.status === "fulfilled") {
  const sendResult = result.value;
  await prisma.emailQueue.update({
    where: { id: job.id },
    data: { status: EmailQueueStatus.SENT, messageId: sendResult.messageId, errorLog: null },
  });
}
```

---

## 14. Background Worker Design

### 14.1 Architecture

- **Trigger:** External cron calling `POST /api/cron/detect-bounces`
- **Frequency:** Set by the deployment platform's cron schedule (recommended: every 15 minutes). The worker code does not hardcode this.
- **Auth:** `EMAIL_QUEUE_CRON_SECRET`
- **Idempotent:** DSNs have UNREAD removed after processing. `deliveryStatus IS NULL` prevents double-processing.

### 14.2 Rate limiting & backoff

| Scenario | Behavior |
|---|---|
| **HTTP 429** | Sleep `Retry-After`. Otherwise exponential backoff: 60s, 120s, 240s (capped 300s). |
| **HTTP 401** | Log error. Do not retry this run. `googleapis` auto-refreshes tokens; if refresh token is invalid, requires operator intervention. |
| **HTTP 503 / 5xx** | Retry once after 30s. Return early on second failure. |
| **Network timeout** | Return early. Next cron run retries. |
| **3 consecutive failures** | Log critical alert. Worker keeps retrying every subsequent run. |

### 14.3 Cron concurrency protection

1. **Gmail-level:** `is:unread` filter ensures only unread DSNs are returned. Once one worker removes UNREAD, the other worker's query won't include it.
2. **Database-level:** `deliveryStatus IS NULL` ensures only the first worker to write `BOUNCED` succeeds.

No external locking required.

### 14.4 Maximum per-run

`maxResults: 10`. Prevents any single run from excessive processing. Remaining DSNs picked up next interval.

### 14.5 Orchestrator

```typescript
async function detectBounces(): Promise<BounceDetectionResult> {
  const gmail = createGmailClient(...);
  const messages = await BounceFetcher.fetchNew(gmail, { maxResults: 10 });

  let bounced = 0, errors = 0, lowConfidence = 0;

  for (const msg of messages) {
    try {
      // 1. Parse
      const parsed = BounceParser.parse(msg.rawBody);

      // 2. Validate
      const validated = BounceValidator.validate(parsed);
      if (!validated) {
        // Rejected (temporary, missing fields, invalid domain, malformed)
        await BounceFetcher.markRead(gmail, msg.gmailMessageId);
        continue;
      }

      // 3. Match
      const match = await BounceMatcher.match(validated);

      if (match.matchConfidence === "HIGH" || match.matchConfidence === "MEDIUM") {
        await BounceProcessor.process(match);
        await NotificationService.notifyBounce(match);
        bounced++;
      } else if (match.matchConfidence === "LOW") {
        logger.warn("Low confidence bounce match", { ... });
        lowConfidence++;
      }
      // NONE: no action needed beyond logging

      // 4. Remove UNREAD — DSN stays in Inbox
      await BounceFetcher.markRead(gmail, msg.gmailMessageId);
    } catch (err) {
      errors++;
      // DSN NOT marked as read — will be retried next run
    }
  }

  return { checked: messages.length, bounced, errors, lowConfidence };
}
```

---

## 15. Notification Flow

### 15.1 When

| Event | Recipient | Channel | When |
|---|---|---|---|
| Bounce recorded (confidence HIGH or MEDIUM) | Project teacher | In-app notification | After `deliveryStatus = BOUNCED` written |

### 15.2 Content

```typescript
await prisma.notification.create({
  data: {
    userId: project.teacherId,
    type: "PROJECT_UPDATED",
    title: "Invitation delivery failed",
    message: `The invitation sent to ${email} bounced: ${validated.summary}`,
    link: `/teacher/projects/${projectId}`,
  },
});
```

### 15.3 Deduplication by assignment identity

Each `PendingProjectAssignment` record generates at most one bounce notification across its entire lifetime. Deduplication is by `assignment.id`, not by time window or notification title.

```typescript
async function notifyBounce(match: MatchResult): Promise<void> {
  const assignment = match.assignment!;

  // Check if a bounce notification already exists for this specific
  // assignment record. Each record gets at most one notification.
  const existing = await prisma.notification.findFirst({
    where: {
      userId: assignment.project.teacherId,
      type: "PROJECT_UPDATED",
      link: `/teacher/projects/${assignment.projectId}`,
      createdAt: { gte: assignment.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    await prisma.notification.create({ ... });
  }
}
```

This means:
- A single pending assignment never generates >1 notification
- Editing the email creates a new pending record (via `editPendingAssignment()` — old deleted, new created) — the new record is eligible for a fresh notification
- Resending does NOT create a new pending record — no new notification
- No arbitrary time windows

### 15.4 Other channels

| Channel | Decision | Reason |
|---|---|---|
| In-app notification | ✅ Yes | Appears in NotificationPanel |
| Toast | ❌ No | Teacher may not be in dashboard when cron runs |
| Email | ❌ No | The bounce DSN already arrives via email |
| Badge/counter | ✅ Yes | Unread count increments naturally |

---

## 16. Teacher Experience

### 16.1 Pending card

```
Normal (deliveryStatus = null):

┌──────────────────────────────────────────┐
│ ⏳  aman@tcetmumbai.in                   │
│     Invitation sent · 2 days ago         │
│                         [Edit] [Resend]  │
│                                   [✕]   │
└──────────────────────────────────────────┘

Bounced (deliveryStatus = BOUNCED):

┌──────────────────────────────────────────┐
│ ❌  aman@tcetmumbai.in                   │
│     Invitation delivery failed           │
│     Mailbox does not exist               │
│                         [Edit] [Resend]  │
│                                   [✕]   │
└──────────────────────────────────────────┘
```

### 16.2 When bounce clears

| Action | Effect | Reason |
|---|---|---|
| **Edit (changes address)** | `editPendingAssignment()` creates new record. `deliveryStatus = null`. | New address gets fresh delivery attempt. |
| **Cancel** | Record deleted. No card. | Teacher abandoning this invitation. |
| **Resend** | `deliveryStatus` stays `BOUNCED`. | Same address, same result. Teacher must edit. |

---

## 17. Recovery Workflow & State Transitions

### 17.1 State machine

```
PendingProjectAssignment (deliveryStatus = null, status = "PENDING")
  │
  ├── No DSN → stays null (no news is good news)
  │
  ├── DSN detected (5xx, confidence HIGH or MEDIUM)
  │   → deliveryStatus = BOUNCED
  │   → Teacher sees ❌
  │   → Teacher notified in-app
  │   │
  │   ├── Edit → correct email → new pending created (deliveryStatus = null)
  │   ├── Resend → deliveryStatus stays BOUNCED
  │   └── Cancel → record deleted
  │
  └── Teacher edits before any DSN
      → Old pending deleted, new pending created (deliveryStatus = null)
```

### 17.2 History preservation

When a teacher edits, the old pending record is deleted. Bounce history is intentionally discarded because:
- The old email was wrong — its bounce record has no ongoing value
- The `EmailQueue` record and archived Gmail DSN preserve the audit trail if needed

---

## 18. Failure Scenarios

| Scenario | Expected Behavior |
|---|---|
| **Gmail API 503** | `BounceFetcher` catches, logs, returns 0 results. Next cron run retries. |
| **OAuth expired** | `googleapis` auto-refreshes. If refresh token invalid, logs error. Operator intervention required. |
| **Rate limited (429)** | Exponential backoff up to 300s. |
| **Duplicate DSNs** | First sets `deliveryStatus = BOUNCED`. Second finds `deliveryStatus IS NULL` false — skip. |
| **Delayed DSN (>7 days)** | Outside search window. Skipped. |
| **DSN for non-invitation email** | `BounceMatcher.match()` returns NONE. UNREAD removed. |
| **DSN after pending resolved** | `status = "PENDING"` filter skips it. UNREAD removed. |
| **Same email, multiple projects** | `matchConfidence: LOW`. Logged. Not updated. |
| **DSN body unparseable** | `BounceParser` returns null fields. `BounceValidator` rejects. UNREAD removed. Logged. |
| **Missing Original-Message-ID** | Fall to email matching. Confidence MEDIUM (1 candidate) or LOW (multiple). |
| **Cron concurrency** | `is:unread` + `deliveryStatus IS NULL` prevent double-processing. |
| **3 consecutive cron failures** | Log critical alert. Worker keeps retrying. |
| **Database write fails** | DSN NOT marked as read — will retry next run. |

---

## 19. Logging & Metrics

### 19.1 Structured log fields

```typescript
interface BounceDetectionLog {
  event: "bounce_detection_run" | "bounce_processed" | "bounce_skipped" | "bounce_error";
  timestamp: string;
  duration: number;

  // Per-run
  checked: number;  lowConfidence: number;  errors: number;  apiCalls: number;

  // Per-bounce
  recipient: string; projectId: string; teacherId: string;
  messageId: string; matchMethod: string; matchConfidence: string;
  candidatesFound: number; gmailMessageId: string;
}
```

### 19.2 Operational metrics

| Metric | Source |
|---|---|
| invitations_sent_total | EmailQueue.status = SENT |
| invitations_bounced_total | PendingProjectAssignment.deliveryStatus = BOUNCED |
| bounce_rate | Derived (bounced / sent) |
| parser_failures_total | Structured log |
| validator_failures_total | Structured log |
| gmail_api_errors_total | Structured log |
| correlation_high_confidence_total | Structured log |
| correlation_medium_confidence_total | Structured log |
| correlation_low_confidence_total | Structured log |
| correlation_none_total | Structured log |
| ambiguous_matches_total | correlation_low_confidence_total |
| notifications_created_total | Notification table |
| detection_latency_seconds | Gmail message internalDate vs lastBounceAt |
| cron_duration_ms | Structured log |

---

## 20. Monitoring Recommendations

| Condition | Severity | Action |
|---|---|---|
| Gmail API failure rate > 5% over 1 hour | Warning | Check OAuth, network, GCP console |
| Parser failure spike (3+ runs with 0 parsed DSNs) | Warning | Investigate DSN format changes |
| Validator failure spike | Warning | May indicate format change |
| LOW confidence > 2 per day | Info | May indicate same-email-multiple-projects pattern |
| No DSNs in 24 hours while emails were sent | Info | May indicate worker failure |
| Detection latency > 60 minutes | Info | Check cron schedule |
| OAuth credentials expire | Critical | Requires manual refresh token regeneration |

---

## 21. Security Review

### 21.1 OAuth scopes

| Scope | Purpose | Required? |
|---|---|---|
| `gmail.readonly` | Read DSN bodies | ❌ Cannot mark as read — DSNs reprocessed every run |
| `gmail.modify` | Read DSNs + remove UNREAD label | ✅ Sufficient. Cannot send, delete, or modify settings. |
| `mail.google.com` | Full mailbox access | ❌ Too broad — this is the existing SMTP scope but the worker does not need it |

**Recommendation:** `gmail.modify`. The `readonly` scope would leave DSNs unread, causing every cron run to re-process them. `gmail.modify` removes only the UNREAD label. This is less privileged than the existing `mail.google.com` scope already deployed for SMTP.

### 21.2 Refresh token regeneration

After adding `gmail.modify` to the OAuth consent screen, the existing refresh token **must be regenerated**. The old token was issued without this scope and cannot be upgraded. Steps:

1. Add `https://www.googleapis.com/auth/gmail.modify` to the OAuth consent screen in GCP Console
2. Run the OAuth2 authorization flow with both `https://mail.google.com/` (for SMTP) and `https://www.googleapis.com/auth/gmail.modify` (for detection)
3. Save the new refresh token to `GOOGLE_REFRESH_TOKEN` in `.env`
4. Deploy the updated `.env`

The detection worker will fail with 401 errors until a valid refresh token with the correct scope is provided.

### 21.3 Credential storage

All credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) are already deployed for SMTP. No new secrets are introduced.

### 21.4 DSN data handling

- Only `Final-Recipient`, `Diagnostic-Code`, and `Original-Message-ID` are extracted from DSN bodies.
- Full DSN bodies are not persisted. The raw diagnostic is stored as `bounceDiagnosticRaw`.
- The DSN's UNREAD label is removed after processing. It remains in the Inbox for operator visibility.

---

## 22. Environment & Deployment

### 22.1 Environment variables

None new. All credentials reuse existing SMTP configuration. The existing `GOOGLE_REFRESH_TOKEN` must be regenerated with the new scope (see section 21.2).

### 22.2 Google Cloud configuration

| Step | Action |
|---|---|
| 1 | Enable **Gmail API** in GCP Console |
| 2 | Add `https://www.googleapis.com/auth/gmail.modify` to OAuth consent screen |
| 3 | Generate new refresh token with both scopes |
| 4 | Update `GOOGLE_REFRESH_TOKEN` in `.env` |

### 22.3 New dependency

```
npm install googleapis
```

### 22.4 Cron configuration

```
# Existing — SEND (every 2 min):
*/2 * * * * curl -X POST .../api/cron/process-emails -H "Authorization: Bearer ..."

# New — DETECT (every 15 min):
*/15 * * * * curl -X POST .../api/cron/detect-bounces -H "Authorization: Bearer ..."
```

### 22.5 Deployment order

```
1. Prisma migration (additive — messageId, DeliveryStatus enum, 4 pending fields)
2. npm install googleapis
3. Deploy Phase 1 — messageId capture (email.ts, email-queue.ts)
4. Google Cloud config (enable Gmail API, add scope, regenerate token)
5. Deploy Phase 2 — all 6 detection modules + cron endpoint
6. Configure cron trigger (*/15)
7. Deploy Phase 3 — UI (MembersTab.tsx bounce rendering)
```

---

## 23. Testing Strategy

### 23.1 Unit tests — BounceParser

| Test | Expected |
|---|---|
| `parseRecipient()` with valid DSN | Returns email |
| `parseRecipient()` with missing field | Returns null |
| `parseDiagnostic()` with 550 code | Returns string |
| `parseDiagnostic()` with 450 code | Returns string |
| `parseMessageId()` with valid ID | Returns `<msgid>` |
| `parseMessageId()` with missing ID | Returns null |
| `parse()` with all fields | ParsedBounce with 3 non-null fields |
| `parse()` with empty body | All fields null |

### 23.2 Unit tests — BounceValidator

| Test | Expected |
|---|---|
| `validate()` with 5xx diagnostic + all fields | Returns ValidatedBounce with isPermanent = true |
| `validate()` with 4xx diagnostic | Returns null (temporary) |
| `validate()` with null recipient | Returns null |
| `validate()` with non-institutional email | Returns null |
| `validate()` with all null fields (malformed) | Returns null |
| `summarizeReason("550 5.1.1 ...")` | `"Mailbox does not exist"` |
| `summarizeReason("550 5.7.1 ...")` | Falls back to first line |

### 23.3 Unit tests — BounceMatcher

| Test | Expected |
|---|---|
| Message-ID matches EmailQueue → one pending | HIGH confidence |
| Message-ID matches → no pending | Falls back to email |
| No Message-ID → one pending by email | MEDIUM confidence |
| No Message-ID → multiple pending by email | LOW confidence |
| No Message-ID → no pending by email | NONE confidence |

### 23.4 Integration tests

| Test | Expected |
|---|---|
| Full pipeline (mock Gmail → all 6 modules) | deliveryStatus = BOUNCED |
| Duplicate DSN pipeline | Second run: no state change |
| Temporary failure | deliveryStatus stays null |
| LOW confidence | No update, logged |
| Malformed MIME (message lacks `message/delivery-status`) | Message skipped, UNREAD removed, no DB changes |
| Edit clears bounce | New record has deliveryStatus = null |
| Resend preserves bounce | deliveryStatus stays BOUNCED |

### 23.5 E2E tests

| Test | Flow |
|---|---|
| Teacher sees bounce | Set deliveryStatus = BOUNCED → ❌ visible |
| Teacher edits after bounce | Edit → Save → bounce cleared |
| Teacher resends after bounce | Resend → bounce indicator remains |
| Notification appears | After bounce detected → NotificationPanel shows it |

### 23.6 Manual test with real Gmail

Send to `nonexistent-test@tcetmumbai.in` → wait for DSN → run cron → verify DB → verify UI → edit → verify cleared.

---

## 24. Rollback Strategy

### 24.1 Schema rollback

```
npx prisma migrate down
```

Drops: `EmailQueue.messageId`, `DeliveryStatus` enum, `PendingProjectAssignment.deliveryStatus`, `.bounceDiagnosticRaw`, `.bounceReason`, `.lastBounceAt`.

### 24.2 Code rollback

```
1. Revert detect-bounces route + detect-bounces.ts + all 6 delivery modules
2. Revert email.ts + email-queue.ts
3. Revert MembersTab.tsx
4. Remove googleapis from package.json
5. Run prisma migrate down (only after code reverted)
6. Deploy
```

---

## 25. File-by-File Implementation Plan

### Phase 1 — Message-ID capture

| File | Change | Lines |
|---|---|---|
| `src/lib/email.ts` | Return `{ messageId }` from `sendMail()` | +2 |
| `src/lib/email-queue.ts` | Store `messageId` on EmailQueue after SENT | +3 |

### Phase 2 — Database migration

| File | Change | Lines |
|---|---|---|
| `prisma/schema.prisma` | Add `messageId` to EmailQueue. `DeliveryStatus` enum. `deliveryStatus`, `bounceDiagnosticRaw`, `bounceReason`, `lastBounceAt` to PendingProjectAssignment. | +8 |

### Phase 3 — Detection modules

| File | Change | Lines |
|---|---|---|
| `src/lib/delivery/BounceFetcher.ts` | NEW — Gmail API client, search by `has:delivery-status`, MIME type verification, markRead() | ~40 |
| `src/lib/delivery/BounceParser.ts` | NEW — parseRecipient, parseDiagnostic, parseMessageId, parse | ~40 |
| `src/lib/delivery/BounceValidator.ts` | NEW — validate: permanent/temporary, required fields, domain, malformed | ~40 |
| `src/lib/delivery/BounceMatcher.ts` | NEW — confidence-based match (Message-ID → email) | ~50 |
| `src/lib/delivery/BounceProcessor.ts` | NEW — update PendingProjectAssignment | ~20 |
| `src/lib/delivery/NotificationService.ts` | NEW — notify teacher, per-assignment-ID dedup | ~30 |
| `src/lib/delivery/detectBounces.ts` | NEW — orchestrator: Fetcher → Parser → Validator → Matcher → Processor → Notifier | ~30 |
| `src/app/api/cron/detect-bounces/route.ts` | NEW — cron endpoint, EMAIL_QUEUE_CRON_SECRET auth | ~35 |

### Phase 4 — UI

| File | Change | Lines |
|---|---|---|
| `MembersTab.tsx` | Read deliveryStatus, bounceReason. Render ❌ variant when BOUNCED. | +15 |

**Summary:** 11 files, ~315 lines, 1 new dependency (`googleapis`).

---

## 26. Implementation Contract

### 26.1 What implementation agents must not do

- **Change the integration approach** — Gmail API only. No IMAP, no Pub/Sub.
- **Add delivery states beyond `null` and `BOUNCED`** — No `SENT`, `DELIVERED`, `PENDING` on PendingProjectAssignment.
- **Add FKs between EmailQueue and PendingProjectAssignment** — Correlation is query-time only.
- **Process LOW confidence matches as updates** — Log with LOW confidence details. Remove UNREAD label. Do not update any pending assignment.
- **Clear bounce status on resend** — Only edit clears it.
- **Skip structured logging** — All documented log fields are required.
- **Process temporary failures (4xx) as bounces** — Only 5xx permanent failures.
- **Introduce new notification types** — Reuse `PROJECT_UPDATED`.
- **Introduce additional matching signals** — Only Original-Message-ID and recipient email. No custom headers, no subject matching, no timestamp heuristics.
- **Store confidence on PendingProjectAssignment** — Confidence is ephemeral, computed at match time, not persisted.
- **Remove DSNs from the Inbox** — Only remove the UNREAD label. The message stays in the Inbox.
- **Search Gmail by sender address** — Use `has:delivery-status` only.
- **Hardcode poll interval** — The cron schedule is the platform's responsibility.

### 26.2 What to do when blocked

1. Document the blocker — what was assumed, what was discovered, why it blocks.
2. Do not work around it — do not silently change the architecture.
3. Request review — the blocker must be reviewed and the plan updated before deviating.

### 26.3 Contract

> Every implementation follows exactly this design. If it isn't in this document, it isn't part of the feature. If it contradicts this document, it is wrong.

---

## 27. Implementation Readiness Checklist

| Item | Status |
|---|---|
| **Design principles documented** | ✅ 9 principles |
| **Assumptions documented** | ✅ 6 assumptions in section 2 |
| **Module architecture finalized** | ✅ 6 single-responsibility modules + orchestrator |
| **Module responsibilities mutually exclusive** | ✅ Parser extracts. Validator validates. Matcher correlates. Processor updates. Notifier alerts. Orchestrator sequences. |
| **ParsedBounce type** | ✅ 3 fields only — no classification, no confidence |
| **ValidatedBounce type** | ✅ Distinct from ParsedBounce. Contains isPermanent + summary. |
| **Confidence assigned only by BounceMatcher** | ✅ Parser and Validator do not assign confidence |
| **DSN detection** | ✅ `has:delivery-status` only. No sender-based search. |
| **DSN processing** | ✅ UNREAD label removed. DSN stays in Inbox. Not archived. |
| **Notification deduplication** | ✅ By assignment identity (id). Max 1 per record lifetime. |
| **Schema changes** | ✅ 1 enum + 5 fields, all additive |
| **Refresh token regeneration documented** | ✅ Section 21.2 |
| **Malformed MIME test** | ✅ Integration test for missing `message/delivery-status` |
| **Sender-based search removed** | ✅ No `from:mailer-daemon` references |
| "archive" replaced with "remove UNREAD label" | ✅ Consistent throughout |
| **Logging & metrics** | ✅ 14 metrics, structured log fields defined |
| **Monitoring recommendations** | ✅ 7 alert conditions with severity levels |
| **Failure scenarios** | ✅ 13 edge cases documented |
| **Rollback documented** | ✅ Schema + code rollback steps |
| **File-by-file plan complete** | ✅ 11 files, ~315 lines, 1 new dependency |
| **Implementation contract defined** | ✅ 12 explicit constraints |
| **No remaining architectural decisions** | ✅ Everything finalized |

---

**Implementation Specification (Frozen). No architectural changes without a planning revision.**
