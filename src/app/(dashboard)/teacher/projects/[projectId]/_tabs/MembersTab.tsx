"use client";

import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Crown, Trash2, Loader2, Clock, Mail, X, Edit, Send } from "lucide-react";
import { addProjectMember, removeProjectMember, setProjectLead, cancelPendingAssignment, editPendingAssignment, resendPendingInvitation } from "@/server/actions/projects";
import { usePendingMembers } from "@/hooks/useProjects";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface MembersTabProps {
  project: any;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export function MembersTab({ project }: MembersTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<"MEMBER" | "LEAD">("MEMBER");
  const members = project.members ?? [];

  const { data: pendingMembers = [], isLoading: loadingPending } = usePendingMembers(project.id);

  // Resend cooldown tracking: { [assignmentId]: remaining seconds }
  const [resendCooldowns, setResendCooldowns] = useState<Record<string, number>>({});

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Cancel confirm state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Countdown timer for resend buttons
  useEffect(() => {
    const ids = Object.keys(resendCooldowns);
    if (ids.length === 0) return;

    const timer = setInterval(() => {
      setResendCooldowns((prev) => {
        const next: Record<string, number> = {};
        let hasRemaining = false;
        for (const [id, remaining] of Object.entries(prev)) {
          if (remaining > 1) {
            next[id] = remaining - 1;
            hasRemaining = true;
          }
        }
        if (!hasRemaining) return {};
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldowns]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["pending-members", project.id] });
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const result = await addProjectMember(project.id, email, role);
    if (result.success) {
      if (result.pending) {
        toast.success(`Invitation sent to ${email}. They'll be added automatically when they register.`);
      } else {
        toast.success("Member added successfully.");
      }
      invalidate();
      setDialogOpen(false);
      setRole("MEMBER");
    } else {
      toast.error(result.error || "Failed to add member");
    }
    setAdding(false);
  }

  async function handleRemove(studentId: string) {
    try {
      await removeProjectMember(project.id, studentId);
      invalidate();
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  }

  async function handleSetLead(studentId: string) {
    try {
      await setProjectLead(project.id, studentId);
      invalidate();
      toast.success("Lead updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to set lead");
    }
  }

  async function handleResend(assignmentId: string, email: string) {
    const result = await resendPendingInvitation(project.id, assignmentId);
    if (result.success) {
      toast.success(`Invitation re-sent to ${email}.`);
      setResendCooldowns((prev) => ({ ...prev, [assignmentId]: 60 }));
    } else {
      toast.error(result.error || "Failed to resend invitation");
    }
  }

  function openEditDialog(pending: any) {
    setEditingId(pending.id);
    setEditEmail(pending.email);
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingId || !editEmail.trim()) return;
    setSavingEdit(true);
    const result = await editPendingAssignment(project.id, editingId, editEmail.trim());
    if (result.success) {
      toast.success("Invitation updated. A new invitation has been sent to the new email.");
      invalidate();
      setEditDialogOpen(false);
      setEditingId(null);
      setEditEmail("");
    } else {
      toast.error(result.error || "Failed to update invitation");
    }
    setSavingEdit(false);
  }

  async function handleCancel(assignmentId: string) {
    setCancelling(true);
    const result = await cancelPendingAssignment(project.id, assignmentId);
    if (result.success) {
      toast.success("Invitation removed.");
      invalidate();
    } else {
      toast.error(result.error || "Failed to remove invitation");
    }
    setCancelling(false);
    setCancellingId(null);
  }

  const slotsFilled = members.length + pendingMembers.length;
  const canAdd = slotsFilled < project.maxGroupSize;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            Members ({members.length}/{project.maxGroupSize})
          </h3>
          <p className="text-sm text-muted-foreground">
            Supervised by {project.teacher?.name}
          </p>
        </div>
        {canAdd && (
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
                  <Label>Student Institutional Email</Label>
                  <Input name="email" type="email" placeholder="student@tcetmumbai.in" required />
                  <p className="text-xs text-muted-foreground">
                    If the student hasn't registered yet, an invitation will be sent to this email.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v: "MEMBER" | "LEAD") => setRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={adding} className="w-full">
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {adding ? "Adding..." : "Add Member"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active Members */}
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

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Pending Invitations ({pendingMembers.length})
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {pendingMembers.map((p: any) => {
              const cooldown = resendCooldowns[p.id];
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border bg-card/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {p.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invitation sent · {timeAgo(p.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {p.memberRole}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(p)}
                      title="Edit invitation"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResend(p.id, p.email)}
                      disabled={!!cooldown}
                      title={cooldown ? `Resend (${cooldown}s)` : "Resend invitation"}
                    >
                      {cooldown ? (
                        <span className="text-xs font-mono">{cooldown}</span>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog
                      open={cancellingId === p.id}
                      onOpenChange={(open) => {
                        if (!open) setCancellingId(null);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancellingId(p.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this invitation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel the pending invitation and free up a slot.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancel(p.id)}
                            disabled={cancelling}
                          >
                            {cancelling ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Invitation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="student@tcetmumbai.in"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingId(null);
                  setEditEmail("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || !editEmail.trim()}>
                {savingEdit ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
