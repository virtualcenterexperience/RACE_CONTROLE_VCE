-- VCE Coach IRL — protocole initial et retest, données réservées au STAFF
-- Migration additive : les entraînements, profils et tours existants ne sont pas touchés.
create table if not exists public.vce_irl_evaluations (
 id uuid primary key default gen_random_uuid(),
 pilot_slug text not null check (length(trim(pilot_slug)) between 1 and 160),
 created_by uuid not null default auth.uid(),
 phase text not null default 'initial' check (phase in ('initial','retest','suivi')),
 status text not null default 'draft' check (status in ('draft','reviewed')),
 protocol_version text not null default 'vce-irl-2026-11',
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists vce_irl_evaluations_pilot_recent on public.vce_irl_evaluations (pilot_slug,created_at desc);
alter table public.vce_irl_evaluations enable row level security;
revoke all on public.vce_irl_evaluations from anon;
grant select,insert,update on public.vce_irl_evaluations to authenticated;
drop policy if exists vce_irl_evaluations_staff_read on public.vce_irl_evaluations;
create policy vce_irl_evaluations_staff_read on public.vce_irl_evaluations
 for select to authenticated using ((select public.vce_is_staff()));
drop policy if exists vce_irl_evaluations_staff_insert on public.vce_irl_evaluations;
create policy vce_irl_evaluations_staff_insert on public.vce_irl_evaluations
 for insert to authenticated with check ((select public.vce_is_staff()) and created_by=(select auth.uid()));
drop policy if exists vce_irl_evaluations_staff_update on public.vce_irl_evaluations;
create policy vce_irl_evaluations_staff_update on public.vce_irl_evaluations
 for update to authenticated using ((select public.vce_is_staff()))
 with check ((select public.vce_is_staff()));
-- No pilot-facing SELECT/UPDATE/DELETE policy: raw evaluations are private until STAFF publishes them.
