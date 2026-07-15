"use client";

import { useState } from "react";
import { adminUploadProjectAssignments } from "@/server/actions/projects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type UploadSummary = {
  totalRows: number;
  matchedRows: number;
  unresolvedRows: number;
  createdProjects: number;
  existingUsersAssigned: number;
  invitedUsersQueued: number;
  emailsQueued: number;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read CSV file"));
    reader.readAsText(file);
  });
}

export default function AdminSettingsPage() {
  const [csvContent, setCsvContent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  async function onCsvFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }

    try {
      const text = await readFileAsText(file);
      setCsvContent(text);
      toast.success("CSV loaded successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not parse CSV";
      toast.error(message);
    }
  }

  async function onSubmit() {
    if (!csvContent.trim()) {
      toast.error("Upload or paste CSV content first");
      return;
    }

    setIsSubmitting(true);
    setSummary(null);
    try {
      const result = await adminUploadProjectAssignments({
        csvContent,
      });

      setSummary({
        totalRows: result.totalRows,
        matchedRows: result.matchedRows,
        unresolvedRows: result.unresolvedRows,
        createdProjects: result.createdProjects,
        existingUsersAssigned: result.existingUsersAssigned,
        invitedUsersQueued: result.invitedUsersQueued,
        emailsQueued: result.emailsQueued,
      });

      toast.success("Assignments processed and emails queued");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          CSV project assignment upload and system configuration
        </p>
      </div>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Project Assignment</CardTitle>
          <CardDescription>
            Upload a CSV to assign users to projects. Notifications are queued asynchronously.
            Required columns: <code className="bg-muted px-1 rounded text-xs">email</code>,{" "}
            <code className="bg-muted px-1 rounded text-xs">projectName</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Upload CSV file</Label>
            <Input type="file" accept=".csv,text/csv" onChange={onCsvFilePicked} />
          </div>

          <div className="space-y-2">
            <Label>CSV content</Label>
            <Textarea
              value={csvContent}
              onChange={(event) => setCsvContent(event.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder={"email,projectName\nstudent1@tcetmumbai.in,AI Attendance System\nnew.user@example.com,IoT Smart Campus"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Process CSV and Queue Emails"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCsvContent("email,projectName\nstudent1@tcetmumbai.in,AI Attendance System\nnew.user@example.com,IoT Smart Campus")
              }
            >
              Insert Sample CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Result Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <SummaryItem label="Rows processed" value={summary.totalRows} />
            <SummaryItem label="Rows matched" value={summary.matchedRows} />
            <SummaryItem label="Rows skipped" value={summary.unresolvedRows} />
            <SummaryItem label="Projects created" value={summary.createdProjects} />
            <SummaryItem label="Existing assigned" value={summary.existingUsersAssigned} />
            <SummaryItem label="Invites created" value={summary.invitedUsersQueued} />
            <SummaryItem label="Emails queued" value={summary.emailsQueued} />
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Email Config */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>SMTP configuration for system emails</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); toast.success("Settings saved"); }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input type="number" placeholder="587" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP User</Label>
                <Input placeholder="user@gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>SMTP Password</Label>
                <Input type="password" placeholder="••••••••" />
              </div>
            </div>
            <Button type="submit">Save Email Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
