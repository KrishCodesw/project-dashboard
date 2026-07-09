import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { isPrincipal } from "@/lib/principal";

export default async function DashboardRootPage() {
  const requestHeaders = await headers();
  const user = await resolveUserFromHeaders(requestHeaders);
  if (!user) {
    redirect("https://tcetcercd.in/login?reason=session_expired");
  }

  if (isPrincipal(user.email)) {
    redirect("/principal");
  }

  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "TEACHER") redirect("/teacher");
  if (user.role === "STUDENT") redirect("/student");

  redirect("/");
}
