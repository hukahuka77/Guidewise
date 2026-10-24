/**
 * Where to go after logging in, from `?next=`. Only a path on this site is accepted: it starts with a single
 * "/" (not "//" or "/\", which browsers read as another host), has no scheme, backslash or control characters,
 * and is not the login or signup page itself. Anything else returns null and the caller uses its default.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://guidewise.invalid");
    if (url.origin !== "https://guidewise.invalid") return null;
    if (/^\/(login|signup)(\/|$)/.test(url.pathname)) return null;
  } catch {
    return null;
  }
  return value;
}

/** The login page, set to come back to `path` (by default the page the browser is on) after signing in. */
export function loginPath(path?: string): string {
  const here = path ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");
  const next = safeNextPath(here);
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
