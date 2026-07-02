# Email Bounce Handling — Implementation Plan

> **Document status:** Final — frozen after this revision. Canonical implementation specification.  
> **Objective:** Help teachers recover from bounced invitation emails with the minimum possible interaction.  
> **Design philosophy:** Gmail is the notification system. The dashboard is the recovery system. No mailbox polling. No new dependencies. Zero schema changes for MVP.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Non-Goals](#2-non-goals)
3. [The Actual Problem](#3-the-actual-problem)
4. [Teacher Mental Model](#4-teacher-mental-model)
5. [Current Email Architecture](#5-current-email-architecture)
6. [Recovery Workflow](#6-recovery-workflow)
7. [Edit vs Resend: When to Use Each](#7-edit-vs-resend-when-to-use-each)
8. [UI Specification](#8-ui-specification)
9. [Database Impact](#9-database-impact)
10. [Notification Flow](#10-notification-flow)
11. [File-by-File Implementation Plan](#11-file-by-file-implementation-plan)
12. [Rollback Strategy](#12-rollback-strategy)
13. [Phase 2: Automatic Detection (Future)](#13-phase-2-automatic-detection-future)
14. [Why Gmail Is Sufficient for MVP](#14-why-gmail-is-sufficient-for-mvp)
15. [Implementation Contract](#15-implementation-contract)
16. [Implementation Readiness Checklist](#16-implementation-readiness-checklist)

---

## 1. Design Principles

These principles guide all implementation decisions. Future contributors must preserve them.

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Gmail is the notification system.** | Teachers already receive Delivery Status Notifications in their institutional inbox. The dashboard does not need to replicate this. |
| 2 | **The dashboard is the recovery system.** | The application's job is to make fixing a bounced email as fast as possible. It should never add steps between the teacher and the fix. |
| 3 | **`PendingProjectAssignment` remains the source of truth.** | All invitation state lives on the pending assignment. `EmailQueue` is a delivery mechanism — it does not own invitation semantics. |
| 4 | **Editing automatically resends.** | When a teacher edits a pending invitation's email, the system automatically queues a fresh invitation. The teacher never needs to press Resend after editing. |
| 5 | **No mailbox polling in MVP.** | No Gmail API, no IMAP, no cron for bounce detection. Teacher-driven recovery is sufficient for expected scale. |
| 6 | **Existing infrastructure is reused.** | The `editPendingAssignment()` transaction (create new + delete old + queue email) is the complete recovery mechanism. |
| 7 | **Operational simplicity is preferred over automation.** | Zero new dependencies, zero new environment variables, zero schema changes. An automated system would add infrastructure burden with marginal benefit at current scale. |
| 8 | **Teachers should resolve failures with the minimum possible interaction.** | Edit → Save → Resent. That is the complete workflow. No intermediate "Mark as Bounced" step. |

---

## 2. Non-Goals

This feature intentionally does **not** do the following. These are deliberate product decisions, not missing work.

| Non-Goal | Why |
|---|---|
| **Verify email existence before sending** | The system cannot verify whether a `@tcetmumbai.in` address exists before sending. Only Google's mail server can determine this. |
| **Replace Gmail delivery notifications** | Gmail's Delivery Status Notification is the authoritative source for whether an email was delivered. The dashboard does not duplicate this. |
| **Detect bounced emails automatically** | No Gmail API, no IMAP, no mailbox polling. Detection is delegated to Gmail, which already handles it. |
| **Monitor mailboxes** | No mailbox access of any kind in MVP. |
| **Guarantee email delivery** | Delivery guarantees are the mail server's responsibility, not the dashboard's. |
| **Validate institutional mailbox existence** | No pre-send validation. The system sends and trusts the mail server's response (which arrives as a DSN if it fails). |
| **Maintain a delivery history or audit trail** | Bounce history is ephemeral — it lives in Gmail's DSNs, not in the dashboard's database. |
| **Display delivery status on pending cards** | No `deliveryStatus` field, no bounce indicators, no visual state changes. The teacher already knows from Gmail. |

---

## 3. The Actual Problem

### 3.1 Today's workflow

```
Teacher enters student@tcetmumbai.in in Add Member dialog
  → System sends invitation via Gmail SMTP
  → If the address is invalid, Google sends a Delivery Status Notification
  → DSN lands in the teacher's Gmail inbox
  → Teacher sees the DSN (subject: "Delivery Status Notification (Failure)")
  → Teacher opens the dashboard
  → Teacher scrolls through pending invitations to find the matching email
  → Teacher guesses which one corresponds to the DSN
  → Teacher clicks Edit, fixes the address, saves
  → New invitation is sent
```

### 3.2 The actual friction points

| Friction | Solution |
|---|---|
| Teacher must identify which pending card corresponds to the DSN | The pending card displays the full email address. The DSN contains the recipient email. Matching is visual — find the email in the list. |
| Teacher must know that editing triggers a new invitation | Helper text in the Add Member dialog explains this upfront. See [section 8.2](#82-add-member-dialog). |
| Teacher might click Resend (wrong action) instead of Edit | Section [7](#7-edit-vs-resend-when-to-use-each) documents the distinction. The UI already has both buttons — no change needed. |

### 3.3 Not friction

- **Detection** — Not friction. Gmail already notifies the teacher. The DSN arrives within minutes.
- **Confirmation** — Not friction. The teacher doesn't need to tell the dashboard "this bounced." They already saw it. They go straight to Edit.
- **Error details** — Not friction. The DSN contains the specific error (e.g., "550 5.1.1 user unknown"). The teacher reads it in Gmail.

### 3.4 Expected volume

- Peak: tens of invitations per day during enrollment periods
- Typical: single digits per week
- Bounce rate: very low (institutional `@tcetmumbai.in` emails are stable)
- Total: well under 1,000 invitations per semester

A fully automated detection system polling a mailbox every 15 minutes would introduce infrastructure complexity for a problem that occurs a few times per month.

---

## 4. Teacher Mental Model

### 4.1 The canonical teacher journey

```
Student not registered on tcetcercd.in yet

Teacher enters student's institutional email

↓

Invitation sent

↓
├── Student registers → Automatically joins the project. Done.
│
└── Invitation bounces → Teacher sees DSN in Gmail inbox.
                         → Teacher opens dashboard Members tab.
                         → Teacher finds the matching email in Pending Invitations.
                         → Teacher clicks Edit, corrects the address.
                         → New invitation sent automatically.
                         → Student registers → Automatically joins the project. Done.
```

### 4.2 What the teacher needs to know

1. **Where pending invitations live** — In the Members tab of each project, under "Pending Invitations."
2. **What to look for** — The email address on the card matches the email in the Gmail DSN.
3. **What to click** — Edit (not Resend). Edit lets you change the address.
4. **What happens next** — Saving automatically sends a new invitation. No second step needed.

### 4.3 What the teacher does NOT need to know

- Bounce detection statuses
- Email queue internals
- Message-IDs or SMTP codes
- Whether a delivery confirmation arrived

---

## 5. Current Email Architecture

### 5.1 Email flow (unchanged)

```
Server action (addProjectMember, scheduleReview, etc.)
  → EmailQueue.create({ to, subject, body, status: "PENDING" })
  → Cron: POST /api/cron/process-emails
    → processEmailQueue()
      → sendEmail() via Nodemailer + Gmail SMTP OAuth2
      → On success: EmailQueue.status = "SENT"
      → On failure (attempts < 3): EmailQueue.status = "PENDING" (retry)
      → On failure (attempts >= 3): EmailQueue.status = "FAILED"
```

The email sending pipeline is **unchanged** by this plan. No modifications to `email.ts`, `email-queue.ts`, or the cron endpoint.

### 5.2 Relevant models (current state — unchanged)

```prisma
model PendingProjectAssignment {
  id          String     @id @default(cuid())
  projectId   String
  email       String
  name        String?
  memberRole  MemberRole @default(MEMBER)
  invitedById String
  status      String     @default("PENDING")
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  invitedBy User    @relation("PendingAssignmentInviter", fields: [invitedById], references: [id])

  @@unique([projectId, email])
  @@index([email])
  @@index([status])
  @@map("pending_project_assignments")
}

model EmailQueue {
  id        String           @id @default(cuid())
  to        String
  subject   String
  body      String           @db.LongText
  status    EmailQueueStatus @default(PENDING)
  attempts  Int              @default(0)
  errorLog  String?          @db.Text
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([status, createdAt])
  @@index([to])
  @@map("email_queue")
}
```

**No schema changes.** Both models remain exactly as they are.

---

## 6. Recovery Workflow

### 6.1 The complete recovery path

```
1. Teacher receives a DSN in Gmail
   └─ Subject: "Delivery Status Notification (Failure)"
   └─ Body: "550 5.1.1 The email account that you tried to reach does not exist."
   └─ Recipient: aman@tcetmumbai.in

2. Teacher opens the dashboard and navigates to the project's Members tab
   └─ Pending Invitations section displays all pending email addresses

3. Teacher finds the matching email visually
   └─ The card shows: aman@tcetmumbai.in

4. Teacher clicks the [Edit] button on that card
   └─ Dialog opens with current email pre-filled

5. Teacher corrects the address and clicks Save

6. System executes atomically (inside a single $transaction):
   a. Delete the old PendingProjectAssignment record
   b. Create a new PendingProjectAssignment with the corrected email
   c. Queue a new EmailQueue record (status: PENDING)

7. Teacher sees the corrected email in the pending list
   └─ "Invitation sent · just now" (fresh timestamp)

8. Cron processes the new email queue record
   └─ New invitation sent to the corrected address
```

### 6.2 What the teacher does NOT need to do

- Mark anything as "bounced"
- Paste SMTP error codes
- Click Resend after editing
- Open any separate bounce management page
- Contact support

### 6.3 The transaction in code

The existing `editPendingAssignment()` server action already handles step 6. No new server action is needed. The existing implementation:

```typescript
prisma.$transaction(async (tx) => {
  1. Validate new institutional email format
  2. Check no duplicate pending for [projectId, newEmail]
  3. Check newEmail not already a member
  4. tx.pendingProjectAssignment.create({ ...newEmail... })
  5. tx.pendingProjectAssignment.delete({ where: { id: oldId } })
  6. tx.emailQueue.create({ to: newEmail, ... })
})
```

This transaction is **the entire recovery mechanism**. It already:
- Cancels the old invitation (delete)
- Creates a new one (create)
- Queues a fresh email (EmailQueue.create)
- Is atomic (any failure rolls back all changes)

### 6.4 Why no separate bounce flow

Editing the email is the recovery action. There is no separate "bounce recovery" flow because:
- The teacher's goal is to correct the email. That's what Edit does.
- Saving automatically sends a new invitation. That's what Edit does.
- There is nothing else to do.

---

## 7. Edit vs Resend: When to Use Each

The Members tab displays both [Edit] and [Resend] buttons on each pending invitation card. They serve different purposes and must not be merged or redefined.

### 7.1 Edit

| Aspect | Detail |
|---|---|
| **When to use** | The email address is incorrect. The student doesn't have access to the invited address. |
| **What it does** | Opens a dialog to change the email address. On save: creates a new pending record with the corrected email, deletes the old record, queues a fresh invitation. |
| **After save** | A new invitation is automatically sent to the new address. The old invitation is cancelled. |
| **Does it resend?** | Yes — a new invitation is queued to the corrected address. The teacher does not need to click Resend afterward. |

### 7.2 Resend

| Aspect | Detail |
|---|---|
| **When to use** | The email address is correct, but the teacher wants another invitation sent (e.g., the student says they didn't receive it, or it went to spam). |
| **What it does** | Queues a duplicate email to the same address. Does not change any data on the pending record. |
| **After resend** | A new invitation is sent to the existing address. The old email queue record remains unchanged. |
| **Does it replace the old invitation?** | No. The old email was already sent; this is a fresh attempt to the same address. |

### 7.3 Decision tree

```
Teacher wants to respond to a bounced invitation:

  Is the email address wrong?
    → YES → Click [Edit]. Correct the address. Save. New invitation sent automatically.
    → NO  → Click [Resend]. Same address. New attempt sent.

  What if the teacher isn't sure?
    → Click [Edit] to verify the address. Cancel if it's already correct.
```

### 7.4 Implementation note

No changes are needed to either button's behavior. They already work as described. The `resendPendingInvitation()` and `editPendingAssignment()` server actions in `projects.ts` already implement this distinction.

---

## 8. UI Specification

### 8.1 Pending invitation cards (existing — unchanged)

The Members tab displays pending invitations as cards below the active member list. Each card shows:

```
⏳  aman@tcetmumbai.in
    Invitation sent · 2 days ago
                         [Edit] [Resend]
                                   [✕]
```

| Element | Purpose |
|---|---|
| `aman@tcetmumbai.in` | The full email address. This is what the teacher matches against the Gmail DSN. |
| `Invitation sent · 2 days ago` | When the invitation was first created. Helps the teacher gauge recency. |
| [Edit] | Opens dialog to change the email. This is the bounce recovery action. |
| [Resend] | Sends another invitation to the same address. For non-bounce scenarios. |
| [✕] | Cancels the invitation entirely. Frees the reserved slot. |

### 8.2 Add Member dialog — helper text

When creating a new pending invitation, the dialog includes:

```
Add Member dialog:

  ● Student Institutional Email   [__________________]
    (placeholder: "student@tcetmumbai.in")

  ● Role                     [Select: MEMBER ▼]

  [Cancel]  [Add Member]

  Hint (below input):
    "Use the student's official institutional email ending in @tcetmumbai.in.
    If the invitation cannot be delivered, Gmail will notify you.
    Simply edit the student's email address and save to send a new invitation."
```

This hint serves three purposes:
1. Reinforces the institutional email requirement
2. Sets expectations that Gmail (not the dashboard) handles delivery notification
3. Teaches the recovery workflow before the teacher ever needs it

### 8.3 Where pending invitations appear

Pending invitations appear in the **Members tab** of each project's detail page. This is the same location where teachers add and manage team members. The "Pending Invitations" section sits below active members.

The teacher navigates to:
```
Dashboard → Teacher → Projects → [Select Project] → Members tab
```

### 8.4 What does NOT change

| UI element | Status | Reason |
|---|---|---|
| Pending invitation card layout | Unchanged | Email displayed, Edit button exists. No new elements needed. |
| Edit email dialog | Unchanged | Opens with current email pre-filled. Saves triggers the transaction. |
| Resend behavior | Unchanged | Queues duplicate email to same address. |
| Cancel behavior | Unchanged | Deletes the pending record. |
| Counter display | Unchanged | `Pending Invitations (2)` — unaffected by bounces. |
| Active member list | Unchanged | No bounce state on confirmed members. |

---

## 9. Database Impact

### 9.1 Zero schema changes

No migration required. The `PendingProjectAssignment` and `EmailQueue` models remain unchanged.

### 9.2 What was considered and rejected

| Proposed field | Status | Reason for rejection |
|---|---|---|
| `PendingProjectAssignment.deliveryStatus` | Not added | No source of truth for this value — teacher already knows from Gmail; no auto-detection in MVP |
| `PendingProjectAssignment.bounceReason` | Not added | Teachers should not paste SMTP errors; the DSN in Gmail is the authoritative error record |
| `PendingProjectAssignment.lastBounceAt` | Not added | Removed with deliveryStatus |
| `EmailQueue.messageId` | Not added | Not needed for MVP — no mailbox polling to correlate against |

---

## 10. Notification Flow

### 10.1 No new notifications

The notification system is **unaffected** by this plan. No new notification types, no new notification triggers, no new recipients.

**Why:** The teacher's notification is the DSN email from Google's Mailer-Daemon. An in-app notification that says "your invitation bounced" would be redundant — the teacher already received it via email. Adding a second notification channel for the same event violates principle 1 (Gmail is the notification system).

---

## 11. File-by-File Implementation Plan

### 11.1 Files changed

| File | Change | Lines | Risk |
|---|---|---|---|
| `MembersTab.tsx` | Update helper text in Add Member dialog to include bounce recovery guidance. See [section 8.2](#82-add-member-dialog) for exact text. | +2 lines (modify existing hint) | None — text-only change |

### 11.2 Files NOT changed

| File | Reason not changed |
|---|---|
| `prisma/schema.prisma` | Zero schema changes needed |
| `src/lib/email.ts` | Email sending pipeline is unaffected |
| `src/lib/email-queue.ts` | Queue processing is unaffected |
| `src/server/actions/projects.ts` | `editPendingAssignment()` already queues email — no behavioral change needed |
| `src/app/api/cron/process-emails/route.ts` | Cron endpoint is unaffected |
| `.env.example` | No new environment variables |
| `package.json` | No new dependencies |

### 11.3 Total implementation

| Metric | Value |
|---|---|
| Files changed | 1 |
| Lines added/modified | 2 |
| New dependencies | 0 |
| New environment variables | 0 |
| Schema migrations | 0 |
| New API routes | 0 |
| New server actions | 0 |
| New cron jobs | 0 |
| OAuth changes | 0 |
| GCP configuration | 0 |

---

## 12. Rollback Strategy

### 12.1 Rollback

Revert the 2-line text change in `MembersTab.tsx`. Deploy.

**There is nothing else to roll back.** No schema migration, no new dependencies, no new infrastructure. The entire change is removable in a single commit.

---

## 13. Phase 2: Automatic Detection (Future)

### 13.1 When to reconsider automation

Automatic bounce detection should only be reconsidered if at least one of these conditions is met:

- Invitation volume grows substantially (100+/day consistently)
- Teachers repeatedly report that manual recovery is burdensome
- Measurable operational data justifies the additional infrastructure

**Future automation must provide a clear measurable benefit over Gmail's existing Delivery Status Notification.** Automation should not exist simply because it is technically possible.

### 13.2 What Phase 2 would look like

```
If pursued, Phase 2 would add:

  1. Capture messageId from sendMail() return value → store on EmailQueue
     (schema: add EmailQueue.messageId field)

  2. googleapis dependency + Gmail API client for inbox reading

  3. New OAuth scope: gmail.readonly (requires re-authorization, new refresh token)

  4. POST /api/cron/detect-bounces endpoint
     → Polls Gmail inbox for DSNs matching mailer-daemon@googlemail.com
     → Matches by recipient email against PendingProjectAssignment records
     → Sets deliveryStatus = "BOUNCED" on matching records

  5. PendingProjectAssignment schema additions:
     → deliveryStatus String? (null | "BOUNCED")
     → bounceReason String? (extracted diagnostic code from DSN)
     → lastBounceAt DateTime? (when DSN was processed)

  6. UI: bounce indicator (❌) on pending cards when deliveryStatus = "BOUNCED"
```

### 13.3 Why not now

| Concern | MVP | Phase 2 |
|---|---|---|
| New dependencies | 0 | `googleapis` |
| Schema changes | 0 | +4 fields across 2 tables |
| OAuth changes | None | New scope + re-authorization |
| Cron jobs | 0 | +1 (every 15 min) |
| GCP configuration | None | Enable Gmail API |
| Maintenance | None | OAuth token rotation, API monitoring |
| Teacher benefit | Edit → Save → Resent | Auto-detect, but Edit → Save → Resent is the same recovery |

The MVP covers the recovery path (Edit → Save → auto-resend). Phase 2 adds automated detection (system notices the bounce without the teacher). The notification is already handled by Gmail. The benefit of Phase 2 is marginal at current scale.

### 13.4 Phase 2 must remain optional

Future automation must be independently deployable. The MVP must never depend on Gmail APIs. If Phase 2 is implemented, it must degrade gracefully if the Gmail API is unavailable — the teacher-driven Edit → Save → Resent workflow must always work.

---

## 14. Why Gmail Is Sufficient for MVP

### 14.1 What Gmail already provides

| Capability | Gmail DSN | Dashboard would duplicate |
|---|---|---|
| Delivery notification | ✅ Immediate email to sender | Polling-based, delayed detection |
| Failure reason | ✅ "550 5.1.1 User unknown" | Would need DSN parsing |
| Timestamp | ✅ Exact time of failure | Would need DSN parsing |
| Recipient address | ✅ Included in DSN body | Already stored in pending record |

### 14.2 Why duplication is unnecessary

To replicate what Gmail already does, the dashboard would need:

- A new dependency (`googleapis`)
- A new OAuth scope (`gmail.readonly`)
- A new refresh token (existing one lacks the scope)
- Gmail API enablement in GCP Console
- A new cron endpoint (polling every 15 minutes)
- A new background worker (DSN parsing + matching)
- Schema changes (4 fields across 2 tables)
- Ongoing maintenance (OAuth token rotation, API monitoring)

All of this infrastructure would exist to detect something that:
- Happens infrequently (single-digit times per week)
- Is already communicated to the teacher via DSN email
- Requires the same corrective action regardless (Edit → Save)

### 14.3 Summary

> This feature intentionally optimizes for operational simplicity rather than perfect delivery visibility. The teacher already receives Google's Delivery Status Notification. The dashboard exists to make correcting the email effortless, not to duplicate Google's mail infrastructure.

---

## 15. Implementation Contract

### 15.1 What implementation agents must not do

Implementation agents **must not**:

- **Change the recovery workflow** — Edit → Save → Resent. That is the complete workflow. No intermediate steps.
- **Introduce Gmail API** — No `googleapis`, no Gmail API client, no mailbox polling. This is a Phase 2 consideration only.
- **Introduce IMAP** — No IMAP connections, no mailbox reading.
- **Introduce mailbox polling** — No cron jobs for bounce detection.
- **Add delivery status fields to the schema** — `deliveryStatus`, `bounceReason`, `lastBounceAt` are not added in MVP. `EmailQueue.messageId` is not added in MVP.
- **Add a "Mark as Bounced" button or any bounce-specific UI** — The existing [Edit] button is the complete recovery mechanism.
- **Merge or redefine Edit and Resend** — They serve different purposes. Edit changes the address. Resend retries the same address. See [section 7](#7-edit-vs-resend-when-to-use-each).
- **Expand the notification system** — No new notification types, no new notification triggers for bounce detection.
- **Add new environment variables** — No new configuration values for bounce handling.
- **Add new dependencies** — No `googleapis`, no `imap`, no `mailparser`.

### 15.2 What to do when blocked

If implementation uncovers a genuine blocker (e.g., a constraint not visible from code analysis):

1. **Document the blocker** — What was assumed, what was discovered, why it blocks.
2. **Do not work around it** — Do not silently change the architecture or invent a new flow.
3. **Request review** — The blocker must be reviewed and the plan updated before deviating from this specification.

### 15.3 Contract

> Every implementation follows exactly this design. If it isn't in this document, it isn't part of the feature. If it contradicts this document, it is wrong.

---

## 16. Implementation Readiness Checklist

| Item | Status |
|---|---|
| **Design principles documented** | ✅ 8 principles in section 1 |
| **Non-goals documented** | ✅ 10 explicit non-goals in section 2 |
| **Teacher mental model documented** | ✅ Canonical journey in section 4 |
| **Recovery workflow finalized** | ✅ Edit → Save → Resent. No intermediate steps. See section 6. |
| **Edit vs Resend distinction documented** | ✅ Section 7 — clear separation of purpose |
| **"Mark as Bounced" not added** | ✅ Removed. Teacher already knows from Gmail. |
| **deliveryStatus fields not added** | ✅ Zero schema changes. |
| **Add Member helper text specified** | ✅ Section 8.2 — exact wording provided |
| **Pending invitation card location documented** | ✅ Section 8.3 — Members tab below active members |
| **Resend behavior clarified** | ✅ Section 7.2 — queues duplicate to same address |
| **Edit auto-resend clarified** | ✅ Section 6.3 — the `editPendingAssignment()` transaction queues email automatically |
| **Terminology consistent** | ✅ "edit the address and save to send a new invitation" used throughout |
| **Notification scope defined** | ✅ No new notifications. Gmail DSN is the notification. |
| **Why Gmail is sufficient documented** | ✅ Section 14 — detailed reasoning |
| **Phase 2 boundary defined** | ✅ Must remain optional. Clear trigger criteria. |
| **Rollback documented** | ✅ Single commit revert. |
| **Implementation contract defined** | ✅ Section 15. |
| **No remaining architectural decisions** | ✅ Every decision is finalized. |

---

**Planning phase complete. This document is frozen. Implementation agents should only need to answer "How do I implement this?" not "What should I build?"**

**Any future architectural changes require an explicit planning revision before implementation.**
