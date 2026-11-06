# VCE TELEMETRY LIVE 3.0 — INSTALLATION SUPABASE

## 0. Pré-requis
Déployer d'abord les tables des V2.6–V2.9 si cela n'a pas déjà été fait.
Un pilote doit être lié à un vrai utilisateur Supabase Auth via `pilot_auth_user` pour lire ses propres données. Un simple slug dans une URL n'est pas une preuve d'identité.

## 1. SQL Editor
Exécuter **dans cet ordre**, uniquement si pas encore installés :
- `race-controle-windows/server/supabase-vce-agent-v26.sql`
- `race-controle-windows/server/supabase-vce-agent-v27-ip.sql`
- `race-controle-windows/server/supabase-vce-live-migration.sql`

Puis exécuter **un seul nouveau script** : `race-controle-windows/server/supabase-vce-live-v3.sql`. Il comprend les règles Realtime privées et le partage optionnel des tours. Les deux scripts séparés restent disponibles pour diagnostic.

## 2. Edge Functions
Déployer le fichier `race-controle-windows/server/vce-telemetry/index.ts` dans la fonction **vce-telemetry** dans Supabase Edge Functions.
Cette fonction doit être configurée pour vérifier elle-même les jetons STAFF et les secrets appareils. Si le fournisseur impose une vérification JWT globale avant l'exécution, configurer la fonction pour accepter les demandes de l'agent puis laisser le code contrôler l'identité ; les politiques de base garantissent l'authentification des abonnés aux topics privés.

## 3. Realtime
Dans Supabase Realtime, conserver les channels privés et les règles RLS pour `realtime.messages`. Ne pas ajouter une règle `USING (true)` pour tous les utilisateurs sur les topics VCE. Le topic est construit sous la forme `vce:device:<UUID>`.

Supabase Realtime transmet les mesures en continu dans le navigateur. L'application Windows capture environ **20 mesures/s**, transmet des **lots jusqu'à 5 fois/s** et le navigateur tente un rendu à **60 images/s**. Les valeurs affichées sont les mesures réelles et non une interpolation fictive du moteur de jeu.

## 4. Windows
Installer la V3.0 de test après avoir fermé l'ancienne application. Le code enregistre une session dès son début, puis l'agent diffuse les échantillons uniquement si le transfert est autorisé et le PC approuvé par le STAFF.

## 5. Dashboard
Sur `telemetry.html`, connectez-vous avec le compte Supabase pilote authentifié ou un compte STAFF.
Le HUD et la carte afficheront la télémétrie en direct lorsqu'Assetto Corsa est en piste. À la fin de la session, les tours terminés sont conservés pour analyse et comparaison.
Pour comparer les tours de deux pilotes, le STAFF dispose de l'accès autorisé ; un pilote non-STAFF doit d'abord activer « Autoriser le partage de mes tours », qui nécessite son compte Supabase Auth lié à son PC.

## Vérification rapide
Dans SQL Editor :
```sql
select session_id, pilot_slug, game, track, car, status, laps_count,
       last_heartbeat_at,live_sample
from public.vce_agent_sessions
order by started_at desc limit 10;

select session_id,lap_number,lap_time_ms,sample_count
from public.vce_agent_laps
order by created_at desc limit 20;
```

Les coordonnées XY du circuit sont lues depuis `carCoordinates` dans la mémoire partagée **Assetto Corsa original**. Les coordonnées de l'ACC ne sont pas encore garanties par ce lecteur. La barre de progression s'affiche si les coordonnées manquent. Le circuit est nommé d'après les données de session du jeu.

## Fichiers GitHub
**Créés :** `telemetry-live.js`, `telemetry-recap.js`, `race-controle-windows/patch_v30.py`, `race-controle-windows/server/supabase-vce-private-live.sql`, `race-controle-windows/server/supabase-vce-comparison.sql`, ce guide.
**Remplacés :** `telemetry.html`, `telemetry.js`, `telemetry-cloud.js`, `telemetry.css`, `race-controle-windows/server/vce-telemetry/index.ts`, `.github/workflows/build-vce-installer.yml`, `race-controle-windows/setup.iss`.
**Inchangés :** tous les autres modules pilotes / staff.
