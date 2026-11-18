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
    coalesce(auth.jwt()->'app_metadata'->>'vce_pilot_active','true') = 'false') then
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

create or replace function vce_private.can_submit_training(p_pilot text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return false; end if;
 if public.vce_is_staff() then return true; end if;
 if coalesce(auth.jwt()->'app_metadata'->>'vce_pilot_active','true')='false' then return false; end if;
 return exists(
  select 1 from public.vce_publications r,jsonb_array_elements(r.payload->'items') p
  where r.kind='pilotes' and p->>'id'=auth.jwt()->'app_metadata'->>'vce_pilot_slug'
    and (p->>'id'=p_pilot or lower(p->>'name')=lower(p_pilot))
 );
end; $$;
revoke all on function vce_private.can_submit_training(text) from public,anon;
grant execute on function vce_private.can_submit_training(text) to authenticated;
drop policy vce_training_submission_insert on public.vce_training_submissions;
create policy vce_training_submission_insert on public.vce_training_submissions for insert to authenticated
with check (
 session_id=payload->>'id' and pilot=payload->>'driver' and payload->>'status'='submitted'
 and vce_private.can_submit_training(pilot)
);
