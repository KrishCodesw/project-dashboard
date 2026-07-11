import { notFound } from "next/navigation";
import { requirePrincipal } from "@/lib/coe-guard";
import { getDepartmentDrilldown } from "@/server/actions/principal-dashboard";
import { getCurrentAcademicYear } from "@/lib/academic-year";
import Link from "next/link";
import {
  ArrowLeft, Users, BookOpen, GraduationCap,
  CheckCircle, MessageSquare, Layers, TrendingUp,
} from "lucide-react";
import {
  StatusBarChart,
  DomainPieChart,
  GuideLoadChart,
  MonthlyTrendChart,
} from "../../hod/HODCharts";

interface PageProps {
  params: Promise<{ department: string }>;
}

export default async function PrincipalDeptDrilldownPage({ params }: PageProps) {
  await requirePrincipal();
  const { department: enc } = await params;
  const dept = decodeURIComponent(enc);

  let data;
  try { data = await getDepartmentDrilldown(dept); }
  catch { notFound(); }

  const academicYear = getCurrentAcademicYear();
  const taskPct = data.totalTasks > 0
    ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;

  const kpis = [
    { label: "Total Projects",  value: data.totalProjects,   icon: BookOpen,       detail: `${data.activeProjects} active · ${data.completedProjects} done` },
    { label: "Faculty Guides",  value: data.guideCount,      icon: Users,          detail: "Assigned guides" },
    { label: "Students (Cfg)",  value: data.studentCount,    icon: GraduationCap,  detail: `${data.divisionCount} divisions` },
    { label: "Total Intake",    value: data.totalIntake || "—", icon: Layers,      detail: "Sanctioned strength" },
    { label: "Task Completion", value: `${taskPct}%`,        icon: CheckCircle,    detail: `${data.completedTasks} / ${data.totalTasks} done` },
    { label: "Reviews",         value: data.totalReviews,    icon: MessageSquare,  detail: "Across all projects" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/principal"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Principal Dashboard
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{dept}</h1>
            <span className="text-[9px] font-mono uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">
              Read-only · Principal View
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Academic Year {academicYear}
          </p>
        </div>
        <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[2px] border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{k.label}</p>
              <k.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold">{k.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{k.detail}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusBarChart data={data.statusBreakdown} />
        <DomainPieChart data={data.domainBreakdown} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuideLoadChart data={data.guideLoad} />
        <MonthlyTrendChart data={data.projectTrend} />
      </div>

      {/* Recent projects */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Department Projects</h2>
        {data.recentProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects found for this department.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.recentProjects.map((project) => (
              <div key={project.id} className="rounded-[2px] border border-border bg-card p-4">
                <h3 className="text-sm font-medium truncate">{project.title}</h3>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                  {project.domain}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{project.memberCount} members</span>
                  <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm ${
                    project.status === "ACTIVE"    ? "bg-green-500/10 text-green-600" :
                    project.status === "COMPLETED" ? "bg-blue-500/10 text-blue-600"  :
                    "bg-muted text-muted-foreground"
                  }`}>{project.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
