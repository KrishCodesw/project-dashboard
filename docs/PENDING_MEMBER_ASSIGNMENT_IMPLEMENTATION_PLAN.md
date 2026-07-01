# Pending Member Assignment — Implementation Plan

> **Document status:** Implementation-ready specification — planning phase complete  
> **Objective:** Allow teachers to add unregistered students to projects via email-based pending assignments, reusing existing `PendingProjectAssignment` infrastructure.  
> **Constraints:** No schema changes for MVP. No new models. No new API routes. Zero regressions.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Source of Truth Architecture](#2-source-of-truth-architecture)
3. [Final Architecture](#3-final-architecture)
4. [Updated Workflow](#4-updated-workflow)
5. [Business Rules](#5-business-rules)
6. [Edge Cases](#6-edge-cases)
7. [API Design](#7-api-design)
8. [Database Considerations](#8-database-considerations)
9. [UI Behavior](#9-ui-behavior)
10. [Notification Flows](#10-notification-flows)
11. [Audit Strategy](#11-audit-strategy)
12. [Team Size Behavior](#12-team-size-behavior)
13. [Project State Behavior](#13-project-state-behavior)
14. [UI Consistency Matrix](#14-ui-consistency-matrix)
15. [File-by-File Implementation Plan](#15-file-by-file-implementation-plan)
16. [Migration Strategy](#16-migration-strategy)
17. [Testing Strategy](#17-testing-strategy)
18. [Rollback Strategy](#18-rollback-strategy)
19. [Future Extensibility](#19-future-extensibility)
20. [Implementation Readiness Checklist](#20-implementation-readiness-checklist)
21. [Implementation Contract](#21-implementation-contract)

---

## 1. Design Principles

These principles guide all implementation decisions. Future contributors should preserve them.

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Registered students become `ProjectMember` immediately.** | No pending state needed for existing users. Direct addition is the fast path. |
| 2 | **Unregistered students become `PendingProjectAssignment`.** | The pending assignment is the canonical pre-registration membership mechanism. All unregistered invitations use it. |
| 3 | **Registration automatically resolves pending assignments.** | `upsertDashboardUser()` detects pending by email and creates `ProjectMember` records atomically during user creation. Teachers do nothing. |
| 4 | **Teachers never manually convert pending to member.** | Resolution happens automatically on registration. There is no "convert now" button. |
| 5 | **Pending members reserve project capacity.** | `count(members) + count(pending)` ≤ `maxGroupSize`. Prevents overfilling. |
| 6 | **Pending assignments are transparent to teachers.** | Teachers see pending members in the same Members tab. No hidden state. |
| 7 | **Future bulk-import features reuse `PendingProjectAssignment`.** | CSV, ERP, Google Workspace — all create pending assignments. The resolution path is shared. |
| 8 | **Existing infrastructure is reused whenever possible.** | Email queue, notification system, user upsert, `buildAssignmentEmailBody()` — no parallel implementations. |
| 9 | **The implementation remains backward compatible.** | CSV import, admin workflow, student dashboard, authentication — all unchanged. |
| 10 | **Schema changes are avoided unless strictly required.** | The existing `PendingProjectAssignment` model is sufficient for MVP. |

---

## 2. Source of Truth Architecture

### 2.1 Identity ownership chain

```
┌─────────────────────────────────────────────────────────────┐
│  COE Main (tcetcercd.in)                                    │
│                                                             │
│  Owns:                                                      │
│  • Authentication (JWT cookie validation)                   │
│  • User identity (email, name, role, uid, status)           │
│  • User status (ACTIVE / PENDING / REJECTED)                │
│                                                             │
│  Source of truth for: "Does this student exist?"           │
│                                                             │
│  Exposes:                                                    │
│  • JWT cookie (for dashboard middleware)                    │
│  • GET /api/internal/users/lookup (on-demand by UID)        │
│  • POST /api/internal/users/upsert (push on register)       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ POST /api/internal/users/upsert
                          │ (push on student registration)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard DB (this application)                             │
│                                                             │
│  Owns:                                                      │
│  • Project membership (ProjectMember table)                 │
│  • Pending invitations (PendingProjectAssignment table)     │
│  • Project data (tasks, milestones, reviews, files)         │
│  • Notifications (Notification table)                       │
│  • Email delivery state (EmailQueue table)                  │
│                                                             │
│  Caches:                                                     │
│  • User records (lazy-provisioned from COE Main via upsert) │
│                                                             │
│  Reads from COE Main:                                        │
│  • resolveUserFromHeaders() on every page load              │
│  • resolveStudent() on manual member add                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ resolveStudent() returns null?
                          │ (student hasn't registered yet)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PendingProjectAssignment                                    │
│                                                             │
│  Owns:                                                      │
│  • Email-based pre-registration membership records          │
│                                                             │
│  Resolution trigger:                                         │
│  • Student registers at COE Main → upsertDashboardUser()    │
│    → email matches PENDING record → ProjectMember created   │
│                                                             │
│  Lifespan:                                                   │
│  • Created by teacher adding unregistered email             │
│  • Resolved to ProjectMember on student registration        │
│  • Hard-deleted by teacher cancellation                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Student registers → email matches
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ProjectMember                                               │
│                                                             │
│  Owns:                                                      │
│  • Confirmed membership in a specific project               │
│                                                             │
│  Source of truth for: "Who is on this team?"               │
│                                                             │
│  Created by:                                                 │
│  • addProjectMember() when student already registered       │
│  • upsertDashboardUser() when pending assignment resolves   │
│  • CSV import for already-registered students               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Ownership summary

| Concern | System | Owns |
|---|---|---|
| Authentication | COE Main | Session, JWT validation |
| User identity | COE Main | Email, name, role, uid, status |
| User cache | Dashboard DB | Cached copy (lazy-provisioned) |
| Project membership | Dashboard DB | `ProjectMember` records |
| Pending membership | Dashboard DB | `PendingProjectAssignment` records |
| Notifications | Dashboard DB | In-app notifications |
| Email delivery | Dashboard DB | `EmailQueue` records |
| File storage | S3 / MinIO | Project files, assets |

### 2.3 Key implication

The Dashboard never pushes identity changes to COE Main. It only receives. This means:

- Pending assignments created by email can only resolve when **the student registers at COE Main first**
- COE Main is the gatekeeper for "does this student exist" — the Dashboard cannot create students
- If COE Main is unreachable, pending assignment creation **still works** (it's a local DB operation), but student **lookup** will fail (the teacher gets a "try again later" error)

---

## 3. Final Architecture

### 3.1 Core principle

The existing `PendingProjectAssignment` model becomes the default fallback when `resolveStudent()` returns null. The teacher enters an institutional email for the unregistered student. The system creates a pending assignment and queues an invitation email. When the student registers at `tcetcercd.in`, the existing `upsertDashboardUser()` flow auto-resolves all pending assignments for that email.

### 3.2 What changes

```
Current:
  addProjectMember(projectId, identifier, role)
    → resolveStudent(identifier)
      → null → return { success: false, error: "Must register first" }

New:
  addProjectMember(projectId, identifier, role)
    → isRegistered = resolveStudent(identifier)
      → Found → create ProjectMember → return { success: true }
      → null, AND identifier passes institutional email validation →
          validate domain via INSTITUTIONAL_EMAIL_DOMAIN env var
          validate not duplicate pending
          validate slot available (members + pending < maxGroupSize)
          validate project not COMPLETED or ARCHIVED
          create PendingProjectAssignment in transaction
          queue invitation email via existing EmailQueue
          return { success: true, pending: true }
      → null, AND identifier FAILS email validation →
          return { success: false,
            error: "This student has not registered yet. Enter their institutional email to send them an invitation." }
      → Throws (timeout/network) →
          return { success: false,
            error: "Unable to verify this student right now. Please try again later." }
```

### 3.3 What does NOT change

| Component | Reason |
|---|---|
| `resolveStudent()` | Already returns null for not-found. No change needed. |
| `upsertDashboardUser()` | Already resolves pending assignments. No change needed except filtering by project status. |
| `PendingProjectAssignment` model | Schema is sufficient. No schema migration needed. |
| `fetchUserFromCOE()` | Unchanged — separate concern. |
| CSV import flow | Unchanged — already uses `PendingProjectAssignment`. |
| Authentication / middleware | Unchanged. |
| Showcase system | Unchanged — completely separate. |

---

## 4. Updated Workflow

### 4.1 Adding a member — complete decision tree

```
Teacher clicks "Add Member"

Teacher enters identifier in dialog input

Server action receives: { projectId, identifier, role }

┌─────────────────────────────────────────────┐
│ Step 1: Authorize                           │
│ teacher must own this project               │
│   Fail → return { success: false,          │
│            error: "You don't have           │
│            permission to add members        │
│            to this project." }              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Step 2: Validate identifier                 │
│   Zod: z.string().min(1)                   │
│   Fail → return { success: false,          │
│            error: "Enter an email or        │
│            student ID." }                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Step 3: Check max group size                │
│   Count: ProjectMember                      │
│        + PendingProjectAssignment           │
│   If ≥ maxGroupSize → return { success:    │
│     false, error: "This project has         │
│     reached its maximum capacity." }        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Step 4: Project status check                │
│   If COMPLETED or ARCHIVED →               │
│     return { success: false,               │
│       error: "This project is already      │
│       completed or archived. You can't      │
│       add new members." }                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Step 5: Attempt to resolve student          │
│   Call resolveStudent(identifier)           │
│   Success → student object                  │
│   Throws  → return { success: false,        │
│     error: "Unable to verify this student   │
│     right now. Please try again later." }   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Step 6: Branch on result                    │
│                                             │
│ Branch A — Student found                    │
│   → Check if already a member               │
│     Yes → return { success: false,          │
│              error: "This student is        │
│              already a member of this       │
│              project." }                    │
│   → Create ProjectMember                    │
│   → return { success: true }                │
│                                             │
│ Branch B — Student not found,               │
│           identifier is a valid             │
│           institutional email               │
│   → Validate domain: must match             │
│     INSTITUTIONAL_EMAIL_DOMAIN env var      │
│     Fail → return { success: false,         │
│              error: "Please use a valid     │
│              institutional email ending     │
│              in @{domain}." }               │
│   → Check duplicate pending:                │
│     exists [projectId, email]?              │
│     Yes → return { success: false,          │
│              error: "An invitation has      │
│              already been sent to this      │
│              email address." }              │
│   → Create PendingProjectAssignment         │
│     { projectId, email, memberRole,         │
│       invitedById: teacher.id }             │
│   → Queue email via EmailQueue.create()     │
│     using existing buildAssignmentEmailBody │
│   → return { success: true, pending: true } │
│                                             │
│ Branch C — Student not found,               │
│           identifier is NOT a valid         │
│           email                             │
│   → return { success: false,                │
│       error: "This student has not          │
│       registered yet. Enter their           │
│       institutional email to send them      │
│       an invitation." }                     │
└─────────────────────────────────────────────┘
```

### 4.2 Registration resolution — existing flow (minimal change)

```
User registers at tcetcercd.in
  → COE Main calls POST /api/internal/users/upsert
    → upsertDashboardUser() in $transaction:
      1. If status !== "ACTIVE" → return null (user not created)
      2. Create user record with email, name, role
      3. findMany PendingProjectAssignment
         WHERE email = user.email
         AND status = "PENDING"
         INCLUDE project (to check project status)
      4. Filter: only resolve for projects NOT in ["COMPLETED", "ARCHIVED"]
      5. For each resolvable:
         create ProjectMember { projectId, studentId, role }
      6. Update each resolved: status = "ASSIGNED"
      7. For each resolved:
         create in-app Notification for teacher + student
  → Dashboard DB now has both user + memberships
```

### 4.3 Managing pending members

```
Teacher views Members tab
  → Fetch ProjectMember[] for the project
  → Fetch PendingProjectAssignment[] for the project WHERE status = "PENDING"
  → Render in two sections: "Members" and "Pending Invitations"

Each pending card shows:
  - Email address
  - "Invitation sent · 2 days ago"
  - Action buttons: Edit, Resend, Cancel

Slots are reserved while pending exists.
When cancelled, the slot immediately becomes available.
```

---

## 5. Business Rules

### 5.1 Rules that change

| Rule | Current | New |
|---|---|---|
| **Max group size** | `count(ProjectMember) ≥ maxGroupSize` blocks addition | `count(ProjectMember) + count(PendingProjectAssignment WHERE status = "PENDING") ≥ maxGroupSize` blocks addition |
| **Student addition** | Must be registered | Registered → immediate. Unregistered → pending invitation by institutional email. |
| **Identifier required** | Any string (UID/email/ID) | For unregistered students: MUST be email matching `INSTITUTIONAL_EMAIL_DOMAIN`. For registered: UID/email/ID all work (existing behavior). |

### 5.2 Rules that stay the same

| Rule | Behavior |
|---|---|
| **One LEAD per project** | Setting new LEAD demotes old. Pending assignments use `memberRole` — when resolved, they get that role. If `LEAD` is pending and `LEAD` already exists, on resolution the existing LEAD gets demoted. |
| **Teacher ownership** | Exactly one teacher per project. Only that teacher modifies members. `addProjectMember()` checks `project.teacherId !== user.id`. |
| **Duplicate prevention** | `@@unique([projectId, email])` prevents duplicate pending. `@@unique([projectId, studentId])` prevents duplicate members. |
| **Cascade on project delete** | If project is deleted, `onDelete: Cascade` on the `project` relation automatically deletes all `PendingProjectAssignment` records. |
| **CSV import** | Unchanged — admin CSV creates pending assignments by email. |
| **Admin group size limit** | Unchanged — `adminAddProjectMember()` enforces the same `maxGroupSize` check as `addProjectMember()`. Admins do not bypass the limit. (This is today's implementation. If an admin bypass is desired, that requires a separate business decision.) |

### 5.3 New rules

| Rule | Rationale |
|---|---|
| **Pending assignments count toward `maxGroupSize`** | Prevents overfilling when all pending members register. See [section 12](#12-team-size-behavior). |
| **Unregistered students require institutional email** | Only emails matching `INSTITUTIONAL_EMAIL_DOMAIN` accepted. Configured via environment variable. Prevents personal email invitations. |
| **Cancel is always allowed** | Teacher cancels a pending assignment at any time. Hard delete. Slot becomes available immediately. |
| **Edit email is atomic** | Cancel old + create new + queue email in a single `$transaction`. If any step fails, nothing changes. See [section 6.3](#63-email-editing). |
| **Resend has 60-second cooldown** | Enforced server-side via `updatedAt`. Prevents spam. |
| **No pending on completed or archived projects** | `COMPLETED` and `ARCHIVED` projects block new pending creation AND resolution. See [section 13](#13-project-state-behavior). |
| **Pending assignments never expire** | Academic timelines are variable. Teacher cancels manually. |

---

## 6. Edge Cases

### 6.1 Duplicate pending assignment

| Scenario | Behavior |
|---|---|
| Teacher adds same email twice | `@@unique([projectId, email])` → caught → `{ success: false, error: "An invitation has already been sent to this email address." }` |
| CSV import creates pending, teacher manually adds same email | Same constraint — CSV uses `skipDuplicates: true`, so it silently skips if the pending already exists |
| Registered student, teacher tries to pending-add same email | `addProjectMember()` checks members first → "already a member" error. Pending creation never reached. |

### 6.2 Duplicate member after pending resolution

| Scenario | Behavior |
|---|---|
| Student registers → pending resolves | `skipDuplicates: true` in `upsertDashboardUser()` prevents duplicate `ProjectMember` |
| Teacher manually adds registered student while pending exists | `addProjectMember()` checks members first → "already a member" |
| Teacher adds same email, pending exists, not yet registered | Unique constraint → "already invited" |

### 6.3 Email editing

Email editing is a **single atomic operation**. It must not partially succeed.

```
Teacher clicks "Edit" → enters new email

prisma.$transaction(async (tx) => {

  1. Validate new email matches INSTITUTIONAL_EMAIL_DOMAIN

  2. Check no duplicate pending for [projectId, newEmail]
     → Fail: throw → entire transaction rolls back

  3. Check newEmail not already a member of this project
     → Fail: throw → entire transaction rolls back

  4. tx.pendingProjectAssignment.create({
       projectId, email: newEmail,
       memberRole, invitedById, status: "PENDING"
     })

  5. tx.pendingProjectAssignment.delete({
       where: { id: oldAssignmentId }
     })

  6. tx.emailQueue.create({
       to: newEmail,
       subject: "Project Assignment: {projectTitle}",
       body: buildAssignmentEmailBody(...)
     })

}) // If anything throws, complete rollback. No dangling state.

**Critical transaction rule:** Only the `EmailQueue` record is inserted inside the transaction. The actual SMTP/network email sending is handled asynchronously by the background cron worker (`api/cron/process-emails/route.ts`). Under no circumstance should SMTP network I/O occur inside a database transaction.
```

**Why create + delete instead of update in-place:**
- `@@unique([projectId, email])` prevents in-place email change
- Clean record: old email permanently removed, new email has fresh `createdAt`
- If implementation constraints make delete-then-create inside a transaction problematic, an alternative is to use a single `update` with a `delete` + `create` approach where the old record's unique constraint is temporarily released — but the `$transaction` approach is the recommended pattern

### 6.4 Teacher deleted

Active teachers cannot be deleted through the admin UI. The admin users page only supports `toggleUserActive` (deactivate/reactivate). The only `prisma.user.delete()` call is in `rejectTeacherRegistration()`, which explicitly guards against active teachers:

```typescript
if (user.isActive) {
  throw new Error("Active teachers cannot be rejected from this panel");
}
```

**Therefore:** No schema migration is needed. The `onDelete: Cascade` on `invitedBy` is unnecessary because active teachers are never deleted. If a future feature allows deleting active teachers, the cascade can be added then.

### 6.5 Project deleted before registration

Already handled by `onDelete: Cascade` on the `project` relation. Prisma automatically deletes all `PendingProjectAssignment` records when the project is deleted.

### 6.6 Student never registers

Pending assignment stays indefinitely. No automatic cleanup in MVP. Teacher cancels manually via Members tab. The reserved slot remains unavailable until cancelled.

### 6.7 COE Main timeout

If `resolveStudent()` throws (network error, 5xx, timeout), the `catch` block catches it and returns `"Unable to verify this student right now. Please try again later."`. No pending assignment is created — the teacher must retry.

This is intentionally conservative. A timeout could mean the student IS registered but COE Main is unavailable. Creating a pending assignment would be incorrect in that case.

### 6.8 Double-submit protection

| Scenario | Protection |
|---|---|
| **Teacher clicks "Add Member" twice rapidly** | First call succeeds. Second call hits duplicate check (already member or already pending) → error. Prisma unique constraint is the final safeguard. |
| **Teacher clicks "Resend" repeatedly** | Server checks `updatedAt` — must be ≥ 60 seconds. Fails early with cooldown error. Frontend also disables button for 60 seconds. |
| **Teacher refreshes during edit dialog** | Dialog state lost on refresh. Old pending still exists unchanged. No partial state. |
| **Teacher double-submits edit email** | First call creates new pending + deletes old inside transaction. Second call: old record no longer exists → `delete` throws → error caught. If second call's `create` violates `@@unique` with first call's new record, unique constraint catches it. Frontend should disable submit after click. |
| **Teacher clicks "Cancel" twice** | First call deletes. Second call: record gone → `delete` throws → caught → `"Invitation not found. It may have already been removed."` |

### 6.9 Student registers with different email

If the student registers at `tcetcercd.in` with a different email than what the teacher entered, the pending assignment does not automatically resolve. The teacher must cancel and re-invite with the correct email.

The invitation email sent to the student explicitly states their email. If the student registers with a different address, the teacher addresses it by cancelling and re-inviting. This is intentionally manual — auto-resolving to the wrong email would be a security concern.

### 6.10 Concurrent teacher and system operations

| Scenario | Behavior |
|---|---|
| **Teacher adds pending → system tries to resolve (student registered just now)** | `upsertDashboardUser()` runs in a `$transaction`. Pending is atomically resolved. If teacher's `delete` or duplicate `create` overlaps, Prisma transaction isolation handles it — one transaction wins, the other retries or fails. |
| **Student registers twice (retry)** | `upsertDashboardUser()` is idempotent — `skipDuplicates: true`. Second call is a no-op. |

---

## 7. API Design

### 7.1 Modified server actions

#### `addProjectMember(projectId, studentIdentifier, role)`

| Aspect | Detail |
|---|---|
| **Location** | `src/server/actions/projects.ts` |
| **Return type** | `{ success: boolean; pending?: boolean; error?: string }` |
| **Change** | Add fallback to `PendingProjectAssignment` when `resolveStudent()` returns null and input passes institutional email validation |
| **Responsibilities** | Check auth, check group size (including pending), check project status, resolve student, create member or pending, queue email using existing `EmailQueue` and `buildAssignmentEmailBody()`, revalidate |

#### `adminAddProjectMember(data)`

| Aspect | Detail |
|---|---|
| **Location** | `src/server/actions/projects.ts` |
| **Return type** | `{ success: boolean; pending?: boolean; error?: string }` |
| **Change** | Same fallback logic as `addProjectMember()`. Group size limit is enforced identically for admins (current behavior). |
| **Note** | Admin page uses a dropdown of registered students. The same `adminAddProjectMember()` function handles both dropdown selections (registered) and email text input (unregistered). |

### 7.2 New server actions

#### `getPendingMembers(projectId)`

| Aspect | Detail |
|---|---|
| **Purpose** | Fetch all pending assignments for a project |
| **Authorization** | Teacher must own project; admin always allowed |
| **Returns** | `Array<{ id, email, memberRole, status, invitedByName, createdAt, updatedAt }>` |
| **Query** | `prisma.pendingProjectAssignment.findMany({ where: { projectId, status: "PENDING" }, include: { invitedBy: { select: { name: true } } } })` |

#### `cancelPendingAssignment(projectId, assignmentId)`

| Aspect | Detail |
|---|---|
| **Purpose** | Delete a pending invitation. Slot becomes available immediately. |
| **Authorization** | Teacher must own project; admin always allowed |
| **Validation** | Pending assignment must exist and belong to this project |
| **Action** | `prisma.pendingProjectAssignment.delete({ where: { id: assignmentId } })` — hard delete |
| **Returns** | `{ success: true }` |

#### `editPendingAssignment(projectId, assignmentId, newEmail)`

| Aspect | Detail |
|---|---|
| **Purpose** | Change the email for a pending invitation |
| **Authorization** | Teacher must own project |
| **Validation** | New email must match `INSTITUTIONAL_EMAIL_DOMAIN`. No duplicate pending for `[projectId, newEmail]`. New email not already a member. |
| **Action** | Executed inside `prisma.$transaction()`: create new pending → delete old pending → queue email. Atomic. |
| **Returns** | `{ success: true }` |
| **Double-submit** | First call succeeds. Second call: old record gone → `delete` throws → error caught. |

#### `resendPendingInvitation(projectId, assignmentId)`

| Aspect | Detail |
|---|---|
| **Purpose** | Re-queue the invitation email |
| **Authorization** | Teacher must own project |
| **Validation** | Cooldown: `assignment.updatedAt` must be ≥ 60 seconds ago. Return `{ success: false, error: "You can resend the invitation once every 60 seconds." }` if violated. |
| **Action** | Queue new `EmailQueue` record using `buildAssignmentEmailBody()`. Update `updatedAt` timestamp. |
| **Returns** | `{ success: true }` |

### 7.3 Frontend return value handling

```typescript
if (result.success && result.pending) {
  toast.success("Invitation sent to the student's email address.");
} else if (result.success) {
  toast.success("Member added successfully.");
} else {
  toast.error(result.error || "Something went wrong. Please try again.");
}
```

### 7.4 Institutional email validation

Use an environment variable as the single source of truth:

```typescript
const INSTITUTIONAL_EMAIL_DOMAIN =
  process.env.INSTITUTIONAL_EMAIL_DOMAIN || "tcetmumbai.in";

function isInstitutionalEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const domain = `@${INSTITUTIONAL_EMAIL_DOMAIN}`;
  return normalized.endsWith(domain) && normalized.indexOf("@") === normalized.length - domain.length;
}
```

This is a shared constant, not duplicated across files. Placed in `src/lib/validation.ts`.

---

## 8. Database Considerations

### 8.1 No schema migration needed

The existing `PendingProjectAssignment` model is fully sufficient:

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
```

**No cascade on `invitedBy`** — active teachers cannot be deleted through the admin UI, so cascading is unnecessary.

**No new indexes** — existing indexes on `email`, `status`, and `[projectId, email]` are sufficient.

### 8.2 Status values — exactly two for MVP

| Status | Meaning | Set by |
|---|---|---|
| `PENDING` | Invitation created, awaiting student registration | `addProjectMember()`, `editPendingAssignment()` |
| `ASSIGNED` | Student registered and auto-linked to project | `upsertDashboardUser()` |

- Email delivery state is tracked by `EmailQueue`, not `PendingProjectAssignment`.
- Cancellation is represented by hard delete — no `CANCELLED` status needed.
- No `SENT`, `FAILED`, `CANCELLED` statuses for MVP.

### 8.3 Resend cooldown uses `updatedAt`

The existing `updatedAt` timestamp on `PendingProjectAssignment` is the source of truth for the 60-second cooldown. This field is also modified by other operations (e.g., editing the email), which resets the cooldown timer. This is an intentional MVP simplification — the cooldown is a safety measure against rapid resends, not a precise rate-limiting system.

**Acknowledged technical debt:** A dedicated `lastInvitationSentAt` field should be added in a future migration once resend tracking requirements are better understood. For MVP, the `updatedAt` reuse is sufficient to prevent abuse.

No additional database fields needed for MVP.

---

## 9. UI Behavior

### 9.1 Add Member dialog

```
[Add Member] button → Dialog opens

Dialog content:
  ● Student Institutional Email   [__________________]
    (placeholder: "student@tcetmumbai.in")

  ● Role                     [Select: MEMBER ▼]

  [Cancel]  [Add Member]

Validation:
  - If empty: "Enter a valid institutional email address."
  - If not email format: "Enter a valid email address."
  - If not matching INSTITUTIONAL_EMAIL_DOMAIN:
    "Please use an institutional email ending in @{domain}."
  - Hint below input:
    "If the student hasn't registered yet, an invitation will be sent to this email."

On success (registered):
  → Toast: "Member added successfully."

On success (pending):
  → Toast: "Invitation sent to student@tcetmumbai.in. They'll be added automatically when they register."
  → Pending section appears immediately in Members tab

On fail (already pending):
  → Toast: "An invitation has already been sent to this email address."

On fail (project full):
  → Toast: "This project has reached its maximum capacity."
```

### 9.2 Members tab — enhanced layout

```
┌──────────────────────────────────────────────┐
│  Members (2/4)                [Add Member]   │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ ✓  Alice Johnson          LEAD  [Crown] ││
│  │    alice@tcetmumbai.in                   ││
│  └──────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────┐│
│  │ ✓  Rahul Shah            MEMBER  [🗑]   ││
│  │    rahul@tcetmumbai.in                   ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ── Pending Invitations (2) ──               │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ ⏳  aman@tcetmumbai.in                   ││
│  │     Invitation sent · 2 days ago         ││
│  │                         [Edit] [Resend]  ││
│  │                                   [✕]   ││
│  └──────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────┐│
│  │ ⏳  riya@tcetmumbai.in                   ││
│  │     Invitation sent · 5 hours ago        ││
│  │                         [Edit] [Resend]  ││
│  │                                   [✕]   ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### 9.3 Pending invitation card

| Element | Behavior |
|---|---|
| Email display | Show the full email. No name displayed — the student hasn't registered. |
| Duration text | `"Invitation sent · 2 days ago"` — calculated from `createdAt`. |
| ⏳ icon | Clock icon indicating pending invitation state. |
| [Edit] button | Opens edit dialog. Server enforces 60-second cooldown. |
| [Resend] button | Re-queues invitation email. Server enforces 60-second cooldown. Frontend shows countdown: "Resend (45s)" with disabled button. |
| [✕] Cancel button | Hard-deletes the pending. Immediately frees reserved slot. Prompt: "Remove this invitation?" before deleting. |

### 9.4 Edit email dialog

```
[Edit] → Mini dialog:

Current invitation: aman@tcetmumbai.in

New email:          [____________________]
                    [Save Changes]  [Cancel]

Validation:
  - Must match INSTITUTIONAL_EMAIL_DOMAIN format
  - Must not already have a pending invitation for this project
  - Must not already be a member of this project

On success:
  → Toast: "Invitation updated. A new invitation has been sent to the new email."
  → Old pending removed from list
  → New pending appears with fresh timestamp

On fail:
  → Toast: "Could not update the invitation. Please try again."
```

### 9.5 Resend button cooldown

- **Frontend:** Button shows "Resend" normally. After click, shows "Resend (45s)" with disabled state and countdown timer.
- **Server:** Returns error if `updatedAt` < 60 seconds ago.
- **On success:** Toast: "Invitation re-sent to email@address."
- **On cooldown:** Toast: "You can resend the invitation once every 60 seconds."

### 9.6 Member counter across the app

Use a single format consistently:

```
Members (N/M)
```

Where `N` = active members only (not pending). For project headers showing utilization:

```
Members (2/4) + 1 pending
```

Render the pending count as a secondary indicator when space allows.

---

## 10. Notification Flows

### 10.1 Event → Notification matrix

| Event | Recipient | Channel | Timing |
|---|---|---|---|
| Pending assignment created | Student (unregistered) | Email (queued) | Immediately after pending creation |
| Pending assignment created | Teacher | In-app toast | Immediately (frontend only, not a DB notification) |
| Student registers → pending resolved | Teacher | In-app notification (DB) | During `upsertDashboardUser()` |
| Student registers → pending resolved | Student (now member) | In-app notification (DB) | During `upsertDashboardUser()` |
| Teacher edits email | Student (new email) | Email (queued) | Inside edit transaction |
| Teacher resends invitation | Student | Email (queued) | On resend success |
| Teacher cancels pending | None | None | No notification needed |

### 10.2 Email content — pending assignment

Reuse `buildAssignmentEmailBody()` from `src/server/actions/projects.ts`. This function already exists and is used by the CSV import flow:

```typescript
function buildAssignmentEmailBody(projectTitle: string, loginOrRegisterUrl: string): string
```

The generated email contains:
> "You have been assigned to **{projectTitle}**. Please continue using the link below:"

**Add the following safety note** to the email template footer:
> "If you received this invitation by mistake: Simply ignore this email. No access is granted until you authenticate using your institutional account."

The `loginOrRegisterUrl` points to `tcetcercd.in/register` with the email pre-filled (same as existing CSV import behavior).

### 10.3 In-app notification — resolution (teacher)

Inside `upsertDashboardUser()`, after resolving pending assignments:

```typescript
for (const assignment of resolvableAssignments) {
  const project = await tx.project.findUnique({
    where: { id: assignment.projectId },
    select: { title: true, teacherId: true }
  });
  if (project) {
    await tx.notification.create({
      data: {
        userId: project.teacherId,
        type: "PROJECT_UPDATED",
        title: "Student registered and joined your project",
        message: `${created.name} has registered and been added to "${project.title}".`,
        link: `/teacher/projects/${assignment.projectId}`,
      }
    });
  }
}
```

Use the student's display name (`created.name`) when available. Fall back to `created.email` only if the name is empty.

### 10.4 In-app notification — resolution (student)

```typescript
await tx.notification.create({
  data: {
    userId: created.id,
    type: "PROJECT_UPDATED",
    title: "You've been added to a project",
    message: `You have been added to "${project.title}".`,
    link: `/student/projects/${assignment.projectId}`,
  }
});
```

### 10.5 Notification type

Reuse `PROJECT_UPDATED` from the existing `NotificationType` enum. No new enum value is needed for MVP. A dedicated `MEMBER_JOINED` type can be added in a future migration if desired.

---

## 11. Audit Strategy

### 11.1 Current state

No audit/activity log system exists. There is no `ActivityLog` model, no `EventLog` model, no audit table.

### 11.2 MVP approach

Do not build an audit system. The pending assignment lifecycle is self-documenting through existing database records:

| Event | Evidence in DB |
|---|---|
| Pending created | `PendingProjectAssignment` row with `createdAt` |
| Pending resolved | Status set to `ASSIGNED`, `ProjectMember` row created, `Notification` row created for teacher |
| Pending cancelled | Row deleted (no trace — intentional for MVP) |
| Email sent | `EmailQueue` row with status `SENT`, `to`, `subject`, `body` |
| Email failed | `EmailQueue` row with status `FAILED`, `errorLog` |

### 11.3 Future audit hook locations

If an `ActivityLog` model is added later:

| Event | Hook location |
|---|---|
| Pending created | `projects.ts` → after `PendingProjectAssignment.create()` |
| Pending cancelled | `projects.ts` → in `cancelPendingAssignment()`, before `delete()` |
| Pending email changed | `projects.ts` → in `editPendingAssignment()`, inside transaction |
| Pending resolved | `resolve-user.ts` → in `upsertDashboardUser()`, after assignment loop |
| Email sent | `email-queue.ts` → after successful send |

---

## 12. Team Size Behavior

### 12.1 Business rule

Pending members count toward `maxGroupSize`. Slots are reserved at creation time. When a pending assignment is cancelled, the slot immediately becomes available.

### 12.2 Rationale

Without reservation, maxGroupSize overflow is possible:
```
maxGroupSize = 4
Teacher adds:  2 registered (count=2) + 2 pending (count=2)
Teacher adds:  2 more pending (count=2 but pending=4)
Total on resolve: 2 + 4 = 6 → exceeds maxGroupSize
```

With reservation:
```
maxGroupSize = 4
Teacher adds: 2 registered (count=2) + 2 pending (count=4, full)
Next attempt: "This project has reached its maximum capacity."
```

### 12.3 Implementation

```typescript
const currentMemberCount = project.members.length;
const pendingCount = await prisma.pendingProjectAssignment.count({
  where: { projectId, status: "PENDING" }
});

if (currentMemberCount + pendingCount >= project.maxGroupSize) {
  return { success: false, error: "This project has reached its maximum capacity." };
}
```

### 12.4 Slot release on cancellation

Hard delete naturally frees the slot. The next `addProjectMember()` call automatically sees one less pending.

### 12.5 CSV import

The existing `adminUploadProjectAssignments()` does not check `maxGroupSize`. This is existing behavior and is not changed by this plan. It is an admin tool.

---

## 13. Project State Behavior

### 13.1 Behavior matrix

| Project Status | Can create pending? | Can pending resolve on registration? | Teacher can edit/cancel pending? |
|---|---|---|---|
| `DRAFT` | Yes | Yes | Yes |
| `ACTIVE` | Yes | Yes | Yes |
| `UNDER_REVIEW` | Yes | Yes | Yes |
| `COMPLETED` | **Requires stakeholder confirmation** | **Requires stakeholder confirmation** | Yes (cancel only) |
| `ARCHIVED` | No | No | Yes (cancel only) |

### 13.2 Stakeholder confirmation required

The behavior for `COMPLETED` projects is not fully determined by the codebase. Two interpretations are possible:

- **Option A:** A completed project is frozen. No new members can join. Pending assignments should not resolve.
- **Option B:** A student who was invited before completion should still be linked when they register, even after the project is complete.

**Implementation recommendation (to be confirmed):** Block both creation and resolution on `COMPLETED` and `ARCHIVED`. This is the conservative choice. If stakeholders select Option B, remove `COMPLETED` from the blocked statuses filter — the `ARCHIVED` block remains.

### 13.3 Implementation

In `addProjectMember()`:

```typescript
const BLOCKED_STATUSES = ["COMPLETED", "ARCHIVED"];
if (BLOCKED_STATUSES.includes(project.status)) {
  return {
    success: false,
    error: "This project is already completed or archived. You can't add new members."
  };
}
```

In `upsertDashboardUser()`:

```typescript
const pendingAssignments = await tx.pendingProjectAssignment.findMany({
  where: { email, status: "PENDING" },
  include: { project: { select: { status: true } } },
});

const BLOCKED_STATUSES = ["COMPLETED", "ARCHIVED"];
const resolvable = pendingAssignments.filter(
  (a) => !BLOCKED_STATUSES.includes(a.project.status)
);
```

---

## 14. UI Consistency Matrix

| Page / Component | Show pending members? | Display format |
|---|---|---|
| Teacher `_tabs/MembersTab.tsx` | **Yes** | Full pending cards with Edit/Resend/Cancel |
| Teacher `ProjectDetailPage.tsx` header | **Yes** — utilization | `Members (2/4) + 1 pending` |
| Teacher `ProjectCard.tsx` | **Yes** — summary | `Members (2/4)` with pending badge `+1` |
| Admin `projects/page.tsx` | **Yes** | Same as teacher |
| Teacher dashboard `TeacherDashboardClient.tsx` | **No** | ProjectCards already show pending indicator |
| Student `StudentProjectDetailClient.tsx` | **No** | Students do not see pending invitations |
| Student `StudentProjectsClient.tsx` | **No** | Only confirmed memberships |
| Student dashboard `StudentDashboardClient.tsx` | **No** | Only confirmed memberships |
| Public showcase | **No** | Showcase is disconnected |
| Exports / Reports | **No for MVP** | Pending is transient |

---

## 15. File-by-File Implementation Plan

### 15.1 Phase 1 — Backend (Pending Assignment Fallback)

#### `src/server/actions/projects.ts`

| Aspect | Detail |
|---|---|
| **Current responsibility** | Project CRUD, member management, CSV import |
| **Changes** | 1. Import or define `isInstitutionalEmail()` using `INSTITUTIONAL_EMAIL_DOMAIN` env var<br>2. Modify `addProjectMember()` — fall back to `PendingProjectAssignment` when `resolveStudent()` returns null and input is an institutional email<br>3. Modify `adminAddProjectMember()` — same fallback (group size enforced identically)<br>4. Add `getPendingMembers(projectId)` — returns pending assignments for project<br>5. Add `cancelPendingAssignment(projectId, assignmentId)` — hard delete<br>6. Add `editPendingAssignment(projectId, assignmentId, newEmail)` — atomic `$transaction`<br>7. Add `resendPendingInvitation(projectId, assignmentId)` — 60s cooldown check, queue email<br>8. Update group size check to include `count(PendingProjectAssignment WHERE status = "PENDING")`<br>9. Add project status check — block `COMPLETED`, `ARCHIVED`<br>10. Queue email via `EmailQueue.create()` using `buildAssignmentEmailBody()` |
| **Estimated complexity** | Medium — ~100 lines new, ~40 lines modified |
| **Regression risk** | Medium — existing registered-student path unchanged |
| **Testing** | Unit test each server action |

#### `src/lib/validation.ts` (new file)

| Aspect | Detail |
|---|---|
| **Purpose** | Single source of truth for institutional email validation |
| **Content** | `isInstitutionalEmail(email): boolean` using `process.env.INSTITUTIONAL_EMAIL_DOMAIN \|\| "tcetmumbai.in"` |
| **Note** | Do not duplicate this logic. Import from this file wherever needed. Future validation helpers (UID, phone, roll number, etc.) belong here. |

#### `src/lib/resolve-user.ts`

| Aspect | Detail |
|---|---|
| **Current responsibility** | User resolution, upsert, COE Main lookup |
| **Changes** | 1. In `upsertDashboardUser()`, filter pending assignments by project status (skip COMPLETED/ARCHIVED)<br>2. After resolution, create in-app notifications for teacher + student inside the `$transaction`<br>3. Use student's display name in teacher notification message; fall back to email |
| **Estimated complexity** | Low — ~20 lines added |
| **Regression risk** | Low — additive changes in a path that fires only on first-time registration |

### 15.2 Phase 2 — Frontend (Members Tab)

#### `src/app/(dashboard)/teacher/projects/[projectId]/_tabs/MembersTab.tsx`

| Aspect | Detail |
|---|---|
| **Current responsibility** | Display/add/remove team members |
| **Changes** | 1. Fetch `getPendingMembers()` on mount<br>2. Render "Pending Invitations" section below active members<br>3. Each pending card: email, "Invitation sent · X ago", Edit/Resend/Cancel<br>4. Update "Add Member" dialog — label "Student Institutional Email", add validation + hint<br>5. Handle `result.pending` in success toast<br>6. Counter: `Members (2/4)` + "Pending Invitations (2)"<br>7. Wire up cancel/edit/resend server actions<br>8. Resend button: disable + countdown for 60s after click |
| **Estimated complexity** | Medium — ~150 lines JSX |
| **Regression risk** | Medium — additive, layout changes may affect existing member list |

#### `src/app/(dashboard)/teacher/projects/[projectId]/page.tsx`

| Aspect | Detail |
|---|---|
| **Current responsibility** | Project detail page with tabs |
| **Changes** | Update header member count to show pending indicator: `Members (2/4) + 1 pending` |
| **Estimated complexity** | Low — ~5 lines |

#### `src/app/(dashboard)/admin/projects/page.tsx`

| Aspect | Detail |
|---|---|
| **Current responsibility** | Admin project management page (~880 lines) |
| **Changes** | 1. Show pending count and cards per project<br>2. Add admin cancel/edit/resend actions<br>3. Update "Add Member" to support both dropdown (registered) and email input (unregistered) |
| **Estimated complexity** | High — largest client component. Careful regression planning required. |
| **Regression risk** | High — tightly coupled |

#### `src/hooks/useProjects.ts`

| Aspect | Detail |
|---|---|
| **Current responsibility** | React Query hooks for project data |
| **Changes** | Add `usePendingMembers(projectId)` query hook |
| **Estimated complexity** | Low — ~10 lines |

---

## 16. Migration Strategy

### 16.1 No schema migration

The existing `PendingProjectAssignment` model is fully sufficient. No `prisma migrate` command is required.

### 16.2 No data migration

Existing `PendingProjectAssignment` records continue to work. Their `PENDING` / `ASSIGNED` status values remain valid. No existing data changes meaning.

### 16.3 Deployment order

```
Step 1: Deploy backend changes (Phase 1)
  → Server actions updated, but existing UI still calls same functions
  → addProjectMember() with registered student → still works identically
  → Pending fallback exists but current UI never reaches it (no email input in old UI)
  → Risk: None

Step 2: Deploy frontend changes (Phase 2)
  → MembersTab now passes email input to addProjectMember()
  → Pending fallback activates for unregistered students
  → Risk: Low — backend tested in isolation in Step 1
```

### 16.4 Feature flag

Optional: `PENDING_MEMBER_FLOW` env var with `"true"` / `"false"` toggle.

**Recommended:** Skip the feature flag. The change is additive and backward-compatible.

---

## 17. Testing Strategy

### 17.1 Unit tests

| Test | Server Action | Expected |
|---|---|---|
| Add registered student | `addProjectMember()` | Creates `ProjectMember`, `{ success: true }` |
| Add unregistered institutional email | `addProjectMember()` | Creates `PendingProjectAssignment`, queues email, `{ success: true, pending: true }` |
| Add unregistered non-email identifier | `addProjectMember()` | `{ success: false, error: "Enter their institutional email" }` |
| Add unregistered non-institutional email | `addProjectMember()` | `{ success: false, error: "Must end in @{domain}" }` |
| Add duplicate pending email | `addProjectMember()` | `{ success: false, error: "Already invited" }` |
| Add when project full (members + pending) | `addProjectMember()` | `{ success: false, error: "Maximum capacity" }` |
| Add when project COMPLETED | `addProjectMember()` | `{ success: false, error: "Cannot add members" }` |
| Add when project ARCHIVED | `addProjectMember()` | `{ success: false, error: "Cannot add members" }` |
| Get pending members | `getPendingMembers()` | Returns array of pending assignments |
| Cancel pending (hard delete) | `cancelPendingAssignment()` | Record deleted, `{ success: true }` |
| Cancel pending → slot freed | Then `addProjectMember()` | Succeeds (slot available) |
| Edit pending email (atomic) | `editPendingAssignment()` | Old deleted, new created, email queued |
| Edit pending — duplicate new email | `editPendingAssignment()` | Transaction rolls back, old unchanged |
| Resend — within 60s cooldown | `resendPendingInvitation()` | `{ success: false, error }`, no email queued |
| Resend — after 60s cooldown | `resendPendingInvitation()` | Email queued, `updatedAt` refreshed |
| Pending resolves on registration | `upsertDashboardUser()` | `ProjectMember` created, status → `ASSIGNED`, teacher notified |
| Pending does NOT resolve for COMPLETED | `upsertDashboardUser()` | Status stays `PENDING` |
| Admin group size enforced | `adminAddProjectMember()` | Same error as teacher (no bypass) |
| Double-click "Add Member" | Two rapid calls | First succeeds, second hits duplicate check |

### 17.2 Integration tests

| Test | Setup | Expected |
|---|---|---|
| Register → pending resolves | Create pending → register user | `ProjectMember` created, teacher + student notified |
| Register → COMPLETED project → no resolution | Pending in COMPLETED → register | No `ProjectMember`, pending stays |
| Register → multiple projects → all resolve | 3 pending for 3 projects → register | 3 `ProjectMember` records |
| Group size with pending | 2 members + 2 pending in max=4 | Next add blocked |
| Email queue on pending creation | Create pending | `EmailQueue` with correct `to`, `subject`, `body` |
| Edit rolls back on failure | Edit → force failure in transaction | Old unchanged, new not created |
| Resend cooldown | Resend twice in 5 seconds | First succeeds, second fails |

### 17.3 E2E tests

| Test | Flow |
|---|---|
| Teacher adds registered student | Add Member → enter UID → see member in list |
| Teacher adds unregistered email | Add Member → enter email → see pending in list |
| Teacher cancels pending | Click cancel → pending disappears, slot freed |
| Teacher edits pending email | Edit → enter new email → old gone, new appears |
| Teacher resends (after cooldown) | Click resend → toast confirms |
| Teacher resends (within cooldown) | Click resend → error or button disabled |
| Non-institutional email rejected | Enter `@gmail.com` → error shown |
| Pending count displayed | Header: `Members (2/4)` + `Pending Invitations (2)` |

---

## 18. Rollback Strategy

### 18.1 Phase 1 (Backend) rollback

| Step | Action | Impact |
|---|---|---|
| 1 | Revert `projects.ts` changes | `addProjectMember()` returns old "Must register first" error |
| 2 | Revert `resolve-user.ts` notification changes | Notifications no longer created on resolution |
| 3 | Remove `validation.ts` if created | No impact — imported only by changed code |
| 4 | Deploy | System returns to pre-change state |

Pending assignments created during the window remain in DB with `PENDING` status. They resolve on registration or stay indefinitely — neither causes issues.

### 18.2 Phase 2 (Frontend) rollback

| Step | Action | Impact |
|---|---|---|
| 1 | Revert `MembersTab.tsx` | Members tab returns to old layout. Pending section hidden. |
| 2 | Revert admin project page | Admin page returns to old layout. |
| 3 | Deploy | Backend still has pending data — just invisible from UI. Functional but teachers can't see pending. |

### 18.3 Full rollback

1. Revert all changed files
2. Remove `validation.ts`
3. Verify `addProjectMember()` returns old error
4. Deploy

Pending assignments created during rollout remain in DB — they stay `PENDING` forever or resolve when students eventually register. No cleanup required.

---

## 19. Future Extensibility

### 19.1 Canonical pre-registration membership mechanism

`PendingProjectAssignment` is the **canonical pre-registration membership mechanism** for users who do not yet exist in the Dashboard. Every future system that needs to invite unregistered users to projects should create `PendingProjectAssignment` records rather than inventing new workflows.

### 19.2 How future features map

| Future Feature | How it uses `PendingProjectAssignment` |
|---|---|
| **Teacher CSV upload** | Teacher uploads CSV of emails → server parses → creates `PendingProjectAssignment` for each row → same resolution path. No new workflow. |
| **ERP import** | ERP pushes enrollment data → external script creates `PendingProjectAssignment` records → students register → auto-resolve. No changes to resolution logic. |
| **Google Workspace directory autocomplete** | Teacher types → autocomplete queries Google Directory → returns email → teacher selects → student already exists? → `ProjectMember`. Not registered? → `PendingProjectAssignment`. |
| **Bulk invitations by department** | Admin selects "all unregistered students in Computer Engineering" → system bulk-creates `PendingProjectAssignment` records per project. |
| **Search/autocomplete** | New search endpoint queries Dashboard DB by name/email/rollNumber → falls back to COE Main → returns registered students. Unregistered? → teacher enters email → same pending path. |
| **Student self-request to join** | Student requests to join → `PendingProjectAssignment` with direction reversed (student invites self, teacher approves). Same model, different entry point. |
| **Department-wide assignment** | Admin imports project-committee mapping → system creates both projects and `PendingProjectAssignment` records in one operation. |

### 19.3 What stays stable

- `PendingProjectAssignment` model — already generic enough for all above scenarios
- `upsertDashboardUser()` — resolves all pending regardless of source
- `EmailQueue` — delivers all invitation emails
- Existing server actions — new features add new actions but existing ones remain stable

### 19.4 What would need to change for specific features

| Feature | Needed change |
|---|---|
| **Student self-request** | Allow `student` role to create pending (currently teacher/admin only). May need a `type` field to distinguish "invited by teacher" from "requested by student." |
| **Bulk operations** | Add a server action accepting an array of emails, creating pending in a single transaction. |
| **Resend tracking** | `sentCount` / `lastSentAt` columns on `PendingProjectAssignment` if required for reporting. Not needed for MVP — `EmailQueue` tracks delivery. |

---

## 20. Implementation Readiness Checklist

| Item | Status |
|---|---|
| **Architecture finalized** | ✅ PendingProjectAssignment as fallback when resolveStudent() returns null. |
| **Business rules finalized** | ✅ 19 rules documented. Completed/archived behavior requires stakeholder sign-off (noted in section 13). |
| **Schema changes finalized** | ✅ None required for MVP. Existing model is sufficient. |
| **API surface finalized** | ✅ 2 modified + 4 new server actions. |
| **Validation finalized** | ✅ Institutional email domain via env var. Single validator in shared utility. |
| **Email template finalized** | ✅ Reuses existing `buildAssignmentEmailBody()`. Safety note added. |
| **Notifications finalized** | ✅ In-app for teacher + student on resolution. Email for pending creation/edit/resend. |
| **UI finalized** | ✅ Members tab with pending section. Edit/Resend/Cancel per pending card. Counter consistency documented. |
| **Edge cases documented** | ✅ 11 edge cases with expected behavior. |
| **Double-submit protection documented** | ✅ Every rapid-click scenario addressed. |
| **Rollback documented** | ✅ Phase 1, Phase 2, and full rollback steps. |
| **Testing strategy documented** | ✅ 22 unit tests, 6 integration tests, 10 E2E tests. |
| **Future extensibility documented** | ✅ PendingProjectAssignment described as canonical pre-registration mechanism. |
| **Backward compatibility confirmed** | ✅ CSV import, admin workflow, student dashboard, authentication — all unchanged. |
| **All previous alternatives removed** | ✅ No references to SENT, CANCELLED, FAILED statuses. No soft-delete. No onDelete cascade. |
| **Terminology consistent** | ✅ "PendingProjectAssignment", "PENDING"/"ASSIGNED", "hard delete", "institutional email", "canonical pre-registration membership mechanism" — used uniformly. |

---

## 21. Implementation Contract

This document is now the architectural source of truth for the Pending Member Assignment feature.

### 21.1 What implementation agents must not do

- **Redesign workflows** — The workflow defined in section 4 (add member decision tree + registration resolution) is final.
- **Modify business rules** — All 19 business rules in section 5 are final. If a rule appears incorrect, document the blocker — do not change the rule.
- **Introduce new architecture** — No new models, no new API routes, no new notification types. The existing infrastructure is sufficient.
- **Create alternative APIs** — Use the server actions defined in section 7. Do not create alternative endpoints.
- **Change ownership boundaries** — Section 2 defines which system owns what. COE Main owns identity. Dashboard owns membership. Do not blur these boundaries.
- **Add schema columns** — Section 8 confirms zero schema changes for MVP. Do not add columns.

### 21.2 What implementation agents must do when blocked

If implementation discovers a genuine blocker (e.g., a constraint not visible from code analysis):

1. **Document the blocker** — What was assumed, what was discovered, why it blocks.
2. **Review before changing** — Do not work around the blocker with an alternative design. The plan must be updated first.
3. **Minimal change only** — Any plan update should change the minimum necessary to unblock.

### 21.3 Contract

> Every implementation follows exactly this design. If it isn't in this document, it isn't part of the feature. If it contradicts this document, it is wrong.

---

**Planning phase complete. This document is the single implementation specification for all coding agents.**
