import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/coe-guard";

export default async function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePrincipal();
  } catch {
    redirect("/");
  }

  return <>{children}</>;
}
