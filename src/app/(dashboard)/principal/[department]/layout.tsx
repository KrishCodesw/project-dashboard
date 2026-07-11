import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/coe-guard";

export default async function PrincipalDeptLayout({ children }: { children: React.ReactNode }) {
  try { await requirePrincipal(); } catch { redirect("/dashboard"); }
  return <>{children}</>;
}
