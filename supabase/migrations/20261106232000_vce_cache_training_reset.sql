-- CACHE VCE · permanent audit snapshots and controlled training cycle resets.
-- Running this migration does NOT clear existing records or training assignments.
create table if not exists public.vce_cache_archives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  operation text not null check (operation in ('manual','before_training_reset')),
  payload jsonb not null check (jsonb_typeof(payload)='object')
);
create index if not exists vce_cache_archives_recent on public.vce_cache_archives(created_at desc);
alter table public.vce_cache_archives enable row level security;
revoke all on public.vce_cache_archives from anon,authenticated;
-- Only the service-role Edge Function, after STAFF verification, may read/write archives.

create table if not exists public.vce_training_control (
 id smallint primary key check(id=1),
 cycle integer not null default 0 check(cycle>=0),
 updated_at timestamptz not null default now(),
 last_archive_id uuid references public.vce_cache_archives(id),
 reset_by uuid references auth.users(id)
);
insert into public.vce_training_control(id,cycle) values(1,0) on conflict(id) do nothing;
alter table public.vce_training_control enable row level security;
revoke all on public.vce_training_control from anon,authenticated;
grant select on public.vce_training_control to anon,authenticated;
drop policy if exists vce_training_control_read on public.vce_training_control;
create policy vce_training_control_read on public.vce_training_control for select to anon,authenticated using(true);

-- Atomically snapshot and, when requested, reset ONLY the active training cycle.
-- This privileged function is never callable by regular website users.
create or replace function public.vce_staff_cache_action(p_staff_id uuid,p_operation text)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $func$
declare
 v_backup_id uuid;
 v_publications jsonb;
 v_submissions jsonb;
 v_reviews jsonb;
 v_evaluations jsonb;
 v_telemetry_stats jsonb;
 v_payload jsonb;
 v_counts jsonb;
 v_cycle integer;
begin
 if p_staff_id is null or not exists(select 1 from public.vce_staff_users where user_id=p_staff_id) then
   raise exception 'STAFF non autorisé' using errcode='42501';
 end if;
 if p_operation not in ('manual','before_training_reset') then
   raise exception 'Operation CACHE invalide' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(18210,20611);
 lock table public.vce_publications,public.vce_training_submissions,public.vce_training_reviews in share row exclusive mode;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_publications from public.vce_publications t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_submissions from public.vce_training_submissions t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_reviews from public.vce_training_reviews t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_evaluations from public.vce_irl_evaluations t;
 select jsonb_build_object(
   'sessions',(select count(*) from public.vce_agent_sessions),
   'laps',(select count(*) from public.vce_agent_laps),
   'samples',(select coalesce(sum(sample_count),0) from public.vce_agent_laps)
 ) into v_telemetry_stats;
 select cycle into v_cycle from public.vce_training_control where id=1 for update;
 v_counts=jsonb_build_object(
  'publications',jsonb_array_length(v_publications),
  'training_submissions',jsonb_array_length(v_submissions),
  'training_reviews',jsonb_array_length(v_reviews),
  'coach_irl_evaluations',jsonb_array_length(v_evaluations),
  'telemetry',v_telemetry_stats,
  'training_cycle',v_cycle);
 v_payload=jsonb_build_object(
  'schema_version',1,
  'created_at',now(),
  'description','VCE CACHE · publications, entraînements, évaluations; télémétrie brute conservée dans les tables originales',
  'publications',v_publications,
  'training_submissions',v_submissions,
  'training_reviews',v_reviews,
  'irl_evaluations',v_evaluations,
  'telemetry_summary',v_telemetry_stats,
  'counts',v_counts);
 insert into public.vce_cache_archives(created_by,operation,payload)
  values(p_staff_id,p_operation,v_payload) returning id into v_backup_id;
 if p_operation='before_training_reset' then
   -- Reset just the currently shared assignments and training reviews/submissions.
   insert into public.vce_publications(kind,payload,updated_at)
    values('training_assignments','{"version":1,"items":[]}'::jsonb,now())
    on conflict(kind) do update set payload=excluded.payload,updated_at=now();
   delete from public.vce_training_reviews;
   delete from public.vce_training_submissions;
   update public.vce_training_control set cycle=cycle+1,updated_at=now(),
      last_archive_id=v_backup_id,reset_by=p_staff_id where id=1 returning cycle into v_cycle;
 end if;
 return jsonb_build_object('ok',true,'archive_id',v_backup_id,
  'operation',p_operation,'cycle',v_cycle,'counts',v_counts);
end
$func$;
revoke all on function public.vce_staff_cache_action(uuid,text) from public,anon,authenticated;
grant execute on function public.vce_staff_cache_action(uuid,text) to service_role;
