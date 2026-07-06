import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const user = await resolveUserFromHeaders(requestHeaders);
  if (!user) {
    redirect("https://tcetcercd.in/login?reason=session_expired");
  }

  // Redirect to role-based home
  return (
    <DashboardShell
      userId={user.id}
      userName={user.name ?? "User"}
      userRole={user.role}
      userImage={user.avatarUrl}
    >
      {children}
    </DashboardShell>
  );
}
