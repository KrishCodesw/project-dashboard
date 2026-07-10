export class SupportError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SupportError";
  }
}

export class SupportUnavailableError extends SupportError {
  constructor() {
    super("Support system is temporarily unavailable. Please try again later.", "SUPPORT_UNAVAILABLE");
    this.name = "SupportUnavailableError";
  }
}

export class ConversationNotFoundError extends SupportError {
  constructor(id: number) {
    super(`Conversation ${id} was not found.`, "CONVERSATION_NOT_FOUND");
    this.name = "ConversationNotFoundError";
  }
}

export class UnauthorizedTicketAccessError extends SupportError {
  constructor() {
    super("You do not have permission to access this ticket.", "UNAUTHORIZED");
    this.name = "UnauthorizedTicketAccessError";
  }
}

export class ChatwootApiError extends SupportError {
  constructor(public statusCode: number, message: string, public requestId?: string) {
    super(message, "CHATWOOT_API_ERROR");
    this.name = "ChatwootApiError";
  }
}

export class SupportDisabledError extends SupportError {
  constructor() {
    super("Support is not currently enabled.", "SUPPORT_DISABLED");
    this.name = "SupportDisabledError";
  }
}

export class RateLimitError extends SupportError {
  constructor(action: string) {
    super(`Rate limit exceeded for ${action}. Please wait before trying again.`, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}
