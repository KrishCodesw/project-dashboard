"use client";

import React, { useEffect } from "react";
import { useTeacherDashboardData, useTogglePinProject, useRecordLastVisited, useDismissAction } from "@/hooks/useTeacherDashboardData";
import { TeacherDashboardSkeleton } from "./TeacherDashboardSkeleton";
import { TeacherDashboardHeader } from "./TeacherDashboardHeader";
import { DailyBrief } from "./DailyBrief";
import { ImmediateActionsSection } from "./ImmediateActionsSection";
import { NeedsAttentionSection } from "./NeedsAttentionSection";
import { RecentChangesSection } from "./RecentChangesSection";
import { MyProjectsSection } from "./MyProjectsSection";
import { UpcomingReviewsSection } from "./UpcomingReviewsSection";
import { StudentsNeedingAttentionSection } from "./StudentsNeedingAttentionSection";
import { logWorkspaceEvent } from "@/lib/delivery/instrumentation";

export default function TeacherDashboardClient() {
  const { data, isLoading, error } = useTeacherDashboardData();
  const togglePin = useTogglePinProject();
  const dismissAction = useDismissAction();
  const recordVisit = useRecordLastVisited();

  // Record "last visited" on first load (background)
  useEffect(() => {
    if (data && !isLoading) {
      recordVisit.mutate();
      logWorkspaceEvent("workspace_opened");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="mt-4 text-lg font-semibold">Could not load dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong. Please try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading || !data) {
    return <TeacherDashboardSkeleton />;
  }

  const {
    header,
    dailyBrief,
    immediateActions,
    needsAttention,
    recentChanges,
    chronologicalEvents,
    projects,
    upcomingReviews,
    studentsNeedingAttention,
  } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <TeacherDashboardHeader
        greeting={header.greeting}
        userName={header.userName}
        date={header.date}
        sinceLastVisit={header.sinceLastVisit}
        urgentItemCount={header.urgentItemCount}
        activeProjectCount={header.activeProjectCount}
        totalStudentCount={header.totalStudentCount}
      />

      {/* Daily Brief */}
      <DailyBrief
        sinceLastVisit={dailyBrief.sinceLastVisit}
        recentlyCompleted={dailyBrief.recentlyCompleted}
        attentionItems={dailyBrief.attentionItems}
        recommendations={dailyBrief.recommendations}
      />

      {/* Immediate Actions */}
      <ImmediateActionsSection
        actions={immediateActions}
        onDismiss={(id) => {
          dismissAction.mutate(id);
          logWorkspaceEvent("workspace_action_dismissed", { actionId: id });
        }}
      />

      {/* Needs Attention */}
      <NeedsAttentionSection
        items={needsAttention}
        scaleTier={header.scaleTier}
      />

      {/* Recent Changes */}
      <RecentChangesSection
        grouped={recentChanges}
        chronological={chronologicalEvents}
      />

      {/* My Projects */}
      <MyProjectsSection
        projects={projects}
        scaleTier={header.scaleTier}
        onTogglePin={(projectId) => {
          togglePin.mutate(projectId);
          logWorkspaceEvent("workspace_project_pinned", { projectId });
        }}
      />

      {/* Upcoming Reviews */}
      <UpcomingReviewsSection reviews={upcomingReviews} />

      {/* Students Needing Attention */}
      <StudentsNeedingAttentionSection students={studentsNeedingAttention} />
    </div>
  );
}
