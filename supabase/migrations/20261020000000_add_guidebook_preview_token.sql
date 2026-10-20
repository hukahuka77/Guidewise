-- Unguessable token required to view an unpublished (draft) guidebook at /preview/<id>?t=<token>
alter table "public"."guidebook" add column if not exists "preview_token" varchar(64);
