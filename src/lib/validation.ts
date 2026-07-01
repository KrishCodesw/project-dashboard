const INSTITUTIONAL_EMAIL_DOMAIN =
  process.env.INSTITUTIONAL_EMAIL_DOMAIN || "tcetmumbai.in";

export function isInstitutionalEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const domain = `@${INSTITUTIONAL_EMAIL_DOMAIN}`;
  return normalized.endsWith(domain) && normalized.indexOf("@") === normalized.length - domain.length;
}

export function getInstitutionalDomain(): string {
  return process.env.INSTITUTIONAL_EMAIL_DOMAIN || "tcetmumbai.in";
}
