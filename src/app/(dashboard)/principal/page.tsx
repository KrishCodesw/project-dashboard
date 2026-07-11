import {
  getDailyActivityFeed,
  getDepartmentWorkload,
  getDepartmentComparisonWithIntake,
  getPrincipalDashboardData,
} from "@/server/actions/principal-dashboard";
import {
  BookOpen, Users, GraduationCap, Building2,
  ListTodo, MessageSquare, FileText, Sparkles, Activity,
} from "lucide-react";
import {
  StatusBarChart, DomainPieChart, GuideLoadChart, MonthlyTrendChart,
} from "../hod/HODCharts";
import {
  TypePieChart, CategoryPieChart, SDGBarChart, RBLPieChart,
  TaskCompletionBar, MemberDistributionChart, ActivitySummary, MilestoneGauge,
} from "./PrincipalCharts";
import { DepartmentComparisonTable } from "./DepartmentComparisonTable";
import { ActivityFeedSection } from "./ActivityFeedSection";
import { DepartmentWorkloadSection } from "./DepartmentWorkloadSection";
import { getDailyActivityFeed as serverFetchFeed } from "@/server/actions/principal-dashboard";

export default async function PrincipalDashboardPage() {
  const [data, todayFeed, deptWorkload, deptComparison] = await Promise.all([
    getPrincipalDashboardData(),
    getDailyActivityFeed(),
    getDepartmentWorkload(),
    getDepartmentComparisonWithIntake(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Principal Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Institution-wide overview · {data.activeDepts} departments ·{" "}
          {data.recentProjects} new projects this month
        </p>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Projects", value: data.totalProjects,    icon: BookOpen,      detail: `${data.activeProjects} active · ${data.completedProjects} done` },
          { label: "Students",       value: data.totalStudents,    icon: GraduationCap, detail: `${data.totalTeachers} teachers` },
          { label: "Guides",         value: data.totalGuideCount,  icon: Users,         detail: "Assigned guides" },
          { label: "Tasks",          value: data.totalTasks,       icon: ListTodo,      detail: `${data.completedTasks} done · ${data.inProgressTasks} in progress` },
          { label: "Reviews",        value: data.reviewCount,      icon: MessageSquare, detail: `${data.completedReviewCount} completed` },
          { label: "Publications",   value: data.approvedPublications, icon: FileText,  detail: `${data.pendingPublications} pending` },
        ].map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="rounded-[2px] border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{detail}</p>
          </div>
        ))}
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Milestones",     value: data.totalMilestones,    icon: Activity,  detail: `${data.completedMilestones} completed` },
          { label: "Showcase",       value: data.publishedShowcase,   icon: Sparkles,  detail: "Published projects" },
          { label: "Active Depts",   value: data.activeDepts,         icon: Building2, detail: "With configuration" },
          { label: "Recent Reviews", value: data.recentReviews,       icon: MessageSquare, detail: "Last 30 days" },
        ].map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="rounded-[2px] border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{detail}</p>
          </div>
        ))}
      </div>

      {/* Activity Feed + Department Workload */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ActivityFeedSection initialFeed={todayFeed} fetchFeed={serverFetchFeed} />
        <DepartmentWorkloadSection data={deptWorkload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivitySummary data={[
          { label: "New Projects",       value: data.recentProjects,       period: "30 days" },
          { label: "Recent Reviews",     value: data.recentReviews,        period: "30 days" },
          { label: "Completed Tasks",    value: data.completedTasks,       period: "All time" },
          { label: "Pending Publications",value: data.pendingPublications, period: "Awaiting" },
        ]} />
        <MilestoneGauge completed={data.completedMilestones} total={data.totalMilestones} />
      </div>
      
      {/* Dept comparison table with Total Intake + drill-down */}
      <DepartmentComparisonTable data={deptComparison} />

      {/* Chart rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusBarChart data={data.statusBreakdown} />
        <DomainPieChart data={data.domainBreakdown} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TypePieChart data={data.typeBreakdown} />
        <CategoryPieChart data={data.categoryBreakdown} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SDGBarChart data={data.sdgBreakdown} />
        <RBLPieChart data={data.rblBreakdown} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TaskCompletionBar data={[
          { name: "TODO",        value: data.totalTasks - data.completedTasks - data.inProgressTasks },
          { name: "IN_PROGRESS", value: data.inProgressTasks },
          { name: "DONE",        value: data.completedTasks },
        ]} />
        <MemberDistributionChart data={data.memberDistribution} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GuideLoadChart data={data.guideLoad} />
        <MonthlyTrendChart data={data.projectTrend} />
      </div>
      

      
    </div>
  );
}
