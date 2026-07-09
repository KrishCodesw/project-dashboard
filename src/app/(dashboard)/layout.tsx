import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { prisma } from "@/lib/prisma";
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

  let isHod = false;
  if (user.role === "TEACHER") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isHod: true },
    });
    isHod = dbUser?.isHod ?? false;
  }

  return (
    <DashboardShell
      userId={user.id}
      userName={user.name ?? "User"}
      userRole={user.role}
      userImage={user.avatarUrl}
      userIsHod={isHod}
    >
      {children}
    </DashboardShell>
  );
}
