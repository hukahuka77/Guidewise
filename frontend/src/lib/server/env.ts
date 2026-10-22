/** Flask backend on Render, used as the fallback for anything not migrated (or not configured) yet. */
export const BACKEND_URL = (process.env.BACKEND_URL || "https://guidewise.onrender.com").replace(/\/$/, "");

/** Public origin used in absolute links inside server-rendered pages. Empty = same-origin relative links. */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_ORIGIN || "").replace(/\/$/, "");
