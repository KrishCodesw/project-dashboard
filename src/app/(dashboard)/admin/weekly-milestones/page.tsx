"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { assignWeeklyMilestoneToAllProjects } from "@/server/actions/weekly-milestones";
import type { CreateMilestoneSchema } from "@/lib/validations/weekly-task";

/* ------------------------------------------------------------------ */
/* Helper: a simple tag‑input for checklist items                     */
/* ------------------------------------------------------------------ */
function ChecklistInput() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
      setDraft("");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="checklist-items">Checklist (deliverables)</Label>
      <div className="flex flex-wrap gap-1">
        <input
          id="checklist-items"
          placeholder="Type an item and press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="input input-bordered w-full max-w-xs"
        />
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic mt-1">
            Add at least one checklist item
          </p>
        ) : (
          <div className="flex flex-wrap gap-1 mt-1">
            {items.map((text, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted"
              >
                {text}
                <button
                  type="button"
                  onClick={() => {
                    setItems(items.filter((_, idx) => idx !== i));
                  }}
                  className="ml-2 h-3 w-3 text-muted-foreground hover:text-muted-foreground/80"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */
export default function WeeklyMilestonesAdminPage() {
  const [weekNumber, setWeekNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (checklistItems.length === 0) {
      toast.error("Please add at least one checklist item");
      return;
    }
    setIsSubmitting(true);

    try {
      const payload: CreateMilestoneSchema = {
        weekNumber: Number(weekNumber),
        title,
        description: description || undefined,
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        checklists: checklistItems,
        isBackdated: false,
      };

      const result = await assignWeeklyMilestoneToAllProjects(payload);
      toast.success(
        `Weekly milestone “${result.milestone.title}” assigned to ${result.createdSubmissionsCount} projects.`
      );
      // Reset form
      setWeekNumber("");
      setTitle("");
      setDescription("");
      setStartDate("");
      setDueDate("");
      setChecklistItems([]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Failed to create weekly milestone");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Weekly Milestone (Admin)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define a global weekly milestone; the system will create a submission
          card for **every** project automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Milestone Details</CardTitle>
          <CardDescription>
            Fill in the fields below to create a milestone that will be assigned
            to all projects. The checklist defines the required deliverables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Week Number</Label>
            <Input
              type="number"
              min={1}
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Checklist (deliverables)</Label>
            <ChecklistInput />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Weekly Milestone"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Optional: show a list of existing milestones (read‑only) */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Existing Weekly Milestones</h2>
        <p className="text-muted-foreground">
          (List view omitted – you can add a GET action to show all milestones.)
        </p>
      </section>
    </div>
  );
}