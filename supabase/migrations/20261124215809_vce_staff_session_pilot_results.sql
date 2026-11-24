
alter table public.vce_race_result_submissions add column if not exists submitted_by uuid references auth.users(id);
create or replace function vce_private.record_race_submitter()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.submitted_by:=auth.uid(); return new; end; $$;
revoke all on function vce_private.record_race_submitter() from public,anon,authenticated;
create trigger vce_record_race_submitter before insert on public.vce_race_result_submissions
 for each row execute function vce_private.record_race_submitter();

create or replace function vce_private.staff_pilot_race(p_pilot text,p_result jsonb default null,p_expected_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_slug text; target_name text; owner_id uuid; result_id uuid;
begin
 if auth.uid() is null or not public.vce_is_staff() then raise exception 'STAFF access required' using errcode='42501'; end if;
 select p->>'id',p->>'name' into target_slug,target_name from public.vce_publications r,jsonb_array_elements(r.payload->'items') p
 where r.kind='pilotes' and (p->>'id'=p_pilot or lower(p->>'name')=lower(p_pilot)) limit 1;
 if target_slug is null then raise exception 'Pilote absent de l’effectif actif' using errcode='22023'; end if;
 select id into owner_id from auth.users where raw_app_meta_data->>'vce_pilot_slug'=target_slug
 and coalesce(raw_app_meta_data->>'vce_pilot_active','true')<>'false' limit 1;
 if owner_id is null then raise exception 'Ce pilote ne possède pas de compte actif. Crée son accès depuis le STAFF.' using errcode='22023'; end if;
 if p_result is not null then
  if p_expected_actor is distinct from auth.uid() then raise exception 'Le compte connecté a changé. Actualise avant l’envoi.' using errcode='42501'; end if;
  if jsonb_typeof(p_result)<>'object' or coalesce(length(btrim(p_result->>'event_name')),0) not between 1 and 140
   or coalesce(length(btrim(p_result->>'track')),0) not between 1 and 140
   or coalesce(p_result->>'finishing_position','') !~ '^[0-9]{1,4}$'
   or coalesce(p_result->>'category','') not in ('sprint','esport','qualification','endurance','special','rally')
   or coalesce(p_result->>'race_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or coalesce(length(p_result->>'notes'),0)>2000 or coalesce(length(p_result->>'proof_url'),0)>600
  then raise exception 'Résultat incomplet ou invalide' using errcode='22023'; end if;
  if coalesce(p_result->>'proof_url','')<>'' and p_result->>'proof_url' !~ '^https://[^[:space:]]+$' then raise exception 'Preuve HTTPS requise' using errcode='22023'; end if;
  insert into public.vce_race_result_submissions(pilot_auth_user,pilot_slug,event_name,championship,race_date,track,car,game,category,finishing_position,starters,notes,proof_url,status,staff_notes)
  values(owner_id,target_slug,btrim(p_result->>'event_name'),coalesce(p_result->>'championship',''),(p_result->>'race_date')::date,btrim(p_result->>'track'),
   coalesce(p_result->>'car',''),coalesce(p_result->>'game',''),p_result->>'category',(p_result->>'finishing_position')::integer,
   nullif(p_result->>'starters','')::integer,coalesce(p_result->>'notes',''),coalesce(p_result->>'proof_url',''),'pending','')
  returning id into result_id;
 end if;
 return jsonb_build_object('pilot_slug',target_slug,'pilot_name',target_name,'pilot_auth_user',owner_id,'actor_auth_user',auth.uid(),'submission_id',result_id);
end; $$;
revoke all on function vce_private.staff_pilot_race(text,jsonb,uuid) from public,anon;
grant execute on function vce_private.staff_pilot_race(text,jsonb,uuid) to authenticated;
create or replace function public.vce_staff_pilot_race(p_pilot text,p_result jsonb default null,p_expected_actor uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select vce_private.staff_pilot_race(p_pilot,p_result,p_expected_actor); $$;
revoke all on function public.vce_staff_pilot_race(text,jsonb,uuid) from public,anon;
grant execute on function public.vce_staff_pilot_race(text,jsonb,uuid) to authenticated;
