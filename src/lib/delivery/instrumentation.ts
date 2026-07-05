// ─── Product Instrumentation ───────────────────────────────────────────────
// Lightweight fire-and-forget event logging.
// No third-party analytics dependency.

export type WorkspaceEventName =
  | "workspace_opened"
  | "workspace_brief_viewed"
  | "workspace_action_completed"
  | "workspace_action_dismissed"
  | "workspace_recommendation_clicked"
  | "workspace_recommendation_dismissed"
  | "workspace_project_opened"
  | "workspace_project_pinned"
  | "workspace_review_started"
  | "workspace_review_rescheduled"
  | "workspace_student_followup"
  | "workspace_changes_view_switched"
  | "workspace_section_interacted";

export function logWorkspaceEvent(
  event: WorkspaceEventName,
  metadata?: Record<string, unknown>
): void {
  // Fire-and-forget. Never block the UI.
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      metadata,
      timestamp: new Date().toISOString(),
    }),
    keepalive: true,
  }).catch(() => {
    // Silent fail — analytics must never block the user experience
  });
}
