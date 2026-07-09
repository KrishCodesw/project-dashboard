import { requireHOD } from "@/lib/coe-guard";
import { getHODDashboardData } from "@/server/actions/hod-dashboard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import { Users, BookOpen, GraduationCap, Mail, Layers } from "lucide-react";

export default async function HODDashboardPage() {
  const user = await requireHOD();
  const data = await getHODDashboardData();
  const academicYear = getCurrentAcademicYear();

  const stats = [
    { label: "Projects", value: data.projects.length, icon: BookOpen },
    { label: "Faculty Guides", value: data.guideCount, icon: Users },
    { label: "Students", value: data.studentCount, icon: GraduationCap },
    { label: "Divisions", value: data.divisionCount, icon: Layers },
    { label: "Pending Invitations", value: data.activeInvitations, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HOD Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {data.department} · Academic Year {academicYear}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[2px] border border-border bg-card p-6 shadow-none">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
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
