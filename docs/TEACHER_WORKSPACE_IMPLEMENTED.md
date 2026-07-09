# Teacher Workspace — Implementation Summary

> Implementation date: 2026-07-05
> Spec reference: `TEACHER_DASHBOARD_REDESIGN_PLAN.md` (v4 — Final Approval)

---

## Engine Layer — `src/lib/delivery/engines/`

Pure TypeScript engines. Zero framework dependencies (no React, Prisma, Next.js). Deterministic: same input → same output.

| File | Exports | Responsibility |
|---|---|---|
| `HealthEngine.ts` | `computeHealth(project, previousScore?)` | Health score 0–100, level (EXCELLENT/HEALTHY/WARNING/CRITICAL), trend (IMPROVING/STABLE/DECLINING), oneLiner, reasons |
| `AttentionEngine.ts` | `computeAttentionItems(projects, since)` | 7 attention types scored 0–1000: UPCOMING_REVIEW, OVERDUE_MILESTONE, BOUNCED_INVITE, PENDING_EDIT, BLOCKED_TASK, OVERDUE_TASKS, NO_ACTIVITY |
| `RecommendationEngine.ts` | `generateRecommendations(items, projects)` | 6 priority-ordered rules with explainable reasons. One recommendation per project (highest priority wins) |
| `ChangeAggregator.ts` | `aggregateChanges(projects, since)` | Grouped (per-project ChangeStats) + chronological (event timeline, capped 50) |
| `BriefGenerator.ts` | `generateBrief(stats, completed, attention, recs)` | Assembles Daily Brief from engine outputs |
| `ReviewReadinessEngine.ts` | `computeReviewReadiness(project)` | 0–100% readiness: milestones (40%) + docs (25%) + files (20%) + tasks (15%) + warnings |
| `ActivitySummarizer.ts` | `summarizeActivity(projects, since)` | Aggregated ChangeStats across all projects |

---

## Shared Layer — `src/lib/delivery/`

| File | Contents |
|---|---|
| `types.ts` | All shared TypeScript interfaces — `TeacherDashboardData`, `HealthResult`, `ScoredAttentionItem`, `ActionCard`, `ProjectHealthCardData`, `ReviewCardData`, `StudentAttentionData`, `RawProjectData`, etc. |
| `WorkspacePolicy.ts` | Single source of truth for business constants: health thresholds, attention base scores, severity tiers, review readiness weights, stale-time constants, scale limits, inactivity thresholds |
| `scoring.ts` | `scoreAttentionItem(type, context)` — scoring function + `scoreToSeverity(score)` mapper |
| `refresh.ts` | React Query stale time constants (URGENT: 30s, NORMAL: 60s, BRIEF: Infinity) |
| `instrumentation.ts` | `logWorkspaceEvent(event, metadata?)` — fire-and-forget product event logger |

---

## Data Layer

### Server Actions — `src/server/actions/`

| File | Functions | Purpose |
|---|---|---|
| `teacher-dashboard.ts` | `getTeacherDashboardData()` | Main orchestrator — 3 parallel Prisma queries, 6 engine calls, builds complete `TeacherDashboardData` |
| | `getTeacherDashboardUrgentData()` | Returns only immediate actions + needs attention (30s refresh) |
| | `getTeacherDashboardProjectsData()` | Returns only project health cards (60s refresh) |
| | `getTeacherDashboardReviewsData()` | Returns only upcoming reviews with readiness (60s refresh) |
| `teacher-dashboard-actions.ts` | `togglePinProject(projectId)` | Toggles `Project.isPinned` for teacher |
| | `dismissAction(actionId)` | Session-only dismiss (Phase 2: persistent) |
| | `recordLastVisited()` | Updates `User.lastVisitedAt` to now |

### React Query Hooks — `src/hooks/`

| File | Hooks | Stale Time |
|---|---|---|
| `useTeacherDashboardData.ts` | `useTeacherDashboardData()` | 30s |
| | `useTeacherDashboardBrief()` | Infinity |
| | `useTeacherDashboardUrgent()` | 30s |
| | `useTeacherDashboardProjects()` | 60s |
| | `useTeacherDashboardReviews()` | 60s |
| | `useTogglePinProject()` | Mutation — invalidates dashboard |
| | `useDismissAction()` | Mutation — invalidates urgent |
| | `useRecordLastVisited()` | Background write |

### API Route

| Route | Purpose |
|---|---|
| `POST /api/events` | Fire-and-forget product event logging |

---

## Presentation Layer — `src/components/teacher/workspace/`

24 client components organized by section. Every section has: title → content → loading skeleton → empty state.

### Infrastructure (6)

| Component | Purpose |
|---|---|
| `TeacherDashboardSkeleton` | Full-page skeleton with per-section placeholders |
| `TeacherDashboardHeader` | Greeting + date + urgency badge + quick stats |
| `EmptySectionState` | Reusable empty state with icon, message, optional CTA |
| `AllClearedState` | "Everything looks good" — shown when all actions dismissed |
| `HealthBadge` | Colored health level (emerald/indigo/amber/rose) + trend arrow |
| `ViewToggle` | Grouped/Chronological segment control |

### Daily Brief (5)

| Component | Purpose |
|---|---|
| `DailyBrief` | Main brief container — combines stats, completed items, attention items, recommendations |
| `BriefStatGroup` | 4-column count-up stats (tasks, files, comments, milestones) |
| `RecentlyCompletedList` | Time-relative completed items with type icons |
| `BriefAttentionItems` | Severity-coded attention alerts inside brief |
| `BriefRecommendations` | Clickable recommendations with reasons |

### Immediate Actions (2)

| Component | Purpose |
|---|---|
| `ImmediateActionsSection` | Inbox-zero section — session dismiss state, max 3 cards |
| `ActionCard` | Severity-coded card with left border, icon, primary CTA, dismiss |

### Needs Attention (2)

| Component | Purpose |
|---|---|
| `NeedsAttentionSection` | Scored, prioritized list — hidden when empty, truncated with "View all" |
| `NeedsAttentionItem` | Row with severity dot, score badge, clickable |

### Recent Changes (3)

| Component | Purpose |
|---|---|
| `RecentChangesSection` | Section with view toggle — grid (grouped) / timeline (chronological) |
| `ChangeGroup` | Per-project change card with stat icons + health badge |
| `ViewToggle` | Grouped / Chronological toggle |

### My Projects (3)

| Component | Purpose |
|---|---|
| `MyProjectsSection` | Scale-aware project grid (SMALL/MEDIUM/LARGE), pinned-first sorting |
| `ProjectHealthCard` | Card with health border, completion bar, task summary, pin toggle |
| `HealthBadge` | Shared health + trend indicator |

### Reviews (2)

| Component | Purpose |
|---|---|
| `UpcomingReviewsSection` | Card grid — empty state with CTA |
| `ReviewCard` | Readiness score ring, checklist, urgency badge, Open/Reschedule |

### Students (2)

| Component | Purpose |
|---|---|
| `StudentsNeedingAttentionSection` | Student list — empty state "All actively working" |
| `StudentRow` | Avatar + name + reason badge + action link |

### Orchestrator (1)

| Component | Purpose |
|---|---|
| `TeacherDashboardClient` | Top-level client — fetches data via hook, renders all sections with Suspense, handles loading/error states, fires instrumentation events |

---

## Database Schema Changes

| Model | Field | Type | Purpose |
|---|---|---|---|
| `User` | `lastVisitedAt` | `DateTime?` | Tracks when teacher last opened the workspace |
| `Project` | `isPinned` | `Boolean @default(false)` | Teacher pin toggle |
| `ProjectMember` | `isPinned` | `Boolean @default(false)` | Student pin toggle (future use) |

---

## Page Wiring

| File | Change |
|---|---|
| `src/app/(dashboard)/teacher/page.tsx` | Now renders `TeacherDashboardClient` from workspace components |
| `src/app/(dashboard)/teacher/TeacherDashboardClient.tsx` | **Deleted** — replaced by workspace version |

---

## Architecture Diagram

```
TeacherDashboardPage (server)
  └── TeacherDashboardClient (client — orchestrator)
        ├── useTeacherDashboardData() [React Query, 30s stale]
        │     └── getTeacherDashboardData() [server action]
        │           ├── queryProjects()              ─┐
        │           ├── queryRecentCompletedItems()    ├── Promise.all (parallel)
        │           └── queryPinnedProjectIds()       ─┘
        │           ├── computeHealth()            [HealthEngine]
        │           ├── computeAttentionItems()    [AttentionEngine]
        │           ├── aggregateChanges()         [ChangeAggregator]
        │           ├── generateRecommendations()  [RecommendationEngine]
        │           ├── generateBrief()            [BriefGenerator]
        │           ├── computeReviewReadiness()   [ReviewReadinessEngine]
        │           └── summarizeActivity()        [ActivitySummarizer]
        ├── TeacherDashboardHeader
        ├── DailyBrief
        │     ├── BriefStatGroup
        │     ├── RecentlyCompletedList
        │     ├── BriefAttentionItems
        │     └── BriefRecommendations
        ├── ImmediateActionsSection
        │     ├── ActionCard × N
        │     └── AllClearedState
        ├── NeedsAttentionSection
        │     └── NeedsAttentionItem × N
        ├── RecentChangesSection
        │     ├── ViewToggle
        │     ├── ChangeGroup × N (grouped view)
        │     └── ActivityEvent list (chronological view)
        ├── MyProjectsSection
        │     └── ProjectHealthCard × N (scaled by tier)
        ├── UpcomingReviewsSection
        │     └── ReviewCard × N (with readiness)
        └── StudentsNeedingAttentionSection
              └── StudentRow × N
```

---

## Scale Tiers

| Project Count | Display Behaviour |
|---|---|
| 1–5 (SMALL) | All projects shown |
| 6–15 (MEDIUM) | Pinned first, then attention-needed, then recent activity (max 7) |
| 16+ (LARGE) | Pinned + Critical/Warning only (max 9) + "View all N projects" link |

---

## Refresh Strategy

| Section | Stale Time |
|---|---|
| Header | On fetch (static) |
| Daily Brief | Infinity (manual refresh) |
| Immediate Actions | 30s |
| Needs Attention | 30s |
| Recent Changes | 60s |
| My Projects | 60s |
| Upcoming Reviews | 60s |
| Students Needing Attention | 60s |

---

## Verification

- **TypeScript**: 0 errors
- **Next.js build**: Compiles successfully
- **Workspace ESLint errors**: 0 (all 171 build-blocking errors are pre-existing in untouched files)
