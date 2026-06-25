"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Crown, Trash2, Loader2 } from "lucide-react";
import { addProjectMember, removeProjectMember, setProjectLead } from "@/server/actions/projects";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface MembersTabProps {
  project: any;
}

export function MembersTab({ project }: MembersTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const members = project.members ?? [];

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    const fd = new FormData(e.currentTarget);
    const result = await addProjectMember(project.id, fd.get("studentId") as string);
    if (result.success) {
      toast.success("Member added");
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      setDialogOpen(false);
    } else {
      toast.error(result.error || "Failed to add member");
    }
    setAdding(false);
  }

  async function handleRemove(studentId: string) {
    try {
      await removeProjectMember(project.id, studentId);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  }

  async function handleSetLead(studentId: string) {
    try {
      await setProjectLead(project.id, studentId);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Lead updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to set lead");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            Team Members ({members.length}/{project.maxGroupSize})
          </h3>
          <p className="text-sm text-muted-foreground">
            Supervised by {project.teacher?.name}
          </p>
        </div>
        {members.length < project.maxGroupSize && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input name="studentId" placeholder="Enter student ID" required />
                </div>
                <Button type="submit" disabled={adding} className="w-full">
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Member
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {members.map((m: any) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={m.student.avatarUrl ?? ""} />
                <AvatarFallback className="text-xs">
                  {m.student.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  {m.student.name}
                  {m.role === "LEAD" && (
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.student.email}
                  {m.student.rollNumber && ` • ${m.student.rollNumber}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {m.role}
              </Badge>
              {m.role !== "LEAD" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSetLead(m.studentId)}
                  title="Promote to lead"
                >
                  <Crown className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(m.studentId)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
