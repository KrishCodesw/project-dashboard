import assert from "node:assert";
import { validate, summarizeReason } from "../BounceValidator";
import type { ParsedBounce } from "../BounceParser";

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
// Helpers
// ---------------------------------------------------------------------------

function makeParsedBounce(overrides: Partial<ParsedBounce> = {}): ParsedBounce {
  return {
    recipient: null,
    diagnostic: null,
    originalMessageId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

test("validate returns ValidatedBounce with isPermanent=true for 5xx", () => {
  const parsed = makeParsedBounce({
    recipient: "student@tcetmumbai.in",
    diagnostic: "550 5.1.1 The email account does not exist",
    originalMessageId: "<abc@mail.gmail.com>",
  });

  const result = validate(parsed);

  assert.ok(result !== null, "expected a ValidatedBounce");
  assert.strictEqual(result.isPermanent, true);
  assert.strictEqual(result.recipient, "student@tcetmumbai.in");
  assert.strictEqual(
    result.originalMessageId,
    "<abc@mail.gmail.com>",
  );
});

test("validate returns null for 4xx temporary failure", () => {
  const parsed = makeParsedBounce({
    recipient: "student@tcetmumbai.in",
    diagnostic: "450 4.1.0 Temporary failure",
  });

  assert.strictEqual(validate(parsed), null);
});

test("validate returns null when recipient is null", () => {
  const parsed = makeParsedBounce({
    recipient: null,
    diagnostic: "550 5.1.1 Unknown",
  });

  assert.strictEqual(validate(parsed), null);
});

test("validate returns null for non-institutional email", () => {
  const parsed = makeParsedBounce({
    recipient: "someone@gmail.com",
    diagnostic: "550 5.1.1 User unknown",
  });

  assert.strictEqual(validate(parsed), null);
});

test("validate returns null for all-null fields (malformed)", () => {
  const parsed = makeParsedBounce({});

  assert.strictEqual(validate(parsed), null);
});

test("validate returns null when diagnostic is null (no code to check)", () => {
  const parsed = makeParsedBounce({
    recipient: "student@tcetmumbai.in",
    diagnostic: null,
  });

  // diagnostic null → isPermanent = false → returns null
  assert.strictEqual(validate(parsed), null);
});

test("validate returns null for 2xx (non-failure code)", () => {
  const parsed = makeParsedBounce({
    recipient: "student@tcetmumbai.in",
    diagnostic: "250 2.1.5 OK",
  });

  assert.strictEqual(validate(parsed), null);
});

test("validate sets summary via summarizeReason", () => {
  const parsed = makeParsedBounce({
    recipient: "student@tcetmumbai.in",
    diagnostic: "550 5.1.1 The email account does not exist",
  });

  const result = validate(parsed);
  assert.ok(result !== null);
  assert.strictEqual(result.summary, "Mailbox does not exist");
});

// ---------------------------------------------------------------------------
// summarizeReason
// ---------------------------------------------------------------------------

test('summarizeReason "550 5.1.1 ..." returns "Mailbox does not exist"', () => {
  assert.strictEqual(
    summarizeReason("550 5.1.1 The email account does not exist"),
    "Mailbox does not exist",
  );
});

test('summarizeReason "550 5.1.10 ..." returns "Mailbox does not exist" (5.1.1 match wins by substring)', () => {
  // ponytail: source checks "5.1.1" before "5.1.10", so 5.1.10 is unreachable
  assert.strictEqual(
    summarizeReason("550 5.1.10 Recipient rejected"),
    "Mailbox does not exist",
  );
});

test('summarizeReason "550 5.2.1 ..." returns "Mailbox is disabled"', () => {
  assert.strictEqual(
    summarizeReason("550 5.2.1 Mailbox disabled"),
    "Mailbox is disabled",
  );
});

test('summarizeReason "550 5.2.2 ..." returns "Mailbox is full"', () => {
  assert.strictEqual(
    summarizeReason("550 5.2.2 Mailbox full"),
    "Mailbox is full",
  );
});

test('summarizeReason "550 5.4.1 ..." returns "Recipient domain does not exist"', () => {
  assert.strictEqual(
    summarizeReason("550 5.4.1 Domain not found"),
    "Recipient domain does not exist",
  );
});

test('summarizeReason "550 5.4.4 ..." returns "Unable to route to recipient"', () => {
  assert.strictEqual(
    summarizeReason("550 5.4.4 Unable to route"),
    "Unable to route to recipient",
  );
});

test('summarizeReason "550 5.7.1 ..." returns "Delivery not authorized"', () => {
  assert.strictEqual(
    summarizeReason("550 5.7.1 Delivery not authorized"),
    "Delivery not authorized",
  );
});

test("summarizeReason falls back to first line for unknown code", () => {
  const msg = "550 5.3.0 Some uncommon error";
  assert.strictEqual(
    summarizeReason(msg),
    msg,
  );
});

test("summarizeReason returns fallback for null diagnostic", () => {
  assert.strictEqual(
    summarizeReason(null),
    "Delivery failure",
  );
});

test("summarizeReason truncates first line to 100 chars", () => {
  const longLine = "5" + "a".repeat(150);
  const result = summarizeReason(longLine);
  assert.ok(result.length <= 100);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("BounceValidator Tests:");
console.log("");

process.on("exit", () => {
  console.log("\nDone.");
});
