"use server";

import { prisma } from "@/lib/prisma";
import { requireHOD } from "@/lib/coe-guard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import { revalidatePath } from "next/cache";

export async function getHODDashboardData() {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const [projects, totalTeachers, totalStudents, activeInvitations, config] = await Promise.all([
    prisma.project.findMany({
      where: { department: dept },
      include: { _count: { select: { members: true, tasks: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.count({ where: { department: dept, role: "TEACHER", isActive: true } }),
    prisma.user.count({ where: { department: dept, role: "STUDENT", isActive: true } }),
    prisma.facultyGuideInvitation.count({ where: { department: dept, status: "PENDING" } }),
    prisma.departmentConfiguration.findFirst({
      where: { department: dept, isActive: true },
    }),
  ]);

  return {
    projects,
    totalTeachers,
    totalStudents,
    activeInvitations,
    config,
    department: dept,
  };
}

export async function getDepartmentGuides() {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const guides = await prisma.user.findMany({
    where: { department: dept, role: "TEACHER", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      _count: { select: { managedProjects: true } },
    },
    orderBy: { name: "asc" },
  });

  const pendingInvitations = await prisma.facultyGuideInvitation.findMany({
    where: { department: dept },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { guides, facultyGuides: guides, pendingInvitations, department: dept };
}

export async function inviteFacultyGuide(_prev: unknown, formData: FormData) {
  const user = await requireHOD();
  const dept = user.department ?? "";
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }
  const existing = await prisma.facultyGuideInvitation.findFirst({
    where: { email, department: dept, status: "PENDING" },
  });
  if (existing) {
    return { success: false, error: "An active invitation for this email already exists" };
  }
  await prisma.facultyGuideInvitation.create({
    data: { department: dept, email: email.toLowerCase().trim(), invitedByUserId: user.id },
  });
  revalidatePath("/hod/guides");
  return { success: true, error: null };
}

export async function cancelInvitation(invitationId: string) {
  await requireHOD();
  await prisma.facultyGuideInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/hod/guides");
}

export async function assignGuide(facultyUserId: string) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const targetUser = await prisma.user.findUnique({
    where: { id: facultyUserId },
    select: { department: true, role: true, isActive: true },
  });

  if (!targetUser || targetUser.role !== "TEACHER") {
    throw new Error("Faculty not found");
  }
  if (targetUser.department !== dept) {
    throw new Error("Cannot assign guide from a different department");
  }
  if (!targetUser.isActive) {
    throw new Error("Cannot assign inactive faculty as guide");
  }

  revalidatePath("/hod/guides");
  return { success: true };
}

export async function inviteGuide(email: string, name?: string) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const existing = await prisma.facultyGuideInvitation.findFirst({
    where: { email, status: "PENDING" },
  });
  if (existing) {
    throw new Error("An active invitation already exists for this email");
  }

  await prisma.facultyGuideInvitation.create({
    data: { department: dept, email, name, invitedByUserId: user.id },
  });

  revalidatePath("/hod/guides");
  return { success: true };
}

/**
 * Department Configuration
 * ──────────────────────
 * divisionCount:    Manual — reflects current divisions (A, B, C…).
 *                   Updated by HOD when department structure changes.
 * studentCount:     Manual — intended to become an automatically derived
 *                   count from synchronized COE student data in a future
 *                   release without schema changes. For now, HOD enters
 *                   it for capacity planning (guide-to-student ratios).
 * projectGroupCount:Manual — same future trajectory as studentCount.
 *                   May be auto-calculated from live project data when
 *                   department-wide project grouping is standardized.
 *
 * Ownership: HODs manage their department's config via the HOD
 * dashboard. Admins can override via direct DB access. COE Main
 * is NOT involved in department configuration — it lives entirely
 * on the Dashboard side.
 */
export async function getDepartmentConfiguration() {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const currentYear = getCurrentAcademicYear();

  const config = await prisma.departmentConfiguration.findUnique({
    where: { academicYear_department: { academicYear: currentYear, department: dept } },
  });

  return {
    config,
    divisionCount: config?.divisionCount ?? 0,
    studentCount: config?.studentCount ?? 0,
    projectGroupCount: config?.projectGroupCount ?? 0,
    updatedAt: config?.updatedAt ?? null,
    academicYear: currentYear,
    department: dept,
  };
}

export async function updateDepartmentConfiguration(_prev: unknown, formData: FormData) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");
  const divisionCount = parseInt(formData.get("divisionCount") as string, 10) || 0;
  const studentCount = parseInt(formData.get("studentCount") as string, 10) || 0;
  const projectGroupCount = parseInt(formData.get("projectGroupCount") as string, 10) || 0;
  const currentYear = getCurrentAcademicYear();
  await prisma.departmentConfiguration.upsert({
    where: { academicYear_department: { academicYear: currentYear, department: dept } },
    create: { academicYear: currentYear, department: dept, divisionCount, studentCount, projectGroupCount, configuredByUserId: user.id },
    update: { divisionCount, studentCount, projectGroupCount, configuredByUserId: user.id },
  });
  revalidatePath("/hod/configuration");
  return { success: true };
}

export async function updateDepartmentConfigurationJson(data: {
  divisionCount: number;
  studentCount: number;
  projectGroupCount: number;
  expectedUpdatedAt: string;
}) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");
  const currentYear = getCurrentAcademicYear();

  const existing = await prisma.departmentConfiguration.findUnique({
    where: { academicYear_department: { academicYear: currentYear, department: dept } },
  });

  if (existing && data.expectedUpdatedAt) {
    const expectedDate = new Date(data.expectedUpdatedAt);
    if (existing.updatedAt.getTime() !== expectedDate.getTime()) {
      throw new Error("Conflict: Department configuration was modified by another user. Please refresh and try again.");
    }
  }

  const config = await prisma.departmentConfiguration.upsert({
    where: { academicYear_department: { academicYear: currentYear, department: dept } },
    update: {
      divisionCount: data.divisionCount,
      studentCount: data.studentCount,
      projectGroupCount: data.projectGroupCount,
      configuredByUserId: user.id,
    },
    create: {
      academicYear: currentYear,
      department: dept,
      divisionCount: data.divisionCount,
      studentCount: data.studentCount,
      projectGroupCount: data.projectGroupCount,
      configuredByUserId: user.id,
    },
  });

  revalidatePath("/hod/configuration");
  return { success: true, config };
}
