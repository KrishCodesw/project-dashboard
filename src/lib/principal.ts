/**
 * Centralized Principal authorization logic.
 *
 * All Principal-related logic lives here so that a future migration
 * to a database-backed Principal model only touches this file.
 */
export function getPrincipalEmails(): string[] {
  const raw = process.env.PRINCIPAL_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPrincipal(email: string): boolean {
  if (!email) return false;
  const emails = getPrincipalEmails();
  return emails.includes(email.toLowerCase().trim());
}
