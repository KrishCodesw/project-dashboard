"use client";

type DeptRow = {
  department: string;
  projectCount: number;
  guideCount: number;
  studentCount: number;
  teacherCount: number;
  activeCount: number;
  completedCount: number;
  completionRate: number;
};

export function DepartmentComparisonTable({
  data,
}: {
  data: DeptRow[];
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-[2px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No department data available.
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-border bg-card">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              Department Comparison
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              Projects · Guides · Students · Completion
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
            {data.length} departments
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <th className="text-left p-3 font-medium">Department</th>
              <th className="text-right p-3 font-medium">Projects</th>
              <th className="text-right p-3 font-medium">Active</th>
              <th className="text-right p-3 font-medium">Guides</th>
              <th className="text-right p-3 font-medium">Teachers</th>
              <th className="text-right p-3 font-medium">Students</th>
              <th className="text-right p-3 font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.department}
                className="border-b border-border/50 last:border-0"
              >
                <td className="p-3 font-medium">{row.department}</td>
                <td className="p-3 text-right">{row.projectCount}</td>
                <td className="p-3 text-right">{row.activeCount}</td>
                <td className="p-3 text-right">{row.guideCount}</td>
                <td className="p-3 text-right">{row.teacherCount}</td>
                <td className="p-3 text-right">{row.studentCount}</td>
                <td className="p-3 text-right">
                  <span
                    className={`font-mono ${
                      row.completionRate >= 50
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {row.completionRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
