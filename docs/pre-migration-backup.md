# Pre-migration backup and rollback (Flask on Render -> Next.js on Vercel)

Snapshot taken 2026-10-21, before moving the backend from Flask/Render into Next.js on Vercel.

## Code backups

| Backup | Commit | What it is |
| --- | --- | --- |
| `backup/pre-vercel-migration-prod` | `d028da9` | `prod` branch exactly as deployed (Render + Vercel) |
| `backup/pre-vercel-migration-main` | `51fa1f8` | `main` branch before any migration work |

Do not delete or commit to these branches. To get back to the pre-migration code:

- Render (Flask backend) keeps running unchanged until it is decommissioned. It deploys from `prod`.
- Vercel: in the dashboard, promote an earlier deployment ("Instant Rollback"), or reset `prod` to the backup branch.
- Because the Flask API stays deployed until the very end, any migrated route can be rolled back by removing its Next.js route handler: Next.js falls back to the Flask API for anything it does not implement (see `frontend/next.config.ts`).

## Infrastructure snapshot (no secret values)

- Render web service `Guidewise` (`srv-d2c2dth5pdvs73d7pujg`): Docker runtime, root dir `backend/`, plan `starter`, region `oregon`, branch `prod`, auto-deploy on commit. Start command: `gunicorn app:app --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT`.
- Vercel project `guidewise`, root directory `frontend`, GitHub integration.
- Supabase project `Guidewise DB` (`hojncqasasvvrhdmwwhv`, region `us-east-1`).

### Environment variable names

Values are NOT stored in the repo. Before decommissioning Render, copy them from the Render dashboard (Environment tab) into a password manager.

Render (Flask backend): `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ACTIVE_COUPON_ID`, `STRIPE_PORTAL_CONFIGURATION_ID`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWT_AUD`, `FRONTEND_ORIGIN`, `CLEANUP_SECRET`, plus the Google Places key used by `backend/utils/google_places.py`.

Vercel (frontend): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET`, `NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_FORMSPREE_ENDPOINT`, `NEXT_PUBLIC_PROMO_ENABLED`, `GOOGLE_API_KEY`.

## Database

- Tables: `guidebook`, `host`, `property`, `profiles` (RLS enabled on all four), plus views `vw_guidebook` and `vw_users`, and Supabase `auth`/`storage` schemas.
- Schema history: `supabase/migrations/` (initial remote schema plus the `preview_token` column).
- No data export was taken during this snapshot (no database credentials are available in the build environment, and the data contains customer information). Before any migration step that changes data or schema, take a backup in the Supabase dashboard (Database > Backups) or run `pg_dump` yourself.
