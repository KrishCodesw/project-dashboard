import { isInstitutionalEmail } from "@/lib/validation";
import type { ParsedBounce } from "./BounceParser";

export interface ValidatedBounce {
  recipient: string;
  diagnostic: string | null;
  originalMessageId: string | null;
  isPermanent: boolean;
  summary: string;
}

export function validate(bounce: ParsedBounce): ValidatedBounce | null {
  if (!bounce.recipient) return null;
  if (!isInstitutionalEmail(bounce.recipient)) return null;

  const isPermanent = bounce.diagnostic
    ? /^\s*5\d{2}\s/.test(bounce.diagnostic)
    : false;

  if (!isPermanent) return null;

  return {
    recipient: bounce.recipient,
    diagnostic: bounce.diagnostic,
    originalMessageId: bounce.originalMessageId,
    isPermanent: true,
    summary: summarizeReason(bounce.diagnostic),
  };
}

export function summarizeReason(diagnostic: string | null): string {
  if (!diagnostic) return "Delivery failure";

  if (diagnostic.includes("5.1.10")) return "Recipient rejected by mail server";
  if (diagnostic.includes("5.1.1")) return "Mailbox does not exist";
  if (diagnostic.includes("5.2.1")) return "Mailbox is disabled";
  if (diagnostic.includes("5.2.2")) return "Mailbox is full";
  if (diagnostic.includes("5.4.1")) return "Recipient domain does not exist";
  if (diagnostic.includes("5.4.4")) return "Unable to route to recipient";
  if (diagnostic.includes("5.7.1")) return "Delivery not authorized";

  return diagnostic.split("\n")[0].trim().slice(0, 100);
}
