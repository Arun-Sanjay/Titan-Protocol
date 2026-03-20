/**
 * Simple in-memory score cache with TTL-based invalidation.
 *
 * Dexie's liveQuery already re-fires when data changes, so this cache
 * primarily prevents redundant recomputation within the same render cycle
 * (e.g., multiple components requesting the same date range).
 *
 * The cache auto-clears entries after TTL_MS to avoid stale data.
 */

const TTL_MS = 2_000; // 2 seconds — short enough to stay fresh, long enough to coalesce

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateScoreCache(): void {
  cache.clear();
}

/**
 * Wrap an async function with caching. Returns cached result if available,
 * otherwise calls the function and caches the result.
 */
export async function withScoreCache<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  const result = await fn();
  setCached(key, result);
  return result;
}
