import { headers, cookies } from "next/headers";
import { resolveUserFromHeaders, getCoeAuthFromHeaders } from "@/lib/resolve-user";
import { mapCoERoleToDashboard } from "@/lib/coe-auth";
import { prisma } from "@/lib/prisma";
import { isPrincipal } from "@/lib/principal";

/** Whether the dev auth bypass is active — checked server-side so it's never lost. */
const isDevBypass = (): boolean =>
  process.env.NODE_ENV === "development" || process.env.DEV_AUTH_BYPASS === "true";

export type DashboardRole = "ADMIN" | "TEACHER" | "STUDENT";

export async function getCoeUser() {
  const requestHeaders = await headers();
  return resolveUserFromHeaders(requestHeaders);
}

export async function requireCoeUser() {
  const user = await getCoeUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(role: DashboardRole | DashboardRole[]) {
  const user = await requireCoeUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireHOD() {
  const requestHeaders = await headers();
  const authUser = getCoeAuthFromHeaders(requestHeaders);
  if (!authUser) {
    console.log("[DEV AUTH] requireHOD: NO AUTH USER (headers missing) - x-coe-email:", requestHeaders.get("x-coe-email"), "x-coe-role:", requestHeaders.get("x-coe-role"));
    throw new Error("Unauthorized");
  }

  const mapped = mapCoERoleToDashboard(authUser.role);
  if (mapped !== "TEACHER") throw new Error("Unauthorized");

  if (isDevBypass()) {
    console.log("[DEV AUTH] requireHOD: bypass active, resolving user from headers");
    const user = await resolveUserFromHeaders(requestHeaders);
    if (!user) {
      console.log("[DEV AUTH] requireHOD: resolveUserFromHeaders returned null");
      throw new Error("Unauthorized");
    }
    console.log("[DEV AUTH] requireHOD: success, user role:", user.role, "dept:", user.department);
    return user;
  }

  const user = await prisma.user.findUnique({
    where: { email: authUser.email.toLowerCase().trim() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isHod: true,
    },
  });
  if (!user || !user.isHod) throw new Error("Unauthorized");

  return user;
}

export async function requirePrincipal() {
  const requestHeaders = await headers();
  const authUser = getCoeAuthFromHeaders(requestHeaders);
  if (!authUser) throw new Error("Unauthorized");

  if (authUser.status !== "ACTIVE") throw new Error("Unauthorized");

  // Dev bypass: skip the PRINCIPAL_EMAILS check. The middleware has already vetted the
  // role, and the env-var check is server-side (never lost across redirects).
  if (!isDevBypass() && !isPrincipal(authUser.email)) {
    throw new Error("Unauthorized");
  }

  const user = await resolveUserFromHeaders(requestHeaders);
  if (!user) throw new Error("Unauthorized");
  return user;
}