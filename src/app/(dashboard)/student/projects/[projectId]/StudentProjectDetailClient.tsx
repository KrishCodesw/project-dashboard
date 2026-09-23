"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { LeaderDetailsForm } from "@/components/dashboard/LeaderDetailsForm";
import { useProject } from "@/hooks/useProjects";
import { useProjectTasks, useUpdateTask } from "@/hooks/useTasks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskKanban } from "@/components/dashboard/TaskKanban";
import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { FileUploader } from "@/components/dashboard/FileUploader";
import { StudentPublicationsTab } from "./_tabs/StudentPublicationsTab";
import { StudentReviewsTab } from "./_tabs/StudentReviewsTab";
import {
  Calendar,
  Users,
  FileText,
  ListTodo,
  Download,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectFiles } from "@/server/actions/files";
import { getDownloadUrl } from "@/server/actions/files";
import { getProjectMilestones } from "@/server/actions/milestones";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { submitWeeklyTaskWorkLog } from "@/server/actions/student-weekly-tasks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";


const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  ACTIVE: "bg-emerald-500/20 text-emerald-400",
  UNDER_REVIEW: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-indigo-500/20 text-indigo-400",
  ARCHIVED: "bg-zinc-500/20 text-zinc-400",
};

type StudentProjectDetailClientProps = {
  userId: string;
};

export default function StudentProjectDetailClient({
  userId,
}: StudentProjectDetailClientProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { data: project, isLoading } = useProject(projectId);
  const [activeTab, setActiveTab] = React.useState("tasks");

  React.useEffect(() => {
    const allowedTabs = new Set([
      "tasks",
      "milestones",
      "reviews",
      "publications",
      "files",
    ]);
    setActiveTab(
      allowedTabs.has(tabParam || "") ? (tabParam as string) : "tasks",
    );
  }, [tabParam]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [workLog, setWorkLog] = useState<string>("");
  const [evidenceLinks, setEvidenceLinks] = useState<
    Array<{ title: string; url: string; type: "GITHUB" | "DRIVE" | "DESIGN" | "DOCUMENT" }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tasks } = useProjectTasks(projectId);
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const { data: files } = useQuery({
    queryKey: ["files", projectId],
    queryFn: () => getProjectFiles(projectId),
  });

  const { data: milestones } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => getProjectMilestones(projectId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const p = project as any;

  const isLeader = p.members?.some(
    (member: any) => member.studentId === userId && member.role === "LEAD",
  );

  async function handleTaskUpdate(taskId: string, data: any) {
    try {
      await updateTask.mutateAsync({ taskId, data });
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  }

  function handleWeeklyTaskClick(submissionId: string) {
    setSubmissionId(submissionId);
    // Reset form
    setWorkLog("");
    setEvidenceLinks([]);
    setModalOpen(true);
  }

  async function handleDownload(fileId: string, filename: string) {
    try {
      const url = await getDownloadUrl(fileId);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch {
      toast.error("Failed to download file");
    }
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionId) return;

    setIsSubmitting(true);
    try {
      await submitWeeklyTaskWorkLog({
        submissionId,
        workLog,
        evidenceLinks,
      });
      toast.success("Work log submitted");
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{p.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{p.domain}</p>
          </div>
          <div className="flex items-center gap-4">
            {isLeader && <LeaderDetailsForm project={p} />}
            <Badge className={statusColors[p.status] ?? ""}>
              {p.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(p.startDate).toLocaleDateString()} -{" "}
            {new Date(p.endDate).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Supervisor: {p.teacher?.name}
          </span>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-transparent border-b rounded-none px-0 pb-0">
          <TabsTrigger
            value="tasks"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <ListTodo className="mr-2 h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="milestones"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger
            value="reviews"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger
            value="publications"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Publications
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            <FileText className="mr-2 h-4 w-4" />
            Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <TaskKanban projectId={projectId} tasks={tasks ?? []} onTaskUpdate={handleTaskUpdate} onWeeklyTaskClick={handleWeeklyTaskClick} />
        </TabsContent>

        <TabsContent value="milestones" className="mt-6">
          <div className="rounded-xl border bg-card p-6">
            <MilestoneTimeline milestones={milestones ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <StudentReviewsTab projectId={projectId as string} />
        </TabsContent>

        <TabsContent value="publications" className="mt-6">
          <StudentPublicationsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="files" className="mt-6 space-y-6">
          <FileUploader
            projectId={projectId}
            onUploadComplete={() =>
              queryClient.invalidateQueries({ queryKey: ["files", projectId] })
            }
          />
          <div className="space-y-2">
            {(files ?? []).map((file: any) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.fileSize / 1024).toFixed(1)} KB •{" "}
                      {formatDistanceToNow(new Date(file.uploadedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file.id, file.fileName)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit weekly task work</DialogTitle>
            <DialogDescription>
              Add a work log and, optionally, a link to supporting evidence.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="work-log">Work log</Label>
              <Textarea
                id="work-log"
                value={workLog}
                onChange={(event) => setWorkLog(event.target.value)}
                placeholder="Describe the work completed this week..."
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-url">Evidence URL (optional)</Label>
              <Input
                id="evidence-url"
                type="url"
                value={evidenceLinks[0]?.url ?? ""}
                onChange={(event) => {
                  const url = event.target.value;
                  setEvidenceLinks(
                    url
                      ? [
                          {
                            title: evidenceLinks[0]?.title || "Weekly task evidence",
                            url,
                            type: evidenceLinks[0]?.type || "DOCUMENT",
                          },
                        ]
                      : [],
                  );
                }}
                placeholder="https://..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit work log"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
