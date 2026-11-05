# RACE CONTROLE VCE — V2.6 · INSTALLATION SUPABASE PAR COPIER-COLLER

## Étape 1 — SQL EDITOR
Dans Supabase > **SQL Editor**, ouvrir **New query** et coller UNIQUEMENT :
`race-controle-windows/server/supabase-vce-agent-v26.sql`.
Cliquer **Run**. Il doit se terminer sans erreur.

Ce fichier crée trois tables séparées :
- `vce_agent_devices` : appareils et associations ;
- `vce_agent_sessions` : sessions en cours et terminées ;
- `vce_agent_laps` : tours et échantillons de télémétrie.

Ne PAS coller `index.ts` ici : les lignes `//`, `import`, `Deno.serve` sont du TypeScript et provoquent une erreur SQL.

## Étape 2 — EDGE FUNCTIONS
Dans Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor** :
1. Nommer la fonction exactement **vce-telemetry**.
2. Remplacer son contenu par le fichier `race-controle-windows/server/vce-telemetry/index.ts`.
3. Dans les réglages de CETTE fonction, désactiver la vérification JWT automatique (**Verify JWT**) si nécessaire. Le code vérifie lui-même les secrets appareils et les jetons STAFF.
4. Cliquer sur **Deploy**.

Ne PAS mettre le `service_role` dans l'interface GitHub, l'EXE ou un formulaire pilote. Supabase fournit ce secret uniquement à la fonction serveur.

## Étape 3 — STAFF
Ouvrir `telemetry-agent-staff.html` depuis GitHub Pages après publication, avec un compte STAFF authentifié.
Cette page interroge la Edge Function sécurisée et présente les appareils.

## Étape 4 — LAUNCHER
Sur Windows :
1. Vérifier l'absence d'alerte antivirus non résolue sur le binaire avant installation.
2. Installer la version vérifiée, puis sélectionner le profil pilote dans Paramètres.
3. Autoriser explicitement le transfert.
4. Envoyer une demande au STAFF, approuver le bon profil puis vérifier la liaison.
5. Lancer Assetto Corsa / ACC et rouler pour produire au moins un tour complet.

Le logiciel détecte AC, ACC, LMU, RaceRoom et ACEVO.
**Capture AC/ACC en cours de validation, LMU par fichiers .duckdb ; RaceRoom/ACEVO : détection seulement, pas encore de lecteur live.**

## Contrôler les données
Exécuter dans SQL Editor :
```sql
select device_id, requested_pilot, pilot_slug, status, current_game, current_state,
       last_seen_at from public.vce_agent_devices order by created_at desc limit 20;
select session_id, pilot_slug, game, track, car, status, laps_count,
       started_at, ended_at from public.vce_agent_sessions order by started_at desc limit 20;
select session_id, lap_number, lap_time_ms, sample_count
       from public.vce_agent_laps order by created_at desc limit 20;
```

## Important : Microsoft Defender
La V2.4.0 a déclenché une alerte. La V2.6 compile l'application en mode `onedir`
puis produit un **unique EXE d'installation** avec Inno Setup. Ce changement peut
réduire certains faux positifs, mais ne garantit pas la sécurité ni la disparition
des alertes. Ne pas désactiver Defender, ne pas contourner un blocage, obtenir le nom
exact de détection et faire examiner le binaire avant diffusion.

La publication de GitHub Release reste **manuelle après validation**.
L'application ne doit pas installer silencieusement un binaire non signé.

## Modifications de dépôt
- Ajout : `race-controle-windows/patch_v26.py`
- Ajout : `race-controle-windows/server/supabase-vce-agent-v26.sql`
- Ajout : `race-controle-windows/server/INSTALLATION_V26_COPIER_COLLER.md`
- Modifiés : `.github/workflows/build-vce-installer.yml` et `race-controle-windows/setup.iss`
- Conservé : `race-controle-windows/server/vce-telemetry/index.ts` (TypeScript : Edge Function)
- Conservé : `telemetry-agent-staff.html`
- Aucun HTML existant remplacé ; tous les autres fichiers du dashboard restent inchangés.
