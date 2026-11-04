-- VCE ESPORT : publication des overlays PNG vers les espaces pilotes.
-- À exécuter UNE FOIS dans Supabase > SQL Editor avec un compte administrateur.
-- La table vce_publications et la fonction vce_is_staff() doivent déjà exister.
alter table public.vce_publications drop constraint if exists vce_publications_kind_check;
alter table public.vce_publications add constraint vce_publications_kind_check
 check (kind in ('calendrier','lineup','resultats','overlays'));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('vce-overlays','vce-overlays',true,12582912,array['image/png'])
on conflict (id) do update set public=true,file_size_limit=12582912,allowed_mime_types=array['image/png'];
drop policy if exists vce_overlays_public_read on storage.objects;
create policy vce_overlays_public_read on storage.objects for select to anon,authenticated
 using (bucket_id='vce-overlays');
drop policy if exists vce_overlays_staff_upload on storage.objects;
create policy vce_overlays_staff_upload on storage.objects for insert to authenticated
 with check (bucket_id='vce-overlays' and public.vce_is_staff());
drop policy if exists vce_overlays_staff_delete on storage.objects;
create policy vce_overlays_staff_delete on storage.objects for delete to authenticated
 using (bucket_id='vce-overlays' and public.vce_is_staff());
-- Les métadonnées des publications sont dans public.vce_publications(kind='overlays').
-- Les politiques existantes limitent leur écriture aux comptes STAFF.
