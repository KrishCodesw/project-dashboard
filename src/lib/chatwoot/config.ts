export const chatwootConfig = {
  apiUrl: process.env.CHATWOOT_API_URL ?? "",
  accountId: process.env.CHATWOOT_ACCOUNT_ID ?? "",
  apiToken: process.env.CHATWOOT_API_TOKEN ?? "",
  webhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET ?? "",
};

export function validateChatwootConfig(): void {
  const missing: string[] = [];
  if (!chatwootConfig.apiUrl) missing.push("CHATWOOT_API_URL");
  if (!chatwootConfig.accountId) missing.push("CHATWOOT_ACCOUNT_ID");
  if (!chatwootConfig.apiToken) missing.push("CHATWOOT_API_TOKEN");
  if (!chatwootConfig.webhookSecret) missing.push("CHATWOOT_WEBHOOK_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Chatwoot configuration is incomplete. Missing: ${missing.join(", ")}\n` +
      "The support feature cannot start without these environment variables.",
    );
  }
}
