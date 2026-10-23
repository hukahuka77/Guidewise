# Local development

Guidewise is one Next.js application in `frontend/`. It serves the site, the API routes
(`/api/*`), the public guidebook pages (`/g/<slug>`, `/guidebook/<id>`), PDFs and the Stripe webhook.
It runs at `http://localhost:3000` locally and on Vercel in production.

## Prerequisites

- Node.js 20 and npm (the versions used by CI)
- Access to a Guidewise-compatible Supabase project (the Supabase dev branch works well); apply the
  repository's migrations in `supabase/migrations/`
- Chromium only if you generate PDFs locally: set `PDF_CHROMIUM_PATH` to a local Chromium/Chrome
  binary (on Vercel the bundled `@sparticuz/chromium` is used)

## Environment

Create `frontend/.env.local` (ignored by Git). Never commit credentials or paste them into issues,
pull requests or chat. Every `NEXT_PUBLIC_*` value ends up in browser code and must not be a secret.

```dotenv
# Site and Supabase (required)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET=YOUR_FOOD_ACTIVITIES_BUCKET
NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET=YOUR_USER_VIDEOS_BUCKET

# Server (required for the API and guidebook pages)
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Feature-specific
OPENAI_API_KEY=YOUR_OPENAI_API_KEY               # listing import, AI recommendations, AI PDF layout
GOOGLE_API_KEY=YOUR_SERVER_GOOGLE_MAPS_KEY       # Places search, photos, travel times
NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_BROWSER_KEY      # address autocomplete in the browser
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_POWER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...           # optional
STRIPE_ACTIVE_COUPON_ID=...                      # optional
NEXT_PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/YOUR_FORM_ID
VIEW_HASH_SALT=any-random-string                 # salts the hashed visitor ids used for view counting
```

Use the Supabase *pooler* connection string for `DATABASE_URL` (the direct `db.<project>.supabase.co`
host is IPv6-only). A route whose configuration is missing answers `503` ("not configured") rather
than failing in odd ways, so you can run with only the parts you need. The Supabase anon key is a
public client value; Row Level Security must still protect data.

## Install and run

```bash
cd frontend
npm ci
npm run dev
```

## Checks

```bash
scripts/check.sh            # npm ci, lint, typecheck, then tests + production build
scripts/check.sh --skip-install
```

Or individually, from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test                    # vitest, against an in-process Postgres (PGlite)
npm run build               # runs the tests, then next build
bash tests/integration/native-routes.sh   # end-to-end routes against a local Supabase stand-in
```
