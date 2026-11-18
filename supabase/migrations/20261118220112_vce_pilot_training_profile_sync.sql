create or replace function vce_private.pilot_training_data(p_pilot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected_name text; selected_id text; own_id text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 own_id:=auth.jwt()->'app_metadata'->>'vce_pilot_slug';
 select p->>'name',p->>'id' into selected_name,selected_id
 from public.vce_publications r, jsonb_array_elements(r.payload->'items') p
 where r.kind='pilotes' and (lower(p->>'name')=lower(p_pilot) or p->>'id'=p_pilot) limit 1;
 if selected_id is null then raise exception 'Unknown pilot' using errcode='22023'; end if;
 if not public.vce_is_staff() and (own_id is distinct from selected_id or
    (auth.jwt()->'app_metadata'->>'vce_pilot_active') is distinct from 'true') then
  raise exception 'Pilot access denied' using errcode='42501';
 end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('session_id',s.session_id,'pilot',selected_name,
   'payload',s.payload,'submitted_at',s.submitted_at,'decision',r.decision,'reviewed_at',r.reviewed_at)
   order by s.submitted_at desc)
  from public.vce_training_submissions s left join public.vce_training_reviews r using(session_id)
  where lower(s.pilot)=lower(selected_name) or s.pilot=selected_id
 ),'[]'::jsonb);
end; $$;
revoke all on function vce_private.pilot_training_data(text) from public,anon;
grant execute on function vce_private.pilot_training_data(text) to authenticated;
create or replace function public.vce_pilot_training_data(p_pilot text)
returns jsonb language sql security invoker set search_path=''
as $$ select vce_private.pilot_training_data(p_pilot); $$;
revoke all on function public.vce_pilot_training_data(text) from public,anon;
grant execute on function public.vce_pilot_training_data(text) to authenticated;
