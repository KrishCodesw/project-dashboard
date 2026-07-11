import { headers } from "next/headers";
import { resolveUserFromHeaders, getCoeAuthFromHeaders } from "@/lib/resolve-user";
import { mapCoERoleToDashboard } from "@/lib/coe-auth";
import { prisma } from "@/lib/prisma";
import { isPrincipal } from "@/lib/principal";

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
  if (!authUser) throw new Error("Unauthorized");

  const mapped = mapCoERoleToDashboard(authUser.role);
  if (mapped !== "TEACHER") throw new Error("Unauthorized");

  // Dev bypass: x-coe-ishod is injected by middleware when DEV_AUTH_BYPASS is active
  // and stripped in the real auth path to prevent spoofing
  if (requestHeaders.get("x-coe-ishod") === "true") {
    const user = await resolveUserFromHeaders(requestHeaders);
    if (!user) throw new Error("Unauthorized");
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

  // Dev bypass: x-coe-isprincipal is injected by middleware when DEV_AUTH_BYPASS is active
  // and stripped in the real auth path to prevent spoofing
  if (requestHeaders.get("x-coe-isprincipal") !== "true" && !isPrincipal(authUser.email)) {
    throw new Error("Unauthorized");
  }

  const user = await resolveUserFromHeaders(requestHeaders);
  if (!user) throw new Error("Unauthorized");
  return user;
}