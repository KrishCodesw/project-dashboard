"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/coe-guard";
import { z } from "zod";
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

  const validated = createUserSchema.parse(data);
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
