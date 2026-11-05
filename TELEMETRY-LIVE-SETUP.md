# VCE LIVE — installation nécessaire
1. Exécuter `telemetry-live-supabase.sql` dans le SQL Editor (après le schéma de télémétrie existant).
2. Déployer `supabase/functions/vce-telemetry-ingest/index.ts` avec Supabase CLI.
3. Créer un jeton aléatoire de 32 octets minimum **par installation** dans un environnement STAFF sécurisé. Stocker uniquement son SHA-256 hex dans `vce_telemetry_device_credentials`, transmettre le jeton à l'EXE par canal sécurisé.
4. Le STAFF associe `pilot_slug` à `vce_telemetry_devices` et approuve l'appareil.
5. L'EXE envoie en POST vers `/functions/v1/vce-telemetry-ingest` avec `Authorization: Bearer <jeton>`, `session_id` UUID stable, `game`, `car`, `track`, `lap_number`, `elapsed_ms`, `sample`. En fin de session `event:"end"`.
6. Les pages STAFF authentifiées peuvent s'abonner à la table `vce_telemetry_live` via Supabase Realtime. Les pages pilotes nécessitent **une authentification pilote dédiée et des règles RLS** avant toute lecture.
7. **Non inclus** : l'EXE lui-même, le provisioning des jetons, la réception des demandes d'appairage, le stockage complet des échantillons/tours, l'affichage pilote live et le test de charge. Le flux proposé est un snapshot de commandes par POST, pas encore un WebSocket continu. Pour 10–20 Hz par pilote, préférer un service de streaming dédié ou batching et tester latence/coût.
8. Aucun déploiement Supabase n'est effectué par l'ajout de ces fichiers GitHub.
