/**
 * Lightweight in-memory TTL cache for server-side data.
 *
 * Falls back to executing the function on cache miss or expiry.
 * Cache is process-local — cleared on server restart, which
 * is acceptable for dashboard data that doesn't need real-time accuracy.
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.data as T;
  }
  const data = await fn();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) store.delete(key);
  }
}
