-- VCE LIVE PRIVATE CHANNELS — Supabase SQL Editor
-- RACE CONTROLE VCE uses private channels named vce:device:<device UUID>.
-- Device + pilot identities are verified by the server; no public broadcast.
create or replace function public.vce_can_read_live(topic_name text)
returns boolean
language plpgsql
stable security definer
set search_path=public
as $$
declare device_text text;
begin
  if auth.uid() is null then return false; end if;
  if topic_name !~ '^vce:device:[0-9a-f-]{36}$' then return false; end if;
  device_text:=substring(topic_name from 12);
  if not exists(select 1 from public.vce_agent_devices d
    where d.device_id::text=device_text and d.status='approved')
  then return false; end if;
  if public.vce_is_staff() then return true; end if;
  return exists(select 1 from public.vce_agent_devices d
    where d.device_id::text=device_text and d.status='approved'
      and d.pilot_auth_user=auth.uid());
end;
$$;
revoke all on function public.vce_can_read_live(text) from public,anon;
grant execute on function public.vce_can_read_live(text) to authenticated;
drop policy if exists "vce_live_receive" on realtime.messages;
create policy "vce_live_receive" on realtime.messages
for select to authenticated
using (extension='broadcast' and public.vce_can_read_live(realtime.topic()));
-- Security boundary: only STAFF or the Supabase Auth account linked to the pilot may receive.
-- Do not add a public SELECT policy on realtime.messages.
