"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { updateDepartmentConfiguration } from "@/server/actions/hod-dashboard";

type ConfigData = {
  academicYear: string;
  department: string;
  divisionCount: number;
  studentCount: number;
  projectGroupCount: number;
  updatedAt: Date | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Saving..." : "Save Configuration"}
    </Button>
  );
}

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
      <SubmitButton />
    </form>
  );
}
