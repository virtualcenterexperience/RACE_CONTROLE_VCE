-- RACE CONTROLE VCE — diagnostic synchronisation v3.1
-- Coller dans Supabase > SQL Editor (pas dans Edge Functions).
-- Lecture seule : aucune modification des donnees.
select 'devices' as source, count(*) as total from public.vce_agent_devices
union all select 'sessions',count(*) from public.vce_agent_sessions
union all select 'laps',count(*) from public.vce_agent_laps;

select d.device_id,d.pilot_slug,d.status,d.current_game,d.current_state,
       d.last_seen_at,
       round(extract(epoch from (now()-d.last_seen_at)))::integer as secondes_depuis_signal,
       (d.last_seen_at >= now()-interval '30 seconds') as signal_recent
from public.vce_agent_devices d
order by d.last_seen_at desc nulls last limit 30;

select s.session_id,s.pilot_slug,s.game,s.track,s.car,s.status,
       s.laps_count,s.last_heartbeat_at,s.started_at,s.ended_at,
       (select count(*) from public.vce_agent_laps l where l.session_id=s.session_id) as tours_enregistres,
       (select coalesce(sum(l.sample_count),0) from public.vce_agent_laps l where l.session_id=s.session_id) as echantillons_enregistres
from public.vce_agent_sessions s
order by s.started_at desc limit 30;

-- Interprétation :
-- signal_recent=false : le serveur n'a pas recu de signal recent du PC.
-- sessions sans tours : verifier la capture native et les envois en fin de tour.
-- echantillons_enregistres=0 : aucun echantillon archive pour ces tours.
-- Le flux Realtime est distinct : ces requetes ne prouvent pas sa livraison.
