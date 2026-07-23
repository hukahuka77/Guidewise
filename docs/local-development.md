# Local development

Guidewise has two applications:

- `frontend/`: Next.js, served at `http://localhost:3000`
- `backend/`: Flask, served at `http://localhost:5001`

## Prerequisites

- Node.js 20 and npm (the versions used by CI)
- Python 3.12 and `venv` (the version used by CI; the backend also supports
  Python 3.11 as used by its Docker image)
- Access to a Guidewise-compatible Postgres/Supabase database
- Native libraries required by
  [WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation)
  if PDF rendering is needed locally

Run all commands below from the repository root unless the command starts by
changing directories.

## Environment files

Create `frontend/.env.local` for browser/frontend configuration and
`backend/.env` for backend configuration. Both paths are ignored by Git.

Never commit credentials or paste them into issues, pull requests, or chat.
Store shared secrets in the managed secret store for the target environment.
Every `NEXT_PUBLIC_*` value is included in browser code and must not contain a
secret.

### Frontend

Use placeholders only when preparing the file:

```dotenv
# Required for the complete local application
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET=YOUR_FOOD_ACTIVITIES_BUCKET
NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET=YOUR_USER_VIDEOS_BUCKET

# Feature-specific
NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_BROWSER_RESTRICTED_GOOGLE_MAPS_KEY
NEXT_PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/YOUR_FORM_ID
NEXT_PUBLIC_PROMO_ENABLED=false
```

The Supabase anon key is intentionally a public client value; database Row
Level Security must still protect data. Restrict the browser Google key to the
expected APIs and HTTP origins. `NEXT_PUBLIC_PROMO_ENABLED` defaults to enabled
when omitted.

### Backend

```dotenv
# Required to start the API and accept requests from the local frontend
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
FRONTEND_ORIGIN=http://localhost:3000

# Required for authenticated Supabase requests
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET

# Feature-specific: AI recommendations and Google Places
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
GOOGLE_API_KEY=YOUR_SERVER_GOOGLE_MAPS_KEY

# Feature-specific: Stripe billing
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
STRIPE_STARTER_PRICE_ID=price_YOUR_STARTER_PRICE_ID
STRIPE_GROWTH_PRICE_ID=price_YOUR_GROWTH_PRICE_ID
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_PORTAL_CONFIGURATION_ID=pc_YOUR_CONFIGURATION_ID
STRIPE_ACTIVE_COUPON_ID=cou_YOUR_COUPON_ID

# Optional auth and operations overrides
SUPABASE_JWKS_URL=https://YOUR_PROJECT.supabase.co/auth/v1/jwks
SUPABASE_JWT_AUD=YOUR_EXPECTED_AUDIENCE
CLEANUP_SECRET=YOUR_MAINTENANCE_ENDPOINT_SECRET
```

For Supabase projects issuing asymmetric JWTs, the backend derives the JWKS
URL from `SUPABASE_URL`; set `SUPABASE_JWKS_URL` only to override it. Projects
issuing HS256 JWTs require `SUPABASE_JWT_SECRET`. `SUPABASE_JWT_AUD` is
optional.

Stripe variables are only needed for billing flows. The portal configuration
and active coupon IDs are optional even when Stripe is enabled. The OpenAI and
Google server keys are only needed for their corresponding recommendation and
Places features. `CLEANUP_SECRET` enables the protected maintenance endpoint.

## Install and run

Install and start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

In a second terminal, create an isolated Python environment, install the
backend, and start Flask:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python app.py
```

The backend loads `backend/.env` through `python-dotenv`. It creates missing
tables represented by its SQLAlchemy models, but the configured database must
already exist and should have the repository's Supabase migrations applied.

## Checks

Run the same local verification contract used by agent work:

```bash
scripts/check.sh
```

It installs frontend dependencies with `npm ci`, then runs lint, TypeScript
checking, a production frontend build, and backend bytecode compilation.
After dependencies are installed, rerun without reinstalling:

```bash
scripts/check.sh --skip-install
```

The individual checks are:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build

cd ../backend
python -m compileall .
```
