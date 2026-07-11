import { redirect } from "next/navigation";
import { requireRole } from "@/lib/coe-guard";
import TeacherDashboardClient from "@/components/teacher/workspace/TeacherDashboardClient";
import { WorkLogModal } from "@/components/teacher/workspace/WorkLogModal";
import { hasSubmittedTodayLog } from "@/server/actions/faculty-work-log";

export default async function TeacherDashboardPage() {
  const user = await requireRole("TEACHER");
  const submitted = await hasSubmittedTodayLog();
  return (
    <>
      <WorkLogModal hasSubmittedToday={submitted} />
      <TeacherDashboardClient />
    </>
  );
}
