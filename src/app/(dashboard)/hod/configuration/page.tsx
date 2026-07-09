import { requireHOD } from "@/lib/coe-guard";
import { getDepartmentConfiguration } from "@/server/actions/hod-dashboard";
import { ConfigForm } from "./ConfigForm";

export default async function DepartmentConfigurationPage() {
  const user = await requireHOD();
  const config = await getDepartmentConfiguration();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Department Configuration</h1>
        <p className="text-sm text-muted-foreground">
          {config.department} · Academic Year {config.academicYear}
        </p>
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5 max-w-lg">
        <ConfigForm config={config} />
      </div>
    </div>
  );
}
