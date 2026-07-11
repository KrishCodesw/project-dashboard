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
  isHod?: boolean;
};

export type ResolvedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  isActive: boolean;
  avatarUrl: string | null;
  department?: string | null;
  uid?: string | null;
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
        isActive: true, avatarUrl: true, department: true, uid: true,
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

      // Handle isHod from sync payload
      if (input.isHod !== undefined) {
        updateData.isHod = input.isHod;
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
        // ponytail: existing.role was stale (pre-update); use mappedRole when role changed
        role: (existing.role !== mappedRole ? mappedRole : existing.role),
        isActive: input.status ? input.status === "ACTIVE" : existing.isActive,
        avatarUrl: existing.avatarUrl,
        department: existing.department,
        uid: existing.uid,
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
        isActive: true, avatarUrl: true, department: true, uid: true,
      },
    });

    // Resolve any pending project assignments for this email
    const pendingAssignments = await tx.pendingProjectAssignment.findMany({
      where: { email, status: "PENDING" },
      include: {
        project: {
          select: { id: true, title: true, status: true, teacherId: true },
        },
      },
    });

    // Filter out assignments for COMPLETED or ARCHIVED projects
    const BLOCKED_STATUSES = ["COMPLETED", "ARCHIVED"];
    const resolvable = pendingAssignments.filter(
      (a) => !BLOCKED_STATUSES.includes(a.project.status)
    );

    if (resolvable.length > 0) {
      const leadAssignments = resolvable.filter((a) => a.memberRole === "LEAD");
      for (const a of leadAssignments) {
        await tx.projectMember.updateMany({
          where: { projectId: a.projectId, role: "LEAD" },
          data: { role: "MEMBER" },
        });
      }

      await tx.projectMember.createMany({
        data: resolvable.map((a) => ({
          projectId: a.projectId,
          studentId: created.id,
          role: a.memberRole,
        })),
        skipDuplicates: true,
      });

      const resolvedIds = resolvable.map((a) => a.id);
      await tx.pendingProjectAssignment.updateMany({
        where: { id: { in: resolvedIds } },
        data: { status: "ASSIGNED" },
      });

      // Create in-app notifications for teachers and student
      const displayName = created.name || created.email;
      for (const assignment of resolvable) {
        // Notification for teacher
        await tx.notification.create({
          data: {
            userId: assignment.project.teacherId,
            type: "PROJECT_UPDATED",
            title: "Student registered and joined your project",
            message: `${displayName} has registered and been added to "${assignment.project.title}".`,
            link: `/teacher/projects/${assignment.projectId}`,
          },
        });

        // Notification for student
        await tx.notification.create({
          data: {
            userId: created.id,
            type: "PROJECT_UPDATED",
            title: "You've been added to a project",
            message: `You have been added to "${assignment.project.title}".`,
            link: `/student/projects/${assignment.projectId}`,
          },
        });
      }
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

/**
 * COE Main API URL and sync secret for on-demand user lookups.
 */
const COE_MAIN_URL = process.env.COE_MAIN_URL?.replace(/\/+$/, "");
const SYNC_SECRET = process.env.SYNC_SECRET;

/**
 * Result of a COE Main user lookup.
 */
export type CoeUserLookupResult = {
  name: string;
  email: string;
  uid: string | null;
  role: string;
  status: string;
};

/**
 * Fetches a user from COE Main by UID.
 *
 * Returns the user data if found, or null if the user does not exist
 * (COE returned 404). Throws on network errors / timeouts / 5xx so the
 * caller can distinguish "not found" from "temporarily unavailable".
 */
export async function fetchUserFromCOE(
  uid: string
): Promise<CoeUserLookupResult | null> {
  if (!COE_MAIN_URL || !SYNC_SECRET) {
    console.warn(
      "[fetchUserFromCOE] COE_MAIN_URL or SYNC_SECRET not configured — cannot look up",
      uid
    );
    return null;
  }

  const url = `${COE_MAIN_URL}/api/internal/users/lookup?uid=${encodeURIComponent(uid)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "x-sync-secret": SYNC_SECRET },
    // 5-second timeout so the caller can surface "try again later"
    signal: AbortSignal.timeout(5000),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `COE Main lookup failed (${response.status}): ${response.statusText}`
    );
  }

  const body = await response.json();
  if (!body?.success || !body?.data) {
    return null;
  }

  return {
    name: body.data.name,
    email: body.data.email,
    uid: body.data.uid,
    role: body.data.role,
    status: body.data.status,
  };
}

/**
 * Resolves a student by UID through the cache-then-source chain:
 *
 *   1. Look up in Dashboard DB.
 *   2. If found → return immediately (fast path).
 *   3. If not found → fetch from COE Main.
 *   4. If COE has the user → upsert into Dashboard DB → return.
 *   5. If COE doesn't have the user → return null.
 *
 * This lets the Dashboard DB behave as a cache while COE Main remains
 * the system of record. Every student lookup path should call this
 * instead of querying the Dashboard DB directly.
 *
 * @returns The resolved user, or null if the student was not found in
 *          either the Dashboard DB or COE Main.
 * @throws  If COE Main is reachable but returns an error, or if the
 *          network request times out — the caller should surface
 *          "Unable to verify student. Try again later."
 */
export async function resolveStudent(
  uid: string
): Promise<ResolvedUser | null> {
  // Step 1: check the local cache (Dashboard DB)
  const local = await prisma.user.findFirst({
    where: {
      role: "STUDENT",
      OR: [{ uid }, { id: uid }],
    },
    select: {
      id: true, name: true, email: true, role: true,
      isActive: true, avatarUrl: true,
    },
  });
  if (local) return local;

  // Step 2: fetch from COE Main (the source of truth)
  const coeUser = await fetchUserFromCOE(uid);
  if (!coeUser) return null;

  // Step 3: upsert into Dashboard DB (warm the cache)
  return upsertDashboardUser({
    email: coeUser.email,
    name: coeUser.name,
    role: coeUser.role,
    status: coeUser.status,
    uid: coeUser.uid ?? undefined,
  });
}
