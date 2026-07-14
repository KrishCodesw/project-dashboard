import { prisma } from "@/lib/prisma";
import { wrapEmailBody } from "@/lib/email";
import { NotificationType } from "@prisma/client";

/**
 * How far ahead (in hours) a due date counts as "approaching".
 * Overridable via env so ops can tune it without a redeploy.
 */
const REMINDER_WINDOW_HOURS = Number(process.env.TASK_REMINDER_WINDOW_HOURS ?? 24);

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Prevents duplicate reminders across cron runs: looks for a notification
 * of the same type/link created after the given "anchor" time (e.g. the
 * task's updatedAt, or "now minus window" for recurring due dates).
 */
async function alreadyNotified(
  userId: string,
  type: NotificationType,
  link: string,
  sinceIso: Date
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      link,
      createdAt: { gte: sinceIso },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

async function queueReminderEmail(params: {
  to: string;
  name: string;
  subject: string;
  heading: string;
  bodyLines: string[];
  ctaLabel: string;
  ctaLink: string;
}) {
  const { to, name, subject, heading, bodyLines, ctaLabel, ctaLink } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  await prisma.emailQueue.create({
    data: {
      to,
      subject,
      body: wrapEmailBody(`
        <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">${heading}</h2>
        <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${name}</strong>,</p>
        ${bodyLines.map((line) => `<p style="color:#434651;font-size:14px;margin:12px 0;">${line}</p>`).join("")}
        <p style="margin:16px 0;">
          <a href="${appUrl}${ctaLink}" style="background:#002155;color:#ffffff;padding:10px 18px;border-radius:4px;text-decoration:none;font-size:14px;">${ctaLabel}</a>
        </p>
      `),
    },
  });
}

type ReminderCounts = {
  tasksChecked: number;
  taskRemindersSent: number;
  reviewsChecked: number;
  reviewRemindersSent: number;
  milestonesChecked: number;
  milestoneRemindersSent: number;
};

/**
 * 1) Per-student reminders for tasks assigned to them that are
 *    overdue, or due within REMINDER_WINDOW_HOURS.
 */
async function remindAssignedTasks(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS); // don't re-notify within one window

  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: { not: null },
      status: { notIn: ["DONE"] },
      dueDate: { not: null, lte: windowEnd },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      projectId: true,
      assignedToId: true,
      project: { select: { title: true } },
      assignedTo: { select: { id: true, email: true, name: true } },
    },
  });

  counts.tasksChecked = tasks.length;

  for (const task of tasks) {
    if (!task.assignedTo || !task.dueDate) continue;

    const link = `/student/projects/${task.projectId}/tasks/${task.id}`;
    const isOverdue = task.dueDate.getTime() < Date.now();

    const notified = await alreadyNotified(
      task.assignedTo.id,
      "DEADLINE_APPROACHING",
      link,
      dedupeSince
    );
    if (notified) continue;

    const statusPhrase = isOverdue ? "is overdue" : "is due soon";

    await prisma.notification.create({
      data: {
        userId: task.assignedTo.id,
        type: NotificationType.DEADLINE_APPROACHING,
        title: isOverdue ? "Task overdue" : "Task due soon",
        message: `"${task.title}" in ${task.project.title} ${statusPhrase} (due ${formatDate(task.dueDate)}).`,
        link,
      },
    });

    await queueReminderEmail({
      to: task.assignedTo.email,
      name: task.assignedTo.name,
      subject: `${isOverdue ? "Overdue" : "Reminder"}: "${task.title}" — ${task.project.title}`,
      heading: isOverdue ? "Task Overdue" : "Task Due Soon",
      bodyLines: [
        `Your task <strong>${task.title}</strong> in project <strong>${task.project.title}</strong> ${statusPhrase}.`,
        `Due date: <strong>${formatDate(task.dueDate)}</strong>.`,
      ],
      ctaLabel: "View Task",
      ctaLink: link,
    });

    counts.taskRemindersSent += 1;
  }
}

/**
 * 2) Whole-team reminders for upcoming scheduled reviews on a project.
 */
async function remindUpcomingReviews(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS);

  const reviews = await prisma.review.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: new Date(), lte: windowEnd },
    },
    select: {
      id: true,
      reviewType: true,
      scheduledAt: true,
      projectId: true,
      project: {
        select: {
          title: true,
          members: { select: { student: { select: { id: true, email: true, name: true } } } },
        },
      },
    },
  });

  counts.reviewsChecked = reviews.length;

  for (const review of reviews) {
    const link = `/student/projects/${review.projectId}/reviews`;

    for (const member of review.project.members) {
      const student = member.student;

      const notified = await alreadyNotified(
        student.id,
        "REVIEW_SCHEDULED",
        link,
        dedupeSince
      );
      if (notified) continue;

      await prisma.notification.create({
        data: {
          userId: student.id,
          type: NotificationType.REVIEW_SCHEDULED,
          title: "Upcoming review",
          message: `A ${review.reviewType} review for ${review.project.title} is scheduled for ${formatDate(review.scheduledAt)}.`,
          link,
        },
      });

      await queueReminderEmail({
        to: student.email,
        name: student.name,
        subject: `Upcoming review — ${review.project.title}`,
        heading: "Upcoming Review",
        bodyLines: [
          `A <strong>${review.reviewType}</strong> review for your project <strong>${review.project.title}</strong> is scheduled.`,
          `Scheduled for: <strong>${formatDate(review.scheduledAt)}</strong>.`,
        ],
        ctaLabel: "View Project",
        ctaLink: link,
      });

      counts.reviewRemindersSent += 1;
    }
  }
}

/**
 * 3) Whole-team reminders for upcoming/overdue project milestones.
 */
async function remindUpcomingMilestones(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS);

  const milestones = await prisma.milestone.findMany({
    where: {
      isCompleted: false,
      dueDate: { lte: windowEnd },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      projectId: true,
      project: {
        select: {
          title: true,
          members: { select: { student: { select: { id: true, email: true, name: true } } } },
        },
      },
    },
  });

  counts.milestonesChecked = milestones.length;

  for (const milestone of milestones) {
    const link = `/student/projects/${milestone.projectId}/milestones`;
    const isOverdue = milestone.dueDate.getTime() < Date.now();

    for (const member of milestone.project.members) {
      const student = member.student;

      const notified = await alreadyNotified(
        student.id,
        "MILESTONE_DUE",
        link,
        dedupeSince
      );
      if (notified) continue;

      const statusPhrase = isOverdue ? "is overdue" : "is due soon";

      await prisma.notification.create({
        data: {
          userId: student.id,
          type: NotificationType.MILESTONE_DUE,
          title: isOverdue ? "Milestone overdue" : "Milestone due soon",
          message: `Milestone "${milestone.title}" for ${milestone.project.title} ${statusPhrase} (due ${formatDate(milestone.dueDate)}).`,
          link,
        },
      });

      await queueReminderEmail({
        to: student.email,
        name: student.name,
        subject: `${isOverdue ? "Overdue" : "Reminder"}: Milestone "${milestone.title}" — ${milestone.project.title}`,
        heading: isOverdue ? "Milestone Overdue" : "Milestone Due Soon",
        bodyLines: [
          `The milestone <strong>${milestone.title}</strong> for your project <strong>${milestone.project.title}</strong> ${statusPhrase}.`,
          `Due date: <strong>${formatDate(milestone.dueDate)}</strong>.`,
        ],
        ctaLabel: "View Milestones",
        ctaLink: link,
      });

      counts.milestoneRemindersSent += 1;
    }
  }
}

export async function sendTaskReminders(): Promise<ReminderCounts> {
  const counts: ReminderCounts = {
    tasksChecked: 0,
    taskRemindersSent: 0,
    reviewsChecked: 0,
    reviewRemindersSent: 0,
    milestonesChecked: 0,
    milestoneRemindersSent: 0,
  };

  await remindAssignedTasks(counts);
  await remindUpcomingReviews(counts);
  await remindUpcomingMilestones(counts);

  return counts;
}
