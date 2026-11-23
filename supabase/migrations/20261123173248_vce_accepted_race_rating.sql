-- STAFF acceptance is the sporting decision; creating an image is optional.
-- Publish only standings fields. Evidence, comments and auth identifiers stay private.
create table public.vce_race_rating_results (
 id uuid primary key references public.vce_race_result_submissions(id) on delete cascade,
 pilot_slug text not null,
 event_name text not null,
 race_date date not null,
 track text not null,
 car text not null,
 category text not null,
 finishing_position integer not null check (finishing_position between 1 and 5000)
);
alter table public.vce_race_rating_results enable row level security;
revoke all on public.vce_race_rating_results from public, anon, authenticated;
grant select on public.vce_race_rating_results to authenticated;
create policy "Verified pilots and staff read accepted standings"
on public.vce_race_rating_results for select to authenticated
using ((select auth.uid()) is not null and (
 (select public.vce_is_staff()) or (
  nullif((select auth.jwt())->'app_metadata'->>'vce_pilot_slug','') is not null
  and coalesce((select auth.jwt())->'app_metadata'->>'vce_pilot_active','true') <> 'false'
 )));

-- The definer is necessary only for this internal projection: clients cannot write it.
create or replace function vce_private.sync_accepted_race_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status <> 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
  return null;
 end if;
 if auth.uid() is not null then
  if not public.vce_is_staff() then raise exception 'STAFF access required' using errcode='42501'; end if;
 elsif session_user not in ('postgres','supabase_admin') and coalesce(auth.role(),'') <> 'service_role' then
  raise exception 'Authenticated STAFF access required' using errcode='42501';
 end if;
 if new.status = 'accepted' then
  insert into public.vce_race_rating_results(id,pilot_slug,event_name,race_date,track,car,category,finishing_position)
  values(new.id,new.pilot_slug,new.event_name,new.race_date,new.track,new.car,new.category,new.finishing_position)
  on conflict(id) do update set pilot_slug=excluded.pilot_slug,event_name=excluded.event_name,
   race_date=excluded.race_date,track=excluded.track,car=excluded.car,
   category=excluded.category,finishing_position=excluded.finishing_position;
 else
  delete from public.vce_race_rating_results where id=new.id;
 end if;
 return null;
end;
$$;
revoke all on function vce_private.sync_accepted_race_rating() from public,anon,authenticated;
create trigger vce_sync_accepted_race_rating
 after insert or update on public.vce_race_result_submissions
 for each row execute function vce_private.sync_accepted_race_rating();

-- Existing STAFF decisions are included without revalidation or point increments.
insert into public.vce_race_rating_results(id,pilot_slug,event_name,race_date,track,car,category,finishing_position)
select id,pilot_slug,event_name,race_date,track,car,category,finishing_position
from public.vce_race_result_submissions where status='accepted';
comment on table public.vce_race_rating_results is 'Read-only sporting projection of STAFF-accepted race results. No private evidence or notes. Profiles recompute ratings without double increments.';
notify pgrst, 'reload schema';
