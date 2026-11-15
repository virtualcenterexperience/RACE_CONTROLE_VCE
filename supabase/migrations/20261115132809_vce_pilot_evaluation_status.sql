-- Store only the current published orientation, separate from the coach's local dossier.
create table public.vce_pilot_evaluation_status (
  pilot_slug text primary key check (char_length(pilot_slug) between 1 and 100 and pilot_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  orientation text not null check (orientation in ('REFUSÉ', 'OBSERVATION', 'ROOKIE', 'ACADÉMIE', 'ESPORT')),
  evaluated_on date not null
);

alter table public.vce_pilot_evaluation_status enable row level security;
revoke all on public.vce_pilot_evaluation_status from public, anon, authenticated;
grant select, insert, update on public.vce_pilot_evaluation_status to authenticated;

create policy "Staff and verified pilot read official orientation"
on public.vce_pilot_evaluation_status for select to authenticated
using (
  (select public.vce_is_staff())
  or (
    (select auth.uid()) is not null
    and pilot_slug = (select auth.jwt()->'app_metadata'->>'vce_pilot_slug')
    and coalesce((select auth.jwt()->'app_metadata'->>'vce_pilot_active'), 'true') <> 'false'
    and coalesce((select auth.jwt()->'app_metadata'->>'vce_password_change_required'), 'false') <> 'true'
    and exists (
      select 1 from public.vce_publications p
      where p.kind = 'pilotes'
        and p.payload->'items' @> jsonb_build_array(jsonb_build_object('id', vce_pilot_evaluation_status.pilot_slug))
    )
  )
);
create policy "Staff publish official orientation"
on public.vce_pilot_evaluation_status for insert to authenticated
with check (
  (select public.vce_is_staff()) and exists (
    select 1 from public.vce_publications p
    where p.kind = 'pilotes'
      and p.payload->'items' @> jsonb_build_array(jsonb_build_object('id', vce_pilot_evaluation_status.pilot_slug))
  )
);
create policy "Staff update official orientation"
on public.vce_pilot_evaluation_status for update to authenticated
using ((select public.vce_is_staff()))
with check (
  (select public.vce_is_staff()) and exists (
    select 1 from public.vce_publications p
    where p.kind = 'pilotes'
      and p.payload->'items' @> jsonb_build_array(jsonb_build_object('id', vce_pilot_evaluation_status.pilot_slug))
  )
);
