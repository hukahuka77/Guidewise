# QA sweep (Oct 2026)

Scope: every page and button, bad inputs and odd URLs, driven with Playwright against a local stack (stub Supabase + PGlite, `DISABLE_BACKEND_FALLBACK=1`).

| # | Issue | Status |
|---|-------|--------|
| 1 | `/dashboard/billing` crashed when the summary request failed or lacked a plan | Fixed: error state shown |
| 2 | `/api/billing/summary` proxied to Flask when Stripe keys were missing (503 with fallback disabled) | Fixed: serves plan and usage, omits invoices |
| 3 | `/onboarding` reachable while logged out | Fixed: redirects to `/login` |
| 4 | Public guidebooks were indexable | Fixed: `X-Robots-Tag: noindex, nofollow` and `robots.ts` |
| 5 | Property names and slugs unbounded | Fixed: names capped at 120 chars, slugs capped |
| 6 | Dead section components (Parking/Wifi/Property/Arrival, Pricing, About) | Removed |
| 7 | PDF preview stuck on "Loading" with `Unknown action from worker: test` | Fixed: `pdfjs-dist` pinned to the version `react-pdf` bundles (5.3.31) so API and worker match |

Checked and fine: pricing buttons and plan query params, signup/login validation, onboarding bad-link message and import error display, print PDF and PDF downloads, 404 pages.

## Sweep 2

End-to-end journey (manual create, phone preview, style switch, every editor section, autosave, success page, dashboard card buttons, delete), 33 odd URLs signed in and out, 13 pages at phone width, and an API bad-input battery.

| # | Issue | Status |
|---|-------|--------|
| 1 | Dashboard plan line, view counts, Analytics and Upgrade buttons never loaded in production (gated on `NEXT_PUBLIC_API_BASE_URL`, which Vercel doesn't set) | Fixed |
| 2 | Pricing page checkout threw "API base not configured" in production, so nobody could upgrade; billing "Manage Subscription" did nothing for the same reason | Fixed |
| 3 | QR codes (dashboard, success page, PDF page and the QR in PDFs) encoded relative paths like `/guidebook/<id>`, so a scanned code opened nothing | Fixed: absolute URLs on the client, and the PDF route resolves `qr_url` to an absolute http(s) URL |
| 4 | Dashboard "Edit" opened the old template picker instead of the editor | Fixed: goes to `/edit/<id>`; the picker page is removed and `/dashboard/url/<id>` redirects to the editor |
| 5 | The PDF page (with the AI-designed layout option) was linked from nowhere | Fixed: "PDF Guidebook" button on each dashboard card |
| 6 | An edit typed less than about a second before leaving the editor was lost | Fixed: pending and in-flight saves are flushed with a keepalive request on leave |
| 7 | Edits made in the first moment after the editor opened were absorbed into the starting point and never saved | Fixed: the starting point is captured once |
| 8 | Editor below 1280px had no style switcher, no save status and no link to the live page | Fixed: compact toolbar above the form |
| 9 | `/edit/<unknown id>` showed an empty editor that tried to save | Fixed: "Guidebook not found" |
| 10 | `/dashboard/pdf/<id>` rendered for unknown ids and for signed-out visitors | Fixed: login redirect and "Guidebook not found" |
| 11 | Signed-out `/dashboard/billing` showed an error instead of the login page | Fixed: redirects to `/login` |
| 12 | `/success` said "Your guidebook is live!" with no guidebook | Fixed |
| 13 | Password reset email led back to the login form with no way to set a new password | Fixed: reset links open a "Choose a new password" form |
| 14 | Google sign-in from the login page landed returning users on the new-guidebook screen | Fixed: goes to the dashboard |
| 15 | Profile page load effect never cancelled (`cancelled = false` in cleanup) | Fixed |

Checked and fine: ownership on PUT/DELETE (other users get 404), template and import URL validation (including `javascript:` and metadata IPs), unauthenticated API calls (401), 404 pages for unknown slugs and ids, no horizontal overflow on any page at 390px, analytics page, delete confirmation.

Left as is: PUT with malformed JSON returns 200 and changes nothing (updates are partial, so nothing is lost).
