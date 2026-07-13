"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherProjects,
  getStudentProjects,
  getProjectById,
  getTeacherDashboardStats,
  getStudentDashboardStats,
  getAllTags,
  requestProjectEdit,
  approveProjectEdit,
  rejectProjectEdit,
  requestProjectActivation,
  getPendingMembers,
} from "@/server/actions/projects";

export function useTeacherProjects(teacherId: string) {
  return useQuery({
    queryKey: ["projects", "teacher", teacherId],
    queryFn: async () => {
      const result = await getTeacherProjects(teacherId, { pageSize: 1000 });
      return result.data;
    },
    enabled: !!teacherId,
  });
}

export function useStudentProjects(studentId: string) {
  return useQuery({
    queryKey: ["projects", "student", studentId],
    queryFn: async () => {
      const result = await getStudentProjects(studentId, { pageSize: 1000 });
      return result.data;
    },
    enabled: !!studentId,
  });
}

export function useTeacherProjectsPaginated(
  teacherId: string,
  params: { page?: number; pageSize?: number; search?: string; status?: string; rblFilter?: string },
) {
  return useQuery({
    queryKey: ["teacher-projects", teacherId, params],
    queryFn: () => getTeacherProjects(teacherId, params),
    enabled: !!teacherId,
  });
}

export function useStudentProjectsPaginated(
  studentId: string,
  params: { page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: ["student-projects", studentId, params],
    queryFn: () => getStudentProjects(studentId, params),
    enabled: !!studentId,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectById(projectId),
    enabled: !!projectId,
  });
}

export function useTeacherDashboardStats(teacherId: string) {
  return useQuery({
    queryKey: ["dashboard", "teacher", teacherId],
    queryFn: () => getTeacherDashboardStats(teacherId),
    enabled: !!teacherId,
  });
}

export function useStudentDashboardStats(studentId: string) {
  return useQuery({
    queryKey: ["dashboard", "student", studentId],
    queryFn: () => getStudentDashboardStats(studentId),
    enabled: !!studentId,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => getAllTags(),
  });
}

export function usePendingMembers(projectId: string) {
  return useQuery({
    queryKey: ["pending-members", projectId],
    queryFn: async () => {
      const result = await getPendingMembers(projectId);
      if (!result.success) return [];
      return result.pending;
    },
    enabled: !!projectId,
  });
}

// --- New Mutations for Edit Request Feature ---

export function useRequestProjectEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof requestProjectEdit>[0]) =>
      requestProjectEdit(data),
    onSuccess: (_, variables) => {
      // Invalidate the specific project so the "Review Required" badge appears
      queryClient.invalidateQueries({
        queryKey: ["project", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "projects", "manage"],
      });
    },
  });
}

export function useApproveProjectEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => approveProjectEdit(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "projects", "manage"] });
    },
  });
}

export function useRejectProjectEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => rejectProjectEdit(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "projects", "manage"] });
    },
  });
}

export function useRequestProjectActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => requestProjectActivation(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "projects", "manage"] });
    },
  });
}