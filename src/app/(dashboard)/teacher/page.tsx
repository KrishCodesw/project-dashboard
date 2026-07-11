import TeacherDashboardClient from "@/components/teacher/workspace/TeacherDashboardClient";
import { WorkLogModal } from "@/components/teacher/workspace/WorkLogModal";
import { hasSubmittedTodayLog } from "@/server/actions/faculty-work-log";

export default async function TeacherDashboardPage() {
  const submitted = await hasSubmittedTodayLog();
  return (
    <>
      <WorkLogModal hasSubmittedToday={submitted} />
      <TeacherDashboardClient />
    </>
  );
}
