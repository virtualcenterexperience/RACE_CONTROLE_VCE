-- Pilot site presence — last website activity, NOT telemetry-agent presence.
-- Each Supabase Auth session is tracked separately so multiple devices can coexist.
create table if not exists public.vce_pilot_presence (
  session_id uuid primary key,
  pilot_user_id uuid not null references auth.users(id) on delete cascade,
  pilot_slug text not null check (
    length(pilot_slug) between 1 and 100 and
    pilot_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  last_seen_at timestamptz not null default now(),
  disconnected_at timestamptz
);
create index if not exists vce_pilot_presence_slug_seen_idx
  on public.vce_pilot_presence (pilot_slug,last_seen_at desc);
alter table public.vce_pilot_presence enable row level security;
revoke all on public.vce_pilot_presence from public,anon,authenticated;
grant select on public.vce_pilot_presence to authenticated;
drop policy if exists vce_pilot_presence_staff_select on public.vce_pilot_presence;
create policy vce_pilot_presence_staff_select on public.vce_pilot_presence
  for select to authenticated
  using ((select public.vce_is_staff()));
-- Only the authenticated pilot can ping their own session; server timestamps are authoritative.
create or replace function public.vce_touch_pilot_presence()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_slug text;
begin
  if v_user is null then return false; end if;
  if (auth.jwt()->>'session_id') is null then return false; end if;
  v_session := (auth.jwt()->>'session_id')::uuid;
  select u.raw_app_meta_data->>'vce_pilot_slug' into v_slug
    from auth.users u
    where u.id=v_user
      and coalesce(u.raw_app_meta_data->>'vce_pilot_active','true') <> 'false'
      and coalesce(u.raw_app_meta_data->>'vce_password_change_required','false') <> 'true';
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return false; end if;
  -- Pilot must still be in the active STAFF-managed roster.
  if not exists (
    select 1 from public.vce_publications p
     where p.kind='pilotes'
       and p.payload->'items' @> jsonb_build_array(jsonb_build_object('id',v_slug))
  ) then return false; end if;
  insert into public.vce_pilot_presence(session_id,pilot_user_id,pilot_slug,last_seen_at,disconnected_at)
  values (v_session,v_user,v_slug,now(),null)
  on conflict (session_id) do update set
    last_seen_at=excluded.last_seen_at,
    disconnected_at=null
  where public.vce_pilot_presence.pilot_user_id=excluded.pilot_user_id;
  return true;
end;
$$;
create or replace function public.vce_disconnect_pilot_presence()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
begin
  if v_user is null or auth.jwt()->>'session_id' is null then return false; end if;
  v_session := (auth.jwt()->>'session_id')::uuid;
  update public.vce_pilot_presence
     set last_seen_at=now(), disconnected_at=now()
   where session_id=v_session and pilot_user_id=v_user and disconnected_at is null;
  return found;
end;
$$;
revoke all on function public.vce_touch_pilot_presence() from public,anon;
revoke all on function public.vce_disconnect_pilot_presence() from public,anon;
grant execute on function public.vce_touch_pilot_presence() to authenticated;
grant execute on function public.vce_disconnect_pilot_presence() to authenticated;
comment on table public.vce_pilot_presence is 'Staff-only last activity of authenticated pilots on the website; telemetry-agent presence is separate.';
