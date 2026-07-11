import { redirect } from "next/navigation";
import { requireHOD } from "@/lib/coe-guard";

const isDevBypass =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_AUTH_BYPASS === "true";

export default async function HODLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dev bypass: skip guard — middleware already vets the role.
  // Guards in server actions still run (with env-var fallback).
  if (!isDevBypass) {
    try {
      await requireHOD();
    } catch {
      redirect("/teacher");
    }
  }

  return <>{children}</>;
}
