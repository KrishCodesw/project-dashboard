// ─── Teacher Workspace Shared Types ────────────────────────────────────────
// Single source of truth for all workspace data types.
// Engine layer, server action, and presentation layer all consume these.

export type HealthLevel = "EXCELLENT" | "HEALTHY" | "WARNING" | "CRITICAL";

export type TrendDirection = "IMPROVING" | "STABLE" | "DECLINING";

export type ScaleTier = "SMALL" | "MEDIUM" | "LARGE";

export type AttentionType =
  | "OVERDUE_MILESTONE"
  | "UPCOMING_REVIEW"
  | "BOUNCED_INVITE"
  | "BLOCKED_TASK"
  | "PENDING_EDIT"
  | "NO_ACTIVITY"
  | "OVERDUE_TASKS";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type CompletedItemType =
  | "REVIEW_COMPLETED"
  | "SHOWCASE_APPROVED"
  | "MILESTONE_COMPLETED"
  | "SPRINT_FINISHED";

export type StudentAttentionReason =
  | "INACTIVE_8D"
  | "OVERDUE_TASKS"
  | "BOUNCED_INVITE";

// ─── Health ────────────────────────────────────────────────────────────────

export interface HealthResult {
  level: HealthLevel;
  score: number;       // 0–100
  oneLiner: string;    // "2 overdue milestones, no activity 6d"
  trend: TrendDirection;
  reasons: string[];   // individual contributing factors
}

// ─── Attention Scoring ─────────────────────────────────────────────────────

export interface ScoredAttentionItem {
  id: string;
  projectId: string;
  projectTitle: string;
  type: AttentionType;
  score: number;        // 0–1000
  severity: Severity;
  message: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
}

export interface ActionCard {
  id: string;
  type: AttentionType;
  score: number;
  title: string;
  description: string;
  reason: string;
  primaryAction: { label: string; href: string };
  dismissible: boolean;
}

export interface BriefAttentionItem {
  projectId: string;
  projectTitle: string;
  message: string;
  severity: Severity;
}

// ─── Recommendations ───────────────────────────────────────────────────────

export interface Recommendation {
  message: string;
  reason: string;
  actionHref: string;
}

// ─── Completed Items ───────────────────────────────────────────────────────

export interface CompletedItem {
  id: string;
  type: CompletedItemType;
  projectId: string;
  projectTitle: string;
  message: string;
  completedAt: Date;
}

// ─── Changes & Activity ────────────────────────────────────────────────────

export interface ChangeStats {
  tasksCompleted: number;
  filesUploaded: number;
  commentsAdded: number;
  milestonesCompleted: number;
}

export interface ProjectChangeGroup {
  projectId: string;
  projectTitle: string;
  health: HealthLevel;
  trend: TrendDirection;
  sinceLastVisit: ChangeStats;
  since7d: ChangeStats;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  projectTitle: string;
  type: string;
  message: string;
  timestamp: Date;
}

// ─── Project Health Card ───────────────────────────────────────────────────

export interface ProjectHealthCardData {
  id: string;
  title: string;
  health: { level: HealthLevel; oneLiner: string; score: number };
  trend: TrendDirection;
  completionPercentage: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  blockedTaskCount: number;
  daysRemaining: number;
  isPinned: boolean;
}

// ─── Review Card ───────────────────────────────────────────────────────────

export interface ReviewCardData {
  id: string;
  projectId: string;
  projectTitle: string;
  reviewType: string;
  scheduledAt: Date;
  daysUntil: number;
  studentCount: number;
  readiness: ReviewReadiness;
}

export interface ReviewReadiness {
  score: number;                  // 0–100 percentage
  milestonesCompleted: number;
  totalMilestones: number;
  filesSubmitted: boolean;
  documentationSubmitted: boolean;
  warnings: string[];
}

// ─── Student Attention ─────────────────────────────────────────────────────

export interface StudentAttentionData {
  studentId: string;
  studentName: string;
  email: string;
  projectId: string;
  projectTitle: string;
  reason: StudentAttentionReason;
  detail: string;
  actionLinks: Array<{ label: string; href: string }>;
}

// ─── Daily Brief ───────────────────────────────────────────────────────────

export interface DailyBrief {
  sinceLastVisit: ChangeStats;
  recentlyCompleted: CompletedItem[];
  attentionItems: BriefAttentionItem[];
  recommendations: Recommendation[];
}

// ─── Header ────────────────────────────────────────────────────────────────

export interface HeaderData {
  greeting: string;
  userName: string;
  date: string;
  sinceLastVisit: string;
  urgentItemCount: number;
  activeProjectCount: number;
  totalStudentCount: number;
  scaleTier: ScaleTier;
}

// ─── Top-level Dashboard Data ──────────────────────────────────────────────

export interface TeacherDashboardData {
  header: HeaderData;
  dailyBrief: DailyBrief;
  immediateActions: ActionCard[];
  needsAttention: ScoredAttentionItem[];
  recentChanges: ProjectChangeGroup[];
  chronologicalEvents: ActivityEvent[];
  projects: ProjectHealthCardData[];
  upcomingReviews: ReviewCardData[];
  studentsNeedingAttention: StudentAttentionData[];
}

// ─── Raw Input Types (for engines) ─────────────────────────────────────────

export interface RawProjectData {
  id: string;
  title: string;
  domain: string;
  status: string;
  completionPercentage: number;
  startDate: Date;
  endDate: Date;
  teacherId: string;
  isPinned?: boolean;
  hasPendingEdit?: boolean;
  tasks: RawTaskData[];
  milestones: RawMilestoneData[];
  reviews: RawReviewData[];
  files: RawFileData[];
  members: RawMemberData[];
  pendingAssignments: RawPendingAssignmentData[];
}

export interface RawTaskData {
  id: string;
  title: string;
  status: string;
  assignedToId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawMilestoneData {
  id: string;
  title: string;
  dueDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
}

export interface RawReviewData {
  id: string;
  reviewType: string;
  scheduledAt: Date;
  conductedAt: Date | null;
  status: string;
  reviewerId: string;
}

export interface RawFileData {
  id: string;
  fileName: string;
  fileType: string | null;
  uploadedAt: Date;
}

export interface RawMemberData {
  id: string;
  studentId: string;
  role: string;
  student: { name: string; email: string } | null;
}

export interface RawPendingAssignmentData {
  id: string;
  email: string;
  deliveryStatus: string | null;
  bounceReason: string | null;
}
