-- VCE 3.4: bounded idempotent transmission of native high-frequency samples
create table if not exists public.vce_agent_lap_segments (
 session_id uuid not null references public.vce_agent_sessions(session_id) on delete cascade,
 lap_number integer not null check (lap_number between 1 and 100000),
 offset integer not null check (offset between 0 and 100000),
 total_samples integer not null check (total_samples between 10 and 100000),
 samples jsonb not null check (jsonb_typeof(samples)='array'),
 created_at timestamptz not null default now(),
 primary key (session_id, lap_number, offset)
);
alter table public.vce_agent_lap_segments enable row level security;
revoke all on public.vce_agent_lap_segments from anon,authenticated;
-- Access is exclusively via an authenticated device on the vce-telemetry Edge Function.
