# Teacher Workspace — Implementation Plan

> **Status:** Planning — No code written.
> **Primary goal:** Help teachers make faster and better decisions with less navigation.
>
> **Architectural note:** Internally, this page is the **Teacher Workspace**, not the Teacher Dashboard.
> The workspace is where teachers spend their time, resolve issues, and drive projects forward.
> The dashboard presentation is only one expression of that workspace.

---

## Table of Contents

0. [Phase 0 — Workflow Analysis](#0-phase-0--workflow-analysis)
1. [Problems with the Current Dashboard](#1-problems-with-the-current-dashboard)
2. [Dashboard vs Adjacent Systems](#2-dashboard-vs-adjacent-systems)
3. [Design Principles](#3-design-principles)
4. [Scaling Strategy](#4-scaling-strategy)
5. [Shared Dashboard Architecture](#5-shared-dashboard-architecture)
6. [Information Hierarchy](#6-information-hierarchy)
7. [Section Question Map](#7-section-question-map)
8. [Feature Phase Classification](#8-feature-phase-classification)
9. [Component Architecture](#9-component-architecture)
10. [Data Requirements & New Queries](#10-data-requirements--new-queries)
11. [Attention Scoring Model](#11-attention-scoring-model)
12. [Health & Trend Model](#12-health--trend-model)
13. [Review Readiness Model](#13-review-readiness-model)
14. ["Since Your Last Visit" Concept](#14-since-your-last-visit-concept)
15. [Pinned Projects Strategy](#15-pinned-projects-strategy)
16. [Continue Working Concept](#16-continue-working-concept)
17. [Recommendation Engine](#17-recommendation-engine)
18. [Recently Completed Concept](#18-recently-completed-concept)
19. ["Inbox Zero" Philosophy](#19-inbox-zero-philosophy)
20. [Refresh Strategy](#20-refresh-strategy)
21. [Future Personalization Architecture](#21-future-personalization-architecture)
22. [Existing Reusable Components](#22-existing-reusable-components)
23. [New Components Required](#23-new-components-required)
24. [Existing Functionality Preserved](#24-existing-functionality-preserved)
25. [Database Changes](#25-database-changes)
26. [State Management Strategy](#26-state-management-strategy)
27. [Loading Strategy](#27-loading-strategy)
28. [Error Handling Strategy](#28-error-handling-strategy)
29. [Responsive Strategy](#29-responsive-strategy)
30. [Performance Considerations](#30-performance-considerations)
31. [Animation Principles](#31-animation-principles)
32. [Empty States Strategy](#32-empty-states-strategy)
33. [Incremental Implementation Phases](#33-incremental-implementation-phases)
34. [Engine Purity Contract](#34-engine-purity-contract)
35. [Growth Plan](#35-growth-plan)
36. [Performance Budgets](#36-performance-budgets)
37. [Success Metrics & Product Instrumentation](#37-success-metrics--product-instrumentation)
38. ["Workspace" Mindset — Design Decisions](#38-workspace-mindset--design-decisions)
39. [Scope Protection](#39-scope-protection)
40. [Final Approval Conditions](#40-final-approval-conditions)

---

## 0. Phase 0 — Workflow Analysis

Before writing any code, document the current teacher workflow. Measure every click a teacher needs to perform common tasks. The redesign's success is measured by how many clicks are eliminated.

### 0.1 Current Click Measurements

| Task | Current Clicks | Route | Pain Point |
|---|---|---|---|
| **Identify a struggling project** | 5+ | Dashboard → scan card → click project → scroll milestones → scroll tasks → check members | No health indicator on project cards |
| **Find overdue tasks across projects** | 5+ per project | Dashboard → project card → click → Tasks tab | No cross-project task view |
| **Prepare for a review** | 7+ | Dashboard → project card → click → Reviews tab → read type/date → switch to Milestones → check completion → switch to Tasks → check status | Review info, milestones, and tasks are on separate tabs |
| **Identify inactive students** | Not possible | No cross-project student activity view | No visibility into student-level engagement |
| **Resend a bounced invitation** | 7+ | Dashboard → sidebar → Projects → click project → scroll to Members tab → scroll to Pending Invitations → click Resend | Bounces hidden inside project detail |
| **Open project files** | 4 | Dashboard → click project → Files tab | Files are 2 clicks deep |
| **Find pending reviews** | 4 | Dashboard → sidebar → Analytics → scan Reviews Due stat → click project → Reviews tab | Reviews stat is not clickable |
| **See what changed today** | 0 | Not possible | No activity feed exists |
| **Check project completion** | 4 | Dashboard → scan completion chart → find project in chart → open project to verify | Chart is decorative — clicking it does nothing |

### 0.2 Navigation Reduction Targets

| Task | Current Clicks | Target | Mechanism |
|---|---|---|---|
| Identify struggling project | 5+ | 1 | Health badge on project card |
| Find overdue tasks | 5+ per project | 0 | Needs Attention panel |
| Prepare for a review | 7+ | 1 | Review readiness card |
| Identify inactive students | Not possible | 0 | Students Needing Attention section |
| Resend bounced invitation | 7+ | 0 | Immediate Action card |
| Open project files | 4 | 2 | Acceptable — files are project-scoped |
| Find pending reviews | 4 | 0 | Daily Brief + Upcoming Reviews |
| See what changed today | 0 | 0 | Daily Brief, auto-generated |
| Check project completion | 4 | 0 | Health + completion on project card |

---

## 1. Problems with the Current Dashboard

1. **Passive, not operational.** Four stats and two charts don't tell the teacher what to do today.
2. **No prioritization.** Everything is equally weighted. No urgency signal.
3. **Activity is invisible.** No idea what changed since last visit.
4. **Reviews are hidden.** "Reviews Due: 3" is a non-clickable number.
5. **No health signals.** A project with 10 overdue tasks looks identical to a well-running one.
6. **Charts dominate the fold.** Drive no action.
7. **Project cards are thin.** No task counts, no last activity, no risk.
8. **No search** for projects, students, or tasks.
9. **Empty states don't guide.** "No projects yet" with no next step.
10. **7+ clicks to prepare for a review.** Information is scattered across tabs.

---

## 2. Dashboard vs Adjacent Systems

### 2.1 Dashboard vs Analytics

| Domain | Dashboard | Analytics |
|---|---|---|
| Purpose | Operational awareness, immediate action | Trend analysis, historical comparison |
| Content | Action cards, brief, attention items, health | Charts, completion rates, distributions |
| Time horizon | Now, today, since last visit | Week, month, semester |
| Behaviour | Drives decisions, suggests next steps | Informs understanding, identifies patterns |
| Charts | None | All |

### 2.2 Dashboard vs Notifications

| Dimension | Notifications | Dashboard |
|---|---|---|
| Granularity | Individual events | Summarized meaning |
| Example | "Rahul uploaded ER diagram" | "Project Alpha had 5 uploads since your last visit" |
| Persistence | Until read, then dismissed | Persistent until resolved |
| Trigger | Event-driven | Visit-driven |
| Action | Click to navigate | Click to resolve |
| Owner | NotificationService | Dashboard engines |

**Boundary rule:** Notifications fire on individual events. The Dashboard summarizes those events into actionable insights. They complement each other but never duplicate content.

### 2.3 Dashboard vs Project Detail

| Dimension | Dashboard | Project Detail |
|---|---|---|
| Scope | All projects | Single project |
| Depth | Summary, health, metrics | Full data: tasks, files, reviews, members |
| Action | Identify problems, navigate | Resolve problems, edit, manage |
| Time spent | 30 seconds – 2 minutes | 5–20 minutes |

The dashboard surfaces *that* a problem exists. The project detail page is where the teacher resolves it.

---

## 3. Design Principles

| # | Principle | Why |
|---|---|---|
| 1 | **This is a workspace, not a dashboard.** | Teachers should complete work here, not just start navigation. Prefer inline actions over forcing navigation whenever reasonable. |
| 2 | **Scale gracefully from 2 to 50+ projects.** | A teacher with 50 projects needs a different workspace than one with 2. |
| 3 | **Every section answers exactly one question.** | If it answers multiple, split it. If none, remove it. |
| 4 | **0 clicks is always better than 1.** | Surface problems directly. Don't bury them in tabs. |
| 5 | **Actionable over informative.** | "Review Project Alpha" > "3 reviews due." |
| 6 | **"Since your last visit" is the default time horizon.** | Personalization beats generic time windows. |
| 7 | **Health is diagnostic with reasons, not just a color.** | "2 overdue milestones, no activity 6d" > "Warning." |
| 8 | **Health and trend are separate concepts.** | Current state + direction = full picture. |
| 9 | **Every recommendation explains itself.** | Trust is built by transparency, not authority. |
| 10 | **Inbox zero is achievable.** | Immediate Actions should feel finishable each day. |
| 11 | **Engines are pure — no UI, framework, routing, or DB writes.** | Every engine accepts data, produces deterministic output. Testable independently. Reusable across roles. |
| 12 | **Presentation layers are thin.** | No business logic in React components. Render, animate, format — nothing else. |
| 13 | **Every business rule exists in exactly one place.** | Health calculation, attention scoring, readiness logic — defined once in the engine layer. Never duplicated. |
| 14 | **Shared architecture, role-specific presentation.** | Teacher and Student workspaces share engines. |
| 15 | **Future personalization is designed but not implemented.** | Architecture allows hiding/reordering sections. |
| 16 | **Charts don't belong on the workspace.** | Move to Analytics. |
| 17 | **One search, not two.** | Extend command palette instead of building separate search. |
| 18 | **Empty states must give next steps.** | "No reviews" should offer to schedule one. |
| 19 | **Every section follows the same structure.** | Title → purpose → primary info → primary action → empty state → loading state → error state. Consistency reduces cognitive load. |
| 20 | **Protect simplicity.** | Before adding anything new: what question does it answer? What decision does it enable? Could it live inside the project page instead? |

---

## 4. Scaling Strategy

### 4.1 Scale Tiers

| Project Count | Behaviour | Project Cards Shown |
|---|---|---|
| **1–5** | Show all projects. No truncation needed. | Up to 5 |
| **6–15** | Pinned projects always visible. Then projects needing attention. Then recently active. | Up to 12 |
| **16+** | Pinned + Critical (health: WARNING or CRITICAL) + Recently active (last 7d). "View all N projects" link at bottom. | Up to 9 |

### 4.2 What Changes at Each Tier

| Section | 1–5 | 6–15 | 16+ |
|---|---|---|---|
| My Projects | Full grid | Pinned first, then attention | Critical + pinned only |
| Immediate Actions | All items | All items (max 3 visible) | Top 3 by score |
| Needs Attention | All items | Top 7 + "View all" | Top 5 + "View all" |
| Recent Changes | All projects | Pinned + active | Critical + pinned |
| Daily Brief | Summary + all items | Summary + top items | Summary + most critical |
| All other sections | Full content | Full content | Full content (no truncation) |

### 4.3 "View All Projects" Link

When projects exceed the tier limit, a link at the bottom of the project section navigates to `/teacher/projects` with the teacher's pinned projects pre-filtered. This ensures the full list is always one click away.

---

## 5. Shared Dashboard Architecture

### 5.1 Engine Layer (Shared)

These modules are framework-agnostic. They compute data and return typed results. Both Teacher and Student dashboards consume them.

| Engine | Input | Output | Used By |
|---|---|---|---|
| `HealthEngine` | Project data (tasks, milestones, activity) | `{ level, oneLiner, score, trend, reasons }` | Teacher, Student (student sees own role health) |
| `AttentionEngine` | All projects' health + reviews + invites | `ScoredAttentionItem[]` | Teacher |
| `RecommendationEngine` | Attention items + project activity + reviews | `Recommendation[]` | Teacher |
| `ChangeAggregator` | Raw events (tasks, files, comments, milestones) | `ProjectChangeGroup[]` | Teacher, Student |
| `BriefGenerator` | Attention + changes + recommendations | `DailyBrief` | Teacher, Student |
| `ReviewReadinessEngine` | Milestones + files for a project | `{ score, checklist, breakdown }` | Teacher |
| `ActivitySummarizer` | Raw events per time window | `{ tasks, files, comments, milestones }` counts | Teacher, Student |

### 5.2 Presentation Layer (Role-Specific)

| Component | Teacher | Student |
|---|---|---|
| Header | TeacherHeader | StudentHeader |
| Daily Brief | TeacherBrief | StudentBrief (simplified) |
| Immediate Actions | TeacherActions | StudentActions (tasks due, feedback) |
| Needs Attention | TeacherAttention | StudentAttention (blocked work, feedback) |
| Recent Changes | TeacherChanges | StudentChanges |
| Projects | TeacherProjectList | StudentProjectList |

### 5.3 File Structure

```
src/lib/delivery/
├── engines/
│   ├── HealthEngine.ts          (shared)
│   ├── AttentionEngine.ts       (shared logic, teacher-specific config)
│   ├── RecommendationEngine.ts  (teacher)
│   ├── ChangeAggregator.ts      (shared)
│   ├── BriefGenerator.ts        (shared)
│   ├── ReviewReadinessEngine.ts (teacher)
│   └── ActivitySummarizer.ts    (shared)
├── types.ts                     (shared types)
├── scoring.ts                   (attention scoring constants)
└── refresh.ts                   (refresh interval constants)
```

**Why this matters:** Without a shared engine layer, two separate dashboard implementations would diverge. The engines enforce consistent logic. The presentation layer only handles rendering and interactivity.

---

## 6. Information Hierarchy

The dashboard is organized by urgency. Above the fold = immediate decisions. Below the fold = awareness and exploration.

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  Good morning, Professor [Name]                              │
│  Jul 5, 2026 · Since your last visit · 3 items need you     │
│                                                              │
│  (One line. Zero stats. Single urgency signal.)              │
├─────────────────────────────────────────────────────────────┤
│  DAILY BRIEF                                                  │
│  Auto-generated summary since the teacher's last visit.      │
│                                                              │
│  Since you last visited                                       │
│  8 tasks completed · 2 milestones finished                   │
│  5 files uploaded · 1 review completed                       │
│                                                              │
│  Recently Completed                                           │
│  ✅ Review for Project Alpha was completed                   │
│  ✅ Showcase for Project Beta was approved                   │
│                                                              │
│  Needs attention (2)                                          │
│  → Alpha: Milestone overdue by 3 days                        │
│  → Beta: No activity in 7 days                               │
│                                                              │
│  Recommendations (3)                                          │
│  → Review Alpha's milestones (overdue + review tomorrow)     │
│  → Follow up with Beta (no activity 7d)                      │
│  → Approve 2 pending edit requests                           │
├─────────────────────────────────────────────────────────────┤
│  IMMEDIATE ACTIONS (Inbox Zero)                               │
│  Concrete cards. Each card resolves one issue.               │
│  Clearable. Finishable.                                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🔴 Review Project Alpha — Midterm review today      │    │
│  │    Reason: Milestone overdue, testing incomplete      │    │
│  │                                   [Open Review]  [✕]  │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🟡 Milestone "DB Design" is 3 days overdue           │    │
│  │    Project: Alpha · Due: Jul 2                        │    │
│  │                                   [Open Milestone] [✕] │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ❌ Invitation bounced — rahul@tcetmumbai.in          │    │
│  │    Project: Alpha · Bounced 2h ago                    │    │
│  │                                   [Fix Email]    [✕]  │    │
│  └──────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  NEEDS ATTENTION (if >3 items)                               │
│  Scored. Prioritized. Truncated with "View all N items."    │
├─────────────────────────────────────────────────────────────┤
│  RECENT CHANGES [Grouped | Chronological]                    │
│  ┌─ Project Alpha ──────────────────────────────────────┐   │
│  │  Since your last visit                                 │   │
│  │  ✅ 3 tasks completed    📎 2 files uploaded           │   │
│  │  💬 1 comment added      🏁 Milestone "SRS" done      │   │
│  │  [Open Project]                                        │   │
│  └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  MY PROJECTS (scaled: pinned first, then by attention)       │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ Alpha            │  │ Beta             │                  │
│  │ 🟢 Excellent     │  │ 🟡 Warning        │                  │
│  │ 🡹 Improving      │  │ 🡺 Stable         │                  │
│  │ 72% · 4/6 tasks  │  │ 45% · 2 overdue   │                  │
│  │ [📌] [Open]      │  │ Milestones        │                  │
│  │                  │  │ [📌] [Open]       │                  │
│  └──────────────────┘  └──────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  UPCOMING REVIEWS (with readiness score)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Project Alpha — Midterm Review · Jul 8 (3 days)      │   │
│  │ Readiness: 72%         4 students                     │   │
│  │ ✅ Milestones: 2/3    ✅ Documentation: submitted     │   │
│  │ ❌ Testing report missing                             │   │
│  │ [Open Review] [Reschedule]                             │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  STUDENTS NEEDING ATTENTION                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Rahul Sharma — Project Alpha                         │   │
│  │ Inactive 8 days · 3 overdue tasks                    │   │
│  │ [Open Project] [View Tasks]                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Section Question Map

Every section on the dashboard must answer exactly one question.

| Section | Question Answered | Why Dashboard | Expected Teacher Action |
|---|---|---|---|
| **Header** | "What is my current context?" | Personal greeting + urgency signal | Scan "N items need you" → know their day |
| **Daily Brief** | "What happened since my last visit?" | Compresses 5+ minutes of checking into 10 seconds | Read summary → note attention items → note recommendations |
| **Recently Completed** | "What was finished recently?" | Provides closure, reinforces progress | Scan completed items → feel productive |
| **Immediate Actions** | "What requires my attention right now?" | Surfaces concrete problems with CTAs | Click a card → resolve an issue |
| **Needs Attention** | "What else is becoming a problem?" | Prioritized list of non-urgent but important items | Scan → plan next actions |
| **Recent Changes** | "What changed across all projects?" | Awareness without opening each project | See which projects had activity → click interesting ones |
| **My Projects** | "Which projects are healthy and which are at risk?" | At-a-glance health + completion + trend | Identify declining projects → open to investigate |
| **Upcoming Reviews** | "Which reviews are coming and are students ready?" | Prevents surprise unprepared reviews | Check readiness → reschedule if needed |
| **Students Needing Attention** | "Which students need intervention?" | Surfaces invisible student disengagement | Open project → follow up |

---

## 8. Feature Phase Classification

### 8.1 Phase 1 (Ship Now)

| Feature | Priority |
|---|---|
| Header with greeting + urgency signal | Critical |
| Daily Brief with "since your last visit" | Critical |
| Immediate Actions (scored, inbox-zero clearable) | Critical |
| Needs Attention (scored, prioritized) | Critical |
| Recent Changes (grouped by default, chronological toggle) | High |
| My Projects with health badge + completion | High |
| Upcoming Reviews with readiness score | High |
| Students Needing Attention | High |
| Empty states with next-step CTAs | High |
| Per-section skeletons | High |
| Scale tier logic (1-5 / 6-15 / 16+) | Medium |
| Pinned projects | Medium |
| Health + trend (shared engine) | Medium |
| Refresh strategy | Medium |
| Shared engine architecture | Critical |

### 8.2 Phase 2 (Next)

| Feature | Rationale |
|---|---|
| "Continue working" context | Requires tracking last-opened, last-edited — more complexity |
| Personalization (hide/collapse sections) | Needs teacher feedback first |
| Command palette search extension | Requires search endpoint |
| Review checklist persistence | Requires DB field for checklist items |
| Student dashboard reuse | After teacher dashboard stabilizes |

### 8.3 Future Enhancement (Validated)

| Feature | Depends On |
|---|---|
| Delivery risk prediction (ML) | Health history data, model training |
| Section reordering | Personalization framework |
| Bulk student messaging | Student messaging infrastructure |
| Dashboard widget API | Third-party/extensibility requirements |

### 8.4 Architectural Preparation (Design Only, No Implementation)

| Feature | Why Postponed |
|---|---|
| Personalization config storage | Would add `TeacherPreference` model prematurely |
| Student dashboard engines | Can be built from shared engines after teacher phase 1 |
| Notification streaming | Would require WebSocket infrastructure |
| Advanced trend analysis | Would require historical data collection |

---

## 9. Component Architecture

### 9.1 Component Tree

```
TeacherDashboardPage (server)
  └── TeacherDashboardClient (client — orchestrator)
        ├── TeacherDashboardHeader
        ├── DailyBrief
        │     ├── BriefStatGroup (Since your last visit)
        │     ├── RecentlyCompletedList
        │     ├── BriefAttentionItems
        │     └── BriefRecommendations (each with reason)
        ├── ImmediateActionsSection (Inbox Zero)
        │     ├── ActionCard × N (each with reason, dismissible)
        │     └── AllClearedState (when 0 items)
        ├── NeedsAttentionSection (conditional: >3 items)
        │     ├── NeedsAttentionItem × N (scored, truncated)
        │     └── "View all N items" link
        ├── RecentChangesSection
        │     ├── ViewToggle (Grouped | Chronological)
        │     └── ChangeGroup × N
        ├── MyProjectsSection (scaled by project count)
        │     ├── ProjectHealthCard × N
        │     │     ├── HealthBadge (+ trend indicator)
        │     │     ├── CompletionBar (animated)
        │     │     ├── TaskSummary (pending/completed)
        │     │     └── PinToggle + QuickLinks
        │     └── ScaleFooter ("View all N projects")
        ├── UpcomingReviewsSection
        │     ├── ReviewCard × N
        │     │     ├── ReviewReadinessScore (percentage + breakdown)
        │     │     └── Actions: Open, Reschedule
        │     └── EmptyReviewsState
        └── StudentsNeedingAttentionSection
              ├── StudentRow × N
              └── EmptyStudentsState
```

### 9.2 Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Server Action          │     │   Shared Engines         │
│   getTeacherDashboard   │────▶│   HealthEngine           │
│   . ts                   │     │   AttentionEngine        │
│                          │     │   ChangeAggregator       │
│   Parallel Prisma        │     │   BriefGenerator         │
│   queries + engine calls │     │   RecommendationEngine   │
└─────────────────────────┘     │   ReviewReadinessEngine  │
           │                    └─────────────────────────┘
           │                             ▲
           ▼                             │
┌─────────────────────────┐              │
│   useTeacherDashboard   │──────────────┘
│   Data (React Query)    │
│   staleTime: 30s        │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   TeacherDashboardClient │
│   (Suspense boundaries)  │
└─────────────────────────┘
```

### 9.3 Component Count (Phase 1)

| Layer | Components | Lines |
|---|---|---|
| Engine layer | 6 files | ~350 |
| Types + scoring + refresh | 3 files | ~100 |
| Presentation components | ~15 | ~650 |
| Skeleton components | 1 | ~80 |
| **Total Phase 1** | **~25 files** | **~1,180** |

---

## 10. Data Requirements & New Queries

### 10.1 Server Action: `getTeacherDashboardData`

```typescript
async function getTeacherDashboardData(
  teacherId: string,
  lastVisitedAt?: Date   // Optional — if null, defaults to 24h ago
): Promise<TeacherDashboardData>
```

### 10.2 Return Type Structure

```typescript
interface TeacherDashboardData {
  // Header
  header: {
    greeting: string;
    date: string;
    sinceLastVisit: string;         // "Since your last visit 4h ago" or "Today"
    urgentItemCount: number;        // Items in Immediate Actions
    activeProjectCount: number;
    totalStudentCount: number;
    scaleTier: "SMALL" | "MEDIUM" | "LARGE";
  };

  // Daily Brief
  dailyBrief: {
    sinceLastVisit: ChangeStats;    // { tasksCompleted, milestonesCompleted, filesUploaded, reviewsCompleted }
    recentlyCompleted: CompletedItem[];
    attentionItems: BriefAttentionItem[];    // max 3
    recommendations: Recommendation[];       // each with reason
  };

  // Immediate Actions (scored, up to 3)
  immediateActions: ActionCard[];

  // Needs Attention (all scored items not in immediate actions)
  needsAttention: ScoredAttentionItem[];

  // Recent Changes
  recentChanges: ProjectChangeGroup[];   // grouped
  chronologicalEvents: ActivityEvent[];  // raw, for chronological toggle

  // Projects (filtered by scale tier)
  projects: ProjectHealthCardData[];

  // Reviews
  upcomingReviews: ReviewCardData[];

  // Students
  studentsNeedingAttention: StudentAttentionData[];
}
```

### 10.3 Core Types

```typescript
interface ActionCard {
  id: string;
  type: AttentionType;
  score: number;
  title: string;                // "Review Project Alpha"
  description: string;          // "Midterm review scheduled today"
  reason: string;               // "Milestone overdue, testing incomplete"
  primaryAction: { label: string; href: string };
  dismissible: boolean;
}

interface ScoredAttentionItem {
  id: string;
  projectId: string;
  projectTitle: string;
  type: AttentionType;
  score: number;                 // 0-1000
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  reason: string;               // Why this is on the list
  actionLabel: string;
  actionHref: string;
}

type AttentionType =
  | "OVERDUE_MILESTONE" | "UPCOMING_REVIEW" | "BOUNCED_INVITE"
  | "BLOCKED_TASK" | "PENDING_EDIT" | "NO_ACTIVITY" | "OVERDUE_TASKS";

interface BriefAttentionItem {
  projectId: string;
  projectTitle: string;
  message: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface Recommendation {
  message: string;               // "Review Alpha's milestones"
  reason: string;                // "Milestone overdue, review scheduled tomorrow"
  actionHref: string;
}

interface CompletedItem {
  id: string;
  type: "REVIEW_COMPLETED" | "SHOWCASE_APPROVED" | "MILESTONE_COMPLETED" | "SPRINT_FINISHED";
  projectId: string;
  projectTitle: string;
  message: string;               // "Review for Project Alpha was completed"
  completedAt: Date;
}

interface ProjectChangeGroup {
  projectId: string;
  projectTitle: string;
  health: HealthLevel;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  sinceLastVisit: ChangeStats;
  since7d: ChangeStats;
}

interface ChangeStats {
  tasksCompleted: number;
  filesUploaded: number;
  commentsAdded: number;
  milestonesCompleted: number;
}

interface ProjectHealthCardData {
  id: string;
  title: string;
  health: { level: HealthLevel; oneLiner: string; score: number };
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  completionPercentage: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  daysRemaining: number;
  isPinned: boolean;
}

type HealthLevel = "EXCELLENT" | "HEALTHY" | "WARNING" | "CRITICAL";

interface ReviewCardData {
  id: string;
  projectId: string;
  projectTitle: string;
  reviewType: string;
  scheduledAt: Date;
  daysUntil: number;
  studentCount: number;
  readiness: {
    score: number;              // 0-100 percentage
    milestonesCompleted: number;
    totalMilestones: number;
    filesSubmitted: boolean;
    documentationSubmitted: boolean;
    warnings: string[];         // "Testing report missing"
  };
}

interface StudentAttentionData {
  studentId: string;
  studentName: string;
  email: string;
  projectId: string;
  projectTitle: string;
  reason: "INACTIVE_8D" | "OVERDUE_TASKS" | "BOUNCED_INVITE";
  detail: string;
  actionLinks: Array<{ label: string; href: string }>;
}
```

### 10.4 Database Queries

Parallel Prisma queries in Phase 1 (6 concurrent):

1. `project.findMany` — all projects with members, milestones, tasks, reviews, files, pendingAssignments
2. `pendingProjectAssignment.count` where bounced (last 7d)
3. `project.count` where hasPendingEdit
4. `task.groupBy` — completed tasks since lastVisit (across teacher's projects)
5. `projectFile.groupBy` — files uploaded since lastVisit
6. `milestone.groupBy` — milestones completed since lastVisit

The ChangeAggregator accepts the raw data and produces grouped + chronological `ProjectChangeGroup[]` server-side.

---

## 11. Attention Scoring Model

### 11.1 Scoring Factors

Every attention item receives a numeric score from 0–1000. Higher = more urgent.

| Factor | Base Score | Multiplier | Example |
|---|---|---|---|
| Review due today | 800 | ×1.5 if readiness < 50% | 1,200 |
| Review due tomorrow | 500 | ×1.3 if readiness < 50% | 650 |
| Review due in 3+ days | 200 | ×1.2 if readiness < 30% | 240 |
| Overdue milestone (each) | 300 | × project.milestoneCount/milestoneCount | 300–600 |
| Bounced invitation | 400 | — | 400 |
| Pending edit request | 200 | — | 200 |
| Blocked task (each) | 150 | — | 150–450 |
| Overdue task (each) | 100 | — | 100–500 |
| No activity 7+ days | 250 | × (days / 7) | 250–750 |
| Inactive student | 100 | × number of inactive students | 100–500 |

### 11.2 Score Tiers → Severity

| Score Range | Severity |
|---|---|
| 800+ | CRITICAL |
| 500–799 | HIGH |
| 200–499 | MEDIUM |
| 0–199 | LOW |

### 11.3 Display Rules

| Count | Behaviour |
|---|---|
| Top 3 by score | Render in **Immediate Actions** section |
| All scored items not in top 3 | Render in **Needs Attention**, sorted by score |
| 0 items | Header shows "Everything looks good." |

### 11.4 Scoring Implementation

```typescript
function scoreAttentionItem(
  type: AttentionType,
  context: {
    daysUntil?: number;
    readiness?: number;
    overdueCount?: number;
    daysInactive?: number;
    inactiveStudentCount?: number;
    totalMilestones?: number;
  }
): number {
  switch (type) {
    case "UPCOMING_REVIEW": {
      const base = context.daysUntil === 0 ? 800 : context.daysUntil === 1 ? 500 : 200;
      const readinessMultiplier = (context.readiness ?? 100) < 50 ? 1.5
        : (context.readiness ?? 100) < 30 ? 1.2 : 1;
      return Math.round(base * readinessMultiplier);
    }
    case "OVERDUE_MILESTONE": return 300 * (context.overdueCount ?? 1);
    case "NO_ACTIVITY": return Math.min(750, Math.round(250 * ((context.daysInactive ?? 7) / 7)));
    // ... others
  }
}
```

---

## 12. Health & Trend Model

### 12.1 Health (Current State)

Calculated by `HealthEngine`. Score 0–100, derived from milestone completion, task status, activity recency, and task assignment.

| Level | Score | Indicator Colour |
|---|---|---|
| EXCELLENT | 80–100 | Emerald |
| HEALTHY | 60–79 | Indigo |
| WARNING | 40–59 | Amber |
| CRITICAL | 0–39 | Rose |

Every health level comes with `oneLiner`: a single sentence explaining the primary reason. Example: "2 overdue milestones, no activity 6d."

### 12.2 Trend (Direction)

Calculated by comparing current health against health from 7 days ago.

| Trend | Condition | Indicator |
|---|---|---|
| IMPROVING | Current score > previous score (≥5 points) | 🡹 Green arrow |
| DECLINING | Current score < previous score (≥5 points) | 🡻 Red arrow |
| STABLE | Difference < 5 points | 🡺 Grey arrow |

Trend is computed server-side by snapshotting health. The initial implementation computes a fresh snapshot each dashboard load by comparing the current health to a query of 7-day-old data. A proper snapshot table (`ProjectHealthSnapshot { projectId, score, timestamp }`) is a Phase 2 addition.

### 12.3 Combined Display

```
Alpha
🟢 Excellent  🡺 Stable
72% · 4/6 tasks

Beta
🟡 Warning    🡻 Declining
45% · 2 overdue milestones
```

---

## 13. Review Readiness Model

### 13.1 Scoring

Calculated by `ReviewReadinessEngine`. Score 0–100%.

| Factor | Weight | Measurement |
|---|---|---|
| Milestone completion | 40% | completedMilestones / totalMilestones |
| Documentation submitted | 25% | Boolean: project has PDF/doc files |
| Files uploaded (any) | 20% | Boolean: any recent uploads |
| Tasks completion | 15% | DONE tasks / total tasks (for assigned review tasks) |

```typescript
function scoreReviewReadiness(project: any): ReviewReadiness {
  const milestoneScore = project.milestones.length > 0
    ? (project.milestones.filter((m: any) => m.isCompleted).length / project.milestones.length) * 40
    : 0;

  const hasDocs = project.files.some((f: any) =>
    f.fileType?.toLowerCase().includes("pdf") || f.fileType?.toLowerCase().includes("doc")
  );
  const docScore = hasDocs ? 25 : 0;

  const hasFiles = project.files.length > 0;
  const fileScore = hasFiles ? 20 : 0;

  // ... task score

  const total = milestoneScore + docScore + fileScore + taskScore;

  return {
    score: Math.round(total),
    milestonesCompleted: project.milestones.filter((m: any) => m.isCompleted).length,
    totalMilestones: project.milestones.length,
    filesSubmitted: hasFiles,
    documentationSubmitted: hasDocs,
    warnings: generateWarnings(project),
  };
}
```

### 13.2 Display

```
Project Alpha — Midterm Review
Readiness: 72%
✅ Milestones: 2/3
✅ Documentation submitted
❌ Testing report missing
❌ Database document missing
```

Readiness score is colour-coded: ≥70% emerald, 40–69% amber, <40% rose.

---

## 14. "Since Your Last Visit" Concept

### 14.1 Core Architecture

The `lastVisitedAt` timestamp is promoted from optional to core. Every section that displays temporal data uses it as the default time horizon.

```typescript
// Updated when teacher loads the dashboard
await prisma.user.update({
  where: { id: teacherId },
  data: { lastVisitedAt: new Date() },
});
```

This update happens **after** the dashboard data is fetched (in the background), so the brief always covers the period *up to* the current visit.

### 14.2 Default Fallback

If `lastVisitedAt` is null (first visit), the brief defaults to "last 24 hours" and displays a welcome message.

```typescript
const since = lastVisitedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
```

### 14.3 Where It's Used

| Section | Use |
|---|---|
| Daily Brief | "Since your last visit: 8 tasks completed..." |
| Recent Changes | Stats delta from `lastVisitedAt` to now |
| Immediate Actions | Items created/updated since `lastVisitedAt` |
| Needs Attention | Same scope as Immediate Actions |

### 14.4 Phase

**Phase 1 — Core.** This is not optional. The field is added to `User` and updated on every dashboard load.

---

## 15. Pinned Projects Strategy

### 15.1 Behaviour

| Current Pins | Display |
|---|---|
| 0 pinned | Automatically determine: projects needing attention first, then recently active |
| 1–3 pinned | Pinned projects first, then auto-selected |
| 4+ pinned | Only pinned projects shown (teacher must unpin to see others) |

### 15.2 Toggle

Each project card has a pin icon toggle. Clicking pins/unpins. Pins persist in the database.

### 15.3 Storage

Pin state is stored on `ProjectMember` (reusing the existing relation):

```prisma
model ProjectMember {
  // ... existing fields (projectId, studentId, role, joinedAt)
  isPinned Boolean @default(false)
}
```

Teacher's pinned projects = `ProjectMember` where `project.teacherId = teacherId` AND `isPinned = true`. Query:

```typescript
const pinnedProjectIds = await prisma.projectMember.findMany({
  where: { project: { teacherId }, isPinned: true },
  select: { projectId: true },
}).then(r => r.map(p => p.projectId));
```

### 15.4 Phase

**Phase 1 — Core.** Pin storage and display are implemented. Auto-fallback is included.

---

## 16. "Continue Working" Concept

### 16.1 Design

When a teacher navigates away from the dashboard to a project detail page, the system remembers what they were doing. On return, a "Continue Working" section or card picks up where they left off.

### 16.2 Data Tracked

| Event | What's Stored |
|---|---|
| Last project opened | `{ projectId, timestamp }` |
| Last tab visited in project | `{ tab: "tasks" | "milestones" | ... }` |
| Last item edited | `{ type: "task", id: "..." }` |

### 16.3 Storage

A single `continueWorking` JSON field on `User`:

```prisma
model User {
  // ... existing
  continueWorking Json?  // { projectId, tab, itemType, itemId }
}
```

Updated whenever the teacher performs a tracked action. Cleared when they complete the task.

### 16.4 Display on Dashboard

```
Continue Working
→ Finish grading Sprint Review in Project Alpha
  Continue → [/teacher/projects/abc123?tab=reviews]
```

### 16.5 Phase

**Phase 2.** Requires tracking infrastructure (server action calls on project page load). Not in Phase 1.

---

## 17. Recommendation Engine

### 17.1 Architecture

`RecommendationEngine` takes the scored attention items and project activity data and produces actionable, explained recommendations.

### 17.2 Rules

| Condition | Recommendation | Reason |
|---|---|---|
| Milestone overdue + review scheduled within 3 days | "Review [project]'s milestones" | "Milestone overdue + review in [N] days" |
| No activity 7+ days | "Follow up with [project] team" | "No activity in [N] days" |
| Bounced invite exists | "Fix [student]'s email" | "Invitation bounced [N]h ago" |
| Pending edit request | "Approve [project]'s edit request" | "Edit request pending for [N] days" |
| Review completed | "Review [project]'s review feedback" | "Review completed [N]h ago" |
| Multiple inactive students in one project | "Check on [project]'s team" | "[N] students inactive for [N]+ days" |

### 17.3 Display

Every recommendation displays the reason underneath:

```
→ Review Alpha's milestones
  Reason: Milestone overdue by 3 days, review scheduled tomorrow
```

### 17.4 Phase

**Phase 1 — Core.** Built into the server action. No separate storage needed.

---

## 18. Recently Completed Concept

### 18.1 Purpose

Provides closure. Teachers see what was finished, reinforcing that their oversight is producing results.

### 18.2 Sourced Events

| Event | Source Table | Phase |
|---|---|---|
| Review completed | `Review` where `status = "COMPLETED"` AND `conductedAt > sinceLastVisit` | 1 |
| Milestone completed | `Milestone` where `isCompleted = true` AND `completedAt > sinceLastVisit` | 1 |
| Showcase approved | `ShowcaseProjectVersion` where `status = "APPROVED"` | 1 |
| Project submitted | `ShowcaseProject` where `status = "SUBMITTED"` | 2 |

### 18.3 Display

Placed inside the **Daily Brief** as a sub-section called "Recently Completed":

```
Since your last visit
8 tasks completed · 2 milestones finished · 5 files uploaded

Recently Completed
✅ Review for Project Alpha was completed (2h ago)
✅ Showcase for Project Beta was approved (5h ago)
✅ Milestone "SRS" for Project Gamma was completed (yesterday)
```

### 18.4 Phase

**Phase 1 — Core.** Queried as part of the main dashboard fetch.

---

## 19. "Inbox Zero" Philosophy

### 19.1 Design Goal

Immediate Actions should feel **finishable**. The teacher should be able to open the dashboard, resolve all action items, and experience a sense of completion.

### 19.2 Implementation

- Max 3 action cards shown (highest scored)
- Each card has a **dismiss** (✕) button and a **resolve** (primary CTA) button
- Dismiss removes the card for the session (or permanently, via `dismissedActionIds` on User)
- When all actions are cleared: `AllClearedState` component — "Everything looks good. No items need your attention right now."
- The count in the header updates to 0

### 19.3 Permanent Dismissal (Future)

In Phase 2, dismissed items can be persisted to a `dismissed_notifications` junction table. This prevents dismissed items from reappearing. In Phase 1, dismiss is session-only (refetched on next dashboard load).

### 19.4 Phase

**Phase 1 — Core.** Session dismiss. Permanent dismiss is Phase 2.

---

## 20. Refresh Strategy

### 20.1 Per-Section Refresh Intervals

| Section | Refresh | Mechanism | Rationale |
|---|---|---|---|
| Header | On data fetch | Static from dashboard data | Changes slowly |
| Daily Brief | On login | Generated once per session | Summary of one period |
| Recently Completed | 60s | React Query staleTime | New completions happen during session |
| Immediate Actions | 30s | React Query staleTime | Urgent items need near-real-time |
| Needs Attention | 30s | React Query staleTime | Same as Immediate Actions |
| Recent Changes | 60s | React Query staleTime | Activity happens every few minutes |
| My Projects | 60s | React Query staleTime | Health changes slowly |
| Upcoming Reviews | 60s | React Query staleTime | Reviews don't change rapidly |
| Students Needing Attention | 60s | React Query staleTime | Engagement changes slowly |
| Notifications (existing) | 30s | Polling (already implemented) | Already established |

### 20.2 Triggered Refresh

| Event | Sections Refreshed |
|---|---|
| Window refocus | All sections (React Query default) |
| Teacher creates a project | My Projects (via mutation invalidation) |
| Teacher schedules a review | Reviews (via mutation invalidation) |
| Teacher dismisses an action | Immediate Actions (local state) |

### 20.3 Stale Time Constants

```typescript
// src/lib/delivery/refresh.ts
export const REFRESH = {
  URGENT: 30_000,       // 30s: Immediate Actions, Needs Attention
  NORMAL: 60_000,       // 60s: Projects, Reviews, Students, Changes
  BRIEF: Infinity,      // Never auto-refresh: Daily Brief (manual refresh only)
  NOTIFICATIONS: 30_000, // 30s: Notification polling (existing)
} as const;
```

---

## 21. Future Personalization Architecture

### 21.1 Design (Not Implemented)

The dashboard architecture must support future personalization without restructuring the code.

### 21.2 What the Architecture Enables

| Future Feature | Enabling Architecture |
|---|---|
| **Hide sections** | Each section is a separate component wrapped in a conditional. A future `visibleSections` config can filter them server-side. |
| **Collapse sections** | Sections render with a collapse toggle. The collapsed/open state can be persisted. |
| **Reorder sections** | Sections are rendered from a configurable array rather than hardcoded order. Today they're hardcoded; a future `sectionOrder` config reorders them. |
| **Pin sections** | Reuses the same collapse/hide mechanism with a pin toggle. |

### 21.3 How to Keep It Open

```typescript
// Current implementation — hardcoded order
function TeacherDashboardClient({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-8">
      <TeacherDashboardHeader />
      <DailyBrief />
      <ImmediateActions />
      {...}
    </div>
  );
}

// Future implementation (not now) — configurable order
function TeacherDashboardClient({ data, config }: { data: TeacherDashboardData; config: SectionConfig[] }) {
  return (
    <div className="space-y-8">
      {config.map(section => renderSection(section, data))}
    </div>
  );
}
```

The render order is hardcoded today, but the component split allows it to become configurable later without refactoring individual sections.

### 21.4 Phase

**Architectural Preparation.** No code changes needed. The component architecture already supports this pattern.

---

## 22. Existing Reusable Components

| Component | File | Reuse |
|---|---|---|
| `Skeleton` | `ui/skeleton.tsx` | Direct reuse |
| `Badge` | `ui/badge.tsx` | Health, review status |
| `Avatar` + `AvatarFallback` | `ui/avatar.tsx` | Student rows, activity |
| `Button` | `ui/button.tsx` | All CTAs |
| `Card` | `ui/card.tsx` | Section containers |
| `useNotifications` | `hooks/useNotifications.ts` | Bell badge (unchanged) |
| `useUnreadCount` | `hooks/useNotifications.ts` | Existing, unchanged |
| `Command palette` (cmdk) | `layout/Topbar.tsx` | Extended with project/student search |

**Not reused:** `StatCard`, `ProjectCard`, `ProjectCompletionChart`, `TaskDistributionDonut`, `MilestoneGanttBar`, `ActivityFeed` (replaced by grouped changes).

---

## 23. New Components Required

| Component | Lines | Phase |
|---|---|---|
| `TeacherDashboardHeader` | 30 | 1 |
| `DailyBrief` | 50 | 1 |
| `BriefStatGroup` | 20 | 1 |
| `RecentlyCompletedList` | 30 | 1 |
| `BriefRecommendations` | 25 | 1 |
| `ImmediateActionsSection` | 35 | 1 |
| `ActionCard` | 45 | 1 |
| `AllClearedState` | 20 | 1 |
| `NeedsAttentionSection` | 40 | 1 |
| `NeedsAttentionItem` | 30 | 1 |
| `RecentChangesSection` | 55 | 1 |
| `ChangeGroup` | 50 | 1 |
| `ViewToggle` | 15 | 1 |
| `MyProjectsSection` | 45 | 1 |
| `ProjectHealthCard` | 65 | 1 |
| `HealthBadge` | 25 | 1 |
| `UpcomingReviewsSection` | 40 | 1 |
| `ReviewCard` | 65 | 1 |
| `StudentsNeedingAttentionSection` | 40 | 1 |
| `StudentRow` | 40 | 1 |
| `EmptySectionState` | 20 | 1 |
| `TeacherDashboardSkeleton` | 80 | 1 |

**Phase 1 total:** ~22 components, ~850 lines.

---

## 24. Existing Functionality Preserved

| Feature | Status |
|---|---|
| Authentication | ✅ `requireRole("TEACHER")` unchanged |
| Notifications | ✅ Bell + panel + page unchanged |
| Sidebar | ✅ All nav items unchanged |
| Command palette | ✅ Preserved, search endpoint added in Phase 2 |
| Permissions | ✅ Role guards unchanged |
| Routing | ✅ All existing routes unchanged |
| Project management | ✅ Create, edit, tasks, milestones, reviews, files — on their pages |
| `/teacher/projects` | ✅ Full list accessible from sidebar |
| `/teacher/analytics` | ✅ Now home for all charts |

---

## 25. Database Changes

### 25.1 Phase 1

| Change | Type | Reason |
|---|---|---|
| `User.lastVisitedAt` | `DateTime?` new field | Core — enables "since your last visit" |
| `ProjectMember.isPinned` | `Boolean @default(false)` new field | Core — enables pinned projects |

### 25.2 Phases 2+

| Change | Type | Reason |
|---|---|---|
| `User.dismissedActionIds` | `Json?` new field | Permanent action dismissal |
| `ProjectHealthSnapshot` | New model | Historical health data for trend computation |
| `User.continueWorking` | `Json?` new field | "Continue working" context |

---

## 26. State Management Strategy

| State | Location | Mechanism |
|---|---|---|
| Dashboard data | `useTeacherDashboardData` hook | React Query, staleTime per section |
| Action dismissals | `ImmediateActionsSection` | `useState` (session), persisted in Phase 2 |
| View toggle (grouped/chrono) | `RecentChangesSection` | `useState` |
| Pinned projects | `MyProjectsSection` | `useMutation` → server action |
| Project filter/sort | `MyProjectsSection` | `useState` |
| Notifications | `useNotifications` | Existing polling, unchanged |

---

## 27. Loading Strategy

### 27.1 Principles

- Every section has its own skeleton matching its layout
- Above the fold: Header + Daily Brief + Immediate Actions
- Below the fold: Everything else (Suspense boundaries)
- No full-page spinners

### 27.2 Skeleton Counts

| Section | Skeleton Pattern |
|---|---|
| Header | Single text bar (60% width) |
| Daily Brief | Two text blocks + 3 item lines + Recently Completed row |
| Immediate Actions | 3 card outlines |
| Needs Attention | 5 row outlines |
| Recent Changes | 2 card outlines per project group |
| My Projects | 3 card outlines (scaled by tier) |
| Reviews | 2 card outlines with checklist placeholders |
| Students | 3 row outlines |

---

## 28. Error Handling Strategy

| Type | UX |
|---|---|
| **Full fetch failed** | Centered error: icon + "Could not load dashboard" + Retry |
| **Section data partial** | `SectionErrorState` with inline retry. Other sections remain. |
| **Single item malformed** | Skip item, render rest. Console warning. |
| **Permission error** | Role guard redirects to `/teacher` |
| **Network offline** | React Query serves cached data |

---

## 29. Responsive Strategy

| Element | Desktop (≥1024) | Tablet (768–1023) | Mobile (<768) |
|---|---|---|---|
| Header | Full width, single line | Full width | Greeting only |
| Daily Brief | 3-column: stats, recents, recs | 2-column | Single column |
| Immediate Actions | 3 cards row | 2+1 wrap | Stacked |
| Recent Changes | 2 groups | 1 group | 1 group |
| Project cards | 3-column grid | 2-column grid | 1 column |
| Reviews | 2 cards | Stacked | Stacked, truncated |

---

## 30. Performance Considerations

| Concern | Solution |
|---|---|
| 6+ parallel DB queries | `Promise.all` — all run concurrently |
| Large project set (50+) | Scale tier limits project cards to 9 |
| `groupBy` instead of raw events | Lightweight counts, not event objects |
| Health computed server-side | Zero client computation |
| React Query staleTime | 30s urgent, 60s normal, Infinity for brief |
| Suspense boundaries | Independent section loading |
| No charts on dashboard | Avoids loading 200KB recharts bundle |

---

## 31. Animation Principles

| Element | Animation | Purpose |
|---|---|---|
| Action cards load | Staggered fade-up (60ms × index) | Draw eye to urgent items |
| Health badge change | Colour transition (300ms) | Signal status change |
| Completion bar | Width tween (800ms, ease-out) | Progress visibility |
| Counters | Spring-animated count-up | Engagement |

**Not animated:** Sidebar (existing), page entrance (existing), scroll reveals, decorative elements.

---

## 32. Empty States Strategy

| Section | Empty State | CTA |
|---|---|---|
| Daily Brief | "Welcome! Data will appear as students work on projects." | — |
| Recently Completed | "No completed items since your last visit." | — |
| Immediate Actions | "Everything looks good. No items need your attention." | — |
| Needs Attention | (Hidden when empty) | — |
| Recent Changes | "No activity since your last visit." | "View all projects" |
| My Projects | "Create your first project to get started." | "Create Project" |
| Reviews | "No reviews scheduled. Schedule one for an active project." | "View Projects" |
| Students | "All students are actively working." | — |

---

## 33. Incremental Implementation Phases

### Phase 1 — Core Workspace (Ship)

| Category | Items | Files |
|---|---|---|
| **Engine layer** | HealthEngine, AttentionEngine, ChangeAggregator, BriefGenerator, RecommendationEngine, ReviewReadinessEngine, ActivitySummarizer | 6 engine files |
| **Shared** | Types, scoring constants, refresh constants | 3 files |
| **DB migration** | `User.lastVisitedAt`, `ProjectMember.isPinned` | 1 migration |
| **Server action** | `getTeacherDashboardData()` | 1 file |
| **Hooks** | `useTeacherDashboardData` | 1 file |
| **Components** | All 22 presentation components | ~22 files |
| **Wire up** | Replace `TeacherDashboardClient` | 1 file modified |

**Phase 1 delivers the complete workspace:** daily brief, immediate actions, needs attention, recent changes, project health with trend, upcoming reviews with readiness scores, pinned projects, students needing attention, empty states, skeletons. Product instrumentation is included from day one.

### Phase 2 — Extended

| Feature | Rationale |
|---|---|
| "Continue working" context | Requires tracking infrastructure on project pages |
| Command palette search | Requires `/api/search` endpoint |
| Permanent action dismissal | Requires `dismissedActionIds` on User |
| Notification→Workspace coherence audit | Align notification copy with workspace sections |
| Student workspace reuse | Reuse shared engines for student role |

### Future

| Feature | Depends On |
|---|---|
| Personalization (hide/reorder) | Teacher feedback, usage data |
| Delivery risk prediction | Health history, model |
| Bulk student messaging | Messaging infrastructure |

---

## 34. Engine Purity Contract

Every engine in `src/lib/delivery/engines/` must adhere to the following contract.

### 34.1 Rules

| Rule | Rationale |
|---|---|
| **Accept data, produce output** | Engines never call the database. Data is passed in by the orchestrator. |
| **Deterministic** | Same input always produces the same output. No randomness, no side effects. |
| **Zero UI logic** | No colours, no class names, no component imports. Return data — let the presentation layer format it. |
| **Zero framework logic** | No `useEffect`, no `useQuery`, no React imports. Pure TypeScript. |
| **Zero routing logic** | Don't generate URLs. Return identifiers. Presentation layer builds links. |
| **Zero database writes** | The orchestrator calls engines, then writes. Engines never write. |
| **Single responsibility** | HealthEngine does not recommend actions. RecommendationEngine does not calculate health. |
| **Export a single function** | One public function per engine. Internal helpers are private. |

### 34.2 Why These Rules Exist

- Engines are **testable** without mocking Prisma, React, or Next.js
- Engines are **reusable** across Teacher, Student, and future workspaces
- Engines are **replaceable** — as business rules evolve, only one file changes
- Engines enforce **separation of concerns** at the architectural level, not just the team convention level

### 34.3 Enforcement

Code review must verify engine purity for every engine PR. No engine imports from `next/*`, `react/*`, `@prisma/*`, or `@/*/ui/*`. Only TypeScript standard library and project types are allowed.

---

## 35. Growth Plan

### 35.1 Expected Scale (12 Months)

| Dimension | Current Estimate | 12-Month Ceiling | Architectural Impact |
|---|---|---|---|
| Projects per teacher | 5–15 | 50+ | Scale tiers handle this. No architecture change. |
| Students per teacher | 25–100 | 500 | No impact — per-project queries scale linearly. |
| Tasks across all projects | 200–2,000 | 20,000 | `groupBy` queries remain efficient. |
| Activity events (daily) | 50–200 | 5,000 | Grouped by project keeps UI stable. Raw chronological view paginated at 50. |
| Dashboard data query time | ~200ms | ~800ms P95 | Still under budget. If exceeded, add `lastActivityAt` to Project denormalization. |

### 35.2 Expected Degradation Points

| Component | Failure Point | Mitigation |
|---|---|---|
| `task.groupBy` | 50,000+ tasks | Add `Project.lastActivityAt` denormalization. Query by date range instead of full table. |
| `project.findMany` with includes | 200+ projects | Paginate projects in the query (not in the UI). Scale tier already limits display to 9. |
| Activity feed query (4 × groupBy) | 100+ projects | Materialize recent activity in a `project_activity` summary table updated by triggers/mutations. |

### 35.3 Rule

**Do not prematurely optimize.** Build for current scale. If query times exceed 1,000ms P95 in production, implement the mitigations. The architecture supports these mitigations without redesign.

---

## 36. Performance Budgets

All targets are measured in production against a teacher with 15 projects and 100 students.

| Metric | Target | Measurement | Violation Action |
|---|---|---|---|
| Dashboard server response (P50) | <500ms | Server-side logging | Profile slow queries, add denormalization |
| Dashboard server response (P95) | <1,000ms | Server-side logging | Review parallel query structure |
| Time to first contentful render | <1,500ms | Lighthouse / Web Vitals | Reduce bundle size, review Suspense boundaries |
| Time to interactive | <2,500ms | Lighthouse / Web Vitals | Lazy-load below-fold components |
| Project card rendering | <16ms per card | React DevTools profiling | Virtualize if >20 cards rendered |
| Health calculation (all projects) | <50ms | Server-side logging | Already server-side — monitor |
| Bundle size increase (Phase 1) | <30KB gzipped | bundle-analyzer | Avoid adding large dependencies |
| DB queries per dashboard load | ≤8 | Prisma query logging | Merge queries if threshold exceeded |

**Note:** These budgets apply to the Teacher Workspace only. The workspace avoids heavy charting libraries (recharts stays on Analytics).

---

## 37. Success Metrics & Product Instrumentation

### 37.1 Product Metrics

Collected pre- and post-rollout to measure improvement.

| Metric | Baseline | Target | Data Source |
|---|---|---|---|
| Average dashboard visits per teacher per week | Current | +30% | `dashboard_opened` event |
| Average session duration | Current | +20% | Session tracking |
| Immediate actions completed per session | 0 (new) | >2 avg | `immediate_action_completed` event |
| Recommendation click-through rate | 0 (new) | >40% | `recommendation_clicked` event |
| Pinned project usage (% of teachers) | 0 (new) | >50% | `project_pinned` event |
| Projects opened from workspace vs sidebar | 0 (new) | >60% via workspace | `project_opened` event with referrer |
| Review preparation time (from workspace) | 0 (new) | <30s | `review_started` event timing |
| Teacher daily return rate | Current | +15% | Session frequency |
| Clicks to identify struggling project | 5+ (current) | ≤1 | User testing, instrumented |
| Clicks to resend bounced invite | 7+ (current) | ≤1 | `project_opened` + invite flow |

### 37.2 Product Instrumentation Events

Logged from the frontend to the server. No third-party analytics dependency.

```
workspace_opened                 # Teacher loads the workspace
workspace_brief_viewed           # Daily Brief section visible
workspace_action_completed       # Immediate Action card resolved (type: attention type)
workspace_action_dismissed       # Immediate Action card dismissed
workspace_recommendation_clicked # Recommendation link clicked
workspace_recommendation_dismissed
workspace_project_opened         # Clicked a project card (origin: pinned|attention|changes|projects)
workspace_project_pinned         # Toggled pin on a project card
workspace_review_started         # Clicked Open Review on a review card
workspace_review_rescheduled     # Clicked Reschedule on a review card
workspace_student_followup       # Clicked a student attention row action
workspace_changes_view_switched  # Toggled grouped/chronological view
workspace_section_interacted     # Generic: section name + action
```

### 37.3 Implementation

Events are logged via a lightweight `POST /api/events` endpoint or batched server action:

```typescript
// src/lib/delivery/instrumentation.ts
export function logWorkspaceEvent(event: string, metadata?: Record<string, unknown>) {
  // Fire-and-forget. Never block the UI.
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, metadata, timestamp: new Date().toISOString() }),
    keepalive: true,  // Survives page navigation
  }).catch(() => {}); // Silent fail
}
```

No events are fired for vanity metrics. Every event maps to a product metric that drives a decision.

### 37.4 Phase

**Phase 1 — Core.** Events fire from day one so pre-rollout baselines can be established against the current dashboard.

---

## 38. "Workspace" Mindset — Design Decisions

### 38.1 When to Complete Work Inline

| Action | Preference | Rationale |
|---|---|---|
| Dismiss an action card | ✅ Inline (click ✕) | 1 click, no navigation |
| Silence a notification | ✅ Inline (click ✓) | Already supported |
| Approve a pending edit request | ⚠️ Navigate to admin | Requires admin role — out of teacher scope |
| Quick review feedback | ❌ Navigate to project | Review requires full context |
| View student profile | ⚠️ Navigate to project | Student info is project-scoped |
| See summary details | ✅ Inline | Tooltips, hover cards, expandable |

### 38.2 Rule

If an action can be completed in ≤2 clicks with no context loss, prefer inline. If it requires the project detail page's full context, navigate. The workspace should **reduce** navigation, not eliminate it.

### 38.3 What This Means for Phase 1

Most actions still navigate to project pages. The workspace surfaces *what* to do. The project page is *where* to do it. As the workspace matures, more inline actions can be added.

---

## 39. Scope Protection

| In Scope (Phase 1) | Out of Scope |
|---|---|
| Teacher Workspace redesign | Student Dashboard redesign |
| Shared engine layer architecture | Project detail page redesign |
| Product instrumentation | Review page redesign |
| Performance monitoring | Task management redesign |
| "Last visited" tracking | Analytics page redesign |
| Pinned projects | Sidebar redesign |
| | Notification system redesign |
| | Any page outside `/(dashboard)/teacher/` |

**Future improvements must be driven by real user behaviour and collected product metrics — not additional speculative planning.**

---

## 40. Final Approval Conditions

The planning phase is considered complete when all of the following are true:

1. ✅ Workspace mindset is adopted as the architectural philosophy (Section 38)
2. ✅ Engines are pure — no UI, no framework, no DB writes (Section 34)
3. ✅ Presentation layers contain no business logic (Section 3, Principle 12)
4. ✅ Business rules exist in exactly one place (Section 3, Principle 13)
5. ✅ Scale is planned to 50+ projects / 500+ students without redesign (Section 35)
6. ✅ Performance budgets are defined and measurable (Section 36)
7. ✅ Success metrics are defined with baselines and targets (Section 37)
8. ✅ Product instrumentation is included in Phase 1 (Section 37)
9. ✅ Scope is explicitly bounded (Section 39)
10. ✅ Recommendations are always explainable (Section 17)
11. ✅ Health and trend are separate concepts (Section 12)
12. ✅ Current state, historical state, and predicted state are kept separate (Section 10 types)
13. ✅ Shared engines are designed for reuse across Teacher/Student/Future (Section 5)
14. ✅ No new npm dependencies (Section 30)
15. ✅ Implementation proceeds incrementally per documented phases (Section 33)

**These conditions are met. The planning phase is complete.**

From this point forward:

- No further planning iterations
- Implementation proceeds incrementally according to the documented phases
- Future improvements are driven by real user behaviour and collected product metrics
- The scope is protected — only the Teacher Workspace is built

---

## Summary

| Metric | Value |
|---|---|
| Phase 1 components | ~22 |
| Phase 1 engine files | 6 |
| Phase 1 new code | ~1,180 lines |
| DB changes (Phase 1) | 2 fields added |
| New dependencies | 0 |
| Navigation pain points addressed | 9/9 |
| Sections removed from current dashboard | All (replaced) |
| Rollback complexity | Low — single file swap |

---

## Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-07-05 | v1 | Initial plan (22 components, widget-oriented) |
| 2026-07-05 | v2 | Revised (17 components, chart-free, action-oriented, Phase 0, truth table) |
| 2026-07-05 | **v3** | **Final (shared engine architecture, scoring, health+trend, last-visit core, pinned, inbox zero, refresh strategy, scale tiers, phase classification)** |
| 2026-07-05 | **v4** | **Final approval (workspace mindset, engine purity contract, growth plan, performance budgets, success metrics, product instrumentation, scope protection, 15 approval conditions)** |
