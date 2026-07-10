export function logChatwootRequest(
  method: string,
  path: string,
  durationMs: number,
  status: number,
  requestId?: string,
  retryCount?: number,
): void {
  const id = requestId ? ` [${requestId}]` : "";
  const retry = retryCount !== undefined && retryCount > 0 ? ` (attempt ${retryCount + 1})` : "";
  console.log(`[Chatwoot]${id} ${method} ${path} → ${status} (${durationMs}ms)${retry}`);
}
