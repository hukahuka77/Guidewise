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

const REMEMBERED_KEY = "guidewise-next";

/**
 * Remember where to go after a Google sign-in or an email confirmation. Those return to a fixed page that
 * is on Supabase's list of allowed redirects (any other address would be refused), which then calls
 * takeRememberedNextPath.
 */
export function rememberNextPath(next: string | null): void {
  try {
    if (safeNextPath(next)) localStorage.setItem(REMEMBERED_KEY, next as string);
  } catch {
    // Storage blocked: they land on the usual page instead
  }
}

/** The remembered path, once: it is cleared as it's read. */
export function takeRememberedNextPath(): string | null {
  try {
    const value = localStorage.getItem(REMEMBERED_KEY);
    localStorage.removeItem(REMEMBERED_KEY);
    return safeNextPath(value);
  } catch {
    return null;
  }
}
