drop extension if exists "pg_net";

create sequence "public"."host_id_seq";

create sequence "public"."property_id_seq";


  create table "public"."guidebook" (
    "id" character varying(36) not null,
    "check_in_time" character varying(20),
    "check_out_time" character varying(20),
    "access_info" character varying(255),
    "cover_image_url" text,
    "things_to_do" json,
    "places_to_eat" json,
    "host_id" integer,
    "property_id" integer not null,
    "template_key" character varying(50) not null default 'template_1'::character varying,
    "welcome_info" text,
    "parking_info" text,
    "checkout_info" json,
    "included_tabs" json,
    "created_time" timestamp with time zone default now(),
    "last_modified_time" timestamp with time zone default now(),
    "custom_sections" json,
    "custom_tabs_meta" json,
    "user_id" character varying(36),
    "active" boolean default false,
    "public_slug" text,
    "safety_info" json,
    "house_manual" json,
    "published_html" text,
    "published_etag" text,
    "published_at" timestamp with time zone,
    "rules_json" json,
    "wifi_json" json
      );


alter table "public"."guidebook" enable row level security;


  create table "public"."host" (
    "id" integer not null default nextval('public.host_id_seq'::regclass),
    "name" character varying(100),
    "bio" text,
    "user_id" character varying(36),
    "contact" text,
    "host_image_url" text
      );


alter table "public"."host" enable row level security;


  create table "public"."profiles" (
    "user_id" uuid not null,
    "plan" text not null default 'free'::text,
    "pro_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "guidebook_limit" integer,
    "stripe_customer_id" text,
    "stripe_subscription_id" text,
    "pro_starts_at" timestamp with time zone
      );


alter table "public"."profiles" enable row level security;


  create table "public"."property" (
    "id" integer not null default nextval('public.property_id_seq'::regclass),
    "name" character varying(100) not null,
    "address_street" character varying(100),
    "address_city_state" character varying(100),
    "address_zip" character varying(50),
    "user_id" character varying(36)
      );


alter table "public"."property" enable row level security;

alter sequence "public"."host_id_seq" owned by "public"."host"."id";

alter sequence "public"."property_id_seq" owned by "public"."property"."id";

CREATE UNIQUE INDEX guidebook_pkey ON public.guidebook USING btree (id);

CREATE UNIQUE INDEX host_pkey ON public.host USING btree (id);

CREATE INDEX idx_guidebook_user_id ON public.guidebook USING btree (user_id);

CREATE INDEX idx_host_user_id ON public.host USING btree (user_id);

CREATE INDEX idx_profiles_stripe_customer ON public.profiles USING btree (stripe_customer_id);

CREATE INDEX idx_profiles_stripe_subscription ON public.profiles USING btree (stripe_subscription_id);

CREATE INDEX idx_property_user_id ON public.property USING btree (user_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX property_pkey ON public.property USING btree (id);

CREATE UNIQUE INDEX ux_guidebook_public_slug ON public.guidebook USING btree (public_slug);

alter table "public"."guidebook" add constraint "guidebook_pkey" PRIMARY KEY using index "guidebook_pkey";

alter table "public"."host" add constraint "host_pkey" PRIMARY KEY using index "host_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."property" add constraint "property_pkey" PRIMARY KEY using index "property_pkey";

alter table "public"."guidebook" add constraint "guidebook_host_id_fkey" FOREIGN KEY (host_id) REFERENCES public.host(id) not valid;

alter table "public"."guidebook" validate constraint "guidebook_host_id_fkey";

alter table "public"."guidebook" add constraint "guidebook_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.property(id) not valid;

alter table "public"."guidebook" validate constraint "guidebook_property_id_fkey";

alter table "public"."profiles" add constraint "profiles_plan_check" CHECK ((plan = ANY (ARRAY['trial'::text, 'free'::text, 'starter'::text, 'growth'::text, 'pro'::text, 'enterprise'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_plan_check";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$
;

create or replace view "public"."vw_guidebook" as  SELECT g.id,
    pr.name,
    pr.address_street,
    u.email,
    p.plan,
    g.created_time
   FROM (((public.guidebook g
     JOIN public.profiles p ON (((g.user_id)::uuid = p.user_id)))
     JOIN auth.users u ON (((g.user_id)::uuid = u.id)))
     JOIN public.property pr ON ((g.property_id = pr.id)));


create or replace view "public"."vw_users" as  SELECT u.id,
    u.email,
    p.user_id,
    p.plan,
    p.pro_expires_at,
    p.created_at,
    p.updated_at,
    p.guidebook_limit,
    p.stripe_customer_id,
    p.stripe_subscription_id,
    p.pro_starts_at
   FROM (auth.users u
     JOIN public.profiles p ON ((p.user_id = u.id)))
  ORDER BY p.created_at DESC, u.email DESC;


grant delete on table "public"."guidebook" to "anon";

grant insert on table "public"."guidebook" to "anon";

grant references on table "public"."guidebook" to "anon";

grant select on table "public"."guidebook" to "anon";

grant trigger on table "public"."guidebook" to "anon";

grant truncate on table "public"."guidebook" to "anon";

grant update on table "public"."guidebook" to "anon";

grant delete on table "public"."guidebook" to "authenticated";

grant insert on table "public"."guidebook" to "authenticated";

grant references on table "public"."guidebook" to "authenticated";

grant select on table "public"."guidebook" to "authenticated";

grant trigger on table "public"."guidebook" to "authenticated";

grant truncate on table "public"."guidebook" to "authenticated";

grant update on table "public"."guidebook" to "authenticated";

grant delete on table "public"."guidebook" to "service_role";

grant insert on table "public"."guidebook" to "service_role";

grant references on table "public"."guidebook" to "service_role";

grant select on table "public"."guidebook" to "service_role";

grant trigger on table "public"."guidebook" to "service_role";

grant truncate on table "public"."guidebook" to "service_role";

grant update on table "public"."guidebook" to "service_role";

grant delete on table "public"."host" to "anon";

grant insert on table "public"."host" to "anon";

grant references on table "public"."host" to "anon";

grant select on table "public"."host" to "anon";

grant trigger on table "public"."host" to "anon";

grant truncate on table "public"."host" to "anon";

grant update on table "public"."host" to "anon";

grant delete on table "public"."host" to "authenticated";

grant insert on table "public"."host" to "authenticated";

grant references on table "public"."host" to "authenticated";

grant select on table "public"."host" to "authenticated";

grant trigger on table "public"."host" to "authenticated";

grant truncate on table "public"."host" to "authenticated";

grant update on table "public"."host" to "authenticated";

grant delete on table "public"."host" to "service_role";

grant insert on table "public"."host" to "service_role";

grant references on table "public"."host" to "service_role";

grant select on table "public"."host" to "service_role";

grant trigger on table "public"."host" to "service_role";

grant truncate on table "public"."host" to "service_role";

grant update on table "public"."host" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."property" to "anon";

grant insert on table "public"."property" to "anon";

grant references on table "public"."property" to "anon";

grant select on table "public"."property" to "anon";

grant trigger on table "public"."property" to "anon";

grant truncate on table "public"."property" to "anon";

grant update on table "public"."property" to "anon";

grant delete on table "public"."property" to "authenticated";

grant insert on table "public"."property" to "authenticated";

grant references on table "public"."property" to "authenticated";

grant select on table "public"."property" to "authenticated";

grant trigger on table "public"."property" to "authenticated";

grant truncate on table "public"."property" to "authenticated";

grant update on table "public"."property" to "authenticated";

grant delete on table "public"."property" to "service_role";

grant insert on table "public"."property" to "service_role";

grant references on table "public"."property" to "service_role";

grant select on table "public"."property" to "service_role";

grant trigger on table "public"."property" to "service_role";

grant truncate on table "public"."property" to "service_role";

grant update on table "public"."property" to "service_role";


  create policy "guidebook_delete"
  on "public"."guidebook"
  as permissive
  for delete
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "guidebook_insert"
  on "public"."guidebook"
  as permissive
  for insert
  to public
with check (((user_id)::text = (auth.uid())::text));



  create policy "guidebook_select"
  on "public"."guidebook"
  as permissive
  for select
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "guidebook_update"
  on "public"."guidebook"
  as permissive
  for update
  to public
using (((user_id)::text = (auth.uid())::text))
with check (((user_id)::text = (auth.uid())::text));



  create policy "host_delete"
  on "public"."host"
  as permissive
  for delete
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "host_insert"
  on "public"."host"
  as permissive
  for insert
  to public
with check (((user_id)::text = (auth.uid())::text));



  create policy "host_select"
  on "public"."host"
  as permissive
  for select
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "host_update"
  on "public"."host"
  as permissive
  for update
  to public
using (((user_id)::text = (auth.uid())::text))
with check (((user_id)::text = (auth.uid())::text));



  create policy "profiles_insert"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "profiles_select"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "profiles_update"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "property_delete"
  on "public"."property"
  as permissive
  for delete
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "property_insert"
  on "public"."property"
  as permissive
  for insert
  to public
with check (((user_id)::text = (auth.uid())::text));



  create policy "property_select"
  on "public"."property"
  as permissive
  for select
  to public
using (((user_id)::text = (auth.uid())::text));



  create policy "property_update"
  on "public"."property"
  as permissive
  for update
  to public
using (((user_id)::text = (auth.uid())::text))
with check (((user_id)::text = (auth.uid())::text));


CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow Auth users to upload/delete/select/update qcik30_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'User_videos'::text));



  create policy "Allow Auth users to upload/delete/select/update qcik30_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'User_videos'::text));



  create policy "Allow Auth users to upload/delete/select/update qcik30_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'User_videos'::text));



  create policy "Allow Auth users to upload/delete/select/update qcik30_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'User_videos'::text));



  create policy "Allow authenticated users to delete their uploads"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'food-and-activities'::text));



  create policy "Allow authenticated users to select their uploads"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'food-and-activities'::text));



  create policy "Insert images to prefixes (auth)"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'food-and-activities'::text));



  create policy "Public read images in food/activites"
  on "storage"."objects"
  as permissive
  for select
  to anon
using ((bucket_id = 'food-and-activities'::text));



  create policy "Update images in prefixes (auth)"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'food-and-activities'::text))
with check ((bucket_id = 'food-and-activities'::text));



