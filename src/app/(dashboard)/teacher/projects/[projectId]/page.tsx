"use client";

import React, { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useProject, useRequestProjectEdit, useRequestProjectActivation } from "@/hooks/useProjects";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Users,
  FileText,
  ClipboardCheck,
  ListTodo,
  BarChart3,
  BookOpen,
  Pencil,
  Loader2,
  Clock,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { OverviewTab } from "./_tabs/OverviewTab";
import { TasksTab } from "./_tabs/TasksTab";
import { MilestonesTab } from "./_tabs/MilestonesTab";
import { ReviewsTab } from "./_tabs/ReviewsTab";
import { PublicationsTab } from "./_tabs/PublicationsTab";
import { FilesTab } from "./_tabs/FilesTab";
import { MembersTab } from "./_tabs/MembersTab";

const DEPARTMENTS = [
  "B.E. Computer Engineering",
  "B.E. Information Technology",
  "B.E. Electronics & Tele-Communication",
  "B.E. Electronics and Computer Science",
  "B.E. Mechanical Engineering",
  "B.E. Civil Engineering",
  "B.E. Computer Science and Engineering (Cyber Security)",
  "B.E. Mechanical and Mechatronics Engineering (Additive Manufacturing)",
  "B.Tech – Artificial Intelligence & Machine Learning",
  "B.Tech – Artificial Intelligence & Data Science",
  "B.Tech – Internet of Things (IoT)",
  "B.Tech – Computer Science & Engineering (CSE-IOT)",
] as const;

const CE_DOMAINS = [
  "Communication Networking and Web Engineering",
  "Computing and System Design",
  "Intelligent System Design and Development",
  "Multimedia Design and Development",
  "Software Development & Information System Management",
];

const DEPARTMENT_DOMAINS: Record<string, string[]> = {
  "B.E. Computer Engineering": CE_DOMAINS,
  "B.E. Computer Science and Engineering (Cyber Security)": CE_DOMAINS,
  "B.Tech – Computer Science & Engineering (CSE-IOT)": CE_DOMAINS,
  "B.E. Mechanical Engineering": [
    "Manufacturing",
    "Thermal Design",
    "Automation",
  ],
  "B.E. Civil Engineering": [
    "Construction Management",
    "Environment Engineering",
    "Geotechnical Engineering",
    "Structural Engineering",
    "Transportation Engineering",
    "Water Resource Engineering",
  ],
  "B.E. Information Technology": [
    "Information and communication Technology",
    "Software Product Development",
    "Artificial Intellignece & Machine Learning",
    "Web Technology and Ecommerce",
    "Database Technology",
  ],
  "B.Tech – Artificial Intelligence & Machine Learning": [
    "Health Care",
    "Agritech",
    "Security",
    "Gaming",
    "Social Benefits",
  ],
  "B.Tech – Internet of Things (IoT)": [
    "Embedded System & Hardware Design",
    "IoT Networking & Communication Technologies",
    "IoT Security & Privacy",
    "Data Management and Analytics",
    "IoT Application & Integration",
  ],
  "B.Tech – Artificial Intelligence & Data Science": [
    "AgriTech",
    "Education Entertainment & Hospitality",
    "Life Science & Pharmaceuticals",
    "Manufacturing, Retail and E-commerce",
    "FinTech",
  ],
  "B.E. Mechanical and Mechatronics Engineering (Additive Manufacturing)": [
    "Automation",
    "Advanced Manufacturing",
    "Electro Mechanical",
    "Mechanical Design",
  ],
  "B.E. Electronics and Computer Science": [
    "Digital Systems and Communication",
    "Embedded Systems and IoT",
    "Software Engineering and Systems",
    "Intelligent Systems and Data Science",
    "Cybersecurity and Networking",
  ],
  "B.E. Electronics & Tele-Communication": [
    "Advance Communication",
    "Signal Processing",
    "EDM",
    "Embedded/IoT",
    "IT",
  ],
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  ACTIVE: "bg-emerald-500/20 text-emerald-400",
  UNDER_REVIEW: "bg-amber-500/20 text-amber-400",
  COMPLETED: "bg-indigo-500/20 text-indigo-400",
  ARCHIVED: "bg-zinc-500/20 text-zinc-400",
};

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const { data: project, isLoading } = useProject(projectId);
  const { mutateAsync: submitEditRequest } = useRequestProjectEdit();
  const { mutateAsync: submitActivationRequest } = useRequestProjectActivation();

  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editDept, setEditDept] = useState<string>("");
  const [editDomain, setEditDomain] = useState<string>("");

  React.useEffect(() => {
    const allowedTabs = new Set([
      "overview",
      "tasks",
      "milestones",
      "reviews",
      "publications",
      "files",
      "members",
    ]);
    setActiveTab(
      allowedTabs.has(tabParam || "") ? (tabParam as string) : "overview",
    );
  }, [tabParam]);

  React.useEffect(() => {
    if (isEditDialogOpen && project) {
      setEditDept((project as any).department || "");
      setEditDomain((project as any).domain || "");
    }
  }, [isEditDialogOpen, project]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-6 w-48" />
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
  const pendingEdits = p.pendingEditData;
  const availableEditDomains = editDept
    ? DEPARTMENT_DOMAINS[editDept] || CE_DOMAINS
    : [];

  async function handleRequestEdit(formData: FormData) {
    setIsSubmitting(true);
    try {
      const data = {
        projectId: p.id,
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || ""),
        department: editDept,
        domain: editDomain,
        startDate: String(formData.get("startDate") || ""),
        endDate: String(formData.get("endDate") || ""),
        maxGroupSize: Number(formData.get("maxGroupSize") || 4),
      };

      // Changed this line to use the destructured function from the hook!
      await submitEditRequest(data);

      toast.success("Edit request sent to admin for approval");
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit edit request");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestActivation() {
    setIsSubmitting(true);
    try {
      await submitActivationRequest(p.id);
      toast.success("Activation request sent to admin for approval");
    } catch (error: any) {
      toast.error(error?.message || "Failed to request activation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{p.title}</h1>
              {p.hasPendingEdit && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  Edit Pending Approval
                </Badge>
              )}
              {p.hasPendingActivation && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  Activation Pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm">{p.domain}</p>
              {p.department && (
                <>
                  <span className="text-muted-foreground text-xs">•</span>
                  <p className="text-muted-foreground text-sm font-medium">
                    {p.department}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={statusColors[p.status] ?? ""}>
              {p.status.replace("_", " ")}
            </Badge>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={p.hasPendingEdit} // Disable if request is already pending
                  title={
                    p.hasPendingEdit
                      ? "An edit request is already pending review"
                      : ""
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {p.hasPendingEdit ? "Edit Pending" : "Request Edit"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Request Project Edit</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Changes will be applied once an admin approves them.
                  </p>
                </DialogHeader>
                <form action={handleRequestEdit} className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      name="title"
                      defaultValue={p.title}
                      required
                      minLength={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      name="description"
                      defaultValue={p.description}
                      required
                      minLength={10}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Select
                        name="department"
                        value={editDept}
                        onValueChange={(val) => {
                          setEditDept(val);
                          setEditDomain("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Domain</Label>
                      <Select
                        name="domain"
                        value={editDomain}
                        onValueChange={setEditDomain}
                        disabled={!editDept}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              editDept ? "Select Domain" : "Select Dept First"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEditDomains.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Start Date</Label>
                      <Input
                        name="startDate"
                        type="date"
                        defaultValue={toDateInputValue(p.startDate)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End Date</Label>
                      <Input
                        name="endDate"
                        type="date"
                        defaultValue={toDateInputValue(p.endDate)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Group Size</Label>
                    <Input
                      name="maxGroupSize"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={p.maxGroupSize}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Submit Request for Approval
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {p.status === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                disabled={p.hasPendingActivation || p.hasPendingEdit || isSubmitting}
                onClick={handleRequestActivation}
                title={
                  p.hasPendingActivation
                    ? "Activation request is already pending review"
                    : p.hasPendingEdit
                      ? "An edit request is pending — resolve it first"
                      : ""
                }
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                {p.hasPendingActivation ? "Activation Pending" : "Request Activation"}
              </Button>
            )}

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
            {p.members?.length ?? 0} / {p.maxGroupSize} members
          </span>
        </div>

        {/* --- TEACHER VISIBLE PENDING EDITS BANNER --- */}
        {p.hasPendingEdit && pendingEdits && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-600">
                Edit Request Pending Approval
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              You submitted the following changes. They will go live once an
              admin approves them.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm bg-background/50 p-3 rounded-md border border-amber-500/10">
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Title
                </span>{" "}
                {pendingEdits.title}
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Domain
                </span>{" "}
                {pendingEdits.domain}
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Department
                </span>{" "}
                {pendingEdits.department}
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">
                  Max Size
                </span>{" "}
                {pendingEdits.maxGroupSize}
              </div>
            </div>
          </div>
        )}
        {/* --------------------------------------------- */}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-transparent border-b rounded-none px-0 pb-0 overflow-x-auto">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <BarChart3 className="mr-2 h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <ListTodo className="mr-2 h-4 w-4" /> Tasks
          </TabsTrigger>
          <TabsTrigger
            value="milestones"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <Calendar className="mr-2 h-4 w-4" /> Milestones
          </TabsTrigger>
          <TabsTrigger
            value="reviews"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger
            value="publications"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <BookOpen className="mr-2 h-4 w-4" /> Publications
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <FileText className="mr-2 h-4 w-4" /> Files
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap"
          >
            <Users className="mr-2 h-4 w-4" /> Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab project={p} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <TasksTab projectId={projectId as string} />
        </TabsContent>
        <TabsContent value="milestones" className="mt-6">
          <MilestonesTab projectId={projectId as string} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          <ReviewsTab projectId={projectId as string} />
        </TabsContent>
        <TabsContent value="publications" className="mt-6">
          <PublicationsTab projectId={projectId as string} />
        </TabsContent>
        <TabsContent value="files" className="mt-6">
          <FilesTab projectId={projectId as string} />
        </TabsContent>
        <TabsContent value="members" className="mt-6">
          <MembersTab project={p} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
