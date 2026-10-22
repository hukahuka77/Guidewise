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
