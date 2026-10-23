/** Absolute URL for a public page. QR codes and shared links must not be relative, or a scanned code leads nowhere. */
export function absoluteUrl(path: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** A QR target as an absolute http(s) URL resolved against `base`; anything else (javascript:, garbage) gives null. */
export function absoluteQrUrl(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
