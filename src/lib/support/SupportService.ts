import { supportRepo } from "./SupportRepository";
import { checkRateLimit } from "./rate-limiter";
import {
  SupportDisabledError,
  UnauthorizedTicketAccessError,
} from "./errors";
import type { SupportTicket, SupportMessage, TicketCategory } from "./types";

const SUPPORT_ENABLED = () => process.env.SUPPORT_ENABLED === "true";

export const supportService = {
  async getMyTickets(user: { email: string }): Promise<{ tickets: SupportTicket[] }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();
    const tickets = await supportRepo.getMyTickets(user.email);
    return { tickets };
  },

  async getTicketDetail(
    user: { email: string; role: string },
    conversationId: number,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();

    const { ticket, messages } = await supportRepo.getTicket(conversationId);

    const isOwner = ticket.ownerEmail === user.email;
    const isAdmin = user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new UnauthorizedTicketAccessError();
    }

    return { ticket, messages };
  },

  async createTicket(
    user: { email: string; name: string; role: string; department?: string; uid?: string },
    input: { subject: string; description: string; category: TicketCategory; attachments?: FormData },
  ): Promise<{ id: number }> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();
    checkRateLimit("createTicket", user.email);

    await supportRepo.ensureContact(user.email, user.name, {
      role: user.role,
      department: user.department ?? "",
      uid: user.uid ?? "",
    });

    const result = await supportRepo.createConversation(user.email, input.description, input.category, input.attachments, input.subject);
    return { id: result.id };
  },

  async replyToTicket(
    user: { email: string; role: string },
    conversationId: number,
    input: { content: string; attachments?: FormData },
  ): Promise<void> {
    if (!SUPPORT_ENABLED()) throw new SupportDisabledError();
    checkRateLimit("replyToTicket", user.email);

    const { ticket } = await this.getTicketDetail(user, conversationId);

    const messageType = user.role === "ADMIN" ? "outgoing" : "incoming";
    await supportRepo.sendReply(conversationId, input.content, messageType, input.attachments);
  },
};
