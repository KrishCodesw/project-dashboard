import { requireHOD } from "@/lib/coe-guard";
import { NoticeForm } from "./NoticeForm";

export default async function HODNoticesPage() {
  const hod = await requireHOD();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Send Notice to Students</h1>
        <p className="text-sm text-muted-foreground">
          {hod.department} · Emails all active students in your department
        </p>
      </div>
      <div className="rounded-[2px] border border-border bg-card p-5 max-w-2xl">
        <p className="text-xs text-muted-foreground mb-4">
          This will email all active students in <strong>{hod.department}</strong>.
          Recipients are deduplicated automatically.
        </p>
        <NoticeForm department={hod.department ?? ""} />
      </div>
    </div>
  );
}
