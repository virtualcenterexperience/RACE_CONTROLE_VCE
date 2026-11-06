# RACE CONTROL VCE — Check-up général du 6 novembre 2026

## Objectif
Préparer la refonte graduelle **Profil général → Pilote → Entraînements → Télémétrie → STAFF**, avant réception des prochaines ressources utilisateurs. Préserver les liens pilotes, les autorisations, la synchronisation et les séances enregistrées.

## Ce qui a réellement été vérifié
- Inventaire du dépôt GitHub `main` : 36 fichiers HTML et 290 éléments référencés dans l'arbre de dépôt (dont images et dossiers).
- Vérification statique de la syntaxe JavaScript **dans les 36 pages HTML** et des doublons d'identifiants : aucune erreur détectée dans les scripts intégrés contrôlés et aucun ID dupliqué au sein des pages.
- Vérification de syntaxe pour **24 modules JS principaux** (authentification, scripts de pilotage, STAFF, télémétrie, replay et traitement des sessions) : aucune erreur détectée.
- Vérification des chemins `src`/`href` déclarés statiquement sur les pages principales : pas de fichier absent confirmé. Les chemins assemblés dynamiquement exigent un test navigateur.
- Lecture de la structure de tables Supabase et des alertes de sécurité remontées par le conseiller du projet.
- **Ce rapport n'est PAS une vérification fonctionnelle** sous navigateur connecté à un compte pilote/STAFF, ni une compilation/test d'EXE Windows.

## Situation Supabase au moment du contrôle
- 1 appareil, dont 1 approuvé par le STAFF.
- 19 séances ; 25 tours ; 35 982 échantillons de télémétrie.
- 4 soumissions d'entraînement ; 4 validations/enregistrements de revue ; 3 publications.
- `vce_agent_sessions` et `vce_agent_laps` servent à la télémétrie actuelle ; les anciennes tables `vce_telemetry_*` sont vides. **Ne pas remplacer le flux de production par les tables vides.**
- Certaines tables sont volontairement sous RLS sans politique directe ; leurs opérations passent par des Edge Functions sécurisées. Ne pas ouvrir leur accès pour faire disparaître un avertissement.

## Points techniques prioritaires
1. `pilote.html` : **19 blocs CSS internes**, 7 scripts internes, 6 JS externes ; plus de 86 Ko. Risque de conflits de styles et de comportements liés aux surcharges empilées. Extraire progressivement par module, conserver authentification et IDs.
2. `staff.html` : 7 blocs de styles et 2 scripts internes ; accueil et vues Teams à découper sans casser les accès de gestion.
3. `strategie.html` (~105 Ko) et `endurances.html` (~98 Ko) : besoin d'externalisation CSS/JS et de séparation des vues.
4. `profile.html` : nouveau fond VCE chargé depuis l'image intégrée à `index.html`. Tester son chargement sous mobile et réseau lent, prévoir à terme un fichier d'image autonome optimisé et mis en cache.
5. Sélection pilote : le script `assets/js/vce-pilot-firstnames.js` change uniquement le texte affiché. Le vrai nom et l'ID restent intacts. Prévoir les photos par un stockage et un champ de profil, **sans remplacer les IDs par les prénoms**.
6. Dashboard pilote : isoler `Mon espace / Entraînement / Team / Télémétrie`, les notifications d'exercices, visuels officiels, XP et rating ; leurs sources ne doivent pas être mélangées.
7. Entraînements : mutualiser le choix des circuits et voitures ; centraliser le retour navigation et éviter la triple répétition des bases. Grille d'évaluation/chronos de référence en attente des documents métiers.
8. Télémétrie : séparer cinq courbes du tour et setup ; ne pas afficher de faux capteurs. Les données 3D de circuit et noms/numéros de virages demandent des sources terrain vérifiables.
9. Windows : la chaîne de compilation GitHub v3.3 est définie mais sa **réussite et son installation distante** restent non vérifiées dans ce contrôle.

## Points de sécurité Supabase à traiter prudemment
- L'analyseur signale `public.vce_is_staff()` accessible depuis le rôle `anon` en tant que `SECURITY DEFINER`. Le corps de fonction compare `auth.uid()` à `vce_staff_users`, ce qui limite le risque observable ; revoir les permissions et vérifier les dépendances avant de révoquer.
- La fonction `vce_can_read_live(topic_name)` est aussi `SECURITY DEFINER` et autorisée aux utilisateurs connectés, ce qui peut être nécessaire pour les canaux Realtime privés. Vérifier ses conditions sans interrompre le flux.
- La protection Supabase Auth contre les mots de passe compromis est désactivée ; envisager l'activation dans les paramètres Auth.
- Guides : https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable et https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Plan ordonné de refonte
1. **Design système** : fichier CSS commun, composants de navigation et fond d'accueil ; vérifier les pages sur mobile.
2. **Identité pilote** : stockage photos de profil, prénom visuel, liste pilotée par le STAFF ; IDs inchangés.
3. **Dashboard + Mon espace** : cartes de navigation, XP/rating en courbes séparées, données réelles, notifications et images de publication.
4. **Entraînements** : Avec coach, Sans coach, Coach IRL (Évaluation / Entraînement), retours de navigation, exercices et validation.
5. **Télémétrie** : cinq canaux tour, comparaison autorisée entre pilotes, carte et replay, setup uniquement à partir de données disponibles.
6. **STAFF** : accueil général, pilotes, entraînements, télémétrie, évaluations et sous-menu Team (lineups, résultats, calendrier et annonces).
7. **Tests finaux** : comptes réels avec consentement, RLS, parcours pilotage/STAFF, navigateur mobile, flux Windows AC/ACC/LMU/AC EVO et compilation de l'EXE.

## Documents attendus
- Barèmes Rookie/XP/rating/points et grilles Coach IRL.
- Bases circuits, numéros de virages, valeurs de référence par combinaison voiture/circuit.
- Barèmes par difficulté des exercices et règles d'attribution/validation.
- Photos individuelles des pilotes, si autorisées, et visuels officiels des Team/LineUp/résultats/calendriers.

## Garanties
Ce check-up est **en lecture seule** pour Supabase et n'a pas remplacé les profils, les données de séances, les permissions ni les scripts fonctionnels. Les données et barèmes absents doivent rester explicitement « à renseigner » et non être inventés.
