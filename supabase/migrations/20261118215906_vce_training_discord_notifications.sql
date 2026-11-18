create extension if not exists pg_net with schema extensions;
create schema if not exists vce_private;
revoke all on schema vce_private from public, anon;
grant usage on schema vce_private to authenticated;

create or replace function vce_private.discord_training_config(p_webhook text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
begin
 if auth.uid() is null or not public.vce_is_staff() then
  raise exception 'STAFF access required' using errcode='42501';
 end if;
 select id into secret_id from vault.secrets where name='vce_discord_training_webhook';
 if p_webhook is not null then
  if p_webhook !~ '^https://discord[.]com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
   raise exception 'Invalid Discord webhook URL' using errcode='22023';
  end if;
  if secret_id is null then
   secret_id:=vault.create_secret(p_webhook,'vce_discord_training_webhook','Training completion notifications');
  else
   perform vault.update_secret(secret_id,p_webhook,'vce_discord_training_webhook','Training completion notifications');
  end if;
 end if;
 return jsonb_build_object('configured',secret_id is not null);
end;
$$;
revoke all on function vce_private.discord_training_config(text) from public, anon;
grant execute on function vce_private.discord_training_config(text) to authenticated;

create or replace function public.vce_discord_training_config(p_webhook text default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select vce_private.discord_training_config(p_webhook);
$$;
revoke all on function public.vce_discord_training_config(text) from public, anon;
grant execute on function public.vce_discord_training_config(text) to authenticated;

create or replace function vce_private.notify_training_discord()
returns trigger language plpgsql security definer set search_path = '' as $$
declare webhook text;
begin
 select decrypted_secret into webhook from vault.decrypted_secrets where name='vce_discord_training_webhook';
 if webhook is null then return new; end if;
 perform net.http_post(
  url:=webhook,
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object(
   'username','VCE Race Control',
   'allowed_mentions',jsonb_build_object('parse','[]'::jsonb),
   'embeds',jsonb_build_array(jsonb_build_object(
    'title','Entraînement terminé · À valider',
    'description',left(new.pilot,120)||' vient d’envoyer sa séance au STAFF.',
    'color',4248063,
    'fields',jsonb_build_array(
     jsonb_build_object('name','Circuit','value',left(coalesce(nullif(new.payload->>'circuit',''),'Non précisé'),200),'inline',true),
     jsonb_build_object('name','Voiture','value',left(coalesce(nullif(new.payload->>'car',''),'Non précisée'),200),'inline',true),
     jsonb_build_object('name','Exercice','value',left(coalesce(nullif(new.payload->>'exercise',''),'Séance pilote'),500))
    ),
    'url','https://virtualcenterexperience.github.io/RACE_CONTROLE_VCE/validation-seances.html',
    'timestamp',new.submitted_at
   ))
  ), timeout_milliseconds:=5000
 );
 return new;
exception when others then
 -- A Discord outage must not roll back the pilot submission.
 return new;
end;
$$;
revoke all on function vce_private.notify_training_discord() from public,anon,authenticated;
create trigger vce_training_discord_notification after insert on public.vce_training_submissions
 for each row execute function vce_private.notify_training_discord();
