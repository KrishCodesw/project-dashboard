import { prisma } from "@/lib/prisma";
import { wrapEmailBody } from "@/lib/email";

const REMINDER_WINDOW_HOURS = Number(process.env.TASK_REMINDER_WINDOW_HOURS ?? 24);
const BATCH_SIZE = 500;

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

const MAX_SUBJECT_LENGTH = 180;

function truncateSubject(text: string): string {
  if (text.length <= MAX_SUBJECT_LENGTH) return text;
  return text.slice(0, MAX_SUBJECT_LENGTH - 1) + "…";
}

/**
 * Batch dedup: given a list of candidate (userId, type, link, since) tuples,
 * returns a Set of `${userId}:${link}` keys that already have a notification.
 */
async function filterAlreadyNotified(
  candidates: Array<{ userId: string; type: string; link: string; since: Date }>
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();

  const orConditions = candidates.map((c) => ({
    userId: c.userId,
    type: c.type as any,
    link: c.link,
    createdAt: { gte: c.since },
  }));

  const existing = await prisma.notification.findMany({
    where: { OR: orConditions },
    select: { userId: true, link: true },
  });

  const seen = new Set<string>();
  for (const n of existing) seen.add(`${n.userId}:${n.link}`);
  return seen;
}

type ReminderCounts = {
  tasksChecked: number;
  taskRemindersSent: number;
  reviewsChecked: number;
  reviewRemindersSent: number;
  milestonesChecked: number;
  milestoneRemindersSent: number;
};

async function remindAssignedTasks(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS);

  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: { not: null },
      status: { notIn: ["DONE"] },
      dueDate: { not: null, lte: windowEnd },
    },
    take: BATCH_SIZE,
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
  if (tasks.length === 0) return;

  // Batch dedup
  const candidates = tasks
    .filter((t) => t.assignedTo && t.dueDate)
    .map((t) => ({
      userId: t.assignedTo!.id,
      type: "DEADLINE_APPROACHING",
      link: `/student/projects/${t.projectId}/tasks/${t.id}`,
      since: dedupeSince,
    }));
  const notified = await filterAlreadyNotified(candidates);
  const due = candidates.filter((c) => !notified.has(`${c.userId}:${c.link}`));
  const dueSet = new Set(due.map((d) => `${d.userId}:${d.link}`));

  const now = Date.now();
  const notificationData: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    link: string;
  }> = [];
  const emailData: Array<{ to: string; subject: string; body: string }> = [];

  for (const task of tasks) {
    if (!task.assignedTo || !task.dueDate) continue;
    const link = `/student/projects/${task.projectId}/tasks/${task.id}`;
    if (!dueSet.has(`${task.assignedTo.id}:${link}`)) continue;

    const isOverdue = task.dueDate.getTime() < now;
    const statusPhrase = isOverdue ? "is overdue" : "is due soon";

    notificationData.push({
      userId: task.assignedTo.id,
      type: "DEADLINE_APPROACHING",
      title: isOverdue ? "Task overdue" : "Task due soon",
      message: `"${task.title}" in ${task.project.title} ${statusPhrase} (due ${formatDate(task.dueDate)}).`,
      link,
    });

    emailData.push({
      to: task.assignedTo.email,
      subject: truncateSubject(`${isOverdue ? "Overdue" : "Reminder"}: "${task.title}" — ${task.project.title}`),
      body: wrapEmailBody(`
        <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">${isOverdue ? "Task Overdue" : "Task Due Soon"}</h2>
        <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${task.assignedTo.name}</strong>,</p>
        <p style="color:#434651;font-size:14px;margin:12px 0;">Your task <strong>${task.title}</strong> in project <strong>${task.project.title}</strong> ${statusPhrase}.</p>
        <p style="color:#434651;font-size:14px;margin:12px 0;">Due date: <strong>${formatDate(task.dueDate)}</strong>.</p>
        <p style="margin:16px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}" style="background:#002155;color:#ffffff;padding:10px 18px;border-radius:4px;text-decoration:none;font-size:14px;">View Task</a></p>
      `),
    });

    counts.taskRemindersSent += 1;
  }

  if (notificationData.length > 0) {
    await prisma.notification.createMany({ data: notificationData as any });
  }
  if (emailData.length > 0) {
    await prisma.emailQueue.createMany({ data: emailData });
  }
}

async function remindUpcomingReviews(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS);

  const reviews = await prisma.review.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: new Date(), lte: windowEnd },
    },
    take: BATCH_SIZE,
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
  if (reviews.length === 0) return;

  const notificationData: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    link: string;
  }> = [];
  const emailData: Array<{ to: string; subject: string; body: string }> = [];
  const candidates: Array<{ userId: string; type: string; link: string; since: Date }> = [];

  for (const review of reviews) {
    const link = `/student/projects/${review.projectId}/reviews`;

    for (const member of review.project.members) {
      const student = member.student;
      candidates.push({
        userId: student.id,
        type: "REVIEW_SCHEDULED",
        link,
        since: dedupeSince,
      });
      notificationData.push({
        userId: student.id,
        type: "REVIEW_SCHEDULED",
        title: "Upcoming review",
        message: `A ${review.reviewType} review for ${review.project.title} is scheduled for ${formatDate(review.scheduledAt)}.`,
        link,
      });
      emailData.push({
        to: student.email,
        subject: truncateSubject(`Upcoming review — ${review.project.title}`),
        body: wrapEmailBody(`
          <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Upcoming Review</h2>
          <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${student.name}</strong>,</p>
          <p style="color:#434651;font-size:14px;margin:12px 0;">A <strong>${review.reviewType}</strong> review for your project <strong>${review.project.title}</strong> is scheduled.</p>
          <p style="color:#434651;font-size:14px;margin:12px 0;">Scheduled for: <strong>${formatDate(review.scheduledAt)}</strong>.</p>
          <p style="margin:16px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}" style="background:#002155;color:#ffffff;padding:10px 18px;border-radius:4px;text-decoration:none;font-size:14px;">View Project</a></p>
        `),
      });
    }
  }

  const notified = await filterAlreadyNotified(candidates);
  const finalNotifications = notificationData.filter(
    (n) => !notified.has(`${n.userId}:${n.link}`)
  );
  const notifiedSet = new Set(
    candidates.filter((c) => notified.has(`${c.userId}:${c.link}`)).map((c) => `${c.userId}:${c.link}`)
  );
  const finalEmails = emailData.filter(
    (_, i) => !notifiedSet.has(`${candidates[i].userId}:${candidates[i].link}`)
  );

  counts.reviewRemindersSent = finalNotifications.length;

  if (finalNotifications.length > 0) {
    await prisma.notification.createMany({ data: finalNotifications as any });
  }
  if (finalEmails.length > 0) {
    await prisma.emailQueue.createMany({ data: finalEmails });
  }
}

async function remindUpcomingMilestones(counts: ReminderCounts) {
  const windowEnd = hoursFromNow(REMINDER_WINDOW_HOURS);
  const dedupeSince = hoursFromNow(-REMINDER_WINDOW_HOURS);

  const milestones = await prisma.milestone.findMany({
    where: {
      isCompleted: false,
      dueDate: { lte: windowEnd },
    },
    take: BATCH_SIZE,
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
  if (milestones.length === 0) return;

  const now = Date.now();
  const notificationData: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    link: string;
  }> = [];
  const emailData: Array<{ to: string; subject: string; body: string }> = [];
  const candidates: Array<{ userId: string; type: string; link: string; since: Date }> = [];

  for (const milestone of milestones) {
    const link = `/student/projects/${milestone.projectId}/milestones`;
    const isOverdue = milestone.dueDate.getTime() < now;
    const statusPhrase = isOverdue ? "is overdue" : "is due soon";

    for (const member of milestone.project.members) {
      const student = member.student;

      candidates.push({
        userId: student.id,
        type: "MILESTONE_DUE",
        link,
        since: dedupeSince,
      });
      notificationData.push({
        userId: student.id,
        type: "MILESTONE_DUE",
        title: isOverdue ? "Milestone overdue" : "Milestone due soon",
        message: `Milestone "${milestone.title}" for ${milestone.project.title} ${statusPhrase} (due ${formatDate(milestone.dueDate)}).`,
        link,
      });
      emailData.push({
        to: student.email,
        subject: truncateSubject(`${isOverdue ? "Overdue" : "Reminder"}: Milestone "${milestone.title}" — ${milestone.project.title}`),
        body: wrapEmailBody(`
          <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">${isOverdue ? "Milestone Overdue" : "Milestone Due Soon"}</h2>
          <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${student.name}</strong>,</p>
          <p style="color:#434651;font-size:14px;margin:12px 0;">The milestone <strong>${milestone.title}</strong> for your project <strong>${milestone.project.title}</strong> ${statusPhrase}.</p>
          <p style="color:#434651;font-size:14px;margin:12px 0;">Due date: <strong>${formatDate(milestone.dueDate)}</strong>.</p>
          <p style="margin:16px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}" style="background:#002155;color:#ffffff;padding:10px 18px;border-radius:4px;text-decoration:none;font-size:14px;">View Milestones</a></p>
        `),
      });
    }
  }

  const notified = await filterAlreadyNotified(candidates);
  const finalNotifications = notificationData.filter(
    (n) => !notified.has(`${n.userId}:${n.link}`)
  );
  const notifiedSet = new Set(
    candidates.filter((c) => notified.has(`${c.userId}:${c.link}`)).map((c) => `${c.userId}:${c.link}`)
  );
  const finalEmails = emailData.filter(
    (_, i) => !notifiedSet.has(`${candidates[i].userId}:${candidates[i].link}`)
  );

  counts.milestoneRemindersSent = finalNotifications.length;

  if (finalNotifications.length > 0) {
    await prisma.notification.createMany({ data: finalNotifications as any });
  }
  if (finalEmails.length > 0) {
    await prisma.emailQueue.createMany({ data: finalEmails });
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
