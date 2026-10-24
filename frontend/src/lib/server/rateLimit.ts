// Small in-memory sliding-window limiter, per server instance. It blunts accidental loops and casual abuse; use Vercel's firewall rate limiting
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

/** The caller's IP: Vercel puts the real client address first in x-forwarded-for. */
export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

export const MAX_AI_ITEMS = 10;
/** Places per generated list (food, things to do) unless the caller asks for more: each one is a few paid Google lookups. */
export const DEFAULT_AI_ITEMS = 3;

/** Clamp a caller-supplied item count to 1..MAX_AI_ITEMS (non-numbers fall back to the default). */
export function clampItems(value: unknown, fallback = DEFAULT_AI_ITEMS): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(Math.trunc(n), MAX_AI_ITEMS));
}
