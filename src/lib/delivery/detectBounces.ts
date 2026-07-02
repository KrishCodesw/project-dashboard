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
        console.warn("[BounceDetection] Low confidence match", {
          recipient: validated.recipient,
          candidatesFound: matchResult.candidatesFound,
          gmailMessageId: msg.gmailMessageId,
        });
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
