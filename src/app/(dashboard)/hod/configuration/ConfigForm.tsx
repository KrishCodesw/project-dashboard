import { updateDepartmentConfiguration } from "@/server/actions/hod-dashboard";

type ConfigData = {
  academicYear: string;
  department: string;
  divisionCount: number;
  studentCount: number;
  projectGroupCount: number;
  totalIntake: number;
  updatedAt: Date | null;
};

export function ConfigForm({ config }: { config: ConfigData }) {
  return (
    <form action={updateDepartmentConfiguration} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Academic Year
        </label>
        <input
          type="text"
          value={config.academicYear}
          readOnly
          className="w-full rounded-[2px] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Department
        </label>
        <input
          type="text"
          value={config.department}
          readOnly
          className="w-full rounded-[2px] border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
      </div>
      <div>
        <label htmlFor="divisionCount" className="block text-xs font-medium text-muted-foreground mb-1">
          Division Count
        </label>
        <input
          id="divisionCount"
          name="divisionCount"
          type="number"
          min="0"
          defaultValue={config.divisionCount}
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="studentCount" className="block text-xs font-medium text-muted-foreground mb-1">
          Student Count
        </label>
        <input
          id="studentCount"
          name="studentCount"
          type="number"
          min="0"
          defaultValue={config.studentCount}
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="projectGroupCount" className="block text-xs font-medium text-muted-foreground mb-1">
          Project Group Count
        </label>
        <input
          id="projectGroupCount"
          name="projectGroupCount"
          type="number"
          min="0"
          defaultValue={config.projectGroupCount}
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="totalIntake" className="block text-xs font-medium text-muted-foreground mb-1">
          Total Intake
        </label>
        <input
          id="totalIntake"
          name="totalIntake"
          type="number"
          min="0"
          defaultValue={config.totalIntake}
          className="w-full rounded-[2px] border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center h-9 px-4 rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent transition-all duration-300"
      >
        Save Configuration
      </button>
    </form>
  );
}
