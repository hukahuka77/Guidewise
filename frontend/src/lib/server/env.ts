/** Public origin used in absolute links inside server-rendered pages. Empty = same-origin relative links. */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_ORIGIN || "").replace(/\/$/, "");
