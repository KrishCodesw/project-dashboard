"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type ConfigData = {
  academicYear: string;
  department: string;
  divisionCount: number;
  studentCount: number;
  projectGroupCount: number;
  updatedAt: Date | null;
};

export function ConfigForm({
  config,
  onSave,
}: {
  config: ConfigData;
  onSave: (formData: FormData) => Promise<{ success: boolean }>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { success: boolean } | null, formData: FormData) => {
      return onSave(formData);
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
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
        <label
          htmlFor="divisionCount"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
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
        <label
          htmlFor="studentCount"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
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
        <label
          htmlFor="projectGroupCount"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
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
      {state?.success && (
        <p className="text-xs text-emerald-600">Configuration saved successfully.</p>
      )}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving..." : "Save Configuration"}
      </Button>
    </form>
  );
}
