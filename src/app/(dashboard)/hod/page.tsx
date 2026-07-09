import { requireHOD } from "@/lib/coe-guard";
import { getHODDashboardData } from "@/server/actions/hod-dashboard";
import { getCurrentAcademicYear } from "@/lib/academic-year";

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
        <div className="rounded-[2px] border border-border bg-card p-6 shadow-none">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Projects</p>
          <p className="text-3xl font-bold mt-1">{data.projects.length}</p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-6 shadow-none">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Faculty Guides</p>
          <p className="text-3xl font-bold mt-1">{data.totalTeachers}</p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-6 shadow-none">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Students</p>
          <p className="text-3xl font-bold mt-1">{data.totalStudents}</p>
        </div>
        <div className="rounded-[2px] border border-border bg-card p-6 shadow-none">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Pending Invitations</p>
          <p className="text-3xl font-bold mt-1">{data.activeInvitations}</p>
        </div>
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
