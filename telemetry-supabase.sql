-- VCE TELEMETRY · exécuter manuellement dans Supabase SQL Editor
-- Le GUID Steam n'est PAS un secret d'authentification.
create table if not exists public.vce_telemetry_devices (
 id uuid primary key default gen_random_uuid(),
 pilot_name text not null,
 steam_guid text not null,
 device_label text not null default 'PC pilote',
 status text not null default 'pending' check(status in ('pending','approved','revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_seen_at timestamptz,
 unique(steam_guid)
);
create table if not exists public.vce_telemetry_sessions (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.vce_telemetry_devices(id) on delete cascade,
 game text, car text, track text, layout text,
 started_at timestamptz, ended_at timestamptz,
 state text not null default 'completed' check(state in ('running','completed','interrupted')),
 payload jsonb not null default '{}'::jsonb,
 received_at timestamptz not null default now()
);
create index if not exists vce_telemetry_sessions_device_received on public.vce_telemetry_sessions(device_id,received_at desc);
alter table public.vce_telemetry_devices enable row level security;
alter table public.vce_telemetry_sessions enable row level security;
revoke all on public.vce_telemetry_devices from anon,authenticated;
revoke all on public.vce_telemetry_sessions from anon,authenticated;
grant select,insert,update,delete on public.vce_telemetry_devices to authenticated;
grant select,insert,update,delete on public.vce_telemetry_sessions to authenticated;
drop policy if exists vce_devices_staff_select on public.vce_telemetry_devices;
create policy vce_devices_staff_select on public.vce_telemetry_devices for select to authenticated using (public.vce_is_staff());
drop policy if exists vce_devices_staff_insert on public.vce_telemetry_devices;
create policy vce_devices_staff_insert on public.vce_telemetry_devices for insert to authenticated with check (public.vce_is_staff());
drop policy if exists vce_devices_staff_update on public.vce_telemetry_devices;
create policy vce_devices_staff_update on public.vce_telemetry_devices for update to authenticated using(public.vce_is_staff()) with check(public.vce_is_staff());
drop policy if exists vce_devices_staff_delete on public.vce_telemetry_devices;
create policy vce_devices_staff_delete on public.vce_telemetry_devices for delete to authenticated using(public.vce_is_staff());
drop policy if exists vce_sessions_staff_select on public.vce_telemetry_sessions;
create policy vce_sessions_staff_select on public.vce_telemetry_sessions for select to authenticated using(public.vce_is_staff());
drop policy if exists vce_sessions_staff_insert on public.vce_telemetry_sessions;
create policy vce_sessions_staff_insert on public.vce_telemetry_sessions for insert to authenticated with check(public.vce_is_staff());
drop policy if exists vce_sessions_staff_update on public.vce_telemetry_sessions;
create policy vce_sessions_staff_update on public.vce_telemetry_sessions for update to authenticated using(public.vce_is_staff()) with check(public.vce_is_staff());
drop policy if exists vce_sessions_staff_delete on public.vce_telemetry_sessions;
create policy vce_sessions_staff_delete on public.vce_telemetry_sessions for delete to authenticated using(public.vce_is_staff());
-- IMPORTANT: l'EXE ne doit JAMAIS embarquer de clé service_role ou de compte STAFF.
-- Une Edge Function dédiée doit authentifier chaque installation (jeton révocable distinct du GUID),
-- limiter les volumes et écrire les sessions après vérification du rattachement approuvé.
-- Les pilotes doivent disposer de leur propre authentification avant toute lecture privée depuis le navigateur.
