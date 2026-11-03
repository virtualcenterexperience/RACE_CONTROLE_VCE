-- À exécuter une seule fois dans Supabase SQL Editor.
-- Les pilotes peuvent envoyer une séance; seul le STAFF peut lire la boîte de réception.
create table if not exists public.vce_training_submissions (
 session_id text primary key,
 pilot text not null check (length(trim(pilot)) between 2 and 120),
 payload jsonb not null check (jsonb_typeof(payload)='object' and payload->>'status'='submitted' and length(payload::text)<30000),
 submitted_at timestamptz not null default now()
);
alter table public.vce_training_submissions enable row level security;
grant insert on public.vce_training_submissions to anon, authenticated;
grant select on public.vce_training_submissions to authenticated;
revoke update, delete on public.vce_training_submissions from anon, authenticated;
drop policy if exists vce_training_submission_insert on public.vce_training_submissions;
create policy vce_training_submission_insert on public.vce_training_submissions for insert to anon,authenticated with check (session_id=payload->>'id' and pilot=payload->>'driver' and payload->>'status'='submitted');
drop policy if exists vce_training_submission_staff_read on public.vce_training_submissions;
create policy vce_training_submission_staff_read on public.vce_training_submissions for select to authenticated using (public.vce_is_staff());
