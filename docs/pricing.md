# Pricing model (October 2026)

Guidebooks are free to create. Plans differ in guest views, guidebook count and features.

| | Free | Starter $5 | Power $15 | Pro $30 |
| --- | --- | --- | --- | --- |
| Guest views / month (all guidebooks combined) | 30 | unlimited | unlimited | unlimited |
| Guidebooks (cap is fine print, not advertised for Starter) | unlimited | 5 | 100 | unlimited |
| AI recommendation runs / month (a listing import that pre-fills things to do and places to eat uses 1) | 3 | 30 | 150 | 500 (fair use) |
| PDF layouts | standard only | all + QR poster + print PDF | all | all |
| View analytics (daily charts) | no | no | yes | yes |

Limits live in `frontend/src/lib/server/plans.ts`; the marketing copy in `frontend/src/config/plans.ts`.
Old plan names map forward: `trial` -> free, `growth` -> power, `enterprise` -> pro.

## How views work
- A view is a guest page load of a published guidebook, counted once per visitor per guidebook per 30 minutes
  (salted hash of IP + user agent; no IPs stored). Crawlers, link previews, prefetches and HEAD requests are not counted.
- Free owners: every request reaches the server, is counted, and once the month's 30 are used guests see a
  "temporarily unavailable" page (also on `/guidebook/<id>`). Responses are `private, no-store`.
- Paid owners: pages stay CDN-cacheable; a small beacon (`POST /api/view/<slug>`) records the view.
- Counters reset on the 1st of each month (UTC). If the counters fail, the guidebook is served anyway.
- Without `DATABASE_URL` nothing is metered.

## Bot protection
Creating guidebooks is limited to 20/hour and 100/day per account (counted in the database, so it holds across
serverless instances), on top of the per-plan cap. AI, Places, import and PDF routes keep their per-minute limits.
Consider enabling CAPTCHA on Supabase sign-up for account-level abuse.

## Rollout checklist
1. Apply `supabase/migrations/20261022000000_usage_tracking.sql` (three new tables, RLS on, no policies).
2. Stripe: create Starter ($5), Power ($15), Pro ($30) monthly prices; set `STRIPE_STARTER_PRICE_ID`,
   `STRIPE_POWER_PRICE_ID` (replaces `STRIPE_GROWTH_PRICE_ID`) and `STRIPE_PRO_PRICE_ID` in Vercel (and Render while it
   is still live). Unset `STRIPE_ACTIVE_COUPON_ID` (the FIRSTYEAR90 coupon has expired; an invalid coupon is now ignored).
3. Stripe billing portal: allow switching between the three new prices.
4. Optional `VIEW_HASH_SALT` in Vercel.
5. The old Flask backend still enforces the old limits; it only serves requests when the Next.js routes are unconfigured.

## PDF design system (phase 1)
`/pdf` (Standard and Basic layouts) and `/print-pdf` are drawn by `frontend/src/lib/pdf/guide/`: one component renderer with three themes
(welcomebook, classic, minimal), bundled fonts, SVG icons, Letter or A4 pages, real page numbers and print-safe page breaks
(cards never split, headings stay with their first card). The Mobile and QR-poster layouts still use their older templates.
`frontend/tests/guideLayout.test.ts` renders real PDFs and fails if a page is blank, a heading is stranded or a card is split.
Bump `GUIDE_RENDER_VERSION` in `src/lib/pdf/service.ts` when the design changes.
