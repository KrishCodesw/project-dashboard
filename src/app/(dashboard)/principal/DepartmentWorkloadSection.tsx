// import Link from "next/link";
// import { ArrowRight } from "lucide-react";
// import type { DeptWorkloadRow } from "@/server/actions/principal-dashboard";

// export function DepartmentWorkloadSection({ data }: { data: DeptWorkloadRow[] }) {
//   if (!data.length)
//     return (
//       <div className="rounded-[2px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
//         No department data. HODs must save their configuration first.
//       </div>
//     );

//   const maxProjects = Math.max(...data.map((d) => d.projectCount), 1);

//   return (
//     <div className="rounded-[2px] border border-border bg-card">
//       <div className="p-5 border-b border-border flex items-center justify-between">
//         <div>
//           <h2 className="text-sm font-semibold">Department Workload</h2>
//           <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
//             Click a department to drill down
//           </p>
//         </div>
//         <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
//           {data.length} depts
//         </span>
//       </div>
//       <div className="divide-y divide-border/50">
//         {data.map((row) => (
//           <Link key={row.department} href={`/principal/${encodeURIComponent(row.department)}`}
//             className="block p-4 hover:bg-muted/40 transition-colors group">
//             <div className="flex items-center justify-between mb-2">
//               <div className="flex items-center gap-2">
//                 <p className="text-sm font-medium">{row.department}</p>
//                 {row.totalIntake > 0 && (
//                   <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
//                     Intake: {row.totalIntake}
//                   </span>
//                 )}
//               </div>
//               <div className="flex items-center gap-3 text-xs text-muted-foreground">
//                 <span>{row.guideCount} guides</span>
//                 <span>{row.activeProjects} active</span>
//                 <span>{row.completionRate}% done</span>
//                 <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
//               </div>
//             </div>
//             <div className="h-1.5 rounded-full bg-muted overflow-hidden">
//               <div className="h-full rounded-full bg-primary/70 transition-all duration-500"
//                 style={{ width: `${(row.projectCount / maxProjects) * 100}%` }} />
//             </div>
//             <p className="text-[9px] text-muted-foreground mt-1">
//               {row.projectCount} projects · {row.studentCount} students
//             </p>
//           </Link>
//         ))}
//       </div>
//     </div>
//   );
// }
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DeptWorkloadRow } from "@/server/actions/principal-dashboard";

export function DepartmentWorkloadSection({
  data,
}: {
  data: DeptWorkloadRow[];
}) {
  if (!data.length)
    return (
      <div className="rounded-[2px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No department data. HODs must save their configuration first.
      </div>
    );

  const maxProjects = Math.max(...data.map((d) => d.projectCount), 1);

  return (
    <div className="rounded-[2px] border border-border bg-card">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Department Workload</h2>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Click a department to drill down
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
          {data.length} depts
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {data.map((row) => (
          <Link
            key={row.department}
            href={`/principal/${encodeURIComponent(row.department)}`}
            className="block p-4 hover:bg-muted/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{row.department}</p>
                {row.totalIntake > 0 && (
                  <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                    Intake: {row.totalIntake}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{row.guideCount} guides</span>
                <span>{row.activeProjects} active</span>
                <span>{row.completionRate}% done</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${(row.projectCount / maxProjects) * 100}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {row.projectCount} projects · {row.studentCount} students
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
