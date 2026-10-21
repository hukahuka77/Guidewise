# Flask -> Next.js (Vercel) migration

Goal: one deployment from GitHub (Vercel). The Flask backend on Render is retired only after every
route has a native Next.js replacement. Backup and rollback notes: `pre-migration-backup.md`.

## How the transition works

`frontend/next.config.ts` has *fallback* rewrites: any `/api/*`, `/g/*`, `/preview/*`, `/guidebook/*`
request that no Next.js page or route handler claims is proxied to Flask (`BACKEND_URL`). So a route
is "migrated" simply by adding a Next.js route handler for it, and "rolled back" by deleting it.

Native routes also protect themselves: if they are not configured, or anything throws, they proxy the
same request to Flask (`src/lib/server/proxy.ts`).

## Status

| Step | Scope | State |
| --- | --- | --- |
| 1 | Vercel in front of Render (rewrites, edge caching, same-origin API) | on `main` |
| 2 | Public guidebook pages: `/g/[slug]`, `/preview/[id]`, `/guidebook/[id]` | on `main`, activates when `SUPABASE_SERVICE_ROLE_KEY` is set |
| 3 | Logged-in CRUD (create/edit/list/get/delete/publish/toggle/template, hosts) | on `main`, activates when `DATABASE_URL` is set in Vercel |
| 4 | Integrations (Stripe billing + webhook, Places, place photos, AI recommendations, listing import) | code complete; each route activates when its keys are set in Vercel (see below) |
| 5 | PDFs (`/api/guidebook/[id]/pdf`, `/print-pdf`) with headless Chromium | code complete; always native (falls back to Flask only if it throws) |
| 6 | Retire Render | after the cutover checklist below, on your go-ahead |

## Step 2 details

- The three guidebook templates were copied from `backend/templates` into
  `frontend/src/templates/guidebook` and run with Nunjucks (Jinja-compatible). The few Python-isms were
  rewritten by `frontend/scripts/port-jinja-templates.py`; the helpers Jinja/Python provided
  (`place_photo_url`, `urlencode`, `title`, rule normalisation, empty-list truthiness) live in
  `frontend/src/lib/guidebook`.
- Parity is proven, not assumed. `frontend/tests/parity/golden/*.html` are pages rendered by the real
  Flask code (`generate_goldens.py`); `guidebook.parity.test.ts` requires the Next.js output to match
  byte for byte. `helpers.parity.test.ts` does the same for the helper functions against Python's output.
  `npm run build` runs these tests, so a regression blocks the deploy.
- `frontend/tests/integration/` has local stand-ins for Flask and Supabase for exercising the routes
  (found / missing / draft token / owner login / fallback).
- Reads use the Supabase service-role key (server only, bypasses RLS), so the routes enforce access
  themselves: drafts need the share token or the owner's access token, everything else 404s.

### Enabling step 2 (Vercel dashboard, Production and Preview)

Add `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard > Project Settings > API > `service_role`). Do not
prefix it with `NEXT_PUBLIC_`. Redeploy. `/g/*`, `/preview/*` and `/guidebook/*` are then rendered by
Next.js; remove the variable to return to Flask instantly.

Optional: `SUPABASE_URL` (defaults to `NEXT_PUBLIC_SUPABASE_URL`), `BACKEND_URL` (defaults to the Render URL).

### Regenerating the golden files (only needed if the Flask templates change)

```
python3 frontend/tests/parity/generate_goldens.py
python3 frontend/tests/parity/generate_unit_expectations.py
python3 frontend/scripts/port-jinja-templates.py
```

## Step 3 details

Routes now native in Next.js (all require a Supabase access token, 401 otherwise):
`POST /api/generate`, `GET /api/guidebooks`, `GET|PUT|PATCH|DELETE /api/guidebooks/:id`,
`POST /api/guidebooks/:id/publish`, `POST /api/guidebooks/:id/toggle`, `POST /api/guidebook/:id/template`,
`GET /api/hosts`.

- `src/lib/server/guidebookService.ts` is a port of the Flask logic. Anything touching several tables
  (create, update, toggle) runs in one Postgres transaction, like the SQLAlchemy session it replaces.
  Data access is direct SQL (`postgres` package) through the Supabase pooler, so ownership checks are in
  the SQL/service code exactly as in Flask (the service connection bypasses RLS).
- Tokens are verified with Supabase Auth (`auth.getUser`), so no JWT secret is needed in Vercel.
- Tests run against a real Postgres engine (PGlite) loaded with a copy of the production schema
  (`tests/helpers/schema.sql`): service logic, plan limits, atomicity (a failed create/update leaves no
  partial rows), ownership, publish freshness, and the HTTP handlers. `tests/integration/native-routes.sh`
  also exercises the running Next.js server end to end.
- Routes fall back to Flask when `DATABASE_URL` (or Supabase auth) is not configured. Writes never retry on
  Flask after an error (they would risk duplicates); reads do.
- `POST /api/guidebooks/activate_for_user` is NOT migrated: the Flask route calls a helper that does not exist
  and always errors. An explicit pass-through route keeps it reaching Flask instead of being captured by
  `/api/guidebooks/[id]` (which would answer 405). `/api/maintenance/cleanup-expired` is also left behind
  (it references columns that do not exist).

### Intentional differences from Flask

- Creating a guidebook without `property_name` returns 400 (Flask crashed with a 500).
- Updating with a non-string `template_key` ignores it (Flask raised on the NOT NULL column).
- Creating a draft preview token no longer bumps `last_modified_time` (it made the dashboard order jump
  and marked fresh snapshots stale).
- Publish renders `ctx.rules` through the same normaliser as the live page (Flask's snapshot used the raw
  value, one of the drift bugs from issue #35). Everything else in the snapshot is byte-identical (golden-tested).
- Timestamps are ISO strings with milliseconds and a `Z`; `GET /api/hosts` is ordered by id.

### Enabling step 3 (Vercel dashboard, Production and Preview)

Add `DATABASE_URL` (the same value as on Render; the Supabase pooler URL) as a server-side variable and
redeploy. Remove it to return these routes to Flask instantly.


## Step 4 details

Each integration route proxies to Flask until the keys it needs exist in Vercel, so keys can be added one
integration at a time and removed again to roll back instantly.

| Routes | Needs in Vercel |
| --- | --- |
| `/api/billing/*`, `/webhooks/stripe` | `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_PRICE_ID` (+ optional coupon / portal config ids) |
| `/api/places/search`, `/api/places/enrich`, `/api/place-photo` | `GOOGLE_API_KEY` (+ Supabase auth for the first two) |
| `/api/ai-recommendations`, `/api/ai-food`, `/api/ai-activities` | `OPENAI_API_KEY`, `GOOGLE_API_KEY` |
| `/api/import-listing` | `OPENAI_API_KEY`, `DATABASE_URL` |

- **Stripe webhook**: create a second webhook endpoint in Stripe pointing at `https://<site>/webhooks/stripe`
  (it gets its own signing secret, used as `STRIPE_WEBHOOK_SECRET` in Vercel). Keep the Render endpoint until
  cutover, then delete it. The API version is pinned to the one Flask used.
- **Rate limits** (AI 10/min, Places 60/min, import 5/min per user) and the 10-item cap match Flask. The limiter is
  per server instance, like Flask's was per worker; add a Vercel firewall rule for a hard global limit.
- **Place photos** are public and cached for a week at the CDN (`s-maxage=604800`).
- **AI recommendations** enrich items in parallel (Flask did it one by one), so they return faster.
- **Listing import** now also reads the JSON state embedded in the page and stores `og:image` as the cover image.
  It is best effort: Airbnb may still serve a bot wall, in which case the user gets the same "blocked" message.

## Step 5 details: PDFs

- WeasyPrint is replaced by headless Chromium (`@sparticuz/chromium` + `puppeteer-core`) inside the two PDF
  route handlers. Templates are the same Jinja files ported to Nunjucks (`frontend/src/templates/pdf`);
  the generated HTML is golden-tested against what Flask handed to WeasyPrint.
- Chromium and WeasyPrint lay text out differently (fonts, rounding), so PDFs are not pixel identical. Page counts
  match for all templates except the welcomebook print, whose check-in page can spill a few boxes onto an extra page.
- The headless browser can only load public http(s) images and data URIs (private/loopback hosts and other
  schemes are blocked) and runs with JavaScript disabled.
- Routes are rate limited to 10 PDFs/min per user. Function config: `maxDuration` 60s; make sure the Vercel plan
  allows at least 1 GB of function memory.
- Both `/pdf` and `/print-pdf` responses are `Cache-Control: private` (Flask said `public`, which let shared caches
  store an authenticated PDF).

### Deliberate differences from Flask (all bug fixes; the Flask copy of each was fixed too so the goldens agree)

- PDF templates are now HTML-escaped (Flask rendered guidebook text into the HTML verbatim).
- The PDF context now includes `wifi` and `house_manual` and keeps `driving_minutes` on items; the templates
  already read these but Flask never supplied them, so Wi-Fi details, the House Manual page and drive times never
  appeared in those PDFs.
- Print PDFs on the original/basic layouts print rules as text instead of a Python dict repr.
- The mobile and QR templates got small CSS changes so Chromium does not emit blank pages.

## Cutover checklist (production)

Do these in order; each step can be undone by removing the variable / redeploying the previous deployment.

1. Take a Supabase backup (Database > Backups). Code backups already exist (`docs/pre-migration-backup.md`).
2. In Vercel (Production + Preview) add: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`,
   `GOOGLE_API_KEY` (already present), `STRIPE_SECRET_KEY`, `STRIPE_*_PRICE_ID`, `STRIPE_ACTIVE_COUPON_ID`,
   `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_WEBHOOK_SECRET` (the new endpoint's secret, see Step 4).
3. Remove `NEXT_PUBLIC_API_BASE_URL` so the browser calls the same origin, then redeploy.
4. Merge `main` into `prod` and smoke test on the production URL: log in, dashboard, edit and publish a guidebook,
   open its public link, download both PDFs, add a place (search, photo), generate AI recommendations, import an
   Airbnb listing, open the billing page and (in Stripe test mode) run checkout.
5. In Stripe, add the `https://<site>/webhooks/stripe` endpoint (done before step 4 if you want live events handled
   by Vercel immediately) and send a test event.
6. Watch Vercel runtime logs for a few days. When satisfied: scale the Render service to zero (or suspend), wait a
   week, then delete it and remove `BACKEND_URL`, the `rewrites().fallback` entries and `backend/`.
