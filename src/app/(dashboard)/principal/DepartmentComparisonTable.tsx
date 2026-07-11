"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type DeptRow = {
  department: string; projectCount: number; guideCount: number;
  studentCount: number; totalIntake: number; activeCount: number;
  completedCount: number; totalTasks: number; doneTasks: number;
  completionRate: number; taskCompletionRate: number;
};

export function DepartmentComparisonTable({ data }: { data: DeptRow[] }) {
  if (!data.length)
    return (
      <div className="rounded-[2px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No department data available.
      </div>
    );

  return (
    <div className="rounded-[2px] border border-border bg-card">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Department Comparison</h2>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Click any row to drill down
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
          {data.length} departments
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {["Department","Intake","Projects","Active","Guides","Students","Tasks","Completion","Task Done",""].map((h) => (
                <th key={h} className={`p-3 font-medium ${h === "Department" ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.department}
                className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors group">
                <td className="p-3 font-medium">{row.department}</td>
                <td className="p-3 text-right">
                  {row.totalIntake > 0
                    ? <span className="text-xs">{row.totalIntake}</span>
                    : <span className="text-[10px] text-muted-foreground/40">—</span>}
                </td>
                <td className="p-3 text-right">{row.projectCount}</td>
                <td className="p-3 text-right">{row.activeCount}</td>
                <td className="p-3 text-right">{row.guideCount}</td>
                <td className="p-3 text-right">{row.studentCount}</td>
                <td className="p-3 text-right">{row.totalTasks}</td>
                <td className="p-3 text-right">{row.completionRate}%</td>
                <td className="p-3 text-right">{row.taskCompletionRate}%</td>
                <td className="p-3 text-right">
                  <Link href={`/principal/${encodeURIComponent(row.department)}`}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
