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
-- Vérification STAFF côté base, sans exposer la liste des comptes autorisés.
create or replace function public.vce_is_staff()
returns boolean language sql stable security definer
set search_path = ''
as $
 select exists (select 1 from public.vce_staff_users where user_id = (select auth.uid()));
$;
revoke all on function public.vce_is_staff() from public;
grant execute on function public.vce_is_staff() to authenticated;
drop policy if exists vce_staff_insert on public.vce_publications;
create policy vce_staff_insert on public.vce_publications for insert to authenticated with check
 (public.vce_is_staff());
drop policy if exists vce_staff_update on public.vce_publications;
create policy vce_staff_update on public.vce_publications for update to authenticated using
 (public.vce_is_staff()) with check
 (public.vce_is_staff());
-- Après création du compte STAFF dans Authentication > Users, remplacer UUID ci-dessous
-- et exécuter séparément :
-- insert into public.vce_staff_users(user_id) values ('UUID_DU_COMPTE_STAFF');

-- Décisions de validation : horodatage serveur (UTC), affichage Europe/Paris.
create table if not exists public.vce_training_reviews (
 session_id text primary key,
 pilot text not null,
 decision text not null check (decision in ('approved','rejected')),
 reviewed_at timestamptz not null default now()
);
alter table public.vce_training_reviews enable row level security;
grant select on public.vce_training_reviews to anon, authenticated;
grant insert, update, delete on public.vce_training_reviews to authenticated;
drop policy if exists vce_training_reviews_read on public.vce_training_reviews;
create policy vce_training_reviews_read on public.vce_training_reviews for select to anon, authenticated using (true);
drop policy if exists vce_training_reviews_insert on public.vce_training_reviews;
create policy vce_training_reviews_insert on public.vce_training_reviews for insert to authenticated with check (public.vce_is_staff());
drop policy if exists vce_training_reviews_update on public.vce_training_reviews;
create policy vce_training_reviews_update on public.vce_training_reviews for update to authenticated using (public.vce_is_staff()) with check (public.vce_is_staff());
drop policy if exists vce_training_reviews_delete on public.vce_training_reviews;
create policy vce_training_reviews_delete on public.vce_training_reviews for delete to authenticated using (public.vce_is_staff());
create or replace function public.vce_stamp_review()
returns trigger language plpgsql set search_path = '' as $$
begin
 new.reviewed_at := now();
 return new;
end;
$$;
drop trigger if exists vce_stamp_review_trigger on public.vce_training_reviews;
create trigger vce_stamp_review_trigger before insert or update on public.vce_training_reviews for each row execute function public.vce_stamp_review();
