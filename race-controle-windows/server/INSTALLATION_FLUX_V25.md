# RACE CONTROLE VCE — Correctif flux 2.5.0

## Important : sécurité
Une version précédente a déclenché Microsoft Defender. **Ne pas demander aux pilotes de l'autoriser, de désactiver Defender ou d'ajouter une exclusion.** Obtenir d'abord le nom exact de la menace et le résultat d'une analyse du fichier; transmettre le binaire à Microsoft pour examen si un faux positif est suspecté. Une empreinte SHA-256 ou un build GitHub réussi n'est pas une garantie d'absence de malware. Signer les binaires distribués une fois audités.

Le code 2.5 est proposé pour examen et tests; aucune publication automatique de release ne doit être faite depuis une pull request.

## Cause des pertes de flux
- Les anciens fichiers `telemetry-supabase.sql` de la racine utilisent un schéma différent de celui du collecteur Windows.
- La Edge Function `vce-telemetry` n'est pas fournie par GitHub Pages et doit être déployée séparément sur le projet Supabase.
- Le compte STAFF doit approuver l'appareil, et le pilote doit autoriser le transfert.
- AC/ACC : le lecteur appelait `xyz` sans avoir défini cette variable, empêchant l'enregistrement de trames.

## Configuration du serveur Supabase
1. Ouvrir le projet Supabase du site VCE.
2. Supabase > **SQL Editor** : exécuter `race-controle-windows/server/supabase-vce-agent-v25.sql` une fois. Les trois tables `vce_agent_*` ne remplacent pas les anciennes.
3. **Edge Functions** : créer / actualiser la fonction **`vce-telemetry`** avec `race-controle-windows/server/vce-telemetry/index.ts`. Si vous utilisez le CLI : `supabase functions deploy vce-telemetry --no-verify-jwt` depuis un projet lié au bon project-ref. Cette option concerne cette fonction uniquement : chaque requête vérifie un secret propre au PC ou un JWT STAFF.
4. Vérifier que les variables **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`** et **`SUPABASE_SERVICE_ROLE_KEY`** existent **uniquement côté Edge Function/Supabase**. Ne jamais mettre la service_role dans l'application ou dans GitHub.
5. Vérifier que le RPC `vce_is_staff()` existe et refuse les utilisateurs non autorisés.
6. Ouvrir `telemetry-agent-staff.html` avec le compte STAFF sur GitHub Pages après publication de la page.
7. Installer une version Windows corrigée **seulement après validation antivirus**, ouvrir Paramètres, confirmer le compte Steam et le profil VCE, cliquer **Autoriser le transfert** puis **Associer au STAFF**.
8. Dans `telemetry-agent-staff.html`, approuver manuellement le bon profil. Cliquer **VÉRIFIER LIAISON** dans le launcher.
9. Lancer AC ou ACC et rouler au moins un tour complet ; vérifier en Supabase avec les requêtes ci-dessous.

## Diagnostic SQL (depuis SQL Editor)
```sql
select device_id, requested_pilot, pilot_slug, status,
       current_game, current_state, last_seen_at
from public.vce_agent_devices order by created_at desc limit 30;

select session_id, pilot_slug, game, track, car, status,
       laps_count, started_at, ended_at
from public.vce_agent_sessions order by started_at desc limit 30;

select session_id, lap_number, lap_time_ms, sample_count
from public.vce_agent_laps order by created_at desc limit 30;
```

## En cas de flux absent
- `FLUX DÉCONNECTÉ` : URL ou clé publique manquante.
- `HTTP 404` sur `/functions/v1/vce-telemetry` : Edge Function absente ou nom incorrect.
- `relation public.vce_agent_devices does not exist` : exécuter le nouveau SQL.
- `En attente STAFF` : demande non approuvée.
- `FLUX SUPABASE : PC inconnu` : cliquer **Associer au STAFF**.
- Jeu détecté mais 0 tour : pas de trame valide ou module non supporté ; la détection n'est pas la télémétrie.

## Compatibilité
- AC/ACC : capture locale expérimentale en lecture seule ; tester une session réelle avant distribution.
- LMU : import de fichiers DuckDB natifs, configuration du chemin parfois nécessaire.
- RaceRoom / ACEVO : détection seule, lecteur live non encore validé. Ne pas inventer de télémétrie.

## Fichiers impactés
- Nouveau : `race-controle-windows/patch_v25.py`.
- Nouveau : `race-controle-windows/server/supabase-vce-agent-v25.sql`.
- Nouveau : `race-controle-windows/server/vce-telemetry/index.ts`.
- Nouveau : `telemetry-agent-staff.html`.
- Modifiés : `race-controle-windows/setup.iss`, `.github/workflows/build-vce-installer.yml`.
- **Aucun HTML existant n'est remplacé**. Tous les autres modules du Race Control restent inchangés.

Les données envoyées par l'agent sont stockées dans les nouvelles tables privées. L'affichage automatique des courbes dans les dashboards pilotes n'est pas encore relié à ces tables : ce sera une phase distincte.
