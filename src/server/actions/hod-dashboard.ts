"use server";

import { prisma } from "@/lib/prisma";
import { requireHOD } from "@/lib/coe-guard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getHODDashboardData() {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const [projects, guideCount, activeInvitations, config] = await Promise.all([
    prisma.project.findMany({
      where: { department: dept },
      include: { _count: { select: { members: true, tasks: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.departmentGuide.count({ where: { department: dept } }),
    prisma.facultyGuideInvitation.count({ where: { department: dept, status: "PENDING" } }),
    prisma.departmentConfiguration.findFirst({
      where: { department: dept, isActive: true },
    }),
  ]);

  return {
    projects,
    guideCount,
    config,
    activeInvitations,
    studentCount: config?.studentCount ?? 0,
    projectGroupCount: config?.projectGroupCount ?? 0,
    divisionCount: config?.divisionCount ?? 0,
    department: dept,
  };
}

export async function getDepartmentGuides() {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const assignments = await prisma.departmentGuide.findMany({
    where: { department: dept },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, isActive: true,
          _count: { select: { managedProjects: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const guides = assignments.map((a) => ({ ...a.user }));
  const pendingInvitations = await prisma.facultyGuideInvitation.findMany({
    where: { department: dept },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { guides, facultyGuides: guides, pendingInvitations, department: dept };
}

export async function inviteFacultyGuide(formData: FormData) {
  const user = await requireHOD();
  const dept = user.department ?? "";
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  const existing = await prisma.facultyGuideInvitation.findFirst({
    where: { email, department: dept, status: "PENDING" },
  });
  if (existing) {
    throw new Error("An active invitation for this email already exists");
  }
  await prisma.facultyGuideInvitation.create({
    data: { department: dept, email: email.toLowerCase().trim(), invitedByUserId: user.id },
  });
  sendEmail({
    to: email,
    subject: `Faculty Guide Invitation — ${dept}`,
    html: `<p>You have been invited to become a faculty guide for <strong>${dept}</strong>.</p><p>Please log in to the Academic Project Dashboard to accept or decline this invitation.</p>`,
  }).catch(() => console.warn("[hod] Failed to send invitation email, but invitation was created."));
  revalidatePath("/hod/guides");
}

export async function cancelInvitation(formData: FormData) {
  await requireHOD();
  const invitationId = formData.get("invitationId") as string;
  if (!invitationId) throw new Error("Missing invitationId");
  await prisma.facultyGuideInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/hod/guides");
}

export async function removeGuide(formData: FormData) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");
  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Missing userId");
  await prisma.departmentGuide.deleteMany({
    where: { userId, department: dept },
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

export async function assignGuideByEmail(email: string) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");

  const targetUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, department: true, role: true, isActive: true },
  });

  if (!targetUser) {
    throw new Error("USER_NOT_FOUND");
  }
  if (targetUser.role !== "TEACHER") {
    throw new Error("User is not a faculty member");
  }
  if (targetUser.department !== dept) {
    throw new Error("Cannot assign guide from a different department");
  }
  if (!targetUser.isActive) {
    throw new Error("Cannot assign inactive faculty as guide");
  }

  revalidatePath("/hod/guides");
  return { success: true, userId: targetUser.id };
}

export async function searchFaculty(query: string) {
  if (!query || query.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      email: { contains: query },
    },
    select: { id: true, name: true, email: true, department: true },
    take: 10,
    orderBy: { email: "asc" },
  });
  return users;
}

export async function addGuide(formData: FormData) {
  const user = await requireHOD();
  const dept = user.department;
  if (!dept) throw new Error("HOD has no department assigned");
  const email = (formData.get("email") as string || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return redirect("/hod/guides?msg=invalid_email");
  }

  const existingUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true, role: true, isActive: true },
  });

  if (existingUser) {
    if (existingUser.role !== "TEACHER") {
      return redirect("/hod/guides?msg=not_teacher");
    }
    if (!existingUser.isActive) {
      return redirect("/hod/guides?msg=inactive");
    }
    const existingAssignment = await prisma.departmentGuide.findUnique({
      where: { userId_department: { userId: existingUser.id, department: dept } },
    });
    if (existingAssignment) {
      return redirect("/hod/guides?msg=already_guide");
    }
    await prisma.departmentGuide.create({
      data: { userId: existingUser.id, department: dept, addedById: user.id },
    });
    return redirect("/hod/guides?msg=assigned");
  }

  const pending = await prisma.facultyGuideInvitation.findFirst({
    where: { email, department: dept, status: "PENDING" },
  });
  if (pending) {
    return redirect("/hod/guides?msg=already_invited");
  }

  await prisma.facultyGuideInvitation.create({
    data: { department: dept, email, invitedByUserId: user.id },
  });
  sendEmail({
    to: email,
    subject: `Faculty Guide Invitation — ${dept}`,
    html: `<p>You have been invited to become a faculty guide for <strong>${dept}</strong>.</p><p>Please log in to the Academic Project Dashboard to accept or decline this invitation.</p>`,
  }).catch(() => console.warn("[hod] Failed to send invitation email, but invitation was created."));
  redirect("/hod/guides?msg=invited");
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

export async function updateDepartmentConfiguration(formData: FormData) {
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
