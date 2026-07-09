"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#a1a1aa",
  ACTIVE: "#22c55e",
  UNDER_REVIEW: "#f59e0b",
  COMPLETED: "#3b82f6",
  ARCHIVED: "#71717a",
};

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

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

type StatusItem = { name: string; value: number };
type DomainItem = { name: string; value: number };
type GuideItem = { name: string; projects: number };
type TrendItem = { month: string; count: number };

export function StatusBarChart({ data }: { data: StatusItem[] }) {
  return (
    <ChartCard title="Projects by Status" subtitle="Current distribution">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#a1a1aa"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DomainPieChart({ data }: { data: DomainItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title="Projects by Domain" subtitle={`${total} total projects`}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-[1px] shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="ml-auto font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function GuideLoadChart({ data }: { data: GuideItem[] }) {
  return (
    <ChartCard title="Projects per Guide" subtitle="Guide workload distribution">
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36 + 20)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Bar dataKey="projects" radius={[0, 2, 2, 0]} fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MonthlyTrendChart({ data }: { data: TrendItem[] }) {
  return (
    <ChartCard title="Project Creation Trend" subtitle="Last 12 months">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
