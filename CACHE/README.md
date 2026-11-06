# CACHE — RACE CONTROL VCE

Ce dossier documente les sauvegardes et l'administration des cycles d'entraînement.

**Important : GitHub Pages est statique.** Les données qui changent en temps réel ne peuvent pas être enregistrées durablement dans un dossier GitHub. Elles sont donc stockées dans Supabase.

## Emplacement effectif des données

- `public.vce_cache_archives` : sauvegardes privées du STAFF, créées à la demande et automatiquement **avant chaque réinitialisation des entraînements**.
- `public.vce_training_control` : génération du cycle d'entraînement (0, 1, 2, ...), consultable par les pages pilotes.
- `public.vce_publications` : pilotes, résultats, line-ups, calendriers, autres publications, attributions d'entraînement.
- `public.vce_training_submissions` et `public.vce_training_reviews` : séances soumises et validations.
- `public.vce_agent_sessions` et `public.vce_agent_laps` : télémétrie et chronos ; non effacés par la réinitialisation.
- `public.vce_irl_evaluations` : évaluations de pilotage ; non effacées par la réinitialisation.

## Commandes STAFF

Page `cache-staff.html` depuis le dashboard `staff.html` :

1. **Créer une sauvegarde** : archiver publications et entraînements sans suppression.
2. **Exporter JSON** : télécharger le contenu d'une archive privée.
3. **Réinitialiser les entraînements** : saisir la phrase de confirmation + accepter une seconde confirmation. Le serveur effectue dans une **transaction atomique** : sauvegarde, remise à zéro des attributions et des validations/soumissions, incrémentation du cycle. La sauvegarde doit réussir avant le reset.

### Ce que le reset conserve

- Comptes et photos pilotes
- Résultats, calendriers, line-ups, annonces et overlays
- Sessions et tours de télémétrie complets
- Évaluations Coach IRL
- Archives existantes

Les traces locales d'entraînement sont préservées sous `vce_training_local_cache_*` dans le navigateur qui les détenait, puis invalidées au changement de cycle.

### Limites et restauration

Les sauvegardes du dossier CACHE sont stockées **dans la base Supabase** : ce n'est pas une sauvegarde indépendante de la totalité du projet ou des fichiers Storage. Les données de télémétrie ne sont pas dupliquées dans chaque archive (seuls leurs compteurs le sont). La fonction d'export permet de télécharger un JSON indépendant.

**La restauration des archives n'est pas automatisée** afin d'éviter d'écraser involontairement les données postérieures. Une restauration éventuelle doit faire l'objet d'une opération STAFF distincte et validée.

La migration SQL est `supabase/migrations/20261106232000_vce_cache_training_reset.sql`. La logique serveur est dans `supabase/functions/vce-telemetry/index.ts`.
