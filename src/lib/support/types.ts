export interface SupportTicket {
  id: number;
  subject: string;
  description?: string | null;
  status: string;
  priority?: string;
  category: string;
  ownerEmail: string | null;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  labels: string[];
}

export interface SupportMessage {
  id: number;
  content: string;
  senderName: string;
  senderType: "user" | "admin" | "system";
  createdAt: string;
  attachments: SupportAttachment[];
  isInternal: boolean;
}

export interface SupportAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
}

export interface SupportContact {
  email: string;
  name: string;
}

export type TicketCategory = "BUG" | "QUESTION" | "FEATURE_REQUEST" | "SUGGESTION" | "OTHER";
