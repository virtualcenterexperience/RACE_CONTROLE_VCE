create table public.vce_result_posters (
  id uuid primary key,
  title text not null check (char_length(title) between 1 and 120),
  mode text not null check (mode in ('solo', 'championnat', 'endurance')),
  pilot_slugs text[] not null check (cardinality(pilot_slugs) between 1 and 5),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint vce_result_posters_solo_count check (mode <> 'solo' or cardinality(pilot_slugs) = 1)
);

create index vce_result_posters_pilot_idx on public.vce_result_posters using gin (pilot_slugs) where published;
create index vce_result_posters_date_idx on public.vce_result_posters (created_at desc);
alter table public.vce_result_posters enable row level security;
revoke all on public.vce_result_posters from anon, authenticated;
grant select, insert, update on public.vce_result_posters to authenticated;

create policy "Staff and recipients read result posters"
on public.vce_result_posters for select to authenticated
using (
  (select public.vce_is_staff())
  or (
    published
    and pilot_slugs @> array[(select auth.jwt()->'app_metadata'->>'vce_pilot_slug')]
    and coalesce((select auth.jwt()->'app_metadata'->>'vce_pilot_active'), 'true') <> 'false'
    and coalesce((select auth.jwt()->'app_metadata'->>'vce_password_change_required'), 'false') <> 'true'
    and exists (
      select 1 from public.vce_publications p
      where p.kind = 'pilotes'
        and p.payload->'items' @> jsonb_build_array(
          jsonb_build_object('id', (select auth.jwt()->'app_metadata'->>'vce_pilot_slug'))
        )
    )
  )
);

create policy "Staff create result posters"
on public.vce_result_posters for insert to authenticated
with check ((select public.vce_is_staff()));

create policy "Staff update result posters"
on public.vce_result_posters for update to authenticated
using ((select public.vce_is_staff()))
with check ((select public.vce_is_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vce-result-posters', 'vce-result-posters', false, 12582912, array['image/png']);

create policy "Staff upload result poster images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vce-result-posters'
  and name ~ '^[0-9a-f-]{36}[.]png$'
  and (select public.vce_is_staff())
);

create policy "Staff and recipients read result poster images"
on storage.objects for select to authenticated
using (
  bucket_id = 'vce-result-posters'
  and (
    (select public.vce_is_staff())
    or exists (
      select 1 from public.vce_result_posters p
      where p.id = case when storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]png$'
        then left(storage.objects.name, 36)::uuid end
        and p.published
    )
  )
);
