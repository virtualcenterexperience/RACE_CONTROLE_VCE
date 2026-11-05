-- VCE 2.7 — ajouter l'IP privée locale à la table de liaison.
-- A exécuter APRES supabase-vce-agent-v26.sql dans Supabase SQL Editor.
-- Adresse purement indicative, elle change selon le réseau et ne sert jamais de mot de passe.
alter table public.vce_agent_devices
  add column if not exists local_ip inet;

-- Vérifier la remontée des demandes :
select requested_pilot, steam_id64, host(local_ip) as ip_locale,
       status, pilot_slug, current_game, last_seen_at
from public.vce_agent_devices
order by created_at desc limit 25;
