-- VCE website pilot connection history (STAFF-only; no retroactive invented records).
alter table public.vce_pilot_presence
  add column if not exists connected_at timestamptz;
update public.vce_pilot_presence
   set connected_at=coalesce(connected_at,last_seen_at)
 where connected_at is null;
alter table public.vce_pilot_presence
  alter column connected_at set default now(),
  alter column connected_at set not null;
create index if not exists vce_pilot_presence_conn_idx
  on public.vce_pilot_presence(connected_at desc);
comment on column public.vce_pilot_presence.connected_at
  is 'First verified website heartbeat for this Supabase Auth session, not guessed login time.';
