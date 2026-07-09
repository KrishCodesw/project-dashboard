import { FolderKanban, Users, GraduationCap, Mail } from "lucide-react";
import { requireHOD } from "@/lib/coe-guard";
import { getHODDashboardData } from "@/server/actions/hod-dashboard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import { StatCard } from "@/components/dashboard/StatCard";

export default async function HODDashboardPage() {
  const user = await requireHOD();
  const data = await getHODDashboardData();
  const academicYear = getCurrentAcademicYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HOD Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {data.department} · Academic Year {academicYear}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Projects"
          value={data.projects.length}
          icon={FolderKanban}
          color="indigo"
        />
        <StatCard
          title="Faculty Guides"
          value={data.totalTeachers}
          icon={GraduationCap}
          color="violet"
        />
        <StatCard
          title="Students"
          value={data.totalStudents}
          icon={Users}
          color="emerald"
        />
        <StatCard
          title="Pending Invitations"
          value={data.activeInvitations}
          icon={Mail}
          color="amber"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Department Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">
              No projects found for this department.
            </p>
          ) : (
            data.projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[2px] border border-border bg-card p-5"
              >
                <h3 className="text-sm font-medium truncate">
                  {project.title}
                </h3>
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                  {project.domain}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Members: {project._count.members}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
