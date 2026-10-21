// Small in-memory sliding-window limiter, per server instance (like the Flask version it replaces, which
// was per gunicorn worker). It blunts accidental loops and casual abuse; use Vercel's firewall rate limiting
// for hard guarantees across instances.
const buckets = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs = 60_000, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  // keep the map from growing without bound
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return false;
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

export const MAX_AI_ITEMS = 10;

/** Clamp a caller-supplied item count to 1..MAX_AI_ITEMS (non-numbers fall back to the default). */
export function clampItems(value: unknown, fallback = 5): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(Math.trunc(n), MAX_AI_ITEMS));
}
