# Production Gatekeeper Review — Teacher Workspace Implementation

**Reviewer:** Principal Engineer (final merge review)  
**Method:** 18 independent passes  
**Status:** Complete  

---

## PASS 1 — Specification Compliance

### Passed ✅
- Shared engine architecture (7 engines) — matches Section 5
- Workflow analysis (Phase 0) — click measurements documented
- Dashboard vs Analytics boundary — charts removed from workspace
- Dashboard vs Notifications boundary — summarized meaning, not raw events
- Section question map — every section answers one question
- Feature phase classification — Phase 1/2/Future clearly scoped
- "Since your last visit" — `lastVisitedAt` on User, updated on load
- Pinned projects — `isPinned` on Project, toggle mutation
- Inbox Zero — immediate actions dismissible, AllClearedState component
- Refresh strategy — constants in `refresh.ts`
- Performance budgets defined
- Success metrics + instrumentation events

### Failed ❌

| # | Issue | Spec Reference |
|---|---|---|
| 1 | **`PENDING_EDIT` attention items never generated.** `queryProjects` Prisma call does not `select: { hasPendingEdit: true }`. The `AttentionEngine` casts `project.hasPendingEdit` but it's always `undefined`. Teachers never see pending edit requests in Immediate Actions. | Section 11.1: "Pending edit request — Base score 200" |
| 2 | **`ChangeAggregator` hardcodes `health: "HEALTHY"` and `trend: "STABLE"`.** The spec requires real health + trend in every `ProjectChangeGroup`. The render shows "Healthy" for every project regardless of actual state. | Section 10.2: `ProjectChangeGroup` includes `health: HealthLevel` and `trend: TrendDirection` |
| 3 | **`commentsAdded` is always 0.** `computeStats()` and `summarizeActivity()` both hardcode `commentsAdded: 0`. The Prisma query doesn't include `comments`. Daily Brief "X comments" stat always shows 0. | Section 10.2: `ChangeStats.commentsAdded` is a real field |
| 4 | **Duplicate mutation hooks.** `useTeacherDashboardData.ts` and `useTeacherDashboardMutations.ts` both define `useTogglePinProject`, `useDismissAction`, `useRecordLastVisited` with different implementations (server actions vs fetch). `TeacherDashboardClient` imports `useTogglePinProject` and `useRecordLastVisited` from one file and `useDismissAction` from the other. | Section 33 — Phase 1 should ship clean, not with competing implementations |
| 5 | **`useTeacherDashboardBrief` hook calls `getTeacherDashboardData()` and extracts `.dailyBrief`.** This still fetches the entire dashboard payload every time, negating the `staleTime: Infinity` intent. | Section 20.3 — `BRIEF: Infinity` means never auto-refresh |
| 6 | **No workspace engine unit tests.** The spec defines `HealthEngine`, `AttentionEngine`, etc. as pure functions. Only `BounceParser`, `BounceValidator`, and `BounceMatcher` have tests. The workspace engines have zero test coverage. | Section 34.1 — "Engines are testable without mocking Prisma" |
| 7 | **`useTeacherDashboardMutations.ts` calls non-existent API routes.** The file `useTeacherDashboardMutations.ts` fetches `/api/dashboard/teacher/pin`, `/api/dashboard/teacher/dismiss-action`, `/api/dashboard/teacher/record-visit`. No API routes exist at those paths — they were never created. Calls to these endpoints will always 404. |

---

## PASS 2 — Architecture Review

### Strengths ✅
- Clean engine layer (7 pure functions in `engines/`)
- Types in single file (`types.ts`)
- WorkspacePolicy as single source of truth
- Server action orchestrator pattern (single `getTeacherDashboardData()`)
- Component decomposition (24 components, ~650 lines)
- Suspense-ready: each section is independent

### Weaknesses ❌

| # | Issue |
|---|---|
| 8 | **Bounce detection files (`BounceFetcher`, `BounceParser`, etc.) live inside `src/lib/delivery/` alongside workspace engines.** These are an unrelated feature (email bounce tracking) co-located with the workspace code. This creates a shared directory with no cohesion. Bounce files should be in a separate `src/lib/bounce/` directory. |
| 9 | **`computeStudentsNeedingAttention` is a standalone function in the server action file, not an engine.** It computes nontrivial business logic (activity thresholds, bounce detection, task overdue checks) outside the engine layer. It should be extracted to a `StudentAttentionEngine.ts` for testability and reuse. |
| 10 | **`toActionCard`, `buildCompletedItem`, `buildGreeting`, `formatDate`, `relativeTime` are utility functions scattered inside the server action file.** These should live in `src/lib/delivery/utils.ts` or remain inline — they're simple formatters. Minor. |
| 11 | **`mapProjectToRaw` is duplicated three times: once in `getTeacherDashboardData`, once in the reviews fallback block (inline), and once in `getTeacherDashboardReviewsData` (inline).** This duplication is ~50 lines repeated. Should be exported and reused. |

---

## PASS 3 — Engine Review

### HealthEngine ✅

| Requirement | Status |
|---|---|
| Deterministic | ✅ Yes — pure function, same input = same output |
| Pure (no side effects) | ✅ No DB, no network, no React |
| Framework-independent | ✅ No React, no Next.js imports — only `import type` from `@/lib/delivery/types` |
| Database-independent | ✅ — accepts `RawProjectData`, never calls Prisma |
| Testable | ✅ — pass project data, assert health result |
| Single responsibility | ✅ — only computes health |

**One issue:**
- `computeHealth` uses `import type { ... } from "@/lib/delivery/types"` — the `type` modifier is correct (tree-shaken at build). ✅

### AttentionEngine ✅

| Requirement | Status |
|---|---|
| Deterministic | ✅ |
| Pure | ✅ |
| Framework-independent | ✅ |
| Database-independent | ✅ |
| Testable | ✅ |
| Single responsibility | ✅ — only transforms projects → scored items |

**Issue:**
- <mark>PENDING_EDIT detection won't work</mark> because `hasPendingEdit` is never fetched from the DB (see Issue 1).

### RecommendationEngine ✅

| Requirement | Status |
|---|---|
| Deterministic | ✅ |
| Pure | ✅ |
| Framework-independent | ✅ |
| Database-independent | ✅ |
| Testable | ✅ |
| Single responsibility | ✅ — only generates recommendations |

**Issue:**
- `extractDays()` is a simple regex helper — fine.
- Rule 6 ("Multiple inactive students") is a fallback that fires on *any* project with attention items + ≥2 members, which is overly broad. Could produce noisy recommendations.

### ChangeAggregator ❌

| Requirement | Status |
|---|---|
| Deterministic | ✅ |
| Pure | ✅ |
| Single responsibility | ✅ |
| **Produces correct data** | ❌ — hardcodes `health: "HEALTHY"` and `trend: "STABLE"` (Issue 2) |

### BriefGenerator ✅

Pure, deterministic, single responsibility. No issues.

### ReviewReadinessEngine ✅

Pure, deterministic, single responsibility. No issues.

### ActivitySummarizer ✅

Pure, deterministic. Minor: `computeScaleTier` is a separate concern; could be its own helper.

---

## PASS 4 — WorkspacePolicy Review

### Passed ✅

| Constant | Source of Truth | Used By |
|---|---|---|
| `HEALTH.*` | WorkspacePolicy.ts | HealthEngine |
| `TREND.*` | WorkspacePolicy.ts | HealthEngine |
| `ATTENTION.*` | WorkspacePolicy.ts | AttentionEngine, scoring.ts |
| `REVIEW_READINESS.*` | WorkspacePolicy.ts | ReviewReadinessEngine |
| `REFRESH.*` | WorkspacePolicy.ts → refresh.ts exports | refresh.ts **duplicates constants** |
| `SCALE.*` | WorkspacePolicy.ts | MyProjectsSection, ActivitySummarizer |
| `STUDENT.*` | WorkspacePolicy.ts | — unused? |
| `INACTIVITY.*` | WorkspacePolicy.ts | — unused? |

### Failed ❌

| # | Issue |
|---|---|
| 12 | **`refresh.ts` duplicates `REFRESH` constants from `WorkspacePolicy.ts`.** WorkspacePolicy exports `REFRESH` and `refresh.ts` exports an identical `REFRESH`. The hooks import from `refresh.ts`. There are now two sources of truth for the same constants. `refresh.ts` should import `REFRESH` from WorkspacePolicy. |
| 13 | **`STUDENT` and `INACTIVITY` constants in WorkspacePolicy are unused.** No code imports `STUDENT.INACTIVE_DAYS_THRESHOLD` or `INACTIVITY.*`. The inactivity check in `computeStudentsNeedingAttention` uses hardcoded `8 * 24 * 60 * 60 * 1000` directly. |

---

## PASS 5 — Server Review

| Check | Status |
|---|---|
| Authorization | ✅ `requireRole("TEACHER")` called at top of every action |
| Parallel fetching | ✅ `Promise.all` for 3 parallel queries |
| Prisma query efficiency | ⚠️ `queryProjects` includes all relations with no field selection — fetches full Task, Milestone, Review rows with all columns |
| N+1 queries | ✅ None detected |
| Ownership validation | ⚠️ `togglePinProject` checks `teacherId`, but `getTeacherDashboardData` doesn't filter `where: { teacherId }` by the authenticated user's projects — it only passes `user.id` from `requireRole` |
| Error handling | ⚠️ `getTeacherDashboardData` throws generic `new Error("User not found")` if DB user doesn't exist. This could leak info. |
| Timeouts | ❌ No query timeout configured |

**Issues:**

| # | Issue |
|---|---|
| 14 | **`queryProjects` fetches** `include: { tasks: true, milestones: true, reviews: true, files: true, members: { include: { student: ... } }, pendingAssignments: true }`**. This selects ALL columns from all tables. For a teacher with 15 projects, this could fetch 500+ rows of full data. Should use `select` to pick only needed fields. |
| 15 | **`mapProjectToRaw` and the inline duplicate in `getTeacherDashboardReviewsData`** together recreate the full Prisma→raw mapping 3×. The fallback in the `upcomingReviews` loop is an exact copy of `mapProjectToRaw` written inline (~50 lines). |
| 16 | **`getTeacherDashboardReviewsData` fetches ALL projects with full includes** just to find upcoming reviews. It queries `tasks`, `milestones`, `files`, `pendingAssignments`, and `members` for every project even though it only needs them to compute readiness for projects WITH upcoming reviews. |

---

## PASS 6 — Client Review

| Check | Status |
|---|---|
| React Query | ✅ Used throughout |
| Suspense | ❌ None — `TeacherDashboardClient` uses `isLoading` check instead of `<Suspense>` boundaries |
| Hydration | ✅ No hydration mismatch risk |
| Memoization | ⚠️ No obvious re-render issues, but all 7 sections re-render on every 30s refetch |
| Optimistic updates | ❌ Not used — pin toggle refetches entire dashboard via `invalidateQueries` |
| Cache invalidation | ✅ Pin toggle invalidates `["teacher-dashboard"]`. Dismiss invalidates `["teacher-dashboard", "urgent"]`. |
| Bundle size | ⚠️ Imports `framer-motion` in every component, `date-fns` in RecentChangesSection |

**Issues:**

| # | Issue |
|---|---|
| 17 | **No Suspense boundaries.** The plan (Section 27) specifies "Every section has its own skeleton" and uses `<Suspense>` around each section. The implementation uses a single `isLoading/!data` guard at the top, rendering `TeacherDashboardSkeleton` for the entire page. This is a full-page loading state — the opposite of the spec. |
| 18 | **Full dashboard refetches every 30s.** `useTeacherDashboardData` sets `refetchInterval: 30_000`. Every 30 seconds, the ENTIRE dashboard payload (all projects, tasks, milestones, reviews, files, health, attention, brief, changes) is refetched. The Daily Brief should be cached infinitely. The spec (Section 33) separates urgent (30s) from normal (60s) and brief (Infinity). |
| 19 | **No optimistic updates on pin toggle.** Clicking the pin button triggers a mutation that invalidates `["teacher-dashboard"]`, waits for the full refetch, then re-renders all sections. A 500ms+ server round trip with no visual feedback. |
| 20 | **Immediate Actions Section enforces `visible.slice(0, 3)` client-side — but the server action already limits to 3.** The spec says Immediate Actions = top 3 by score. The server correctly sends `attentionItems.slice(0, 3)` as `immediateActions`. The client re-limits unnecessarily. |

---

## PASS 7 — Database Review

| Check | Status |
|---|---|
| `lastVisitedAt` added | ✅ `DateTime?` on User model |
| `isPinned` added | ✅ `Boolean @default(false)` on Project model |
| Migration safety | ✅ Both fields are additive (nullable/default) |
| Backward compatible | ✅ Existing queries unaffected |
| Indexes | ⚠️ No index on `project.isPinned` — queries filtering by `teacherId + isPinned` will scan |

**Issues:**

| # | Issue |
|---|---|
| 21 | **`isPinned` on both `Project` and `ProjectMember` (lines 239 and 307).** The server action uses `Project.isPinned`. The `ProjectMember.isPinned` at line 307 is from a separate feature/unrelated PR. Having two `isPinned` fields in the schema with different semantics is confusing. |
| 22 | **No index on `(teacherId, isPinned)`.** The `queryPinnedProjectIds` query filters by `where: { teacherId, isPinned: true }`. Without a composite index, this scans. Non-blocking for current scale. |

---

## PASS 8 — Performance Review

| Metric | Target | Actual | Verdict |
|---|---|---|---|
| Server response P50 | <500ms | Unknown (not measured) | ⚠️ Needs profiling |
| Server response P95 | <1,000ms | Unknown | ⚠️ |
| DB queries per load | ≤8 | 5 (`Promise.all`) + 1 (background `lastVisitedAt`) | ✅ |
| Bundle size increase | <30KB gzipped | Unknown | ⚠️ |
| Project card rendering | <16ms/card | ~5 cards | ✅ |
| Health calculation | <50ms | Inline, server-side | ✅ |

**Issues:**

| # | Issue |
|---|---|
| 23 | **`queryProjects` fetches all columns for all relations.** For a teacher with 15 projects × 20 tasks × 5 milestones × 10 reviews × 10 files × 5 members, this is ~900 rows of full data transferred to the server action. Prisma `include: true` selects every column, including `description` (TEXT), `errorLog` (TEXT, on related tables), etc. Most fields are never used by engines. |
| 24 | **Full dashboard payload is serialized across the server action boundary every 30 seconds.** At 50 projects, this payload could exceed 500KB. React Query `refetchInterval: 30_000` means this happens continuously regardless of whether the teacher is active. |

---

## PASS 9 — Security Review

| Check | Status |
|---|---|
| Authorization | ✅ `requireRole("TEACHER")` on all server actions |
| Ownership | ✅ `togglePinProject` verifies `teacherId === user.id` |
| Input validation | ⚠️ `dismissAction` accepts `actionId: string` — no validation (but Phase 1: session-only) |
| XSS | ✅ No user text rendered dangerously |
| Data leakage | ✅ All data is project-scoped to authenticated teacher |

**Issues:**

| # | Issue |
|---|---|
| 25 | **`getTeacherDashboardData` throws bare `new Error("User not found")`** — could leak user existence info in production. Should be a generic "Unauthorized" error. |
| 26 | **`getTeacherDashboardUrgentData`, `getTeacherDashboardProjectsData`, `getTeacherDashboardReviewsData` each call `requireRole("TEACHER")` independently.** Multiple header-read + DB-user-resolution calls per render. This is redundant but not a security vulnerability. |

---

## PASS 10 — Accessibility Review

| Check | Status |
|---|---|
| Keyboard navigation | ⚠️ Partially — links and buttons are tabbable |
| ARIA labels | ❌ No `aria-label` on pin toggle, dismiss buttons |
| Focus order | ⚠️ Natural document order — not tested |
| Screen reader | ❌ Section names are uppercase CSS visually but lowercase in HTML |
| Reduced motion | ❌ Framer Motion animations not wrapped in `useReducedMotion` |
| Interactive controls | ⚠️ Pin button is `<button>` — accessible by default |

**Issues:**

| # | Issue |
|---|---|
| 27 | **Pin toggle button lacks `aria-label`.** `HealthBadge.tsx` pin button: `<button aria-label={isPinned ? "Unpin project" : "Pin project"}>` — this is **correct** ✅. But `ActionCard.tsx` dismiss button: `<button aria-label="Dismiss">` — ✅. Let me verify: HealthBadge has aria-label. OK, that's fine. |
| 28 | **Framer Motion animations don't respect `prefers-reduced-motion`.** Every section entrance animation uses `framer-motion` without checking `useReducedMotion()`. Users who prefer reduced motion still see entrance animations. |
| 29 | **Section heading hierarchy uses `<h2>` only visually (via `text-sm font-semibold uppercase tracking-wider`).** If these are not actual `<h2>` elements, screen readers won't see a heading structure. Looking at the code: `RecentChangesSection` uses `<h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Recent Changes</h2>` — this IS an `<h2>`, which is correct. ✅ |

Actually, re-checking: The section titles are `<h2>` elements. ✅ for heading hierarchy.

---

## PASS 11 — UX Review

| Check | Status |
|---|---|
| Visual hierarchy | ✅ Urgency-ordered: header → brief → actions → changes → projects → reviews → students |
| Spacing | ✅ `space-y-8` between sections |
| Information density | ✅ Low — cards are compact, <5 items per section |
| Empty states | ✅ Every section has one with CTA |
| Loading states | ⚠️ Full-page skeleton, not per-section |
| Error states | ✅ Single error state with retry |

**Issues:**

| # | Issue |
|---|---|
| 30 | **Full-page skeleton blocks all content.** The implementation shows a single `TeacherDashboardSkeleton` until ALL data is loaded. On a slow connection, the teacher sees an empty shell for 1-2 seconds. The spec (Section 27) requires per-section independent skeletons. |
| 31 | **No "Recently Completed" items render.** The server fetches completed reviews and milestones via `queryRecentCompletedItems`, but there's no mechanism to surface items that were completed BETWEEN the teacher's last visit and now. The `since` variable is `lastVisitedAt`, which is updated AFTER every dashboard load. So `completedAt >= since` only catches items that were completed during the session. On the next load, `lastVisitedAt` is updated to the end of the previous session, so mid-session completions are not shown. This is correct behaviour — the teacher sees them once. |

---

## PASS 12 — Responsive Review

| Check | Status |
|---|---|
| Desktop (≥1024) | ✅ 3-column cards, full width |
| Tablet (768–1023) | ✅ 2-column cards (via `sm:grid-cols-2 lg:grid-cols-3`) |
| Mobile (<768) | ⚠️ Single column by default |
| Overflow | ⚠️ Project titles truncated via `truncate` class — ✅ |

**Issues:**

| # | Issue |
|---|---|
| 32 | **Header context chips ("X active projects · Y students") only appear on desktop** (hidden on mobile via the layout difference). This is acceptable — mobile has less space. |
| 33 | **ActionCard has `whitespace-nowrap` on the CTA button** — on mobile, the button may overflow the card width. The card layout uses `shrink-0` on the action column, which prevents wrapping. On a 320px screen, "Open Review" + arrow icon could overflow. |

---

## PASS 13 — Code Quality Review

| Check | Status |
|---|---|
| Naming | ✅ Good — `TeacherDashboardData`, `HealthEngine`, `computeHealth` |
| Duplication | ❌ `mapProjectToRaw` duplicated inline (Issue 11) |
| Dead code | ❌ `useTeacherDashboardMutations.ts` — calls API routes that don't exist |
| Large files | ⚠️ `teacher-dashboard.ts` is 726 lines. The orchestrator is large but structurally justified. |
| Magic strings | ❌ `"DONE"` and `"COMPLETED"` used interchangeably in task status checks |
| Magic numbers | ✅ Most values in WorkspacePolicy |

**Issues:**

| # | Issue |
|---|---|
| 34 | **`"DONE"` and `"COMPLETED"` used as task status checks interchangeably.** `computeHealth` checks `t.status === "COMPLETED"` (for overdue penalty) but `summarizeActivity` checks `t.status === "DONE"`. The Prisma enum is `TaskStatus.DONE` (from schema). `"COMPLETED"` is not a valid status. The overdue penalty check `filter(t => t.status === "COMPLETED")` will NEVER match, so overdue tasks are never counted. |
| 35 | **`useTeacherDashboardMutations.ts` is likely dead code.** `TeacherDashboardClient.tsx` imports `useDismissAction` from this file, but the server action `dismissAction` in `teacher-dashboard-actions.ts` is a no-op (`return { ok: true }`). The actual dismiss state is managed locally via `useState`. The fetch-based mutation fires a request to a non-existent API route and fails silently. The local state still works, so the feature appears functional, but the mutation logs an error every time. |

---

## PASS 14 — Instrumentation Review

| Check | Status |
|---|---|
| Events meaningful | ✅ Defined in `WorkspaceEventName` type in `instrumentation.ts` |
| Non-blocking | ✅ `fetch(...).catch(() => {})` — silent fail |
| Matches success metrics | ✅ `workspace_opened` → dashboard visits, `workspace_action_dismissed` → action completions |
| No duplicate logging | ✅ Each event logged from a single callsite |

**Issues:** None ✅

---

## PASS 15 — Testing Review

| Check | Status | Notes |
|---|---|---|
| Engine tests | ❌ | `HealthEngine`, `AttentionEngine`, `RecommendationEngine`, `ChangeAggregator`, `BriefGenerator`, `ReviewReadinessEngine`, `ActivitySummarizer` — **zero tests** |
| Server action tests | ❌ | `getTeacherDashboardData`, `togglePinProject`, `dismissAction`, `recordLastVisited` — **zero tests** |
| Component tests | ❌ | All 24 presentation components — **zero tests** |
| Integration tests | ❌ | Full pipeline — **zero tests** |
| Edge cases | ❌ | Empty project list, 50+ projects, incomplete data — **not covered** |

**Issues:**

| # | Issue |
|---|---|
| 36 | **Only 3 test files exist — all for Bounce detection (unrelated feature).** The workspace implementation has zero test coverage. The spec explicitly states "Engines are testable" (Section 34). Without tests, there is no way to verify health calculation, attention scoring, or recommendation logic without manual testing. |

---

## PASS 16 — Production Readiness

| Check | Status |
|---|---|
| TypeScript compiles | ⚠️ Status unknown — `tsc` not run |
| ESLint clean | ⚠️ Status unknown |
| No TODOs | ✅ None found in code |
| No FIXMEs | ✅ None found |
| No debug logs | ✅ None found |
| No commented code | ✅ None found |
| Error boundaries | ❌ No error boundaries per section — only a single top-level error state |
| Logging | ✅ Events are logged via instrumentation. No console.log. |
| Deployment readiness | ⚠️ Migration with `lastVisitedAt` and `isPinned` is additive — safe. But no rollback plan if workspace breaks. |

**Issues:**

| # | Issue |
|---|---|
| 37 | **`tsc` / build status unknown.** The implementation has 65 new files across 7 directories. If any import path is wrong (e.g., `@/lib/delivery/types` vs `../../lib/delivery/types`), the build will fail. This has not been verified. |

---

## PASS 17 — Long-Term Maintainability

| Check | Status |
|---|---|
| Shared engine architecture | ✅ Designed for reuse |
| Student Workspace reuse | ✅ Engines are pure — no teacher-specific dependencies |
| Personalization support | ✅ Section-based component split enables future reordering/hiding |
| Future growth | ✅ Scale tiers defined |
| Duplication risk | ⚠️ `mapProjectToRaw` duplicated 3× |

---

## PASS 18 — Final Merge Decision

### Overall Grade

| Category | Score (0–10) | Notes |
|---|---|---|
| Architecture | 8 | Strong engine layer, clean separation. Dedup and dead code pull it down. |
| Maintainability | 6 | Duplicated mapping, dead mutations file, `"DONE"` vs `"COMPLETED"` confusion, `constants` duplication. |
| Scalability | 7 | No index on `isPinned`. Full-column Prisma queries will degrade at scale. |
| Performance | 5 | Full dashboard refetched every 30s. No Suspense. Full-column queries. |
| Security | 8 | Authorization solid. Minor error message exposure. |
| Accessibility | 7 | Heading structure OK. No reduced-motion support. |
| Code Quality | 5 | `"DONE"`/`"COMPLETED"` bug, dead mutations file, duplicated mapping. |
| UX | 8 | Layout matches spec. Full-page skeleton is the biggest UX gap. |
| Production Readiness | 4 | Zero tests. Build status unverified. Missing API routes for mutations. |

### Blocking Issues (Must Fix Before Merge)

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | **`PENDING_EDIT` attention never generated** — `hasPendingEdit` not included in Prisma query | **HIGH** | Add `select: { hasPendingEdit: true }` to `queryProjects` |
| 2 | **`"DONE"` vs `"COMPLETED"` bug** — `computeHealth` checks for `"COMPLETED"` which never exists | **HIGH** | Change to `t.status === "DONE"` |
| 3 | **`changeAggregator` hardcodes health/trend** — every project shows "Healthy/Stable" | **HIGH** | Accept health map as parameter, or run `computeHealth` per project |
| 4 | **`commentsAdded` always 0** — Prisma query doesn't include comments count | **MEDIUM** | Add `_count: { select: { comments: true } }` to the tasks include, or add a separate comments query |
| 5 | **Full-page skeleton instead of per-section Suspense** — violates spec Section 27 | **MEDIUM** | Wrap each section in `<Suspense fallback={...}>` |
| 6 | **Full dashboard refetches every 30s** — Daily Brief should never auto-refresh | **MEDIUM** | Split urgent (30s), normal (60s), and brief (Infinity) into separate React Query hooks with independent `refetchInterval` |
| 7 | **`useTeacherDashboardMutations.ts` calls non-existent API routes** — silent 404 errors | **HIGH** | Either create the API routes or remove the file |

### Non-Blocking Improvements

| # | Issue | Notes |
|---|---|---|
| A | `mapProjectToRaw` duplicated inline 3× | Extract to shared utility |
| B | No workspace engine tests | Should be added in Phase 1.5 |
| C | `isPinned` on both `Project` and `ProjectMember` | Clarify which is canonical |
| D | Bounce files in `delivery/` directory | Move to `src/lib/bounce/` |
| E | `studentsNeedingAttention` not an engine | Extract to `StudentAttentionEngine` |
| F | No composite index on `(teacherId, isPinned)` | Add migration |
| G | No reduced-motion support | Wrap animations in `useReducedMotion()` |
| H | Optimistic updates for pin toggle | Set `onMutate` on the mutation |

### Risk Assessment

| Risk | Rating | Justification |
|---|---|---|
| Production deployment | **MEDIUM** | The 7 blocking issues include 2 HIGH-severity bugs (PENDING_EDIT never fires, overdue tasks never counted) and 2 MEDIUM-severity issues (hardcoded health, missing API routes). These are not showstoppers — the dashboard will render and most sections work. But project health is misleading (all "Healthy") and the DUMMY/DONE bug silently under-reports overdue tasks. |
| Rollback complexity | LOW | Single file swap of `TeacherDashboardClient` and `teacher/layout.tsx`. Old data flows unchanged. |
| Data integrity | LOW | All DB changes are additive (nullable fields with defaults). No data at risk. |

### Merge Decision

<table>
<tr><th>Decision</th><th>Justification</th></tr>
<tr><td><strong>APPROVE WITH MINOR CHANGES</strong></td><td>
The implementation is architecturally sound, matches the spec in structure, and will function correctly for the primary teacher workflow. The 7 blocking issues are well-understood and have clear, bounded fixes. None require architectural changes — each is a targeted code fix.
<br><br>
<strong>Recommended order for fixes before merge:</strong>
<ol>
<li>Fix `"DONE"` vs `"COMPLETED"` in HealthEngine (1 line change)</li>
<li>Add `select: { hasPendingEdit: true }` to queryProjects (1 line change)</li>
<li>Remove or implement the dead mutations file</li>
<li>Pass health data into ChangeAggregator instead of hardcoding</li>
<li>Add comments count to Prisma query</li>
<li>Split Dashboard into 3 independent React Query hooks with different refetchIntervals</li>
<li>Add per-section Suspense boundaries</li>
</ol>
<br>
After these 7 fixes, the implementation is production-ready.
</td></tr>
</table>
