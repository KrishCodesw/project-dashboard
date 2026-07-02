# Academic Project Dashboard

A full-stack dashboard for academic project management and showcase publishing.

This repository now contains two systems that share authentication:

- Core Project Monitoring System (existing): project/task/milestone/review/file workflows
- Showcase System (new): versioned submission -> admin review -> publish pipeline

---

## Table of Contents

1. Overview
2. What Is New
3. Tech Stack
4. Architecture
5. End-to-End Workflows
6. Authentication and Access Control
7. Core Project Monitoring Workflows
8. CSV Assignment and Email Outbox Workflows
9. Admin Project Control Workflows
10. Showcase Module
11. Database Models
12. Routes
13. Server Actions and APIs
14. Notifications
15. UI/UX Highlights
16. Setup (Development)
17. Deployment
18. Environment Variables
19. Operational Playbooks
20. QA and Testing Matrix
21. Seed Data
22. Security Notes
23. Troubleshooting

---

## Overview

The app supports role-based dashboards:

- ADMIN: governance, users, full project control (mentor/member management), showcase review/publish
- TEACHER: project management + showcase authoring
- STUDENT: project participation + showcase authoring

### Core principles

- Backend-first authorization
- Strict role-based route guards
- Decoupled domain modules
- Type-safe backend with Prisma + Zod

---

## What Is New

### Authentication and Access

- Switched to CoE portal SSO via shared JWT cookie (`coe_shared_token`) across all protected routes
- Middleware verifies the JWT with `COE_JWT_SECRET` and injects `x-coe-email`, `x-coe-role`, and `x-coe-status`
- Users are auto-provisioned on first CoE login and pending assignments are resolved
- Removed NextAuth, OTP registration, password reset, and allowlist flows

### Reliability and Error UX

- Added App Router error boundaries to replace generic production Server Components crash message
  - route-level `error.tsx`
  - app-level `global-error.tsx`

### Public Project Explorer Pages

- Added public Major Projects explorer at `/majorprojects`
- Added public TE RBL Projects explorer at `/rblprojects-te`
- Updated navigation and middleware so both pages are publicly accessible
- Matched `/rblprojects-te` visual system to `/majorprojects` for consistent presentation

### Bulk Email Outbox (CSV Assignments)

- Added Database Outbox Pattern for high-volume assignment notifications
- Admin CSV assignment processing now writes notification jobs into `EmailQueue` instead of sending synchronously
- Added `PendingProjectAssignment` for invite flows where user does not yet exist
- Added secure background processor endpoint:
  - `POST /api/cron/process-emails`
  - token-protected via `EMAIL_QUEUE_CRON_SECRET`
- Added admin monitoring page at `/admin/email-logs` with retry for failed emails
- Added manual queue trigger from admin UI (`Run Queue Now`) for immediate processing
- Added registration-time pending assignment sync:
  - if a user registers after invite, pending rows for that email are auto-converted to `ProjectMember`
  - pending rows are marked `ASSIGNED`

### Admin Project Control Module

- Added `/admin/projects` to manage all projects centrally
- Admin can:
  - edit project metadata (title, description, domain, status, dates, max group size)
  - change project mentor (teacher)
  - add members to project
  - change member roles (`MEMBER` / `LEAD`)
  - remove members
- Server-side admin-only actions enforce access and validation for all project control operations

### Showcase Module

- Added complete decoupled showcase domain:
  - `ShowcaseProject`
  - `ProjectVersion`
  - `ReviewFeedback`
  - `ProjectAsset`
  - `ShowcaseTeamMember`
- Added strict status transition rules
- Added immutable version snapshots on submit/resubmit/edit events
- Added admin review and publish workflows
- Added user-facing multi-step structured submission workspace
- Added public showcase list + project detail pages (`/showcase`, `/showcase/[projectId]`)

### Notifications and Events

New notification types:

- `PROJECT_SUBMITTED`
- `FEEDBACK_ADDED`
- `CHANGES_REQUESTED`
- `PROJECT_APPROVED`
- `PROJECT_PUBLISHED`

### Automatic Invitation Delivery Tracking

- Added full bounce detection pipeline — automatically detects bounced invitation emails via Gmail API
- 6 single-responsibility detection modules:
  - **BounceFetcher** — Gmail API client, searches for DSNs via `has:delivery-status`, verifies MIME type, rate-limit backoff
  - **BounceParser** — Pure DSN extraction (recipient, diagnostic, Original-Message-ID) from RFC 3464/1894 bodies
  - **BounceValidator** — Binary go/no-go: permanent (5xx) vs temporary (4xx), institutional domain check, SMTP code summarization
  - **BounceMatcher** — Confidence-based correlation to `PendingProjectAssignment`: HIGH (Message-ID match), MEDIUM (single email), LOW (multiple), NONE
  - **BounceProcessor** — Updates `PendingProjectAssignment.deliveryStatus = BOUNCED` with diagnostic and reason
  - **NotificationService** — Creates in-app `PROJECT_UPDATED` notification for the teacher, deduplicated by assignment identity
- Message-ID from Gmail SMTP is now captured on `EmailQueue` for DSN correlation
- `PendingProjectAssignment` stores bounce state: `deliveryStatus`, `bounceDiagnosticRaw`, `bounceReason`, `lastBounceAt`
- Bounce detection runs via `POST /api/cron/detect-bounces` (every 15 min recommended), protected by `EMAIL_QUEUE_CRON_SECRET`
- New dependency: `googleapis` for Gmail API access with `gmail.modify` scope
- Teacher-facing bounce UI in MembersTab — ❌ icon + "Invitation delivery failed" + bounce reason
- Bounce cleared automatically when teacher edits the email address; resend preserves bounce state
- Gmail OAuth refresh token must be regenerated with `gmail.modify` scope

### UX Improvements

- Global command palette in topbar (quick navigation/actions)
- Keyboard shortcuts:
  - `Ctrl/Cmd + K` open command menu
  - `Ctrl/Cmd + B` open notifications
- Sidebar links for showcase management
- Enhanced dashboard visual surface/background polish

---

## Tech Stack

- Next.js 15 (App Router, standalone output)
- React 19 + TypeScript
- Prisma + MySQL
- CoE SSO (shared JWT cookie + middleware verification)
- TanStack Query + Zustand
- Tailwind CSS + shadcn/ui + Radix
- Framer Motion
- MinIO (S3-compatible uploads)
- Nodemailer (SMTP/Gmail)
- googleapis (Gmail API — DSN detection)

---

## Architecture

```text
Shared Auth + Access Control
        |
        |---- Core Project Monitoring System
        |
        |---- Showcase System (Submission/Review/Publish)
        |           |
        |           -> Admin Control Surface (/admin/showcase)
        |
        |---- Automatic Invitation Delivery Tracking
                    |
                    -> Gmail API DSN Detection Pipeline
                        BounceFetcher → BounceParser → BounceValidator
                        → BounceMatcher → BounceProcessor → NotificationService
                        Cron: POST /api/cron/detect-bounces
```

### Integration boundaries

Shared:

- User identity/auth/session
- Role checks and middleware
- Notifications
- Email outbox queue + background processor
- Gmail OAuth credentials (SMTP + Gmail API DSN detection)

Decoupled:

- Core project domain models and logic
- Showcase domain models and logic
- Automatic Invitation Delivery Tracking (Gmail API pipeline + bounce detection modules)

---

## End-to-End Workflows

This section captures full system behavior from onboarding to delivery and publishing.

### Role-level journeys

- ADMIN:
  - controls access policy and approvals
  - governs users and all projects
  - imports assignments and manages email outbox
  - reviews and publishes showcase submissions
- TEACHER:
  - creates and manages projects
  - manages members, tasks, milestones, files, and reviews
  - authors showcase submissions
- STUDENT:
  - joins assigned projects
  - executes tasks and milestone work
  - receives notifications
  - contributes to showcase submissions

### Lifecycle summary

- Auth lifecycle:
  - CoE login -> JWT verified -> user resolved -> role access checks
- Assignment lifecycle:
  - CSV row -> project and user resolution -> member or pending invite -> queued email
- Outbox lifecycle:
  - PENDING -> PROCESSING -> SENT or FAILED
- Bounce detection lifecycle:
  - DSN received in Gmail inbox -> BounceFetcher fetches -> BounceParser extracts -> BounceValidator validates
  - -> BounceMatcher correlates (HIGH/MEDIUM confidence) -> BounceProcessor updates deliveryStatus -> NotificationService alerts teacher
- Core project lifecycle:
  - creation -> active execution -> review and progress tracking -> completion
- Showcase lifecycle:
  - DRAFT -> SUBMITTED -> UNDER_REVIEW -> CHANGES_REQUESTED or APPROVED/REJECTED -> PUBLISHED

---

## Authentication and Access Control

### CoE SSO flow

- Users authenticate via the CoE portal, which sets a shared JWT cookie (`coe_shared_token`)
- Middleware verifies the JWT with `COE_JWT_SECRET`, maps roles (ADMIN/FACULTY/STUDENT), and injects `x-coe-email`, `x-coe-role`, `x-coe-status`
- Server guards (`requireCoeUser`, `requireRole`) resolve or auto-provision users and enforce role access
- Non-ACTIVE status is rejected at guard time

### Public vs protected

Public:

- `/showcase`
- `/showcase/[projectId]`
- `/majorprojects`
- `/rblprojects-te`

Protected:

- `/admin/*` (ADMIN)
- `/teacher/*` (TEACHER)
- `/student/*` (STUDENT)
- `/showcase/my-projects` (TEACHER/STUDENT)

### Authorization model

- Middleware enforces route-level access.
- Server actions enforce operation-level access.
- Every privileged operation validates role server-side.
- UI visibility is not treated as a security boundary.

---

## Core Project Monitoring Workflows

### 1) Project creation and setup

- Teacher creates a project with timeline, domain, and group size constraints.
- Optional tags are attached for discoverability.
- Project appears in teacher project list and dashboard counters.

### 2) Member operations

- Members are added by student ID, email, or roll number.
- Max group size is enforced before insertion.
- Roles are maintained as MEMBER or LEAD.
- Member removal deletes project-member linkage.

### 3) Task and milestone execution

- Tasks are created and assigned to users.
- Milestones define target checkpoints.
- Completion percentages are recalculated and reflected in analytics components.

### 4) Reviews and artifacts

- Reviews are scheduled and tracked per project.
- Files and comments provide project evidence and collaboration context.
- Notification events keep members synchronized.

---

## CSV Assignment and Email Outbox Workflows

### CSV format and parsing

- Required headers:
  - email
  - projectName
- Parser behavior:
  - handles quoted CSV values
  - normalizes email casing and whitespace
  - skips invalid rows
  - deduplicates repeated email + projectName pairs

### Assignment processing pipeline

- Resolve project by projectName.
- Auto-create project when title is not found.
- Resolve users by email.
- Existing user rows create ProjectMember entries.
- Missing users create PendingProjectAssignment entries.
- All valid rows create EmailQueue jobs with PENDING status.

### Invite-to-membership conversion

- Invited users sign in via the CoE portal when ready.
- First CoE login auto-provisions the account and checks pending assignments by email.
- Matching entries are converted into ProjectMember rows.
- Pending entries are marked ASSIGNED.
- Projects become visible immediately in student project list.

### Outbox processing and controls

- Queue processing flow:
  - claim oldest PENDING rows as PROCESSING
  - send with controlled stagger delay
  - mark SENT on success with Gmail `messageId` captured for DSN correlation
  - requeue or mark FAILED based on retry count
- Admin controls:
  - Retry Failed
  - Run Queue Now
  - secured cron endpoint at /api/cron/process-emails
- Bounce detection:
  - `POST /api/cron/detect-bounces` queries Gmail for unread DSNs and correlates them to `PendingProjectAssignment` records
  - Matched bounces update `deliveryStatus = BOUNCED` and notify the teacher in-app

---

## Admin Project Control Workflows

Route: /admin/projects

### 1) Project governance view

- Admin can view all projects across mentors.
- Search supports title, domain, and mentor matching.

### 2) Metadata editing workflow

- Admin can edit title, description, domain, status, dates, and max group size.
- Validation runs in admin server actions.
- Relevant pages are revalidated after update.

### 3) Mentor reassignment workflow

- Admin selects active teacher as mentor.
- Backend validates teacher role and active state.
- Project mentor updates propagate to downstream teacher views.

### 4) Member administration workflow

- Add member with MEMBER or LEAD role.
- Update existing member role.
- Remove member from project.
- Capacity and consistency checks are applied server-side.

---

## Showcase Module

### Status lifecycle

`DRAFT -> SUBMITTED -> UNDER_REVIEW -> (CHANGES_REQUESTED | APPROVED | REJECTED)`

`CHANGES_REQUESTED -> SUBMITTED -> UNDER_REVIEW`

`APPROVED -> PUBLISHED`

### Structured submission sections

- Basic information: title, short description, full description
- Project details: problem statement, objectives, methodology, key features
- Technical details: tech stack, architecture, database, API integrations
- Resources: GitHub, live demo, documentation link/files, screenshots
- Team information: members + mentor
- Additional: categories/tags, project domain, visibility

### Core rules

- Never overwrite past submission state
- Every submit/resubmit creates a new `ProjectVersion`
- Admin actions enforce valid status transitions
- Public page shows only `status = PUBLISHED && isPublic = true`

### Submission validation rules (backend-enforced)

- `title` is required
- `shortDescription` is required
- At least 2 major content sections must be filled before submission
- GitHub URL OR documentation (link or file reference) is required before submission

### Admin workflow

- View submissions at `/admin/showcase`
- Filter by status
- Start review
- Add/resolve feedback
- Request changes / approve / publish / reject

### Creator workflow

- Create/edit project at `/showcase/my-projects`
- Submit when in `DRAFT`
- Resubmit when in `CHANGES_REQUESTED`
- View latest feedback and version context

### Full submission-review-publish workflow

- Draft authoring:
  - creator builds structured content, assets, and links
- Submit event:
  - backend validates required fields and minimum section coverage
  - immutable ProjectVersion snapshot is created
  - status transitions to SUBMITTED
- Review event:
  - admin starts review and adds feedback entries
  - admin can request changes, approve, reject, or publish
- Resubmission event:
  - creator updates content and resubmits
  - new snapshot is created; previous snapshots remain immutable
- Publication event:
  - project appears publicly only when status is PUBLISHED and visibility is enabled

### Versioning and audit guarantees

- Each submission cycle produces an immutable version record.
- Feedback remains tied to review context, preserving traceability.
- Current editable state never overwrites historical submission evidence.

---

## Database Models

### Existing core models

- `User`, `Project`, `ProjectMember`, `Task`, `Milestone`, `Review`, `ReviewCriteria`, `ProjectFile`, `Comment`, `Notification`, `Tag`, `ProjectTag`

### New models

- `EmailQueue`
- `PendingProjectAssignment`
- `ShowcaseProject`
- `ProjectVersion`
- `ReviewFeedback`
- `ProjectAsset`
- `ShowcaseTeamMember`

### New enums

- `ShowcaseProjectStatus`
- `ShowcaseProjectDomain`
- `ShowcaseAssetKind`
- `EmailQueueStatus`
- `DeliveryStatus` (`BOUNCED`) — tracks invitation delivery failures
- Added notification enum values for showcase events

### New model fields

- `EmailQueue.messageId` — Gmail Message-ID captured on send, used as primary DSN correlation key
- `PendingProjectAssignment.deliveryStatus` — `null` (no issue) or `BOUNCED` (delivery failed)
- `PendingProjectAssignment.bounceDiagnosticRaw` — raw SMTP diagnostic from DSN
- `PendingProjectAssignment.bounceReason` — human-readable bounce summary for teacher UI
- `PendingProjectAssignment.lastBounceAt` — timestamp of when DSN was detected

---

## Routes

### Public

- `/showcase`
- `/showcase/[projectId]`
- `/majorprojects`
- `/rblprojects-te`

### Admin

- `/admin`
- `/admin/projects`
- `/admin/users`
- `/admin/teacher-approvals`
- `/admin/project-assignments`
- `/admin/email-logs`
- `/admin/showcase`
- `/admin/showcase/[projectId]`
- `/admin/settings`

### Teacher

- `/teacher`
- `/teacher/projects`
- `/teacher/projects/new`
- `/teacher/projects/[projectId]`
- `/teacher/analytics`

### Student

- `/student`
- `/student/projects`
- `/student/projects/[projectId]`
- `/student/notifications`

### Showcase authoring

- `/showcase/my-projects`

---

## Server Actions and APIs

### New admin user moderation actions

- `getPendingTeacherRegistrations()`
- `approveTeacherRegistration()`
- `rejectTeacherRegistration()`

### New bulk assignment/email outbox actions

- `adminUploadProjectAssignments()`
- `getAdminAssignableProjects()`
- `getEmailQueueLogs()`
- `retryFailedEmails()`
- `runEmailQueueNow()`

### New admin project control actions

- `getAdminProjectsManagementData()`
- `adminUpdateProject()`
- `adminUpdateProjectMentor()`
- `adminAddProjectMember()`
- `adminUpdateProjectMemberRole()`
- `adminRemoveProjectMember()`

### New background utilities

- `processEmailQueue(batchSize = 50)`
  - claims `PENDING` rows as `PROCESSING`
  - sends via pooled Nodemailer transporter
  - marks `SENT` or requeues/fails with `attempts` and `errorLog`
  - stores Gmail `messageId` on `EmailQueue` on successful send
- `detectBounces()` — orchestrates the full bounce detection pipeline:
  1. `BounceFetcher.fetchNew()` — queries Gmail API for unread DSNs (`has:delivery-status is:unread`)
  2. `BounceParser.parse()` — extracts recipient, diagnostic, Original-Message-ID from DSN body
  3. `BounceValidator.validate()` — checks permanent failure, institutional domain, required fields
  4. `BounceMatcher.match()` — correlates DSN to `PendingProjectAssignment` with confidence (HIGH/MEDIUM/LOW/NONE)
  5. `BounceProcessor.process()` — updates `deliveryStatus = BOUNCED` with diagnostic and reason
  6. `NotificationService.notifyBounce()` — creates in-app notification for the teacher
  - Exposed via `POST /api/cron/detect-bounces` (protected by `EMAIL_QUEUE_CRON_SECRET`)

### New showcase actions

User-side:

- `createProject()`
- `updateProject()`
- `submitProject()`
- `resubmitProject()`
- `getMyProjects()`
- `getProjectVersions()`

Admin-side:

- `getAllSubmissions()`
- `getSubmissionById()`
- `startReview()`
- `addFeedback()`
- `resolveFeedback()`
- `requestChanges()`
- `approveProject()`
- `publishProject()`
- `rejectProject()`

Public:

- `getPublicShowcaseProjects()`
- `getPublicShowcaseProjectById()`

### New API routes

- `POST /api/cron/process-emails` — process pending email queue
- `POST /api/cron/detect-bounces` — run bounce detection pipeline (Gmail API DSN search → parse → validate → match → process → notify)

---

## Notifications

Existing project notifications remain unchanged.

Showcase events now emit notifications for:

- submission
- feedback added
- changes requested
- approved
- published

Invitation bounce detection emits a `PROJECT_UPDATED` notification when a bounce is confirmed:

- Recipient: project teacher
- Title: "Invitation delivery failed"
- Message: includes the recipient email and bounce reason (e.g., "Mailbox does not exist")
- Deduplication: at most one notification per `PendingProjectAssignment` record lifetime
- Edit clears bounce (new record → eligible for fresh notification); resend preserves bounce

---

## UI/UX Highlights

### Layout

- Role-aware sidebar nav links
- Topbar command menu with quick actions
- Improved shell visuals with subtle gradients and texture

### Auth experience

- CoE portal handles login; the app relies on the shared JWT cookie
- Unauthenticated access redirects to the CoE login entry point

### Admin / Teacher additions

- Teacher approvals panel for admin activation workflows
- Email logs panel for outbox status + retry failed
- Projects management panel for editing project details, mentor, and members
- Showcase command center and structured review view
- Bounce state indicators in MembersTab pending cards — teachers see ❌ with bounce reason when delivery fails; edit to clear, resend preserves

### Invitation Bounce State

- Pending invitation cards show bounce state in MembersTab:
  - Normal: ⏳ clock icon + "Invitation sent · 2 days ago"
  - Bounced: ❌ red icon + "Invitation delivery failed" + bounce reason (e.g., "Mailbox does not exist")
- Edit clears bounce; resend preserves bounce state
- Teachers are auto-notified via in-app notification when a bounce is detected

### Project Assignment Import

- Admin CSV assignment import requires only `email` and `projectName`
- Projects are auto-resolved by project title from each CSV row (no manual project picker)
- CSV assignment import supports both existing users and new invitees
- Existing users are assigned directly to `ProjectMember`
- Non-existing users are stored as `PendingProjectAssignment`
- When invited users sign in via CoE, pending assignments are automatically linked and moved into `ProjectMember`
- All assignment notifications are queued and processed asynchronously

### Showcase UI highlights

- Multi-step project submission form (stepper)
- Structured section cards for review readability
- Basic version comparison in admin review
- Public project detail pages with sectioned narrative + screenshot gallery

### Public explorer highlights

- Unified neutral visual language across `/majorprojects` and `/rblprojects-te`
- Scroll-aware but width-safe table containers to prevent overflow beyond control-bar width
- Responsive search + class/group filters with consistent interaction states

---

## Setup (Development)

### 1. Install

```bash
npm ci
```

### 2. Configure env

```bash
cp .env.example .env
```

### 3. Database

```bash
npm run db:generate
npm run db:push
```

Optional seed:

```bash
npm run db:seed
```

### 4. Run app

```bash
npm run dev
```

---

## Deployment

For complete production steps, see:

- [DEPLOYMENT.md](DEPLOYMENT.md)

Includes:

- Docker deployment
- PM2 deployment
- SSL/nginx setup
- migration strategy
- troubleshooting and backups

---

## Environment Variables

### Required

```env
DATABASE_URL="mysql://user:password@host:3306/project_dashboard"
COE_JWT_SECRET="<coe-jwt-secret>"
EMAIL_QUEUE_CRON_SECRET="<strong-random-secret>"
INSTITUTIONAL_EMAIL_DOMAIN="tcetmumbai.in"
```

### Institutional Email

```env
INSTITUTIONAL_EMAIL_DOMAIN="tcetmumbai.in"
```

`INSTITUTIONAL_EMAIL_DOMAIN` controls which email domains are accepted for student invitations and bounce detection validation. Defaults to `"tcetmumbai.in"` if not set.

### MinIO Object Storage

```env
S3_BUCKET_NAME="..."
MINIO_ENDPOINT="https://minio.your-domain.com"
MINIO_REGION="us-east-1"
MINIO_ACCESS_KEY="..."
MINIO_SECRET_KEY="..."
S3_FORCE_PATH_STYLE="true"
MINIO_USE_PROXY="false"
```

`MINIO_USE_PROXY="true"` forces app-served URLs (`/api/storage/...`) instead of direct MinIO presigned URLs.

### SMTP/Gmail

```env
SMTP_PROVIDER="gmail"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
SMTP_FROM="your-email@gmail.com"
```

Note: SMTP is required for outbound email queue notifications.
Note: bulk email processing route requires `EMAIL_QUEUE_CRON_SECRET`.

**Gmail API (required for bounce detection):**

The `GOOGLE_REFRESH_TOKEN` must be generated with both scopes:

- `https://mail.google.com/` — existing SMTP scope
- `https://www.googleapis.com/auth/gmail.modify` — Gmail API DSN detection (read + remove UNREAD label)

After adding `gmail.modify` to the OAuth consent screen, regenerate the refresh token. The old token lacks the required scope and will cause 401 errors.

---

## Operational Playbooks

### Playbook A: Semester onboarding

- Confirm `COE_JWT_SECRET` is configured and CoE portal issues `coe_shared_token`.
- Import assignment CSV with email and projectName.
- Review import summary:
  - matched rows
  - created projects
  - direct assignments
  - pending invites
- Run Queue Now for immediate notification delivery.
- Confirm invited users convert to memberships after first CoE login.

### Playbook B: Mentor reassignment

- Open /admin/projects.
- Update project mentor to active teacher.
- Validate teacher access on teacher project screens.

### Playbook C: Recover failed emails

- Inspect FAILED rows in /admin/email-logs.
- Fix SMTP or provider credentials/connectivity.
- Click Retry Failed.
- Click Run Queue Now.
- Verify rows move to SENT or requeue with updated error logs.

### Playbook D: Monitor bounce detection

- Configure cron schedule for `POST /api/cron/detect-bounces` (every 15 min recommended)
- Regenerate Gmail OAuth refresh token with `gmail.modify` scope if bounce detection returns 401
- Check `PendingProjectAssignment` records with `deliveryStatus = BOUNCED` to review bounce reasons
- Teachers receive in-app notification on bounce; instruct them to edit the email address to clear bounce state
- Monitor for repeated LOW confidence matches (same email, multiple projects) — may indicate CSV assignment collisions

### Playbook E: Showcase publishing batch

- Open /admin/showcase.
- Filter by submission state.
- Start review and process feedback.
- Request changes or approve.
- Publish approved items.
- Verify public visibility in /showcase.

---

## QA and Testing Matrix

### Auth and access tests

- CoE JWT verification failures and missing cookie handling.
- Role mapping for ADMIN/FACULTY/STUDENT and non-ACTIVE status rejection.
- Route guard checks across all role scopes.

### Assignment and outbox tests

- CSV parsing with quoted values and malformed lines.
- Existing user direct assignment path.
- New user pending assignment path.
- Registration-time pending assignment conversion.
- Queue retry and failure threshold logic.

### Admin project control tests

- Metadata edits with valid and invalid payloads.
- Mentor reassignment to inactive or wrong-role users should fail.
- Member add operations enforcing max group size.
- Member role transitions including LEAD updates.
- Member removal consistency across project views.

### Bounce detection tests

- DSN parser extracts recipient, diagnostic, and Message-ID from RFC 3464/1894 bodies.
- Validator rejects temporary failures (4xx), missing recipients, and non-institutional domains.
- Matcher returns correct confidence: HIGH (Message-ID match), MEDIUM (single email), LOW (multiple), NONE.
- Full pipeline produces `deliveryStatus = BOUNCED` on permanent failures.
- Duplicate DSNs are idempotent — second run produces no state change.
- Edit clears bounce; resend preserves bounce.
- Notification is created only once per assignment record.

### Showcase tests

- Submission validation constraints.
- Status transition integrity.
- Snapshot creation on submit and resubmit.
- Public listing restricted to published and visible submissions.

---

## Seed Data

Seed creates:

- default admin (`admin@university.edu`)
- teacher and student users
- sample projects, tasks, milestones, reviews, notifications

Seeded users are created with placeholder password hashes (not used for CoE auth).

---

## Security Notes

- Keep `.env` out of git
- Rotate AWS and SMTP credentials regularly
- Use a strong `COE_JWT_SECRET` and rotate it with the CoE portal
- Prefer `prisma migrate deploy` in production
- Restrict DB exposure to private network
- Use TLS/HTTPS in production
- Non-ACTIVE CoE statuses are blocked by server guards
- Protect `/api/cron/process-emails` and `/api/cron/detect-bounces` with a strong secret and never expose them client-side
- Gmail OAuth refresh token must include `gmail.modify` scope for bounce detection; regenerate after scope changes

---

## Troubleshooting

### Projects not visible for invited users after registration

- Verify the invited user has completed CoE login at least once.
- Verify pending assignment email matches registered email (normalized lowercase).
- Verify PendingProjectAssignment status changes to ASSIGNED.
- Verify ProjectMember entries were created for the new user.

### Emails remain in PENDING

- Verify SMTP environment variables.
- Use Run Queue Now in /admin/email-logs.
- Verify cron token and scheduler invocation for /api/cron/process-emails.

### Bounce detection returns 401 errors

- The Gmail OAuth refresh token was issued without `gmail.modify` scope.
- Regenerate the refresh token with both `https://mail.google.com/` (SMTP) and `https://www.googleapis.com/auth/gmail.modify` (DSN detection) scopes.
- Update `GOOGLE_REFRESH_TOKEN` in `.env`.

### Bounce detection finds no DSNs despite sending to invalid addresses

- Verify Gmail API is enabled in GCP Console.
- Verify `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` are set.
- Verify the sending mailbox actually receives DSNs (check Gmail inbox manually).
- Check that `is:unread` is not filtering already-read DSNs.

### Pending cards show bouncing but teacher doesn't see notification

- The `PROJECT_UPDATED` notification type must be present in the `NotificationType` enum.
- Verify cron ran successfully — check `POST /api/cron/detect-bounces` response.
- The notification is deduplicated per assignment record — only the first detection creates one.

### Mentor update failures

- Confirm selected mentor is active TEACHER.
- Confirm action is performed by ADMIN session.

### Prisma drift on existing database (no reset allowed)

- If `prisma migrate dev` reports drift and asks for reset on a real database, do not reset.
- Baseline the current schema into migrations:
  - `mkdir -p prisma/migrations/0001_baseline`
  - `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0001_baseline/migration.sql`
  - `npx prisma migrate resolve --applied 0001_baseline`
- After baselining, future schema changes can use normal `prisma migrate dev` workflows.

### Standalone runtime warning

- In standalone output mode, run with node .next/standalone/server.js in production instead of next start.

### Images fail when MINIO endpoint is private/local

- If `MINIO_ENDPOINT` points to `localhost` or a private host, browsers cannot fetch presigned URLs directly.
- Set `MINIO_USE_PROXY="true"` to stream assets through `/api/storage/[...path]` from the app domain.

### Prevent MinIO URL exposure in downloads

- File and showcase asset downloads are served through internal proxy routes (`/api/storage/[...path]`).
- Direct MinIO presigned download URLs are not returned to the browser.
- This keeps MinIO endpoints internal while Node streams file content to clients.
