-- VCE TELEMETRY LIVE · exécuter dans Supabase SQL Editor APRÈS les migrations V2.6 / V2.7.
-- Colonnes facultatives pour afficher les états et canaux réellement transmis par le jeu.
alter table public.vce_agent_sessions add column if not exists live_sample jsonb;
alter table public.vce_agent_sessions add column if not exists session_type text;
-- Contrôle des dernières données :
select session_id, pilot_slug, game, track, car, status, session_type,
       laps_count, live_sample, last_heartbeat_at
from public.vce_agent_sessions
order by started_at desc limit 5;
