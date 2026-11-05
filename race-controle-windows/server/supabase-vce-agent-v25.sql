-- RACE CONTROLE VCE — TELEMETRY AGENT V2.5
-- Run ONCE in Supabase > SQL Editor, BEFORE deploying the Edge Function.
-- Separate tables: does not overwrite older VCE telemetry schemas or sessions.
-- The SteamID and device_id are not passwords.
begin;
create extension if not exists pgcrypto;

create table if not exists public.vce_agent_devices (
  device_id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  requested_pilot text not null,
  steam_id64 text,
  pilot_slug text,
  pilot_auth_user uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  current_game text,
  current_state text not null default 'idle',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_seen_at timestamptz,
  constraint vce_agent_steam_format check (steam_id64 is null or steam_id64 ~ '^7656119[0-9]{10}$')
);
create index if not exists vce_agent_devices_status on public.vce_agent_devices(status,created_at desc);

create table if not exists public.vce_agent_sessions (
  session_id uuid primary key,
  device_id uuid not null references public.vce_agent_devices(device_id),
  pilot_slug text not null,
  pilot_auth_user uuid references auth.users(id) on delete set null,
  game text not null check (game in ('AC','ACC','LMU','R3E','ACEVO')),
  track text not null default '',
  car text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed')),
  last_heartbeat_at timestamptz,
  laps_count int not null default 0,
  best_lap_ms int,
  created_at timestamptz not null default now()
);
create index if not exists vce_agent_sessions_pilot on public.vce_agent_sessions(pilot_slug,started_at desc);
create index if not exists vce_agent_sessions_device on public.vce_agent_sessions(device_id,started_at desc);

create table if not exists public.vce_agent_laps (
  session_id uuid not null references public.vce_agent_sessions(session_id) on delete cascade,
  lap_number integer not null check (lap_number between 1 and 100000),
  lap_time_ms integer check (lap_time_ms between 10000 and 3600000),
  valid boolean,
  sample_count integer not null check (sample_count between 0 and 12000),
  samples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (session_id,lap_number)
);
create index if not exists vce_agent_laps_session on public.vce_agent_laps(session_id);

alter table public.vce_agent_devices enable row level security;
alter table public.vce_agent_sessions enable row level security;
alter table public.vce_agent_laps enable row level security;
revoke all on table public.vce_agent_devices from anon, authenticated;
revoke all on table public.vce_agent_sessions from anon, authenticated;
revoke all on table public.vce_agent_laps from anon, authenticated;
-- No direct browser table access. The Edge Function checks a per-installation secret
-- or a Supabase auth JWT with STAFF verification, using its server-only service_role.
commit;

-- Diagnosis (read in SQL Editor as database administrator):
-- select (select count(*) from public.vce_agent_devices) as devices,
--        (select count(*) from public.vce_agent_sessions) as sessions,
--        (select count(*) from public.vce_agent_laps) as laps;
