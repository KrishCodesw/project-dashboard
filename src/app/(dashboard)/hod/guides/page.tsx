import { requireHOD } from "@/lib/coe-guard";
import { getDepartmentGuides } from "@/server/actions/hod-dashboard";
import { AddGuideForm } from "./AddGuideForm";
import { InviteFacultyForm } from "./InviteFacultyForm";
import { PendingInvitations } from "./PendingInvitations";

export default async function FacultyGuidesPage() {
  const user = await requireHOD();
  const data = await getDepartmentGuides();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faculty Guides</h1>
        <p className="text-sm text-muted-foreground">
          {data.department} — Manage faculty guides and invitations
        </p>
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Current Faculty Guides</h2>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[2px] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Add Faculty Guide</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Enter an email to add an existing faculty member as a guide. If the faculty is not registered yet, an invitation email will be sent.
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
