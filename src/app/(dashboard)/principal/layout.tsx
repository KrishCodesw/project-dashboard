import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/coe-guard";

const isDevBypass =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_AUTH_BYPASS === "true";

export default async function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dev bypass: skip guard — middleware already vets the role.
  // Guards in server actions still run (with env-var fallback).
  if (!isDevBypass) {
    try {
      await requirePrincipal();
    } catch {
      redirect("/");
    }
  }

  return <>{children}</>;
}
