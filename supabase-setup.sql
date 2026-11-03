-- À exécuter dans Supabase > SQL Editor, une fois.
create table if not exists public.vce_staff_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.vce_publications (
 kind text primary key check (kind in ('calendrier','lineup','resultats')),
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.vce_staff_users enable row level security;
alter table public.vce_publications enable row level security;
revoke all on public.vce_staff_users from anon, authenticated;
grant select on public.vce_publications to anon, authenticated;
grant insert, update on public.vce_publications to authenticated;
drop policy if exists vce_public_read on public.vce_publications;
create policy vce_public_read on public.vce_publications for select to anon, authenticated using (true);
drop policy if exists vce_staff_insert on public.vce_publications;
create policy vce_staff_insert on public.vce_publications for insert to authenticated with check
 (exists (select 1 from public.vce_staff_users s where s.user_id=auth.uid()));
drop policy if exists vce_staff_update on public.vce_publications;
create policy vce_staff_update on public.vce_publications for update to authenticated using
 (exists (select 1 from public.vce_staff_users s where s.user_id=auth.uid())) with check
 (exists (select 1 from public.vce_staff_users s where s.user_id=auth.uid()));
-- Après création du compte STAFF dans Authentication > Users, remplacer UUID ci-dessous
-- et exécuter séparément :
-- insert into public.vce_staff_users(user_id) values ('UUID_DU_COMPTE_STAFF');
