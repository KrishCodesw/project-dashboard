"use server";

import { prisma } from "@/lib/prisma";
import { requireCoeUser, requireRole } from "@/lib/coe-guard";
import { z } from "zod";
import { parseOrThrow } from "@/lib/zod-utils";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { updateProjectCompletion } from "@/lib/completion";

const createTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  dueDate: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
});

export async function createTask(data: z.infer<typeof createTaskSchema>) {
  await requireRole("TEACHER");

  const validated = parseOrThrow(createTaskSchema, data);

  const maxOrder = await prisma.task.findFirst({
    where: { projectId: validated.projectId, parentTaskId: validated.parentTaskId || null },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId: validated.projectId,
      title: validated.title,
      description: validated.description,
      assignedToId: validated.assignedToId,
      priority: validated.priority,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      parentTaskId: validated.parentTaskId,
      orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
    },
  });

  if (validated.assignedToId) {
    const project = await prisma.project.findUnique({
      where: { id: validated.projectId },
      select: { title: true },
    });
    await createNotification({
      userId: validated.assignedToId,
      type: "TASK_ASSIGNED",
      title: "New Task Assigned",
      message: `You have been assigned "${validated.title}" in ${project?.title}`,
      link: `/student/projects/${validated.projectId}/tasks`,
    });
  }

  revalidatePath(`/teacher/projects/${validated.projectId}/tasks`);
  return task;
}

export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    assignedToId?: string | null;
    status?: string;
    priority?: string;
    dueDate?: string | null;
  }
) {
  const user = await requireCoeUser();
  const role = user.role;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { teacherId: true, title: true } } },
  });

  if (!task) throw new Error("Task not found");

  // Students can only update status of tasks assigned to them
  if (role === "STUDENT") {
    if (task.assignedToId !== user.id) {
      throw new Error("You can only modify tasks that are assigned to you.");
    }
    const allowedStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
    if (data.status && !allowedStatuses.includes(data.status)) {
      throw new Error("Invalid status transition");
    }
    // Only allow status update for students
    data = { status: data.status };
  } else if (role === "TEACHER") {
    if (task.project.teacherId !== user.id) {
      throw new Error("You can only modify tasks for projects you manage.");
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.status && { status: data.status as any }),
      ...(data.priority && { priority: data.priority as any }),
      ...(data.dueDate !== undefined && {
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      }),
      ...(data.status === "DONE" && { completedAt: new Date() }),
    },
  });

  if (data.status === "DONE") {
    await updateProjectCompletion(task.projectId);
  }

  revalidatePath(`/teacher/projects/${task.projectId}/tasks`);
  revalidatePath(`/student/projects/${task.projectId}/tasks`);
  return updated;
}

export async function deleteTask(taskId: string) {
  await requireRole("TEACHER");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) throw new Error("Task not found");

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/teacher/projects/${task.projectId}/tasks`);
}

export async function reorderTasks(
  projectId: string,
  orderedIds: { id: string; orderIndex: number; status: string }[]
) {
  await requireRole("TEACHER");

  await prisma.$transaction(
    orderedIds.map((item) =>
      prisma.task.update({
        where: { id: item.id },
        data: { orderIndex: item.orderIndex, status: item.status as any },
      })
    )
  );

  await updateProjectCompletion(projectId);
  revalidatePath(`/teacher/projects/${projectId}/tasks`);
}

export async function getProjectTasks(projectId: string) {
  return prisma.task.findMany({
    where: { projectId, parentTaskId: null },
    include: {
      assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true, comments: true } },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function getStudentTasks(studentId: string) {
  return prisma.task.findMany({
    where: { assignedToId: studentId },
    include: {
      project: { select: { id: true, title: true } },
      assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true, comments: true } },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function addComment(taskId: string, content: string) {
  const user = await requireCoeUser();
  const userId = user.id;

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId: userId,
      content,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return comment;
}

export async function getTaskComments(taskId: string) {
  return prisma.comment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
