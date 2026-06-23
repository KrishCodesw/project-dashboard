import { prisma } from "@/lib/prisma";
import { mapCoERoleToDashboard } from "@/lib/coe-auth";

export type CoeAuthUser = {
  email: string;
  name?: string;
  role: string;
  status: string;
  department?: string | null;
  uid?: string | null;
};

export type SyncUserInput = {
  email: string;
  name?: string;
  role: string;
  department?: string | null;
  uid?: string | null;
  status: string;
  isActive?: boolean;
};

type ResolvedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  avatarUrl: string | null;
};

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function defaultName(email: string) {
  const localPart = email.split("@")[0];
  return localPart?.trim() || email;
}

/**
 * Core upsert logic shared between lazy provisioning (resolveUser) and
 * the internal sync endpoint (POST /api/internal/users/upsert).
 *
 * - Normalises email
 * - Maps COE role to dashboard role
 * - Upserts user by email (idempotent)
 * - Resolves pending project assignments for new users
 * - Returns the resolved user or null if role is unsupported
 */
export async function upsertDashboardUser(input: SyncUserInput): Promise<ResolvedUser | null> {
  const mappedRole = mapCoERoleToDashboard(input.role);
  if (!mappedRole) return null;

  const email = normalizeEmail(input.email);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, avatarUrl: true, department: true,
      },
    });

    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (input.name && existing.name !== input.name) updateData.name = input.name;
      if (existing.role !== mappedRole) updateData.role = mappedRole;
      if (input.department !== undefined && existing.department !== input.department) {
        updateData.department = input.department;
      }
      if (input.isActive !== undefined && existing.isActive !== input.isActive) {
        updateData.isActive = input.isActive;
      }

      // Only overwrite uid when source provides a non-null value
      // (prevents erasing existing data with empty sync payloads)
      if (input.uid !== undefined && input.uid !== null) {
        updateData.uid = input.uid;
      }

      // Derive isActive from COE status: ACTIVE → true, anything else → false
      if (input.status) {
        updateData.isActive = input.status === "ACTIVE";
      }

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      return {
        id: existing.id,
        name: input.name || existing.name,
        email: existing.email,
        role: existing.role,
        isActive: input.status ? input.status === "ACTIVE" : existing.isActive,
        avatarUrl: existing.avatarUrl,
      };
    }

    // Only create if status is ACTIVE
    if (input.status !== "ACTIVE") return null;

    const created = await tx.user.create({
      data: {
        name: input.name || defaultName(email),
        email,
        role: mappedRole,
        isActive: input.status === "ACTIVE",
        passwordHash: "",
        department: input.department ?? null,
        uid: input.uid ?? null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, avatarUrl: true,
      },
    });

    // Resolve any pending project assignments for this email
    const pendingAssignments = await tx.pendingProjectAssignment.findMany({
      where: { email, status: "PENDING" },
      select: { projectId: true, memberRole: true },
    });

    if (pendingAssignments.length > 0) {
      await tx.projectMember.createMany({
        data: pendingAssignments.map((a) => ({
          projectId: a.projectId,
          studentId: created.id,
          role: a.memberRole,
        })),
        skipDuplicates: true,
      });

      await tx.pendingProjectAssignment.updateMany({
        where: { email, status: "PENDING" },
        data: { status: "ASSIGNED" },
      });
    }

    return created;
  });
}

/**
 * Lazy-provisions a user from CoE auth headers.
 * Called when a user visits the dashboard for the first time.
 * This is the FALLBACK — it remains untouched as a safety net.
 */
export async function resolveUser(authUser: CoeAuthUser): Promise<ResolvedUser | null> {
  if (authUser.status !== "ACTIVE") return null;
  return upsertDashboardUser({
    email: authUser.email,
    name: authUser.name,
    role: authUser.role,
    status: authUser.status,
    department: authUser.department,
    uid: authUser.uid,
  });
}

export function getCoeAuthFromHeaders(requestHeaders: Headers): CoeAuthUser | null {
  const email = requestHeaders.get("x-coe-email");
  const name = requestHeaders.get("x-coe-name") || undefined;
  const role = requestHeaders.get("x-coe-role");
  const status = requestHeaders.get("x-coe-status");

  if (!email || !role || !status) return null;

  return { email, name, role, status };
}

export async function resolveUserFromHeaders(
  requestHeaders: Headers
): Promise<ResolvedUser | null> {
  const authUser = getCoeAuthFromHeaders(requestHeaders);
  if (!authUser) return null;
  return resolveUser(authUser);
}

// Re-export for convenience
export { mapCoERoleToDashboard } from "@/lib/coe-auth";
