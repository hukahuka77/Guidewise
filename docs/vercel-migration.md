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
| 3 | Logged-in CRUD (create/edit/list/delete/publish/toggle/template) | pending |
| 4 | Integrations (Stripe, Places, AI recommendations, listing import) | pending |
| 5 | PDFs, then retire Render | pending |

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
