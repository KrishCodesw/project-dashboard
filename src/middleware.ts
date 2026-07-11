import { verifyCoEToken } from "@/lib/coe-auth";
import { NextResponse, type NextRequest } from "next/server";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isShowcaseAuthorRoute = pathname.startsWith("/showcase/my-projects");
  const isPublicShowcase = pathname.startsWith("/showcase") && !isShowcaseAuthorRoute;
  const isPublicRoute =
    isPublicShowcase ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/majorprojects") ||
    pathname.startsWith("/rblprojects-te") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/storage") ||
    pathname.startsWith("/api/internal") ||
    pathname.startsWith("/api/webhooks");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const isDevAuthBypassEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.DEV_AUTH_BYPASS === "true";

  if (isDevAuthBypassEnabled) {
    const headers = new Headers(req.headers);
    const allowedRoles = ["ADMIN", "TEACHER", "STUDENT", "HOD", "PRINCIPAL"] as const;
    type Role = (typeof allowedRoles)[number];
    const coeRoleMap: Record<Role, "ADMIN" | "FACULTY" | "STUDENT"> = {
      ADMIN: "ADMIN",
      TEACHER: "FACULTY",
      STUDENT: "STUDENT",
      HOD: "FACULTY",
      PRINCIPAL: "ADMIN",
    };

    // Prefer explicit query param, otherwise fall back to persisted dev cookie
    const roleParam = req.nextUrl.searchParams.get("role");
    const cookieRole = req.cookies.get("dev_auth_role")?.value;
    let role: Role = "ADMIN";
    if (roleParam && allowedRoles.includes(roleParam as Role)) {
      role = roleParam as Role;
    } else if (cookieRole && allowedRoles.includes(cookieRole as Role)) {
      role = cookieRole as Role;
    }

    const emailMap: Record<Role, string | undefined> = {
      ADMIN: process.env.DEV_AUTH_ADMIN_EMAIL,
      TEACHER: process.env.DEV_AUTH_TEACHER_EMAIL,
      STUDENT: process.env.DEV_AUTH_STUDENT_EMAIL,
      HOD: process.env.DEV_AUTH_HOD_EMAIL,
      PRINCIPAL: process.env.DEV_AUTH_PRINCIPAL_EMAIL,
    };

    const email = emailMap[role];
    if (!email) {
      throw new Error(`DEV_AUTH: Missing email for role ${role}`);
    }

    headers.set("x-coe-email", email);
    headers.set("x-coe-name", "Dev User");
    headers.set("x-coe-role", coeRoleMap[role]);
    headers.set("x-coe-status", "ACTIVE");

    if (role === "HOD") {
      headers.set("x-coe-ishod", "true");
    }
    if (role === "PRINCIPAL") {
      headers.set("x-coe-isprincipal", "true");
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[DEV AUTH] Injected headers:", {
        email,
        role,
        coeRole: coeRoleMap[role],
        pathname: req.nextUrl.pathname,
        hasIshod: role === "HOD" ? "set" : "not_set",
        hasIsprincipal: role === "PRINCIPAL" ? "set" : "not_set",
      });
    }

    // Persist the chosen role into a cookie for all dev requests
    // This ensures server actions and subsequent requests maintain the role
    const response = NextResponse.next({ request: { headers } });
    response.cookies.set("dev_auth_role", role, { 
      path: "/", 
      maxAge: 60 * 60 * 24 * 7, // 7-day TTL for convenience during local dev
    });
    return response;
  }

  const token = req.cookies.get("coe_shared_token")?.value;
  if (!token) {
    const loginUrl = new URL("http://tcetcercd.in/login");
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyCoEToken(token);
  if (!payload || payload.status !== "ACTIVE") {
    const loginUrl = new URL("https://tcetcercd.in/login");
    loginUrl.searchParams.set("reason", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-coe-email", payload.email);
  requestHeaders.set("x-coe-name", payload.name || "");
  requestHeaders.set("x-coe-role", payload.role);
  requestHeaders.set("x-coe-status", payload.status);

  // Strip dev-bypass-only headers in the real auth path so clients can't spoof them
  requestHeaders.delete("x-coe-ishod");
  requestHeaders.delete("x-coe-isprincipal");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher:"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)).*)",
};