import { WeeklyTaskStatus, MeetingType, MeetingStatus } from "@prisma/client";

export interface EvidenceItem {
  id?: string;
  title: string;
  url: string;
  type: "GITHUB" | "DRIVE" | "DESIGN" | "DOCUMENT";
}

export interface WeeklyMilestonePayload {
  weekNumber: number;
  title: string;
  description?: string;
  startDate: Date;
  dueDate: Date;
  checklists: string[];
  isBackdated?: boolean;
}

export interface WeeklyTaskSubmissionDetail {
  id: string;
  projectId: string;
  milestoneId: string;
  status: WeeklyTaskStatus;
  workLog: string | null;
  feedback: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  milestone: {
    weekNumber: number;
    title: string;
    dueDate: Date;
    checklists: string[];
  };
  evidenceLinks: EvidenceItem[];
  syncMeetings: {
    id: string;
    scheduledAt: Date;
    meetingType: MeetingType;
    locationUrl: string;
    notes: string | null;
    status: MeetingStatus;
  }[];
}