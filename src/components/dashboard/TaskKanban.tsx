"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Calendar, GripVertical, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getProjectWeeklySubmissions } from "@/server/actions/common-weekly-tasks";
import { WeeklyTaskStatus } from "@prisma/client";
import { WeeklyStatusBadge } from "@/components/weekly-tasks/WeeklyStatusBadge";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number; comments: number };
}

interface WeeklyTaskSubmissionData {
  id: string;
  milestone: {
    weekNumber: number;
    title: string;
    description?: string | null;
    startDate: Date;
    dueDate: Date;
    checklists: { text: string }[];
  };
  status: WeeklyTaskStatus;
  workLog: string | null;
  feedback: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  evidenceLinks: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
  }>;
  syncMeetings: Array<{
    id: string;
    scheduledAt: Date;
    meetingType: string;
    locationUrl: string;
    notes: string | null;
    status: string;
  }>;
}

interface TaskKanbanProps {
  projectId: string;
  tasks: Task[];
  onTaskMove?: (taskId: string, newStatus: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, data: any) => void;
  onWeeklyTaskClick?: (submissionId: string) => void;
}

const columns = [
  { id: "TODO", title: "To Do", color: "border-t-slate-500" },
  { id: "IN_PROGRESS", title: "In Progress", color: "border-t-blue-500" },
  { id: "IN_REVIEW", title: "In Review", color: "border-t-amber-500" },
  { id: "DONE", title: "Done", color: "border-t-emerald-500" },
  { id: "BLOCKED", title: "Blocked", color: "border-t-rose-500" },
];

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-500",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-rose-500",
};

// Map WeeklyTaskStatus to our column status
function mapWeeklyTaskStatusToColumn(status: WeeklyTaskStatus): string {
  switch (status) {
    case WeeklyTaskStatus.PENDING:
      return "TODO";
    case WeeklyTaskStatus.UNDER_REVIEW:
      return "IN_REVIEW";
    case WeeklyTaskStatus.APPROVED:
      return "DONE";
    case WeeklyTaskStatus.REVISION_REQUESTED:
      return "IN_PROGRESS"; // Treat revision requested as in progress
    default:
      return "TODO";
  }
}

function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("h-2 w-2 rounded-full shrink-0", priorityColors[task.priority])} />
            <span className="text-sm font-medium truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.dueDate), "MMM d")}
              </div>
            )}
            {task._count.comments > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {task._count.comments}
              </div>
            )}
          </div>
        </div>
        {task.assignedTo && (
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              {task.assignedTo.name.split(" ").map((n) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// Non-draggable card for weekly task submissions
function WeeklyTaskCard({
  weeklyTask,
  onClick,
}: {
  weeklyTask: WeeklyTaskSubmissionData;
  onClick?: () => void;
}) {
  const columnId = mapWeeklyTaskStatusToColumn(weeklyTask.status);
  const column = columns.find((c) => c.id === columnId);
  const { weekNumber, title: milestoneTitle, dueDate } = weeklyTask.milestone;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer",
        "border-l-2",
        column?.color
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", priorityColors.MEDIUM)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">Week {weekNumber}</span>
              <span className="text-xs font-medium">{milestoneTitle}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {dueDate && (
                <>
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(dueDate), "MMM d")}</span>
                </>
              )}
              <WeeklyStatusBadge status={weeklyTask.status} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  id,
  children,
  weeklyChildren,
}: {
  id: string;
  children: React.ReactNode;
  weeklyChildren: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 space-y-2 p-2 min-h-[100px] rounded-b-lg transition-colors",
        isOver && "bg-accent/40"
      )}
    >
      {children}
      <div className="mt-4">
        {weeklyChildren}
      </div>
    </div>
  );
}

export function TaskKanban({
  projectId,
  tasks,
  onTaskMove,
  onTaskClick,
  onTaskUpdate,
  onWeeklyTaskClick,
}: TaskKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTaskSubmissionData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch weekly task submissions for the project
  useEffect(() => {
    let cancelled = false;
    async function fetchWeeklyTasks() {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectWeeklySubmissions(projectId);
        if (!cancelled) {
          setWeeklyTasks(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load weekly tasks");
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (projectId) {
      fetchWeeklyTasks();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overData = over.data.current;
    const overId = over.id as string;

    // Find which column was dropped to
    const targetColumn = columns.find((c) => c.id === overId);
    if (targetColumn) {
      if (typeof onTaskMove === "function") onTaskMove(taskId, targetColumn.id);
      else if (typeof onTaskUpdate === "function") onTaskUpdate(taskId, { status: targetColumn.id });
      return;
    }

    // Dropped on another task — use that task's column
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      if (typeof onTaskMove === "function") onTaskMove(taskId, overTask.status);
      else if (typeof onTaskUpdate === "function") onTaskUpdate(taskId, { status: overTask.status });
    }
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <>
      {loading && (
        <div className="w-full flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {!loading && error && (
        <div className="w-full flex justify-center py-4 text-red-500">
          {error}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.status === column.id);
            const columnWeeklyTasks = weeklyTasks.filter(
              (wt) => mapWeeklyTaskStatusToColumn(wt.status) === column.id
            );
            return (
              <div
                key={column.id}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-lg border border-t-2 bg-card/50",
                  column.color
                )}
              >
                <div className="flex items-center justify-between p-3">
                  <h3 className="text-sm font-semibold">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnTasks.length + columnWeeklyTasks.length}
                  </Badge>
                </div>
                <SortableContext
                  id={column.id}
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn
                    id={column.id}
                    children={
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
                        />
                      ))
                    }
                    weeklyChildren={
                      columnWeeklyTasks.map((weeklyTask) => (
                        <WeeklyTaskCard
                          key={weeklyTask.id}
                          weeklyTask={weeklyTask}
                          onClick={
                            onWeeklyTaskClick
                              ? () => onWeeklyTaskClick(weeklyTask.id)
                              : undefined
                          }
                        />
                      ))
                    }
                  />
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-lg border bg-card p-3 shadow-lg opacity-90 w-72">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", priorityColors[activeTask.priority])} />
                <span className="text-sm font-medium">{activeTask.title}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}