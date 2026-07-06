import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { DashboardShell } from "./DashboardShell";

type ImpersonationSessionInfo = {
  sessionId: string;
  impersonatedBy: { name: string; email: string };
  impersonatingAs: { name: string; email: string; role: string; uid?: string };
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();

  // Impersonation detection
  const isImpersonating =
    requestHeaders.get("x-coe-impersonating") === "true";

  let impersonationSessionInfo: ImpersonationSessionInfo | null = null;

  if (isImpersonating) {
    try {
      const cookie = requestHeaders.get("cookie") || "";
      const response = await fetch(
        "https://tcetcercd.in/api/admin/impersonate/session-info",
        {
          headers: { cookie },
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        },
      );
      if (response.ok) {
        const body = await response.json();
        if (body.success && body.data) {
          impersonationSessionInfo = body.data;
        }
      }
    } catch {
      // API unavailable — show minimal banner without details
    }
  }

  const user = await resolveUserFromHeaders(requestHeaders);
  if (!user) {
    redirect("https://tcetcercd.in/login?reason=session_expired");
  }

  return (
    <DashboardShell
      userId={user.id}
      userName={user.name ?? "User"}
      userRole={user.role}
      userImage={user.avatarUrl}
      isImpersonating={isImpersonating}
      impersonationSessionInfo={impersonationSessionInfo}
    >
      {children}
    </DashboardShell>
  );
}
