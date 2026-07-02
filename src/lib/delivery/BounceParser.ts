export interface ParsedBounce {
  recipient: string | null;
  diagnostic: string | null;
  originalMessageId: string | null;
}

export function parseRecipient(body: string): string | null {
  if (!body) return null;

  const rfcMatch = body.match(
    /^Final-Recipient:\s*(?:rfc822|RFC822)\s*;\s*(.+)$/im,
  );
  if (rfcMatch) return rfcMatch[1].trim();

  const genericMatch = body.match(
    /^(?:Final|Original)-Recipient:\s*(.+)$/im,
  );
  if (genericMatch) return genericMatch[1].trim();

  return null;
}

export function parseDiagnostic(body: string): string | null {
  if (!body) return null;

  const smtpMatch = body.match(
    /^Diagnostic-Code:\s*(?:smtp|SMTP|x-unix|x-postfix)\s*;\s*(.+)$/im,
  );
  if (smtpMatch) return smtpMatch[1].trim();

  const genericMatch = body.match(/^Diagnostic-Code:\s*(.+)$/im);
  if (genericMatch) return genericMatch[1].trim();

  return null;
}

export function parseMessageId(body: string): string | null {
  if (!body) return null;

  const angleMatch = body.match(
    /^Original-Message-ID:\s*<([^>]+)>/im,
  );
  if (angleMatch) return `<${angleMatch[1]}>`;

  const bareMatch = body.match(/^Original-Message-ID:\s*(.+)$/im);
  if (bareMatch) return bareMatch[1].trim();

  return null;
}

export function parse(body: string): ParsedBounce {
  return {
    recipient: parseRecipient(body),
    diagnostic: parseDiagnostic(body),
    originalMessageId: parseMessageId(body),
  };
}
