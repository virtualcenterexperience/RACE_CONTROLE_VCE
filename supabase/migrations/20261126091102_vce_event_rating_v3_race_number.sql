-- V3 event hierarchy and optional two-race evening. Keep existing RLS ownership rules.
alter table public.vce_race_result_submissions
 drop constraint vce_race_result_submissions_category_check,
 add constraint vce_race_result_submissions_category_check check(category in (
 'sprint','esport','qualification','special','hotlap','daily','open','esport_qualifying',
 'championship','endurance','championship_overall','esport_race','rally')),
 drop constraint vce_race_result_submissions_scoring_version_check,
 add constraint vce_race_result_submissions_scoring_version_check check(scoring_version in (1,2,3)),
 add column race_number smallint check(race_number in (1,2));
alter table public.vce_race_result_submissions alter column scoring_version set default 3;
alter table public.vce_race_rating_results
 drop constraint vce_race_rating_results_scoring_version_check,
 add constraint vce_race_rating_results_scoring_version_check check(scoring_version in (1,2,3)),
 add column race_number smallint check(race_number in (1,2));
-- RLS restricts all these UPDATE columns to STAFF; owners can only INSERT pending rows.
grant update(scoring_version,race_number) on public.vce_race_result_submissions to authenticated;
create or replace function vce_private.record_race_submitter()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.submitted_by:=auth.uid();new.scoring_version:=3;return new;end;$$;
-- Preserve the reviewed owner/actor checks of the existing STAFF submission endpoint.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('vce_private.staff_pilot_race(text,jsonb,uuid)'::regprocedure);
 if position('''esport_race''' in definition)=0 then raise exception 'Missing event validation';end if;
 definition:=replace(definition,'''esport_race''','''esport_race'',''open'',''championship_overall''');
 definition:=replace(definition,'notes,proof_url,status,staff_notes)','notes,proof_url,status,staff_notes,race_number)');
 definition:=replace(definition,'''pending'','''')','''pending'','''',nullif(p_result->>''race_number'','''')::smallint)');
 if position('race_number)' in definition)=0 or position('nullif(p_result->>''race_number''' in definition)=0 then raise exception 'Race number update failed';end if;
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
  insert into public.vce_race_rating_results(id,pilot_slug,event_name,race_date,track,car,category,finishing_position,starters,scoring_version,race_number)
  values(new.id,new.pilot_slug,new.event_name,new.race_date,new.track,new.car,new.category,new.finishing_position,new.starters,new.scoring_version,new.race_number)
  on conflict(id) do update set pilot_slug=excluded.pilot_slug,event_name=excluded.event_name,race_date=excluded.race_date,
   track=excluded.track,car=excluded.car,category=excluded.category,finishing_position=excluded.finishing_position,
   starters=excluded.starters,scoring_version=excluded.scoring_version,race_number=excluded.race_number;
 else delete from public.vce_race_rating_results where id=new.id;
 end if;return null;
end;$$;
revoke all on function vce_private.sync_accepted_race_rating() from public,anon,authenticated;
-- Reclassify only explicit old Hotlap/Rally labels; no guessed category from a finishing rank.
-- Each accepted row is recomputed by the shared client scale, never incremented in place.
update public.vce_race_result_submissions
set category=case
 when category='special' and event_name ~* '(hotlap|time[ -]?attack)' then 'hotlap'
 when category='special' and (event_name ~* 'rally' or game ~* '(rally|wrc)') then 'rally'
 when category='sprint' then 'daily'
 when category='esport' then 'esport_race'
 when category='qualification' then 'esport_qualifying'
 when category='special' then 'championship'
 else category end,
 scoring_version=3
where status='accepted' and starters between 2 and 5000 and finishing_position<=starters;
notify pgrst,'reload schema';
