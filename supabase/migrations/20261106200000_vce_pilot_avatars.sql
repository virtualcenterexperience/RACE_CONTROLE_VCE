-- VCE PILOTE · Photo publique propre au pilote, écriture réservée à l'Edge Function authentifiée.
-- Le contenu de l'image est stocké dans Supabase Storage, pas dans la liste des pilotes.
create table if not exists public.vce_pilot_avatars (
 pilot_slug text primary key check (pilot_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 storage_path text not null check (storage_path ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-zA-Z0-9_-]+[.]jpg$'),
 updated_at timestamptz not null default now()
);
alter table public.vce_pilot_avatars enable row level security;
revoke all on public.vce_pilot_avatars from anon, authenticated;
grant select on public.vce_pilot_avatars to anon, authenticated;
drop policy if exists vce_pilot_avatars_public_read on public.vce_pilot_avatars;
create policy vce_pilot_avatars_public_read on public.vce_pilot_avatars
 for select to anon, authenticated using (true);
-- Only server-side service_role is authorized to upload or replace photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('vce-pilot-avatars','vce-pilot-avatars',true,512000,array['image/jpeg'])
 on conflict (id) do nothing;
