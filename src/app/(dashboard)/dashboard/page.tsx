import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCoeAuthFromHeaders } from "@/lib/resolve-user";
import { isPrincipal } from "@/lib/principal";

type Role = "ADMIN" | "TEACHER" | "STUDENT" | "HOD";

export default async function DashboardEntry({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const roleParam = (params.role || "").toUpperCase();

  const requestHeaders = await headers();
  const authUser = getCoeAuthFromHeaders(requestHeaders);
  if (authUser?.email && isPrincipal(authUser.email)) {
    redirect("/principal");
  }

  // Handle HOD specifically
  if (roleParam === "HOD") {
    redirect("/hod?role=HOD");
  }

  const role: Role =
    roleParam === "TEACHER" || roleParam === "STUDENT" || roleParam === "ADMIN"
      ? (roleParam as Role)
      : "ADMIN";

  if (role === "TEACHER") {
    redirect("/teacher?role=TEACHER");
  }

  if (role === "STUDENT") {
    redirect("/student?role=STUDENT");
  }

  redirect("/admin?role=ADMIN");
}
