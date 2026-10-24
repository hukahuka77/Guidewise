// Where a host first came from (first touch: utm tags, referrer, landing page), kept in the browser
// until they create an account, then saved on the account's user metadata so we can see which
// marketing channel brings hosts in.

const KEY = "guidewise-first-touch";
const HEARD_KEY = "guidewise-heard-about";

export interface FirstTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing: string;
  at: string;
}

/** Remember the first visit's source; later visits never overwrite it. */
export function recordFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    const touch: FirstTouch = {
      source: q.get("utm_source") || q.get("ref") || undefined,
      medium: q.get("utm_medium") || undefined,
      campaign: q.get("utm_campaign") || undefined,
      referrer: ref && ref !== window.location.hostname ? ref : undefined,
      // A gift link's path holds its claim ticket, which must not be copied onto the account
      landing: window.location.pathname.startsWith("/gift/") ? "/gift" : window.location.pathname,
      at: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch { }
}

export function readFirstTouch(): FirstTouch | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/** The signup form's "How did you hear about us?" answer, kept until it is saved on the account. */
export function rememberHeardAbout(answer: string): void {
  try {
    if (answer) localStorage.setItem(HEARD_KEY, answer);
  } catch { }
}

export function readHeardAbout(): string | null {
  try {
    return localStorage.getItem(HEARD_KEY);
  } catch {
    return null;
  }
}
