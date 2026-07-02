import { createGmailClient, fetchNew, markRead } from "./BounceFetcher";
import { parse } from "./BounceParser";
import type { ParsedBounce } from "./BounceParser";
import { validate } from "./BounceValidator";
import type { ValidatedBounce } from "./BounceValidator";
import { match } from "./BounceMatcher";
import type { MatchResult } from "./BounceMatcher";
import { process } from "./BounceProcessor";
import type { ProcessResult } from "./BounceProcessor";
import { notifyBounce } from "./NotificationService";

export interface BounceDetectionResult {
  checked: number;
  bounced: number;
  errors: number;
  lowConfidence: number;
}

export async function detectBounces(): Promise<BounceDetectionResult> {
  const gmail = await createGmailClient();
  const messages = await fetchNew(gmail, { maxResults: 10 });

  let bounced = 0, errors = 0, lowConfidence = 0;

  for (const msg of messages) {
    try {
      // 1. Parse
      const parsed: ParsedBounce = parse(msg.rawBody);

      // 2. Validate
      const validated: ValidatedBounce | null = validate(parsed);
      if (!validated) {
        await markRead(gmail, msg.gmailMessageId);
        continue;
      }

      // 3. Match
      const matchResult: MatchResult = await match(validated);

      if (matchResult.matchConfidence === "HIGH" || matchResult.matchConfidence === "MEDIUM") {
        await process(matchResult);
        await notifyBounce(matchResult);
        bounced++;
      } else if (matchResult.matchConfidence === "LOW") {
        // The email is bouncing — it's undeliverable no matter which project
        // sent it. Bounce all pending assignments for this email.
        const { prisma } = await import("@/lib/prisma");
        const allCandidates = await prisma.pendingProjectAssignment.findMany({
          where: {
            email: validated.recipient,
            status: "PENDING",
            deliveryStatus: null,
          },
          include: { project: { select: { teacherId: true, title: true } } },
        });
        for (const candidate of allCandidates) {
          const forcedMatch: MatchResult = {
            assignment: candidate,
            matchConfidence: "LOW",
            matchMethod: "email_multiple",
            candidatesFound: allCandidates.length,
            validatedBounce: validated,
          };
          await process(forcedMatch);
          await notifyBounce(forcedMatch);
          bounced++;
        }
      }
      // NONE: no action needed

      // 4. Remove UNREAD — DSN stays in Inbox
      await markRead(gmail, msg.gmailMessageId);
    } catch (err) {
      errors++;
      console.error("[BounceDetection] Error processing message", {
        gmailMessageId: msg.gmailMessageId,
        error: err instanceof Error ? err.message : String(err),
      });
      // DSN NOT marked as read — will retry next run
    }
  }

  return { checked: messages.length, bounced, errors, lowConfidence };
}
