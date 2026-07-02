import { prisma } from "@/lib/prisma";
import type { MatchResult } from "./BounceMatcher";

export interface ProcessResult {
  assignmentId: string;
  deliveryStatus: "BOUNCED";
  bounceDiagnosticRaw: string | null;
  bounceReason: string;
  lastBounceAt: Date;
}

export async function process(match: MatchResult): Promise<ProcessResult> {
  const assignment = match.assignment!;
  const validated = match.validatedBounce;

  const updated = await prisma.pendingProjectAssignment.update({
    where: { id: assignment.id },
    data: {
      deliveryStatus: "BOUNCED",
      bounceDiagnosticRaw: validated.diagnostic,
      bounceReason: validated.summary,
      lastBounceAt: new Date(),
    },
  });

  return {
    assignmentId: updated.id,
    deliveryStatus: "BOUNCED",
    bounceDiagnosticRaw: validated.diagnostic,
    bounceReason: validated.summary,
    lastBounceAt: new Date(),
  };
}
