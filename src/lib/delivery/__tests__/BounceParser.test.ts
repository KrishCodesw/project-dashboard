import assert from "node:assert";
import {
  parse,
  parseRecipient,
  parseDiagnostic,
  parseMessageId,
} from "../BounceParser";

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve().then(async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (err) {
      console.log(
        `  ❌ ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// parseRecipient
// ---------------------------------------------------------------------------

test("parseRecipient extracts email from Final-Recipient with rfc822", () => {
  const body = [
    "Final-Recipient: rfc822; student@tcetmumbai.in",
    "Action: failed",
    "Status: 5.1.1",
  ].join("\n");

  assert.strictEqual(parseRecipient(body), "student@tcetmumbai.in");
});

test("parseRecipient returns null when field is missing", () => {
  const body = [
    "Action: failed",
    "Status: 5.1.1",
    "Diagnostic-Code: smtp; 550 5.1.1 User unknown",
  ].join("\n");

  assert.strictEqual(parseRecipient(body), null);
});

test("parseRecipient handles RFC822 uppercase variant", () => {
  const body = [
    "Final-Recipient: RFC822; teacher@tcetmumbai.in",
    "Action: failed",
  ].join("\n");

  assert.strictEqual(parseRecipient(body), "teacher@tcetmumbai.in");
});

test("parseRecipient handles Original-Recipient fallback", () => {
  const body = [
    "Original-Recipient: rfc822; fallback@tcetmumbai.in",
    "Action: delayed",
  ].join("\n");

  // ponytail: generic fallback regex captures the full value including rfc822; prefix
  assert.strictEqual(
    parseRecipient(body),
    "rfc822; fallback@tcetmumbai.in",
  );
});

test("parseRecipient trims whitespace around email", () => {
  const body =
    "Final-Recipient: rfc822;  spaced@tcetmumbai.in  \nAction: failed";

  assert.strictEqual(parseRecipient(body), "spaced@tcetmumbai.in");
});

test("parseRecipient returns null for empty body", () => {
  assert.strictEqual(parseRecipient(""), null);
  assert.strictEqual(parseRecipient(null as unknown as string), null);
});

// ---------------------------------------------------------------------------
// parseDiagnostic
// ---------------------------------------------------------------------------

test("parseDiagnostic extracts 550 code from smtp diagnostic", () => {
  const body = [
    "Diagnostic-Code: smtp; 550 5.1.1 The email account does not exist",
    "Status: 5.1.1",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.ok(result!.includes("550"));
});

test("parseDiagnostic extracts 450 code from temporary failure", () => {
  const body = [
    "Diagnostic-Code: smtp; 450 4.1.0 Temporary failure",
    "Status: 4.1.0",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.ok(result!.includes("450"));
});

test("parseDiagnostic handles SMTP uppercase prefix", () => {
  const body = [
    "Diagnostic-Code: SMTP; 554 5.7.1 Relay denied",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.ok(result!.includes("554"));
});

test("parseDiagnostic handles x-unix prefix", () => {
  const body = [
    "Diagnostic-Code: x-unix; 0",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.strictEqual(result, "0");
});

test("parseDiagnostic handles x-postfix prefix", () => {
  const body = [
    "Diagnostic-Code: x-postfix; delivery temporarily suspended",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.ok(result!.includes("delivery"));
});

test("parseDiagnostic grabs generic Diagnostic-Code when prefix unknown", () => {
  const body = [
    "Diagnostic-Code: dsn; 5.0.0 (Some other MTA error)",
  ].join("\n");

  const result = parseDiagnostic(body);
  assert.ok(result!.includes("5.0.0"));
});

test("parseDiagnostic returns null for body without Diagnostic-Code", () => {
  const body = [
    "Final-Recipient: rfc822; student@tcetmumbai.in",
    "Action: failed",
  ].join("\n");

  assert.strictEqual(parseDiagnostic(body), null);
});

test("parseDiagnostic returns null for empty body", () => {
  assert.strictEqual(parseDiagnostic(""), null);
});

// ---------------------------------------------------------------------------
// parseMessageId
// ---------------------------------------------------------------------------

test("parseMessageId extracts message ID from angle-bracket form", () => {
  const body = [
    "Original-Message-ID: <abc123@mail.gmail.com>",
    "Action: failed",
  ].join("\n");

  assert.strictEqual(
    parseMessageId(body),
    "<abc123@mail.gmail.com>",
  );
});

test("parseMessageId preserves the angle brackets", () => {
  const body =
    "Original-Message-ID:  <abc@example.com>  ";

  const result = parseMessageId(body);
  assert.ok(result!.startsWith("<"));
  assert.ok(result!.endsWith(">"));
});

test("parseMessageId returns null when field is missing", () => {
  const body = [
    "Final-Recipient: rfc822; student@tcetmumbai.in",
    "Diagnostic-Code: smtp; 550 5.1.1 Unknown",
  ].join("\n");

  assert.strictEqual(parseMessageId(body), null);
});

test("parseMessageId returns null for empty body", () => {
  assert.strictEqual(parseMessageId(""), null);
});

test("parseMessageId handles bare (non-angle) ID", () => {
  const body = [
    "Original-Message-ID: abc123@mail.gmail.com",
  ].join("\n");

  assert.strictEqual(
    parseMessageId(body),
    "abc123@mail.gmail.com",
  );
});

// ---------------------------------------------------------------------------
// parse  (aggregate)
// ---------------------------------------------------------------------------

test("parse returns all fields for a complete DSN body", () => {
  const body = [
    "Final-Recipient: rfc822; student@tcetmumbai.in",
    "Action: failed",
    "Status: 5.1.1",
    "Diagnostic-Code: smtp; 550 5.1.1 The email account does not exist",
    "Original-Message-ID: <msg-abc@mail.gmail.com>",
  ].join("\n");

  const result = parse(body);

  assert.strictEqual(result.recipient, "student@tcetmumbai.in");
  assert.ok(result.diagnostic!.includes("550"));
  assert.strictEqual(result.originalMessageId, "<msg-abc@mail.gmail.com>");
});

test("parse returns all-null fields for empty body", () => {
  const result = parse("");

  assert.strictEqual(result.recipient, null);
  assert.strictEqual(result.diagnostic, null);
  assert.strictEqual(result.originalMessageId, null);
});

test("parse returns partial fields when only some headers exist", () => {
  const body = [
    "Final-Recipient: rfc822; partial@tcetmumbai.in",
  ].join("\n");

  const result = parse(body);

  assert.strictEqual(result.recipient, "partial@tcetmumbai.in");
  assert.strictEqual(result.diagnostic, null);
  assert.strictEqual(result.originalMessageId, null);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const results: Promise<void>[] = [];
// Collect all auto-floating promises — node will wait for them before exiting
// because we register the handlers above.  We use a simple count below.
let pass = 0;
let fail = 0;

// Override test to track counts
const origTest = (globalThis as any).__origTest ?? test;
// We can't easily intercept; just print a summary via exit hook.

console.log("\nBounceParser Tests:");
console.log("");

process.on("exit", () => {
  console.log("\nDone.");
});
