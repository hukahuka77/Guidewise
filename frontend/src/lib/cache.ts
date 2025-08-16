type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function cacheSet<T>(key: string, value: T, ttlMs = 60_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheClear(key?: string): void {
  if (key) store.delete(key); else store.clear();
}
