import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { prisma } from "@/lib/prisma";
import { isPrincipal } from "@/lib/principal";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const user = await resolveUserFromHeaders(requestHeaders);

  const isSupportEnabled = process.env.SUPPORT_ENABLED === "true";
  if (!user) {
    redirect("https://tcetcercd.in/login?reason=session_expired");
  }

  let isHod = requestHeaders.get("x-coe-ishod") === "true";
  if (!isHod && user.role === "TEACHER") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isHod: true },
    });
    isHod = dbUser?.isHod ?? false;
  }

  const isUserPrincipal = requestHeaders.get("x-coe-isprincipal") === "true" || isPrincipal(user.email);

  return (
    <DashboardShell
      userId={user.id}
      userName={user.name ?? "User"}
      userRole={user.role}
      userImage={user.avatarUrl}
      userIsHod={isHod}
      userIsPrincipal={isUserPrincipal}
      isSupportEnabled={isSupportEnabled}
    >
      {children}
    </DashboardShell>
  );
}
