create or replace function vce_private.discord_results_config(p_webhook text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
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
 return jsonb_build_object('configured',secret_id is not null);
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
 select decrypted_secret into webhook from vault.decrypted_secrets where name='vce_discord_results_webhook';
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
create trigger vce_results_discord_notification after insert on public.vce_race_result_submissions
 for each row execute function vce_private.notify_results_discord();
