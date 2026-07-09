import { requireHOD } from "@/lib/coe-guard";
import { getHODDashboardData } from "@/server/actions/hod-dashboard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import { Users, BookOpen, GraduationCap, Mail, Layers, CheckCircle, ListTodo, MessageSquare } from "lucide-react";
import { StatusBarChart, DomainPieChart, GuideLoadChart, MonthlyTrendChart } from "./HODCharts";

export default async function HODDashboardPage() {
  const data = await getHODDashboardData();
  const academicYear = getCurrentAcademicYear();

  const overviewCards = [
    { label: "Total Projects", value: data.totalProjects, icon: BookOpen, detail: `${data.activeProjects} active · ${data.completedProjects} completed` },
    { label: "Faculty Guides", value: data.guideCount, icon: Users, detail: `${data.guideLoad.length} assigned` },
    { label: "Students", value: data.studentCount, icon: GraduationCap, detail: `${data.divisionCount} divisions` },
    { label: "Tasks Completed", value: `${((data.completedTasks / (data.totalTasks || 1)) * 100).toFixed(0)}%`, icon: CheckCircle, detail: `${data.completedTasks} / ${data.totalTasks} tasks` },
    { label: "Reviews Conducted", value: data.totalReviews, icon: MessageSquare, detail: "Across all projects" },
    { label: "Pending Invitations", value: data.activeInvitations, icon: Mail, detail: "Faculty guide invites" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HOD Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {data.department} · Academic Year {academicYear}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-[2px] border border-border bg-card p-5 shadow-none">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{card.label}</p>
              <card.icon className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusBarChart data={data.statusBreakdown} />
        <DomainPieChart data={data.domainBreakdown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuideLoadChart data={data.guideLoad} />
        <MonthlyTrendChart data={data.projectTrend} />
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
