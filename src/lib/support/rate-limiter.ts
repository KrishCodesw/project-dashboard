import { RateLimitError } from "./errors";

const windows = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  createTicket: { max: 5, windowMs: 60_000 },
  replyToTicket: { max: 10, windowMs: 60_000 },
};

export function checkRateLimit(action: string, key: string): void {
  const limit = LIMITS[action];
  if (!limit) return;

  const now = Date.now();
  const entry = windows.get(`${action}:${key}`);

  if (!entry || now > entry.resetAt) {
    windows.set(`${action}:${key}`, { count: 1, resetAt: now + limit.windowMs });
    return;
  }

  if (entry.count >= limit.max) {
    throw new RateLimitError(action);
  }

  entry.count++;
}
