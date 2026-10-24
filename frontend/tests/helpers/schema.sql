create table host (
  id serial primary key, name varchar, bio text, user_id varchar, contact text, host_image_url text
);
create table property (
  id serial primary key, name varchar not null, address_street varchar,
  address_city_state varchar, address_zip varchar, user_id varchar
);
create table guidebook (
  id varchar primary key, check_in_time varchar, check_out_time varchar, access_info varchar,
  cover_image_url text, things_to_do json, places_to_eat json,
  host_id integer references host(id), property_id integer not null references property(id),
  template_key varchar not null default 'template_1', welcome_info text, parking_info text,
  checkout_info json, included_tabs json, created_time timestamptz default now(),
  last_modified_time timestamptz default now(), custom_sections json, custom_tabs_meta json,
  user_id varchar, active boolean default false, public_slug text, safety_info json, house_manual json,
  published_html text, published_etag text, published_at timestamptz, rules_json json, wifi_json json,
  preview_token varchar
);
create unique index ux_guidebook_public_slug on guidebook (public_slug);
create table profiles (
  user_id uuid primary key, plan text not null default 'free'
    check (plan in ('free', 'starter', 'power', 'pro', 'trial', 'growth', 'enterprise')), pro_expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  guidebook_limit integer, stripe_customer_id text, stripe_subscription_id text, pro_starts_at timestamptz
);

create table guidebook_view_daily (
  guidebook_id text not null, user_id text not null, day date not null, views integer not null default 0,
  primary key (guidebook_id, day)
);
create index idx_guidebook_view_daily_user_day on guidebook_view_daily (user_id, day);
create table view_dedupe (key text primary key, created_at timestamptz not null default now());
create table ai_usage_monthly (user_id text not null, month date not null, used integer not null default 0, primary key (user_id, month));
create table outreach_gift (
  guest_id uuid primary key, guidebook_id text, property_name text, prospect_email text,
  created_at timestamptz not null default now(), first_opened_at timestamptz, last_opened_at timestamptz,
  opens integer not null default 0, claimed_at timestamptz, claimed_by uuid
);
create table guidebook_pdf_plan (guidebook_id text primary key, content_hash text not null, version integer not null, plan jsonb not null, created_at timestamptz not null default now());

-- Supabase's auth.users, reduced to what the app reads (guests are anonymous users)
create schema if not exists auth;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, email text, created_at timestamptz default now(), raw_user_meta_data jsonb);
