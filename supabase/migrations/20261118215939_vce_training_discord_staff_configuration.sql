create or replace function public.vce_discord_training_config(p_webhook text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select vce_private.discord_training_config(p_webhook); $$;
revoke all on function vce_private.discord_training_config(text) from public, anon;
grant execute on function vce_private.discord_training_config(text) to authenticated;
revoke all on function public.vce_discord_training_config(text) from public, anon;
grant execute on function public.vce_discord_training_config(text) to authenticated;
