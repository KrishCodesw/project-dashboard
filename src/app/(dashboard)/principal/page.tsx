import { getPrincipalDashboardData } from "@/server/actions/principal-dashboard";
import {
  BookOpen, Users, GraduationCap, Building2, ListTodo,
  MessageSquare, FileText, Sparkles, Activity,
} from "lucide-react";
import {
  StatusBarChart,
  DomainPieChart,
  GuideLoadChart,
  MonthlyTrendChart,
} from "../hod/HODCharts";
import {
  TypePieChart,
  CategoryPieChart,
  SDGBarChart,
  RBLPieChart,
  TaskCompletionBar,
  MemberDistributionChart,
  ActivitySummary,
  MilestoneGauge,
} from "./PrincipalCharts";
import { DepartmentComparisonTable } from "./DepartmentComparisonTable";

export default async function PrincipalDashboardPage() {
  const data = await getPrincipalDashboardData();

  const taskStatusData = [
    { name: "TODO", value: data.totalTasks - data.completedTasks - data.inProgressTasks },
    { name: "IN_PROGRESS", value: data.inProgressTasks },
    { name: "DONE", value: data.completedTasks },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Principal Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Institution-wide overview · {data.activeDepts} departments ·{" "}
          {data.recentProjects} new projects in last 30 days
        </p>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Projects" value={data.totalProjects} icon={BookOpen} detail={`${data.activeProjects} active · ${data.completedProjects} completed`} />
        <KpiCard label="Total Students" value={data.totalStudents} icon={GraduationCap} detail={`${data.totalTeachers} teachers`} />
        <KpiCard label="Faculty Guides" value={data.totalGuideCount} icon={Users} detail="Assigned guides" />
        <KpiCard label="Total Tasks" value={data.totalTasks} icon={ListTodo} detail={`${data.completedTasks} done · ${data.inProgressTasks} in progress`} />
        <KpiCard label="Reviews" value={data.reviewCount} icon={MessageSquare} detail={`${data.completedReviewCount} completed`} />
        <KpiCard label="Publications" value={data.approvedPublications} icon={FileText} detail={`${data.pendingPublications} pending`} />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Milestones" value={data.totalMilestones} icon={Activity} detail={`${data.completedMilestones} completed`} />
        <KpiCard label="Showcase" value={data.publishedShowcase} icon={Sparkles} detail="Published projects" />
        <KpiCard label="Active Departments" value={data.activeDepts} icon={Building2} detail="With configuration" />
        <KpiCard label="Recent Reviews" value={data.recentReviews} icon={MessageSquare} detail="Last 30 days" />
      </div>

      {/* Chart Row 1: Status + Domain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusBarChart data={data.statusBreakdown} />
        <DomainPieChart data={data.domainBreakdown} />
      </div>

      {/* Chart Row 2: Type + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TypePieChart data={data.typeBreakdown} />
        <CategoryPieChart data={data.categoryBreakdown} />
      </div>

      {/* Chart Row 3: SDG + RBL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SDGBarChart data={data.sdgBreakdown} />
        <RBLPieChart data={data.rblBreakdown} />
      </div>

      {/* Chart Row 4: Tasks + Team Size */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TaskCompletionBar data={taskStatusData} />
        <MemberDistributionChart data={data.memberDistribution} />
      </div>

      {/* Chart Row 5: Guide Load + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuideLoadChart data={data.guideLoad} />
        <MonthlyTrendChart data={data.projectTrend} />
      </div>

      {/* Mini row: Activity + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivitySummary data={[
          { label: "New Projects", value: data.recentProjects, period: "30 days" },
          { label: "Recent Reviews", value: data.recentReviews, period: "30 days" },
          { label: "Completed Tasks", value: data.completedTasks, period: "All time" },
          { label: "Pending Publications", value: data.pendingPublications, period: "Awaiting approval" },
        ]} />
        <MilestoneGauge completed={data.completedMilestones} total={data.totalMilestones} />
      </div>

      {/* Department Comparison Table */}
      <DepartmentComparisonTable data={data.departmentComparison} />
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, detail,
}: {
  label: string; value: number | string; icon: React.ElementType; detail: string;
}) {
  return (
    <div className="rounded-[2px] border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{detail}</p>
    </div>
  );
}
