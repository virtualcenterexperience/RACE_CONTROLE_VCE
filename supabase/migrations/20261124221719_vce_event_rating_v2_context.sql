
alter table public.vce_race_result_submissions add column scoring_version smallint not null default 1 check(scoring_version in (1,2));
alter table public.vce_race_result_submissions alter column scoring_version set default 2;
alter table public.vce_race_result_submissions drop constraint vce_race_result_submissions_category_check;
alter table public.vce_race_result_submissions add constraint vce_race_result_submissions_category_check
 check(category in ('sprint','esport','qualification','endurance','special','rally','championship','daily','hotlap','esport_qualifying','esport_race'));
alter table public.vce_race_result_submissions add constraint vce_rating_v2_needs_field
 check(scoring_version=1 or status<>'accepted' or starters between 2 and 5000 and starters is not null);
alter table public.vce_race_rating_results add column starters integer;
alter table public.vce_race_rating_results add column scoring_version smallint not null default 1 check(scoring_version in (1,2));
update public.vce_race_rating_results r set starters=s.starters from public.vce_race_result_submissions s where s.id=r.id;
create or replace function vce_private.record_race_submitter()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.submitted_by:=auth.uid();new.scoring_version:=2;return new;end;$$;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('vce_private.staff_pilot_race(text,jsonb,uuid)'::regprocedure);
 if position('''sprint'', ''esport''' in definition)>0 then
  definition:=replace(definition,'''sprint'', ''esport'', ''qualification'', ''endurance'', ''special'', ''rally''','''sprint'', ''esport'', ''qualification'', ''endurance'', ''special'', ''rally'', ''championship'', ''daily'', ''hotlap'', ''esport_qualifying'', ''esport_race''');
 else
  definition:=replace(definition,'''sprint'',''esport'',''qualification'',''endurance'',''special'',''rally''','''sprint'',''esport'',''qualification'',''endurance'',''special'',''rally'',''championship'',''daily'',''hotlap'',''esport_qualifying'',''esport_race''');
 end if;
 if position('esport_qualifying' in definition)=0 then raise exception 'STAFF category validation not updated';end if;
 execute definition;
end;$$;
create or replace function vce_private.sync_accepted_race_rating()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'accepted' and (tg_op='INSERT' or old.status<>'accepted') then return null;end if;
 if auth.uid() is not null then
  if not public.vce_is_staff() then raise exception 'STAFF access required' using errcode='42501';end if;
 elsif session_user not in ('postgres','supabase_admin') and coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'Authenticated STAFF access required' using errcode='42501';
 end if;
 if new.status='accepted' then
  insert into public.vce_race_rating_results(id,pilot_slug,event_name,race_date,track,car,category,finishing_position,starters,scoring_version)
  values(new.id,new.pilot_slug,new.event_name,new.race_date,new.track,new.car,new.category,new.finishing_position,new.starters,new.scoring_version)
  on conflict(id) do update set pilot_slug=excluded.pilot_slug,event_name=excluded.event_name,race_date=excluded.race_date,
   track=excluded.track,car=excluded.car,category=excluded.category,finishing_position=excluded.finishing_position,
   starters=excluded.starters,scoring_version=excluded.scoring_version;
 else delete from public.vce_race_rating_results where id=new.id;
 end if;return null;
end;$$;
revoke all on function vce_private.sync_accepted_race_rating() from public,anon,authenticated;
notify pgrst,'reload schema';
