# UPDATE SITE · 26 novembre 2026

## Connexion aux profils
- Un compte STAFF authentifié peut ouvrir un profil actif même sans identité pilote personnelle. Le serveur vérifie les droits STAFF et l’effectif avant ouverture.
- Une indisponibilité après authentification conserve la session et permet de réessayer sa vérification.
- Les e-mails sont nettoyés des espaces de début/fin et normalisés ; les mots de passe restent strictement inchangés.
- Une ancienne réponse de connexion ne peut plus rétablir un compte après une autre connexion ou une déconnexion.
- Option d’affichage temporaire du mot de passe ; aucun mot de passe enregistré.
- Diagnostic Supabase : ACTIVE_HEALTHY, 16 connexions, aucun verrou bloquant, base 22 Mo. Les journaux observés montrent des refus invalid_credentials et une connexion réussie, sans erreur Auth 5xx. La vérification ne constitue pas un essai du mot de passe personnel du pilote.

## Barème R V3
Le même calcul alimente résultats officiels, profil et classement général.

| Type d’épreuve | Victoire, au moins 20 participants |
| --- | ---: |
| Challenge Hotlap | 60 R |
| Daily Race | 80 R |
| Open | 100 R |
| Qualifications Event | 130 R |
| Course championnat, une manche | 160 R |
| Endurance | 200 R |
| Championnat, classement final de saison | 240 R |
| Course Esport officielle | 320 R |
| Rallye | 160 R |

Un championnat final désigne le classement de saison, distinct d’une manche. Le STAFF confirme le type et le nombre de participants du même classement.

- 1er : 100 % du maximum ; 2e : 90 % ; 3e : 82 %.
- À partir de P4 : position relative = (position − 1) / (participants − 1).
- Par tranches de position relative ≤1 %, ≤5 %, ≤10 %, ≤25 %, ≤50 %, ≤75 %, au-delà : 75 %, 65 %, 55 %, 40 %, 25 %, 8 %, 1 % du maximum.
- Petites grilles : coefficient min(1, racine((participants − 1) / 19)). Arrondi au point, minimum 1 R pour un résultat terminé valide. Abandon : 0 R, aucune perte.
- Exemples : P5/20 Hotlap +24 R ; P5/20 Esport +128 R ; P1/20 Esport +320 R ; P25/1200 Hotlap +39 R.

## Résultats existants et soirées à deux courses
- Les trois résultats acceptés existants disposant du contexte complet ont été migrés vers V3. Les deux intitulés explicites HOTLAP RACEROOM sont reclassés Hotlap ; Tarmac Rally 101 est reclassé Rallye.
- Lucas Galy : P21/1200 Hotlap +39 R et P24/1350 Hotlap +39 R, soit 78 R. Victor Auger : P3/550 Rallye +131 R.
- Les décisions STAFF, classements d’arrivée et preuves restent conservés. Le total est recalculé depuis les résultats, sans incrément en double.
- Case facultative « Soirée avec Course 1 / Course 2 », numéro sauvegardé sur la proposition et la projection officielle, affiché dans l’historique, le profil et le brouillon d’affiche.
- Deux courses portant le même nom, le même jour et sur le même circuit sont distinguées par leur numéro.
- Jeux proposés : Assetto Corsa, Assetto Corsa Competizione, Le Mans Ultimate, RaceRoom, rFactor 2, Assetto Corsa EVO, Richard Burns Rally, Autre.

## Vérifications
Tests des barèmes V1/V2/V3, podium, hiérarchie, petites/grandes grilles, doublons et Course 1/2 ; tests des connexions concurrentes, changement de compte, session expirée et récupération après 504 ; validations HTML/CSS et routage.
Tests SQL avec le rôle authenticated et les identités STAFF/pilote, suivis de ROLLBACK : le STAFF peut modifier les critères et le numéro, la projection est synchronisée, un pilote ne peut pas modifier ses points ; l’envoi via STAFF conserve le vrai propriétaire et l’auteur. Aucun résultat d’essai conservé.

## Fichiers HTML à remplacer
Les HTML suivants référencent les nouvelles versions des scripts communs. La modification du formulaire concerne team-resultat-envoyer.html ; les autres changements HTML sont des versions de ressources pour éviter une ancienne copie en cache.

- `announcement-staff.html`
- `avec-coach.html`
- `cache-staff.html`
- `calendrier-staff.html`
- `calendrier.html`
- `coach-irl-evaluation.html`
- `coach-irl.html`
- `entrainement-staff.html`
- `evaluations-staff.html`
- `evolution-entrainements-staff.html`
- `gestion-donnees-pilotes.html`
- `lineup-staff.html`
- `lineup.html`
- `pilote.html`
- `preset-resultat-pilote.html`
- `resultats-classement-staff.html`
- `resultats-staff.html`
- `resultats.html`
- `staff.html`
- `team-annonces.html`
- `team-resultat-envoyer.html`
- `team-resultats-recus.html`
- `telemetry-agent-staff.html`
- `telemetry-staff.html`
- `telemetry.html`
- `validation-seances.html`

Les autres fichiers HTML restent inchangés. Aucun changement de l’application Windows.
