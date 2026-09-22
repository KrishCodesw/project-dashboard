import { z } from "zod";

export const CreateMilestoneSchema = z.object({
  weekNumber: z.number().int().positive("Week number must be positive"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  checklists: z.array(z.string().min(1, "Checklist item cannot be empty")),
  isBackdated: z.boolean().default(false),
});

export const StudentSubmissionSchema = z.object({
  submissionId: z.string().cuid(),
  workLog: z.string().min(10, "Work log must be at least 10 characters long"),
  evidenceLinks: z.array(
    z.object({
      title: z.string().min(1, "Title is required"),
      url: z.string().url("Must be a valid URL"),
      type: z.enum(["GITHUB", "DRIVE", "DESIGN", "DOCUMENT"]),
    })
  ).min(1, "At least one evidence attachment or link is required"),
});

export const GuideReviewSchema = z.object({
  submissionId: z.string().cuid(),
  status: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  feedback: z.string().optional(),
});

export const ScheduleSyncMeetingSchema = z.object({
  submissionId: z.string().cuid(),
  scheduledAt: z.coerce.date(),
  meetingType: z.enum(["ONLINE", "IN_PERSON"]),
  locationUrl: z.string().min(1, "Meeting link or room number is required"),
  notes: z.string().optional(),
});