-- Cache of the AI-composed PDF design per guidebook (one row each, replaced when the content changes).
create table if not exists public.guidebook_pdf_plan (
  guidebook_id text primary key,
  content_hash text not null,
  version integer not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

-- Only the backend (service role / direct connection) reads and writes this.
alter table public.guidebook_pdf_plan enable row level security;
