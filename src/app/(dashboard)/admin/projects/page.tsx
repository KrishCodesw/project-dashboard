"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminProjectsManagementData,
  adminUpdateProject,
  adminUpdateProjectMentor,
  adminAddProjectMember,
  adminUpdateProjectMemberRole,
  adminRemoveProjectMember,
  adminDeleteProject,
} from "@/server/actions/projects";
import { Trash, Loader2, Pencil, UserPlus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useAllPublications,
  usePendingPublicationsCount,
} from "@/hooks/usePublications";
import { AdminPublicationsList } from "@/components/dashboard/AdminPublicationsList";

type StatusValue =
  | "DRAFT"
  | "ACTIVE"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "ARCHIVED";
type RoleValue = "LEAD" | "MEMBER";

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [savingProjectId, setSavingProjectId] = React.useState<string | null>(
    null,
  );
  const [editingProject, setEditingProject] = React.useState<any | null>(null);
  const [publicationsOpen, setPublicationsOpen] = React.useState(false);
  const [mentorDraft, setMentorDraft] = React.useState<Record<string, string>>(
    {},
  );
  const [memberDraft, setMemberDraft] = React.useState<Record<string, string>>(
    {},
  );
  const [memberRoleDraft, setMemberRoleDraft] = React.useState<
    Record<string, RoleValue>
  >({});
  const [mounted, setMounted] = React.useState(false);
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "projects", "manage"],
    queryFn: () => getAdminProjectsManagementData(),
  });

  const { data: allPublications = [], isLoading: isPublicationsLoading } =
    useAllPublications("ALL", {
      enabled: publicationsOpen,
    });
  const { data: pendingCount = 0 } = usePendingPublicationsCount();

  const projects = data?.projects ?? [];
  const teachers = data?.teachers ?? [];
  const students = data?.students ?? [];
  const pendingLabel = pendingCount > 99 ? "99+" : String(pendingCount);

  const filteredProjects = React.useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (project: any) =>
        (project.title || "").toLowerCase().includes(q) ||
        (project.domain || "").toLowerCase().includes(q) ||
        (project.department || "").toLowerCase().includes(q) ||
        (project.teacher?.name || "").toLowerCase().includes(q),
    );
  }, [projects, search]);

  React.useEffect(() => {
    const target = searchParams.get("publications");
    if (target) {
      setPublicationsOpen(true);
    }
  }, [searchParams]);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  async function refreshData() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "projects", "manage"],
    });
  }

  async function onSaveMentor(projectId: string) {
    const teacherId = mentorDraft[projectId];
    if (!teacherId) {
      toast.error("Select a mentor first");
      return;
    }

    setSavingProjectId(projectId);
    try {
      await adminUpdateProjectMentor({ projectId, teacherId });
      toast.success("Mentor updated");
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update mentor");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function onAddMember(projectId: string) {
    const identifier = memberDraft[projectId];
    const role = memberRoleDraft[projectId] ?? "MEMBER";

    if (!identifier) {
      toast.error("Select a student first");
      return;
    }

    setSavingProjectId(projectId);
    try {
      await adminAddProjectMember({
        projectId,
        studentIdentifier: identifier,
        role,
      });
      toast.success("Member added");
      setMemberDraft((prev) => ({ ...prev, [projectId]: "" }));
      setMemberRoleDraft((prev) => ({ ...prev, [projectId]: "MEMBER" }));
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add member");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function onUpdateMemberRole(
    projectId: string,
    studentId: string,
    role: RoleValue,
  ) {
    setSavingProjectId(projectId);
    try {
      await adminUpdateProjectMemberRole({ projectId, studentId, role });
      toast.success("Member role updated");
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function onRemoveMember(projectId: string, studentId: string) {
    setSavingProjectId(projectId);
    try {
      await adminRemoveProjectMember({ projectId, studentId });
      toast.success("Member removed");
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove member");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function onDeleteProject(projectId: string) {
    const ok = window.confirm(
      "Delete this project and all associated data? This cannot be undone.",
    );
    if (!ok) return;

    setSavingProjectId(projectId);
    try {
      await adminDeleteProject(projectId);
      toast.success("Project deleted");
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete project");
    } finally {
      setSavingProjectId(null);
    }
  }

  async function onSaveProject(formData: FormData) {
    if (!editingProject) return;

    setSavingProjectId(editingProject.id);
    try {
      await adminUpdateProject({
        projectId: editingProject.id,
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || ""),
        domain: String(formData.get("domain") || ""),
        department: String(formData.get("department") || ""),
        status: String(formData.get("status") || "DRAFT") as StatusValue,
        maxGroupSize: Number(formData.get("maxGroupSize") || 4),
        startDate: String(formData.get("startDate") || ""),
        endDate: String(formData.get("endDate") || ""),
      } as any); // Type assertion used here assuming backend schema supports department
      toast.success("Project updated");
      setEditingProject(null);
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update project");
    } finally {
      setSavingProjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects Management</h1>
          <p className="text-muted-foreground text-sm">
            Manage all projects, assign mentors, and edit members
          </p>
        </div>
        <div className="flex w-full max-w-xl flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, domain, dept..."
            className="flex-1 min-w-[220px]"
          />
          <Dialog open={publicationsOpen} onOpenChange={setPublicationsOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm" className="relative">
                Manage Publications
                {pendingCount > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-semibold text-black">
                    {pendingLabel}
                  </span>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Publications</DialogTitle>
              </DialogHeader>
              <AdminPublicationsList
                publications={allPublications}
                isLoading={isPublicationsLoading}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No projects found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project: any) => {
            const selectedMentor =
              mentorDraft[project.id] ?? project.teacher?.id ?? "";
            const selectedMember = memberDraft[project.id] ?? "";
            const selectedMemberRole = memberRoleDraft[project.id] ?? "MEMBER";
            const isSaving = savingProjectId === project.id;

            return (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {project.domain}
                        </p>
                        {project.department && (
                          <>
                            <span className="text-muted-foreground text-xs">
                              •
                            </span>
                            <p className="text-sm text-muted-foreground font-medium">
                              {project.department}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{project.status}</Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteProject(project.id)}
                        disabled={isSaving}
                      >
                        <Trash className="mr-2 h-4 w-4" /> Delete
                      </Button>
                      <Dialog
                        open={editingProject?.id === project.id}
                        onOpenChange={(open) =>
                          setEditingProject(open ? project : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Project
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Project</DialogTitle>
                          </DialogHeader>
                          <form
                            action={async (formData) => {
                              await onSaveProject(formData);
                            }}
                            className="space-y-3"
                          >
                            <div className="space-y-1.5">
                              <Label>Title</Label>
                              <Input
                                name="title"
                                defaultValue={project.title}
                                required
                                minLength={3}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Description</Label>
                              <Input
                                name="description"
                                defaultValue={project.description}
                                required
                                minLength={10}
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Domain</Label>
                                <Input
                                  name="domain"
                                  defaultValue={project.domain}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Department</Label>
                                <Input
                                  name="department"
                                  defaultValue={project.department}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Start Date</Label>
                                <Input
                                  name="startDate"
                                  type="date"
                                  defaultValue={toDateInputValue(
                                    project.startDate,
                                  )}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>End Date</Label>
                                <Input
                                  name="endDate"
                                  type="date"
                                  defaultValue={toDateInputValue(
                                    project.endDate,
                                  )}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>Max Group Size</Label>
                                <Input
                                  name="maxGroupSize"
                                  type="number"
                                  min={1}
                                  max={10}
                                  defaultValue={project.maxGroupSize}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select
                                  name="status"
                                  defaultValue={project.status}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                                    <SelectItem value="ACTIVE">
                                      ACTIVE
                                    </SelectItem>
                                    <SelectItem value="UNDER_REVIEW">
                                      UNDER_REVIEW
                                    </SelectItem>
                                    <SelectItem value="COMPLETED">
                                      COMPLETED
                                    </SelectItem>
                                    <SelectItem value="ARCHIVED">
                                      ARCHIVED
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              type="submit"
                              className="w-full mt-2"
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Save Changes
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label>Mentor</Label>
                      <Select
                        value={selectedMentor}
                        onValueChange={(value) =>
                          setMentorDraft((prev) => ({
                            ...prev,
                            [project.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select mentor" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher: any) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name} ({teacher.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => onSaveMentor(project.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save Mentor
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      Members ({project.members.length}/{project.maxGroupSize})
                    </h3>
                    {project.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No members yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {project.members.map((member: any) => (
                          <div
                            key={member.studentId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                          >
                            <div className="text-sm">
                              <p className="font-medium">
                                {member.student.name}
                              </p>
                              <p className="text-muted-foreground">
                                {member.student.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  onUpdateMemberRole(
                                    project.id,
                                    member.studentId,
                                    value as RoleValue,
                                  )
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MEMBER">MEMBER</SelectItem>
                                  <SelectItem value="LEAD">LEAD</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  onRemoveMember(project.id, member.studentId)
                                }
                                disabled={isSaving}
                              >
                                <UserX className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label>Add Member</Label>
                      <Select
                        value={selectedMember}
                        onValueChange={(value) =>
                          setMemberDraft((prev) => ({
                            ...prev,
                            [project.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student: any) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.name} ({student.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select
                        value={selectedMemberRole}
                        onValueChange={(value) =>
                          setMemberRoleDraft((prev) => ({
                            ...prev,
                            [project.id]: value as RoleValue,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">MEMBER</SelectItem>
                          <SelectItem value="LEAD">LEAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => onAddMember(project.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
