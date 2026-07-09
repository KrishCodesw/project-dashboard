"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherDashboardData,
  getTeacherDashboardUrgentData,
  getTeacherDashboardProjectsData,
  getTeacherDashboardReviewsData,
} from "@/server/actions/teacher-dashboard";
import {
  togglePinProject,
  dismissAction,
  recordLastVisited,
} from "@/server/actions/teacher-dashboard-actions";
import type { TeacherDashboardData } from "@/lib/delivery/types";
import { REFRESH } from "@/lib/delivery/WorkspacePolicy";

export function useTeacherDashboardData() {
  return useQuery<TeacherDashboardData>({
    queryKey: ["teacher-dashboard"],
    queryFn: () => getTeacherDashboardData(),
    staleTime: REFRESH.URGENT,
    refetchInterval: REFRESH.URGENT,
  });
}

export function useTeacherDashboardBrief() {
  return useQuery<TeacherDashboardData["dailyBrief"]>({
    queryKey: ["teacher-dashboard", "brief"],
    queryFn: async () => {
      const data = await getTeacherDashboardData();
      return data.dailyBrief;
    },
    staleTime: REFRESH.BRIEF,
  });
}

export function useTeacherDashboardUrgent() {
  return useQuery<{
    immediateActions: TeacherDashboardData["immediateActions"];
    needsAttention: TeacherDashboardData["needsAttention"];
  }>({
    queryKey: ["teacher-dashboard", "urgent"],
    queryFn: () => getTeacherDashboardUrgentData(),
    staleTime: REFRESH.URGENT,
    refetchInterval: REFRESH.URGENT,
  });
}

export function useTeacherDashboardProjects() {
  return useQuery<TeacherDashboardData["projects"]>({
    queryKey: ["teacher-dashboard", "projects"],
    queryFn: async () => {
      const result = await getTeacherDashboardProjectsData();
      return result.projects;
    },
    staleTime: REFRESH.NORMAL,
    refetchInterval: REFRESH.NORMAL,
  });
}

export function useTeacherDashboardReviews() {
  return useQuery<TeacherDashboardData["upcomingReviews"]>({
    queryKey: ["teacher-dashboard", "reviews"],
    queryFn: async () => {
      const result = await getTeacherDashboardReviewsData();
      return result.upcomingReviews;
    },
    staleTime: REFRESH.NORMAL,
    refetchInterval: REFRESH.NORMAL,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export function useTogglePinProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => togglePinProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
  });
}

export function useDismissAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) => dismissAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teacher-dashboard", "urgent"],
      });
    },
  });
}

export function useRecordLastVisited() {
  return useMutation({
    mutationFn: () => recordLastVisited(),
    onSuccess: () => {
      // no invalidation needed — lastVisited is a background write
    },
  });
}
