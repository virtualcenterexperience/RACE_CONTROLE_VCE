-- Serialize assignment writes so STAFF tabs cannot overwrite one another's work.
create or replace function vce_private.training_assignment_write(p_item jsonb default null,p_remove_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_payload jsonb; items jsonb; selected_id text; selected_name text; target_id text;
begin
 if auth.uid() is null or not public.vce_is_staff() then raise exception 'STAFF access required' using errcode='42501'; end if;
 if (p_item is null) = (p_remove_id is null) then raise exception 'Choose one assignment operation' using errcode='22023'; end if;
 if p_item is not null then
  if jsonb_typeof(p_item)<>'object' or coalesce(length(p_item->>'id'),0) not between 1 and 128
   or coalesce(length(btrim(p_item->>'exercise')),0) not between 1 and 10000
   or coalesce(length(btrim(p_item->>'circuit')),0) not between 1 and 200
   or coalesce(length(btrim(p_item->>'car')),0) not between 1 and 200
   or coalesce(p_item->>'laps','') !~ '^[0-9]{1,4}$' then raise exception 'Invalid assignment' using errcode='22023'; end if;
  if (p_item->>'laps')::integer not between 1 and 100 then raise exception 'Invalid lap count' using errcode='22023'; end if;
  select p->>'id',p->>'name' into selected_id,selected_name from public.vce_publications r,jsonb_array_elements(r.payload->'items') p
   where r.kind='pilotes' and (p->>'id'=p_item->>'pilotSlug' or lower(btrim(p->>'name'))=lower(btrim(p_item->>'driver'))) limit 1;
  if selected_id is null then raise exception 'Unknown active pilot' using errcode='22023'; end if;
  p_item:=p_item||jsonb_build_object('pilotSlug',selected_id,'driver',selected_name,'status','assigned','publishedAt',now());
  target_id:=p_item->>'id';
 else
  if length(p_remove_id) not between 1 and 128 then raise exception 'Invalid assignment id' using errcode='22023'; end if;
  target_id:=p_remove_id;
 end if;
 insert into public.vce_publications(kind,payload) values('training_assignments','{"version":1,"items":[]}') on conflict(kind) do nothing;
 select payload into current_payload from public.vce_publications where kind='training_assignments' for update;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into items from jsonb_array_elements(coalesce(current_payload->'items','[]'::jsonb)) x where x->>'id' is distinct from target_id;
 if p_item is not null then items:=items||jsonb_build_array(p_item); end if;
 current_payload:=coalesce(current_payload,'{}'::jsonb)||jsonb_build_object('version',1,'items',items);
 update public.vce_publications set payload=current_payload,updated_at=now() where kind='training_assignments';
 return current_payload;
end; $$;
revoke all on function vce_private.training_assignment_write(jsonb,text) from public,anon;
grant execute on function vce_private.training_assignment_write(jsonb,text) to authenticated;
create or replace function public.vce_training_assignment_write(p_item jsonb default null,p_remove_id text default null)
returns jsonb language sql security invoker set search_path='' as $$ select vce_private.training_assignment_write(p_item,p_remove_id); $$;
revoke all on function public.vce_training_assignment_write(jsonb,text) from public,anon;
grant execute on function public.vce_training_assignment_write(jsonb,text) to authenticated;

-- Use the existing STAFF channel when no dedicated results channel was set.
create or replace function vce_private.discord_results_config(p_webhook text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare secret_id uuid; fallback_id uuid;
begin
 if auth.uid() is null or not public.vce_is_staff() then
  raise exception 'STAFF access required' using errcode='42501';
 end if;
 select id into secret_id from vault.secrets where name='vce_discord_results_webhook';
 if p_webhook is not null then
  if p_webhook !~ '^https://discord[.]com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
   raise exception 'Invalid Discord webhook URL' using errcode='22023';
  end if;
  if secret_id is null then
   secret_id:=vault.create_secret(p_webhook,'vce_discord_results_webhook','Race result notifications');
  else
   perform vault.update_secret(secret_id,p_webhook,'vce_discord_results_webhook','Race result notifications');
  end if;
 end if;
 select id into fallback_id from vault.secrets where name='vce_discord_training_webhook';
 return jsonb_build_object('configured',secret_id is not null or fallback_id is not null,'source',case when secret_id is not null then 'results' when fallback_id is not null then 'training' else null end);
end;
$$;
revoke all on function vce_private.discord_results_config(text) from public, anon;
grant execute on function vce_private.discord_results_config(text) to authenticated;

create or replace function public.vce_discord_results_config(p_webhook text default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select vce_private.discord_results_config(p_webhook);
$$;
revoke all on function public.vce_discord_results_config(text) from public, anon;
grant execute on function public.vce_discord_results_config(text) to authenticated;

create or replace function vce_private.notify_results_discord()
returns trigger language plpgsql security definer set search_path = '' as $$
declare webhook text;
begin
 if new.status <> 'pending' then return new; end if;
 select decrypted_secret into webhook from vault.decrypted_secrets where name in ('vce_discord_results_webhook','vce_discord_training_webhook') order by case name when 'vce_discord_results_webhook' then 0 else 1 end limit 1;
 if webhook is null then return new; end if;
 perform net.http_post(url:=webhook, headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('username','VCE Race Control','allowed_mentions',jsonb_build_object('parse','[]'::jsonb),
   'embeds',jsonb_build_array(jsonb_build_object('title','Nouveau résultat · À valider','color',16724846,
    'description',left(new.pilot_slug,120)||' a envoyé un résultat au STAFF.',
    'fields',jsonb_build_array(
     jsonb_build_object('name','Épreuve','value',left(new.event_name,200)),
     jsonb_build_object('name','Circuit / spéciale','value',left(new.track,200)),
     jsonb_build_object('name','Classement','value','P'||new.finishing_position||coalesce(' / '||new.starters,''),'inline',true),
     jsonb_build_object('name','Catégorie','value',new.category,'inline',true)),
    'url','https://virtualcenterexperience.github.io/RACE_CONTROLE_VCE/team-resultats-recus.html',
    'timestamp',new.created_at))),timeout_milliseconds:=5000);
 return new;
exception when others then
 -- Notification failure must never prevent the pilot from sending a result.
 return new;
end;
$$;
revoke all on function vce_private.notify_results_discord() from public,anon,authenticated;
