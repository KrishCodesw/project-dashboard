"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2px] border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

type NameValue = { name: string; value: number };

export function TypePieChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard title="Project Type" subtitle="INHOUSE / OUTHOUSE / INDUSTRY">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px]" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            {d.name}: {d.value}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function CategoryPieChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard title="Project Category" subtitle="APPLICATION / RESEARCH / CORE">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} stroke="none" />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px]" style={{ background: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} />
            {d.name}: {d.value}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function SDGBarChart({ data }: { data: NameValue[] }) {
  const labels: Record<string, string> = {
    GOAL_1_NO_POVERTY: "No Poverty", GOAL_2_ZERO_HUNGER: "Zero Hunger",
    GOAL_3_GOOD_HEALTH: "Good Health", GOAL_4_QUALITY_EDUCATION: "Quality Education",
    GOAL_5_GENDER_EQUALITY: "Gender Equality", GOAL_6_CLEAN_WATER: "Clean Water",
    GOAL_7_CLEAN_ENERGY: "Clean Energy", GOAL_8_DECENT_WORK: "Decent Work",
    GOAL_9_INDUSTRY_INNOVATION: "Industry & Innovation", GOAL_10_REDUCED_INEQUALITIES: "Reduced Inequalities",
    GOAL_11_SUSTAINABLE_CITIES: "Sustainable Cities", GOAL_12_RESPONSIBLE_CONSUMPTION: "Responsible Consumption",
    GOAL_13_CLIMATE_ACTION: "Climate Action", GOAL_14_LIFE_BELOW_WATER: "Life Below Water",
    GOAL_15_LIFE_ON_LAND: "Life on Land", GOAL_16_PEACE_AND_JUSTICE: "Peace & Justice",
    GOAL_17_PARTNERSHIPS: "Partnerships",
  };
  const chartData = data.map((d) => ({ ...d, name: labels[d.name] || d.name }));
  return (
    <ChartCard title="SDG Alignment" subtitle="Sustainable Development Goals">
      <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 28)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={100} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]} fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RBLPieChart({ data }: { data: NameValue[] }) {
  const COLORS = ["#22c55e", "#a1a1aa"];
  return (
    <ChartCard title="RBL vs Non-RBL" subtitle="Research-Based Learning">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px]" style={{ background: COLORS[i] }} />
            {d.name}: {d.value}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function TaskCompletionBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ChartCard title="Task Status" subtitle="All tasks across departments">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MemberDistributionChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard title="Team Size Distribution" subtitle="Members per project">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "Members", position: "bottom", fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="#14b8a6" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ActivitySummary({ data }: { data: { label: string; value: number; period: string }[] }) {
  return (
    <ChartCard title="Recent Activity" subtitle="Last 30 days">
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{item.value}</span>
              <span className="text-[10px] text-muted-foreground">{item.period}</span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function MilestoneGauge({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <ChartCard title="Milestones" subtitle="Achievement progress">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray={`${pct}, 100`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{pct}%</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">{completed}</span> completed</p>
          <p>out of <span className="font-medium text-foreground">{total}</span> total</p>
        </div>
      </div>
    </ChartCard>
  );
}
