-- VCE TEAM: pilot-submitted race results, STAFF review, no automatic official rating.
-- Verified Supabase Auth pilot account required. No public/anon read or write.
create table if not exists public.vce_race_result_submissions (
  id uuid primary key default gen_random_uuid(),
  pilot_auth_user uuid not null references auth.users(id) on delete cascade,
  pilot_slug text not null check (pilot_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(pilot_slug) <= 100),
  event_name text not null check (length(btrim(event_name)) between 3 and 140),
  championship text not null default '' check (length(championship) <= 140),
  race_date date not null,
  track text not null check (length(btrim(track)) between 2 and 140),
  car text not null default '' check (length(car) <= 140),
  game text not null default '' check (length(game) <= 60),
  category text not null default 'sprint' check (category in ('sprint','esport','qualification','endurance','special')),
  finishing_position integer not null check (finishing_position between 1 and 5000),
  starters integer check (starters between 1 and 5000),
  notes text not null default '' check (length(notes) <= 2000),
  proof_url text not null default '' check (length(proof_url) <= 600 and (proof_url = '' or proof_url ~* '^https://[^[:space:]]+$')),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  staff_notes text not null default '' check (length(staff_notes) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint vce_result_starters_check check (starters is null or finishing_position <= starters),
  constraint vce_result_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null) or status in ('accepted','rejected')
  )
);
create index if not exists vce_result_submissions_pending_idx on public.vce_race_result_submissions(status,created_at desc);
create index if not exists vce_result_submissions_pilot_idx on public.vce_race_result_submissions(pilot_auth_user,created_at desc);
alter table public.vce_race_result_submissions enable row level security;
revoke all on public.vce_race_result_submissions from anon;
revoke all on public.vce_race_result_submissions from authenticated;
grant select,insert on public.vce_race_result_submissions to authenticated;
grant update(status,staff_notes,reviewed_by,reviewed_at) on public.vce_race_result_submissions to authenticated;
drop policy if exists vce_race_results_read on public.vce_race_result_submissions;
create policy vce_race_results_read on public.vce_race_result_submissions
 for select to authenticated using (
  pilot_auth_user = (select auth.uid()) or (select public.vce_is_staff())
 );
drop policy if exists vce_race_results_insert_owner on public.vce_race_result_submissions;
create policy vce_race_results_insert_owner on public.vce_race_result_submissions
 for insert to authenticated with check (
  pilot_auth_user = (select auth.uid())
  and pilot_slug = (select auth.jwt() -> 'app_metadata' ->> 'vce_pilot_slug')
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'vce_pilot_active') <> 'false',true)
  and status = 'pending'
  and reviewed_by is null and reviewed_at is null
  and staff_notes = ''
 );
drop policy if exists vce_race_results_staff_review on public.vce_race_result_submissions;
create policy vce_race_results_staff_review on public.vce_race_result_submissions
 for update to authenticated
 using ((select public.vce_is_staff()))
 with check ((select public.vce_is_staff()));
comment on table public.vce_race_result_submissions is 'Unverified race-result proposals from authenticated pilots. STAFF reviews; separate official publication controls rating.';
