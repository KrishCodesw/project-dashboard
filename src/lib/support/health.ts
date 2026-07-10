import { chatwootRepo } from "@/lib/chatwoot/repository";

export type SupportHealth = {
  status: "healthy" | "unhealthy";
  reachable: boolean;
  tokenValid: boolean;
  accountAccessible: boolean;
  apiUsable: boolean;
  latencyMs: number;
};

export async function checkSupportHealth(): Promise<SupportHealth> {
  const start = Date.now();
  const result: SupportHealth = {
    status: "healthy",
    reachable: false,
    tokenValid: false,
    accountAccessible: false,
    apiUsable: false,
    latencyMs: 0,
  };

  try {
    await chatwootRepo.findContactByIdentifier("health-check");
    result.reachable = true;
    result.tokenValid = true;
    result.accountAccessible = true;
    result.apiUsable = true;
  } catch {
    result.reachable = true;
    result.tokenValid = false;
    result.accountAccessible = false;
    result.apiUsable = false;
  }

  result.latencyMs = Date.now() - start;
  result.status = result.apiUsable ? "healthy" : "unhealthy";
  return result;
}
