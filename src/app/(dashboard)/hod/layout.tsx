import { redirect } from "next/navigation";
import { requireHOD } from "@/lib/coe-guard";

export default async function HODLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireHOD();
  } catch {
    redirect("/teacher");
  }

  return <>{children}</>;
}
