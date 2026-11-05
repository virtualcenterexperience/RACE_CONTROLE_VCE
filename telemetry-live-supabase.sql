-- VCE LIVE: run in Supabase SQL Editor after telemetry-supabase.sql.
-- Device tokens are generated server-side and never exposed in browser code.
create extension if not exists pgcrypto;
alter table public.vce_telemetry_devices add column if not exists pilot_slug text;
create table if not exists public.vce_telemetry_device_credentials (
 device_id uuid primary key references public.vce_telemetry_devices(id) on delete cascade,
 token_hash text not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.vce_telemetry_live (
 session_id uuid primary key references public.vce_telemetry_sessions(id) on delete cascade,
 device_id uuid not null references public.vce_telemetry_devices(id),
 pilot_slug text,
 lap_number integer,
 position integer,
 elapsed_ms bigint,
 sample jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create index if not exists vce_tel_live_device_idx on public.vce_telemetry_live(device_id,updated_at desc);
alter table public.vce_telemetry_device_credentials enable row level security;
alter table public.vce_telemetry_live enable row level security;
revoke all on public.vce_telemetry_device_credentials from anon,authenticated;
revoke all on public.vce_telemetry_live from anon,authenticated;
grant select on public.vce_telemetry_live to authenticated;
drop policy if exists vce_live_staff_select on public.vce_telemetry_live;
create policy vce_live_staff_select on public.vce_telemetry_live
for select to authenticated using(public.vce_is_staff());
-- Realtime must be enabled on the table. A publication may already contain it.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vce_telemetry_live') then
   alter publication supabase_realtime add table public.vce_telemetry_live;
 end if;
end $$;
-- Credential issuance: execute from trusted admin context only.
-- Example token_hash = encode(digest(<random device token>,'sha256'),'hex').
-- Do NOT put the service_role key or device tokens in GitHub Pages.
