import { getPrincipalDashboardData } from "@/server/actions/principal-dashboard";
import { BookOpen, Users, GraduationCap, Building2 } from "lucide-react";
import {
  StatusBarChart,
  DomainPieChart,
  GuideLoadChart,
  MonthlyTrendChart,
} from "../hod/HODCharts";
import { DepartmentComparisonTable } from "./DepartmentComparisonTable";

export default async function PrincipalDashboardPage() {
  const data = await getPrincipalDashboardData();

  const overviewCards = [
    {
      label: "Total Projects",
      value: data.totalProjects,
      icon: BookOpen,
      detail: `${data.activeProjects} active · ${data.completedProjects} completed`,
    },
    {
      label: "Faculty Guides",
      value: data.totalGuideCount,
      icon: Users,
      detail: `${data.totalTeachers} total teachers`,
    },
    {
      label: "Total Students",
      value: data.totalStudents,
      icon: GraduationCap,
      detail: "Across all departments",
    },
    {
      label: "Active Departments",
      value: data.activeDepts,
      icon: Building2,
      detail: "With department configuration",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Principal Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Institution-wide overview · {data.activeDepts} departments
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[2px] border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {card.label}
              </p>
              <card.icon className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {card.detail}
            </p>
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

      {/* Department Comparison */}
      <DepartmentComparisonTable data={data.departmentComparison} />
    </div>
  );
}
