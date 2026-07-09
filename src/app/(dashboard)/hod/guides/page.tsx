import { requireHOD } from "@/lib/coe-guard";
import { getDepartmentGuides, removeGuide } from "@/server/actions/hod-dashboard";
import { AddGuideForm } from "./AddGuideForm";
import { InviteFacultyForm } from "./InviteFacultyForm";
import { PendingInvitations } from "./PendingInvitations";

const MSG_MAP: Record<string, { text: string; type: "success" | "error" }> = {
  assigned: { text: "Faculty has been added as a guide.", type: "success" },
  already_guide: { text: "Faculty is already a guide in this department.", type: "success" },
  already_invited: { text: "An invitation has already been sent to this email.", type: "error" },
  invited: { text: "Faculty not found. An invitation email has been sent.", type: "success" },
  not_teacher: { text: "This user is not a faculty member.", type: "error" },
  inactive: { text: "This faculty account is inactive.", type: "error" },
  invalid_email: { text: "Please enter a valid email address.", type: "error" },
};

export default async function FacultyGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireHOD();
  const data = await getDepartmentGuides();
  const { msg } = await searchParams;
  const feedback = msg ? MSG_MAP[msg] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faculty Guides</h1>
        <p className="text-sm text-muted-foreground">
          {data.department} — Manage faculty guides and invitations
        </p>
      </div>

      {feedback && (
        <div className={`rounded-[2px] px-4 py-3 text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {feedback.text}
        </div>
      )}

      <div className="rounded-[2px] border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Current Faculty Guides</h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
            {data.facultyGuides.length} total
          </span>
        </div>
        {data.facultyGuides.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No faculty guides found for this department.
          </p>
        ) : (
          <div className="space-y-2">
            {data.facultyGuides.map((guide) => (
              <div
                key={guide.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{guide.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {guide.email} · {guide._count.managedProjects} projects
                  </p>
                </div>
                <form action={removeGuide}>
                  <input type="hidden" name="userId" value={guide.id} />
                  <button
                    type="submit"
                    className="text-xs text-destructive hover:text-destructive/80 underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Find Faculty Guide</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Enter an email to add a faculty member as a guide for this department. Faculty from any department can be added as guides here.
        </p>
        <AddGuideForm />
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Pending Invitations</h2>
        <PendingInvitations invitations={data.pendingInvitations} />
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Invite New Faculty</h2>
        <InviteFacultyForm />
      </div>
    </div>
  );
}
