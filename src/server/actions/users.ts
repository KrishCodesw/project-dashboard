"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { z } from "zod";
import { parseOrThrow } from "@/lib/zod-utils";
import { revalidatePath } from "next/cache";
import type { PaginatedResult } from "@/lib/pagination";
import { buildPagination } from "@/lib/pagination";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
  department: z.string().optional(),
  rollNumber: z.string().optional(),
});

export async function createUser(data: z.infer<typeof createUserSchema>) {
  await requireRole("ADMIN");

  const validated = parseOrThrow(createUserSchema, data);
  const existing = await prisma.user.findUnique({ where: { email: validated.email } });
  if (existing) throw new Error("Email already exists");

  const user = await prisma.user.create({
    data: {
      name: validated.name,
      email: validated.email,
      passwordHash: "",
      role: validated.role,
      department: validated.department,
      rollNumber: validated.rollNumber,
    },
  });

  revalidatePath("/admin/users");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function toggleUserActive(userId: string) {
  await requireRole("ADMIN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/admin/users");
}

export async function getUsers(
  role?: string,
  params?: { page?: number; pageSize?: number; search?: string },
): Promise<PaginatedResult<any>> {
  await requireRole("ADMIN");

  const { page, pageSize, skip, take } = buildPagination({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 50,
  });

  const where: any = {};
  if (role) where.role = role;
  if (params?.search) {
    const q = params.search.toLowerCase();
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        rollNumber: true,
        isActive: true,
        createdAt: true,
        _count: { select: { memberships: true, managedProjects: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUserCounts() {
  await requireRole("ADMIN");
  const [total, students, teachers, admins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  return { total, students, teachers, admins };
}

export async function getStudents() {
  return prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      rollNumber: true,
      department: true,
      avatarUrl: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getTeachers() {
  return prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getPendingTeacherRegistrations() {
  await requireRole("ADMIN");

  return prisma.user.findMany({
    where: {
      role: "TEACHER",
      isActive: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveTeacherRegistration(userId: string) {
  await requireRole("ADMIN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "TEACHER") {
    throw new Error("Teacher registration not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });

  revalidatePath("/admin/teacher-approvals");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function rejectTeacherRegistration(userId: string) {
  await requireRole("ADMIN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "TEACHER") {
    throw new Error("Teacher registration not found");
  }

  if (user.isActive) {
    throw new Error("Active teachers cannot be rejected from this panel");
  }

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/teacher-approvals");
  revalidatePath("/admin/users");
  return { ok: true };
}

export type AdminDashboardStats = {
  userCounts: { total: number; students: number; teachers: number; admins: number };
  projectsByStatus: Array<{ status: string; count: number }>;
  projectsByDepartment: Array<{ department: string; count: number }>;
  taskStatusDistribution: Array<{ status: string; count: number }>;
  milestoneStats: { total: number; completed: number; overdue: number };
  reviewStats: { total: number; scheduled: number; completed: number };
  publicationCount: number;
  showcaseCount: number;
  pendingShowcaseCount: number;
  projectsOverdue: number;
  totalProjectMembers: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await requireRole("ADMIN");

  const now = new Date();

  const [
    userCounts,
    projectsByStatus,
    projectsByDepartment,
    taskStatusDistribution,
    milestoneStats,
    reviewStats,
    publicationCount,
    showcaseCount,
    pendingShowcaseCount,
    overdueProjects,
    totalProjectMembers,
  ] = await Promise.all([
    (async () => ({
      total: await prisma.user.count(),
      students: await prisma.user.count({ where: { role: "STUDENT" } }),
      teachers: await prisma.user.count({ where: { role: "TEACHER" } }),
      admins: await prisma.user.count({ where: { role: "ADMIN" } }),
    }))(),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.project.groupBy({ by: ["department"], _count: true, orderBy: { _count: { department: "desc" } }, take: 10 }),
    prisma.task.groupBy({ by: ["status"], _count: true }),
    (async () => {
      const total = await prisma.milestone.count();
      const completed = await prisma.milestone.count({ where: { isCompleted: true } });
      const overdue = await prisma.milestone.count({ where: { isCompleted: false, dueDate: { lt: now } } });
      return { total, completed, overdue };
    })(),
    (async () => {
      const total = await prisma.review.count();
      const scheduled = await prisma.review.count({ where: { status: "SCHEDULED" } });
      const completed = await prisma.review.count({ where: { status: "COMPLETED" } });
      return { total, scheduled, completed };
    })(),
    prisma.publication.count(),
    prisma.showcaseProject.count(),
    prisma.showcaseProject.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"] } } }),
    prisma.project.count({ where: { status: { notIn: ["COMPLETED", "ARCHIVED"] }, endDate: { lt: now } } }),
    prisma.projectMember.count(),
  ]);

  return {
    userCounts,
    projectsByStatus: projectsByStatus.map((p) => ({ status: p.status, count: p._count })),
    projectsByDepartment: projectsByDepartment.map((p) => ({ department: p.department ?? "Unassigned", count: p._count })),
    taskStatusDistribution: taskStatusDistribution.map((t) => ({ status: t.status, count: t._count })),
    milestoneStats,
    reviewStats,
    publicationCount,
    showcaseCount,
    pendingShowcaseCount,
    projectsOverdue: overdueProjects,
    totalProjectMembers,
  };
}
