# Comprehensive UI/UX Audit — Academic Project Dashboard

> **Date:** 2026-07-05 | **App:** Next.js (App Router) + Prisma + TanStack Query + Zustand + Framer Motion + shadcn/ui

---

## 1. Complete Route Inventory

### 1.1 Route Map

```
/                                   → Role-based redirect (ADMIN→/admin, TEACHER→/teacher, STUDENT→/student)
/dashboard                          → Redirect to role-specific dashboard via ?role= query param

--- Authenticated (Dashboard Shell) ---
/admin                              → Admin Overview (stats, module cards, recent users)
/admin/projects                     → Admin Projects Management (CRUD, mentor assign, member management)
/admin/users                        → Admin Users (list, create, toggle active, filter)
/admin/teacher-approvals            → Approve/reject teacher self-registrations
/admin/project-assignments          → CSV bulk upload for project assignment
/admin/email-logs                   → Email queue monitor + retry/run-now controls
/admin/showcase                     → Showcase submissions table with review workflow
/admin/showcase/[projectId]         → Single submission detail page
/admin/settings                     → Placeholder settings forms (all "demo")

/teacher                            → Teacher Dashboard (stats, charts, project cards)
/teacher/projects                   → Teacher Projects list (search, filter, pagination, create)
/teacher/projects/new               → Multi-step project creation form
/teacher/projects/[projectId]       → Project detail with 7 tabs (Overview, Tasks, Milestones, Reviews, Publications, Files, Members)
/teacher/analytics                  → Cross-project analytics (charts, stats)

/student                            → Student Dashboard (stats, project cards, milestones)
/student/projects                   → Student Projects list (cards with pagination)
/student/projects/[projectId]       → Student project detail (4 tabs: Tasks, Milestones, Publications, Files)
/student/notifications              → Full notification history page with filters

/showcase/my-projects               → Students/Teachers: my showcase submissions (create/edit/submit/resubmit)
/showcase                           → Public showcase gallery (all published)
/showcase/[projectId]               → Public single showcase project

--- Public (No Auth) ---
/analytics                          → Public read-only analytics page
/majorprojects                      → Major projects public listing (static JSON data)
/rblprojects-te                     → RBL projects public listing (static JSON data)

--- API Routes ---
/api/cron/detect-bounces            → Bounce detection worker
/api/cron/process-emails            → Email queue processing worker
/api/files/presign                  → S3 presigned URL generation
/api/internal/users/upsert          → External auth system user sync
/api/notifications                  → CRUD notifications
/api/notifications/count            → Unread notification count
/api/showcase/upload                → Showcase file upload (S3)
/api/storage/[...path]              → S3 storage file serving
/api/upload                         → Generic file upload
```

### 1.2 Route Groups

| Group | Segment | Purpose |
|---|---|---|
| `(dashboard)` | None | All authenticated pages. Wraps in DashboardShell (sidebar + topbar). |
| `_tabs/` | None (private) | Tab components for teacher and student project detail pages. Not routable. |

### 1.3 Auth Protection

| Protection | Routes |
|---|---|
| **Public** | `/showcase`, `/showcase/[projectId]`, `/analytics`, `/majorprojects`, `/rblprojects-te` |
| **Any authenticated** | `/(dashboard)/*` (requires valid COE JWT cookie) |
| **ADMIN only** | `/admin/*` |
| **TEACHER only** | `/teacher/*`, `/teacher/analytics`, `/teacher/projects/*` |
| **STUDENT only** | `/student/*`, `/student/notifications` |
| **STUDENT/TEACHER/ADMIN** | `/showcase/my-projects` |

---

## 2. Complete Page Inventory

### 2.1 Admin Overview (`/admin`)

**Layout:** DashboardShell — sidebar (8 items) + topbar + notification panel

**Visible Components:**
- Greeting header ("Admin Overview")
- System-wide 4-stat row: Total Users, Students, Teachers, Admins (via `StatCard`)
- Showcase System promo card with CTA
- CSV Project Assignment Upload promo card with CTA
- Manage Projects promo card with CTA
- "Go to Showcase" button (top right)
- Recent Users table: name, email, role badge, active/inactive dot

**Data:** `getUserCounts()` aggregate, `getUsers()` paginated per page

**Actions:**
- Click "Go to Showcase" → navigates to `/showcase`
- Click "Open Showcase" → `/admin/showcase`
- Click "Open Upload" → `/admin/project-assignments`
- Click "Open Projects" → `/admin/projects`

**Entry points:** Root redirect (`/`), sidebar "Overview"

### 2.2 Admin Projects (`/admin/projects`)

**Layout:** Full-width card-per-project list with dialogs

**Visible Components:**
- Search input (by title, domain, dept)
- "Manage Publications" button with pending-count badge
- Per-project card:
  - Title + "Review Required" badge (if pending edit)
  - Domain + Department
  - Status badge
  - Pending edits change preview block (amber highlight)
  - Mentor: `<Select>` dropdown with all teachers + "Save Mentor" button
  - Members list: name, email, role (Select: LEAD/MEMBER), remove button
  - Pending Invitations section: email, `timeAgo`, Resend + Remove buttons
  - Add Member section: text input (ID or email) + Role select + Add button
  - Delete button
  - Edit Project dialog (full form: title, description, department, domain, dates, max group size, status)
- Pagination bar

**Actions per project:** Edit, Delete, Save Mentor, Add/Remove member, Update member role, Resend invitation, Cancel invitation, Approve/Reject project edit

**Data:** `getAdminProjectsManagementData()` paginated

**Entry points:** Sidebar "Projects", admin overview promo card

### 2.3 Admin Users (`/admin/users`)

**Layout:** Table with filter + create dialog

**Visible Components:**
- Search input + Role filter dropdown (All/Admin/Teacher/Student)
- "Add User" gradient button → dialog with form
- Table columns: Name, Email, Role badge, Department, Status (Active/Inactive dot), Actions (toggle active)
- Pagination bar

**Actions:** Create user (name, email, role, department, roll number), Toggle active/inactive

### 2.4 Admin Teacher Approvals (`/admin/teacher-approvals`)

**Layout:** Card with pending request list

**Visible Components:**
- Pending requests list: name, email, teacher badge, requested date, department
- Approve / Reject buttons per request

**Entry points:** Sidebar "Teacher Approvals"

### 2.5 Admin Project Assignments (`/admin/project-assignments`)

**Layout:** Card with CSV upload

**Visible Components:**
- File upload input
- Textarea for CSV content
- "Process CSV and Queue Emails" button
- "Insert Sample CSV" button
- Result summary cards: Rows processed, matched, skipped, projects auto-created, existing users assigned, invites created, emails queued

**Actions:** Upload file, paste/edit CSV, process, reset to sample

### 2.6 Admin Email Logs (`/admin/email-logs`)

**Layout:** Card with table

**Visible Components:**
- "Retry Failed" and "Run Queue Now" buttons
- Table: Recipient, Subject, Status (badge), Attempts, Error Log
- Pagination bar

**Actions:** Retry failed emails, Run queue manually

### 2.7 Admin Showcase (`/admin/showcase`)

**Layout:** Table with search + status filter

**Visible Components:**
- Search input + status filter dropdown (DRAFT → REJECTED + ALL)
- Table: Title, Owner, Status badge, Versions count, Actions column
- Per-row actions: Review (link), Start Review, Request Changes, Approve, Publish, Reject (context-dependent on status)

**Entry points:** Sidebar "Showcase", admin overview promo card

### 2.8 Admin Settings (`/admin/settings`)

**Layout:** Two cards with forms

**Visible Components:**
- General card: Institution Name, Admin Email, Max File Upload, Default Max Group Size
- Email Notifications card: SMTP Host, Port, User, Password
- Save button per card

**Note:** All inputs are hardcoded defaults. Any save triggers `toast.success("Settings saved (demo)")` — forms are **completely non-functional**.

### 2.9 Teacher Dashboard (`/teacher`)

**Layout:** DashboardShell + greeting + stats + charts + project grid

**Visible Components:**
- Time-based greeting ("Good morning/afternoon/evening")
- 4 stats: Total Projects, Active Projects, Avg Completion, Reviews Due
- Project Completion bar chart
- Task Distribution donut chart
- Project cards grid (3 columns, up to 6+ projects)

**Entry points:** Root redirect, sidebar "Dashboard"

### 2.10 Teacher Projects (`/teacher/projects`)

**Layout:** Project card grid with search/filter + "New Project" CTA

**Visible Components:**
- Search input + Status filter + RBL filter
- "New Project" gradient button → `/teacher/projects/new`
- ProjectCard components with pagination

**Actions:** Click card → project detail, Create new project

### 2.11 Teacher Project Create (`/teacher/projects/new`)

**Layout:** Stepped form (3 steps) centered, max-w-2xl

**Step 1 — Details:** Title, Description, Department (dependent Select), Domain (dependent Select), Group Number, Max Group Size, RBL Project checkbox

**Step 2 — Timeline:** Start Date, End Date

**Step 3 — Tags:** Badge-style tag selector (optional, colored)

**Components:** Stepper indicator with step circles, Back/Next navigation, framer-motion transitions, react-hook-form + zod validation

**Actions:** Submit → creates project via `createProject()` → redirects to `/teacher/projects`

### 2.12 Teacher Project Detail (`/teacher/projects/[projectId]`)

**Layout:** Header + 7-tab navigation

**Header:** Title, edit-pending badge, domain + department, date range, member count, status badge, "Request Edit" button → dialog with full edit form

**Tabs:**

1. **Overview:** Description card, Task Breakdown donut, Milestones timeline, Tags section
2. **Tasks:** Task management (create, edit, status toggle, assignee) — `TasksTab`
3. **Milestones:** Gantt chart / milestones timeline — `MilestonesTab`
4. **Reviews:** Review scheduling and feedback — `ReviewsTab`
5. **Publications:** Publication management list — `PublicationsTab`
6. **Files:** File upload, download, management — `FilesTab`
7. **Members:** Pending invitations, member list, add/edit/remove — `MembersTab`

**Entry points:** Click project card from dashboard or projects list

### 2.13 Teacher Analytics (`/teacher/analytics`)

**Layout:** 3 stat cards + 2 charts + optional Gantt

**Visible Components:**
- Total Projects, Average Completion, Pending Reviews stats
- Project Completion bar chart
- Task Status Overview donut chart
- Milestone Progress Gantt bar (only if milestones exist)

### 2.14 Student Dashboard (`/student`)

**Layout:** DashboardShell + greeting + stats + project grid + milestones

**Visible Components:**
- Time-based greeting
- 4 stats: My Projects, Tasks Due Today, Completed Tasks, Overall Progress %
- Project cards grid (3 columns)
- Upcoming Milestones timeline (max 5, only if any exist)

### 2.15 Student Projects (`/student/projects`)

**Layout:** Project card grid with pagination

**Visible Components:**
- Header + cards grid (1→2→3 columns)
- Pagination bar

**Entry points:** Root redirect, sidebar "My Projects"

### 2.16 Student Project Detail (`/student/projects/[projectId]`)

**Layout:** Header + 4-tab navigation

**Header:** Title, domain, date range, member count, status badge, mentor info

**Tabs:**

1. **Tasks:** Kanban board view (drag? static columns) with task statuses — TODO/IN_PROGRESS/IN_REVIEW/DONE/BLOCKED
2. **Milestones:** Milestone timeline list
3. **Publications:** Publication summary cards + list + "Add Publication" form (score tracking)
4. **Files:** File uploader, file list with download buttons

**Entry points:** Click project card from dashboard or projects list

### 2.17 Student Notifications (`/student/notifications`)

**Layout:** Full notification history with filters

**Visible Components:**
- "Mark All Read" button (with unread count badge)
- Filter chips: ALL, TASK_ASSIGNED, REVIEW_SCHEDULED, FEEDBACK_RECEIVED, DEADLINE_REMINDER
- Notifications grouped by date (Today, Yesterday, etc.)
- Per notification: icon (by type), title, message, timestamp, "Mark read" button
- Unread notifications have accent border/background

**Entry points:** Sidebar "Notifications"

### 2.18 Showcase My Projects (`/showcase/my-projects`)

**Layout:** Card grid + "Create Structured Submission" dialog

**Visible Components:**
- Create/edit dialog with 6-step form (Basic, Project Details, Technical, Resources, Team, Additional)
- AI Assist Import section (copy JSON template, paste AI JSON, import)
- Project cards: title, short description, status, domain, versions, tech stack pills, team count, resources
- Per-card actions: Edit Draft, Submit for Review, Resubmit

**Note:** File upload requires a pre-existing draft (draft must be saved first before uploading docs/screenshots)

**Entry points:** Sidebar "Showcase" (student/teacher), dashboard CTA

### 2.19 Public Showcase (`/showcase`)

**Layout:** Public gallery of published projects

**Note:** No auth required. Shows all PUBLISHED showcase projects.

### 2.20 Public Analytics (`/analytics`)

**Layout:** Public analytics page

**Note:** No auth required. Read-only aggregate data.

### 2.21 Public Major Projects (`/majorprojects`)

**Layout:** Static listing from JSON files

**Visible Components:** Reads `BE_NBA_groups.json`, `all-dep-data.json`, `statistics.json` directly — no database query.

### 2.22 Public RBL Projects (`/rblprojects-te`)

**Layout:** Static listing from `RBL_NBA_groups.json`

---

## 3. Complete Component Inventory

### 3.1 Layout Components

| Component | Location | Used By |
|---|---|---|
| `DashboardShell` | `(dashboard)/DashboardShell.tsx` | All authenticated pages — wraps Sidebar + Topbar + NotificationPanel + animated main content |
| `Sidebar` | `components/layout/Sidebar.tsx` | DashboardShell — 3 nav sets (ADMIN: 8 items, TEACHER: 4, STUDENT: 4), collapsible, mobile overlay |
| `Topbar` | `components/layout/Topbar.tsx` | DashboardShell — search/command button, theme toggle, notification bell (with unread ping), avatar, mobile hamburger |
| `NotificationPanel` | `components/layout/NotificationPanel.tsx` | DashboardShell — slide-in drawer, groups by New/Earlier, type icons, click to mark read + navigate |

### 3.2 Navigation Components

| Component | Description |
|---|---|
| `Command palette` | Built into Topbar — cmdk-based, opens with ⌘K / Ctrl+K, role-specific nav items + quick actions |
| `Sidebar` | Collapsible (chevron button on desktop), auto-collapses on mobile, tooltip on collapsed items |
| `Breadcrumbs` | Not present anywhere in the app |
| `Mobile hamburger` | Topbar hamburger menu on mobile toggles sidebar overlay |

### 3.3 Dashboard Components

| Component | Description |
|---|---|
| `StatCard` | Icon + title + value + suffix + color (indigo/violet/emerald/amber) — used in all 3 dashboards |
| `ProjectCard` | Project preview card — title, status, progress bar, member count, date range, tags |
| `MilestoneTimeline` | Vertical timeline of milestones with completion status |
| `TaskKanban` | Kanban board view for student tasks |
| `LeaderDetailsForm` | Additional form for project leads |
| `FileUploader` | File upload component for student projects |
| `PublicationList` | List of publications per project |
| `PublicationForm` | Add/edit publication form |
| `AdminPublicationsList` | Admin view of all publications across projects |

### 3.4 Chart Components

| Component | Description |
|---|---|
| `ProjectCompletionChart` | Horizontal bar chart showing completion % per project |
| `TaskDistributionDonut` | Donut chart showing TODO/IN_PROGRESS/IN_REVIEW/DONE/BLOCKED counts |
| `MilestoneGanttBar` | Horizontal Gantt-style milestones across projects |

### 3.5 UI Primitives (shadcn/ui)

All standard: Button, Card, Badge, Input, Textarea, Select, Dialog, Tabs, Skeleton, Avatar, Separator, ScrollArea, Tooltip, Label, Checkbox, Table, PaginationBar

### 3.6 What's Missing

- **Breadcrumbs** — nowhere in the app
- **Back button** — no explicit back navigation on detail pages
- **Keyboard shortcuts** — only ⌘K (command palette) and ⌘B (notifications)
- **Toast/undo** — sonner toasts confirm actions but no undo
- **Confirmation dialogs** — only `window.confirm()` for delete/remove actions (not custom dialogs)

---

## 4. User Journey Maps

### 4.1 Student Journey

```
1. LOGIN (external) → Redirect to /student
   → Sees: greeting, 4 stats, project cards, upcoming milestones
   → Action: clicks a project card

2. PROJECT DETAIL (/student/projects/[id])
   → Default tab: Tasks (Kanban board)
   → Can switch to: Milestones, Publications, Files
   → Actions:
     - Update task status
     - Upload/download files
     - Add/view publications
     - View milestones

3. MY PROJECTS (/student/projects) ← sidebar
   → Sees: paginated project cards
   → Clicks one → project detail

4. NOTIFICATIONS (/student/notifications) ← sidebar
   → Sees: full history grouped by date
   → Can filter by type
   → Clicks notification → navigates to relevant link

5. SHOWCASE (/showcase/my-projects) ← sidebar
   → Sees: own showcase submissions
   → Can create structured submission (6-step form)
   → Can upload files (requires draft first)
   → Can submit for review

6. PUBLIC SHOWCASE (/showcase) ← dashboard CTA
   → Sees: all published projects (public)
```

### 4.2 Teacher Journey

```
1. LOGIN → Redirect to /teacher
   → Sees: greeting, 4 stats (total/active/completion/reviews), charts, project grid

2. PROJECTS (/teacher/projects) ← sidebar
   → Sees: paginated cards with search/filter
   → Clicks "New Project" → stepped creation form
     → Fills title, description, department, domain, group, dates, tags
     → Submits → redirects to projects list

3. PROJECT DETAIL (/teacher/projects/[id]) ← click card
   → Sees: 7 tabs
   → Overview: description, task breakdown, milestones, tags
   → Tasks: create/edit/delete tasks, set statuses
   → Milestones: create/edit milestones
   → Reviews: schedule/complete reviews
   → Publications: manage publication records
   → Files: view/upload project files
   → Members: view members, manage pending invitations, add/remove

4. EDIT REQUEST → "Request Edit" button → dialog
   → Fills form → submits → admin must approve
   → Sees: "Edit Pending Approval" badge + amber preview banner

5. ANALYTICS (/teacher/analytics) ← sidebar
   → Sees: cross-project stats and charts

6. SHOWCASE (/showcase/my-projects) ← sidebar
   → Same as student: create structured submissions
```

### 4.3 Admin Journey

```
1. LOGIN → Redirect to /admin
   → Sees: 4 user stats, module promo cards, recent users

2. USERS (/admin/users) ← sidebar
   → Search/filter users
   → Create new user
   → Toggle active/inactive

3. TEACHER APPROVALS (/admin/teacher-approvals) ← sidebar
   → Approve or reject pending teacher registrations

4. PROJECTS (/admin/projects) ← sidebar
   → Full CRUD on all projects
   → Assign/change mentors
   → Add/remove members
   → Manage pending invitations
   → Approve/reject teacher edit requests
   → Delete projects

5. PROJECT ASSIGNMENTS (/admin/project-assignments) ← sidebar
   → Upload CSV → batch assign projects + queue notification emails

6. EMAIL LOGS (/admin/email-logs) ← sidebar
   → Monitor email queue status
   → Retry failed emails
   → Run queue manually

7. SHOWCASE (/admin/showcase) ← sidebar
   → Review submissions
   → Start review, request changes, approve, publish, reject
   → Click into individual submission

8. SETTINGS (/admin/settings) ← sidebar
   → All forms are non-functional (demo only)
```

---

## 5. Information Architecture Diagram

```
ROOT (/)
  │
  ├── PUBLIC
  │   ├── /showcase                         [Gallery of published projects]
  │   │   └── /showcase/[projectId]         [Single project detail]
  │   ├── /analytics                        [Read-only aggregate data]
  │   ├── /majorprojects                    [Static JSON data display]
  │   └── /rblprojects-te                   [Static JSON data display]
  │
  └── DASHBOARD (auth required)
      │
      ├── /dashboard                        [Redirect by role]
      │
      ├── ADMIN ─────────────────────────────────────
      │   ├── /admin                         [Overview — stats, module cards]
      │   ├── /admin/projects               [CRUD all projects]
      │   ├── /admin/users                  [User management]
      │   ├── /admin/teacher-approvals      [Registration approval]
      │   ├── /admin/project-assignments    [CSV bulk upload]
      │   ├── /admin/email-logs             [Email queue monitor]
      │   ├── /admin/showcase               [Review submissions]
      │   │   └── /admin/showcase/[id]      [Submission detail]
      │   └── /admin/settings               [Non-functional (demo)]
      │
      ├── TEACHER ──────────────────────────────────
      │   ├── /teacher                      [Dashboard — stats, charts, projects]
      │   ├── /teacher/projects             [Projects list]
      │   │   ├── /teacher/projects/new     [Create project (3 steps)]
      │   │   └── /teacher/projects/[id]    [Detail: 7 tabs]
      │   └── /teacher/analytics            [Cross-project analytics]
      │
      ├── STUDENT ──────────────────────────────────
      │   ├── /student                      [Dashboard — stats, projects, milestones]
      │   ├── /student/projects             [Projects list]
      │   │   └── /student/projects/[id]    [Detail: 4 tabs]
      │   └── /student/notifications        [Notification history]
      │
      └── SHARED (any auth role) ──────────
          └── /showcase/my-projects         [Create/manage showcase submissions]
```

---

## 6. UX Pain Points (Ranked by Severity)

### Critical (Blocks users)

1. **Admin Settings are entirely non-functional.** All forms save with `toast.success("Settings saved (demo)")` — hardcoded placeholder values are never persisted. This is deceptive. Any admin who tries to configure SMTP or system settings will believe they've saved changes that were never applied.

2. **Showcase file upload requires a saved draft first.** The file inputs are disabled until `editingId` is set. A user clicking "Create Structured Submission" cannot upload documentation or screenshots until they fill the entire form and save once. This creates a confusing two-phase flow with no guidance.

3. **No breadcrumbs anywhere.** Every detail page (projects, showcase submissions) lacks back-navigation context. A teacher deep in project tabs has no visual indicator of where they are in the hierarchy. The only way back is browser back or sidebar re-click.

4. **"Request Edit" flow is unclear to teachers.** The teacher fills the same form as the admin but submits a "pending edit request" that requires admin approval. The edit button becomes disabled once a request is pending. Nothing communicates *why* edits require approval, *how long* approval takes, or *what happens after approval*. The amber banner helps but appears only *after* submission.

5. **No undo for any action.** Delete, remove member, reject, cancel invitation — all use `window.confirm()` with no undo capability. A single misclick is irreversible.

### High (Frustrating but workable)

6. **Student project detail defaults to Tasks tab.** The Kanban board is the default view. For a student who just joined a project, "Overview" (description, milestones, tags) would be more useful as the first thing they see. The student has no Overview tab at all — only Tasks, Milestones, Publications, Files.

7. **No search/filter on student projects list.** Students with many projects (unlikely but possible) have no search or filter — only pagination. Teachers have search + 2 filters.

8. **Teacher project create form has no draft save.** The 3-step form with validation can lose all progress if the user navigates away or the session expires mid-way. No autosave capability.

9. **Notification panel and page are inconsistent.** The slide-in panel groups by "New" and "Earlier". The full page groups by date but uses different filter mechanism (chips vs no filter in panel). Different type icon sets exist between the panel and the page.

10. **Settings page exists but does nothing.** This is worse than not having a settings page — it creates a false expectation and trains users that the dashboard settings are unreliable.

### Medium (Annoying)

11. **"Go to Showcase" button on every dashboard.** Every dashboard (admin, teacher, student) has a prominent "Go to Showcase" button. For admins it links to `/showcase` (public), for teachers/students it also links to `/showcase`. The sidebar already has "Showcase" links. This feels redundant and crowds dashboard CTA space.

12. **No empty state guidance.** "No projects assigned yet" on student projects is flat. No next-step guidance like "Contact your teacher to be added to a project" or "Looking for your invitations?".

13. **Viewing/read receipts not shown for notifications.** Notifications can be "read" but there's no indication of when the teacher saw a bounce notification or when the student saw a task assignment.

14. **Mobile sidebar covers entire screen.** The 280px sidebar with 40% black overlay is functional but the overlay doesn't dismiss on outside click (only on sidebar item click or overlay click). The toggle button is small.

15. **Status filter options inconsistent.** Teacher projects: ALL/DRAFT/ACTIVE/UNDER_REVIEW. Admin showcase: ALL/DRAFT/SUBMITTED/UNDER_REVIEW/CHANGES_REQUESTED/RESUBMITTED/APPROVED/PUBLISHED/REJECTED. No standardized status vocabulary across features.

### Low (Polish)

16. **Project card truncation.** Project titles truncate at 20 chars in charts and at arbitrary lengths in cards. Long-titled projects look broken.

17. **No favicon or app name in browser tab.** The HTML title is "Academic Project Dashboard" — the external branding (TCET) doesn't appear in browser chrome.

18. **No keyboard shortcut discoverability.** ⌘K and ⌘B are not documented anywhere in the UI. Users won't know they exist.

19. **Date format inconsistency.** Uses `toLocaleDateString()` (locale-dependent) in some places and custom formatting in others.

20. **Severity of notification panel badge.** The unread count uses `animate-ping` on the bell icon — a pulsing red dot. This creates urgency/anxiety for a non-critical feature and runs continuously, which may be distracting.

---

## 7. Product Observations

### What This Product Is Trying to Accomplish

This is an **academic project management dashboard** for TCET (Thakur College of Engineering and Technology). It centralizes the lifecycle of student capstone/final-year projects:

- **Teachers** create projects, define milestones/tasks, review work, manage teams
- **Students** join projects, track tasks, upload files, submit publications, showcase work
- **Admins** manage the entire system: users, project assignments, email notifications, showcase publications

The external COE (Center of Excellence) auth system handles user registration and single sign-on. This dashboard is the **operational layer** — the day-to-day tool for running projects.

### How Users Currently Interact

The interaction pattern is **read-heavy with occasional writes**:

- **Students** check their dashboard for tasks due today and upcoming milestones. They visit project detail pages to update task statuses and upload deliverables. Notifications drive them back when something changes.
- **Teachers** use the dashboard for oversight — checking completion stats, reviewing milestones, and managing members. The stepped project creation form is likely a one-time interaction per project.
- **Admins** batch-operate: CSV uploads, approving teachers, reviewing showcase submissions. The admin rarely visits individual project detail pages.

### Where Users Appear to Stop Using It

1. **Showcase module has unclear value.** The 6-step submission form with "AI Assist Import" suggests complex content creation. But the lack of published showcase projects, no leaderboard or browsing experience, and no tie to grades/graduation makes it unclear why a student would invest in creating a submission.

2. **Analytics pages lack comparative data.** The teacher analytics page shows charts but no benchmarks, no historical trends, no comparison to other teachers' cohorts, no progress-over-time. Without context, the charts are decorative.

3. **Notifications have no actionable next steps.** A notification says "Invitation delivery failed" but clicking it navigates to the project page. The teacher must find the pending invitation section and decide to resend or edit. The notification doesn't offer inline action.

4. **The admin settings page being non-functional suggests this feature was never completed.** It's a placeholder that escaped into production.

### Which Parts Appear Overbuilt

1. **Showcase creation form — 6 steps, ~40 fields, AI import.** For what appears to be a supplementary portfolio feature, this is a significant amount of UI. The gap between effort to create a submission and the visibility/reward of having one published appears wide.

2. **Command palette (⌘K).** For a page with 4-8 sidebar items, a command palette is overkill. It provides navigation to the same places the sidebar does, plus theme toggle and sign out. This is a technically impressive UI pattern applied where nav complexity doesn't warrant it.

3. **Framer Motion animations throughout.** Every page transition, sidebar toggle, notification panel slide, hover effect, and stat counter has custom spring animations. While visually polished, the layout shift risk (animated margins on main content) creates noticeable jank during sidebar toggle on slower devices.

4. **Separate teacher and student project detail pages with different tab sets.** The duplication of `ProjectDetailPage` (teacher, 548 lines) and `StudentProjectDetailClient` (student) with different tab structures suggests these should share a base layout or be unified.

### Which Parts Appear Underdeveloped

1. **Admin Settings — completely non-functional.** This is the most obvious gap. It should either work or be removed.

2. **Public analytics (`/analytics`)** — exists as a route but content was not inspected. Likely minimal.

3. **Bounce detection system — documented spec exists (`docs/AUTOMATIC_INVITATION_DELIVERY_TRACKING_IMPLEMENTATION_PLAN.md`) but may not be implemented yet.** The cron route exists at `/api/cron/detect-bounces` but the UI doesn't currently handle `deliveryStatus = BOUNCED` on `PendingProjectAssignment`.

4. **Student notifications page has a dedicated "Notifications" sidebar link, but teacher and admin don't.** Only students have a full notification history page. Teachers/admins rely solely on the slide-in panel.

5. **No onboarding or first-run experience.** A first-time user (any role) sees a dashboard with 0 stats and no guidance on what to do next.

### The True Core Workflow

The **actual** core workflow is:

1. **Admin** imports student/teacher data (bulk CSV or external auth sync)
2. **Admin** assigns students to projects (CSV upload) or **Teacher** creates projects and adds members
3. **Email notifications** are queued and sent (Nodemailer + Gmail SMTP)
4. **Teacher** manages project tasks, milestones, and reviews
5. **Student** views their assigned projects, tracks tasks, uploads files
6. **Admin** monitors email logs and processes showcase reviews

Everything else — showcase, public analytics, command palette, animation, settings — is supplementary to this core loop.
