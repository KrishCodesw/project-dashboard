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
      console.log("[PIPELINE] msg", msg.gmailMessageId, "RAW BODY (full):", msg.rawBody);
      const parsed: ParsedBounce = parse(msg.rawBody);
      console.log("[PIPELINE] msg", msg.gmailMessageId, "Parsed:", JSON.stringify(parsed));

      // 2. Validate
      const validated: ValidatedBounce | null = validate(parsed);
      console.log("[PIPELINE] msg", msg.gmailMessageId, "Validated:", validated ? "yes" : "NO — null (rejected)");
      if (!validated) {
        await markRead(gmail, msg.gmailMessageId);
        continue;
      }

      // 3. Match
      const matchResult: MatchResult = await match(validated);
      console.log("[PIPELINE] msg", msg.gmailMessageId, "Match:", matchResult.matchConfidence, "| method:", matchResult.matchMethod, "| candidates:", matchResult.candidatesFound);

      if (matchResult.matchConfidence === "HIGH" || matchResult.matchConfidence === "MEDIUM") {
        await process(matchResult);
        await notifyBounce(matchResult);
        bounced++;
      } else if (matchResult.matchConfidence === "LOW") {
        console.warn("[BounceDetection] Low confidence match", {
          recipient: validated.recipient,
          candidatesFound: matchResult.candidatesFound,
          gmailMessageId: msg.gmailMessageId,
        });
        // Log all candidate project IDs for debugging
        if (matchResult.assignment) {
          console.warn("[BounceDetection] LOW matched assignment — unexpected");
        } else {
          // Fetch candidate info to help debug
          try {
            const { prisma } = await import("@/lib/prisma");
            const candidates = await prisma.pendingProjectAssignment.findMany({
              where: { email: validated.recipient, status: "PENDING", deliveryStatus: null },
              select: { id: true, projectId: true, email: true },
            });
            console.warn("[BounceDetection] LOW candidates:", JSON.stringify(candidates));
          } catch (_) {}
        }
        lowConfidence++;
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
