# Connexion unique VCE ESPORT — activation des profils pilotes

Date : 6 novembre 2026

## Fonctionnement
1. Le pilote sélectionne son profil sur `pilote.html`.
2. L'écran affiche l'identifiant commun **virtualcenterexperience** et demande **son code personnel**.
3. Lors de sa première connexion, le code temporaire reçu du STAFF doit être remplacé par un mot de passe personnel (au moins 12 caractères, majuscule, minuscule et chiffre).
4. Sa session Supabase est ensuite réutilisée dans **Télémétrie Tour** et **Télémétrie Setup** sans deuxième formulaire.
5. Le STAFF ouvre les sessions de chaque pilote depuis `telemetry-staff.html` avec son propre compte STAFF.

**Important :** le prénom ne doit pas servir de mot de passe provisoire : il est affiché publiquement dans la liste des pilotes et serait facile à deviner. Le serveur crée un code temporaire aléatoire, communiqué une seule fois au STAFF. Les codes ne sont jamais enregistrés dans GitHub.

## Activation nécessaire dans Supabase
Le **dépôt GitHub a été mis à jour**, mais cela **ne déploie pas** automatiquement l'Edge Function en production.

1. Ouvrir le projet Supabase déjà utilisé par VCE ESPORT, rubrique **Edge Functions**.
2. Choisir la fonction existante **vce-telemetry**, puis son éditeur.
3. Remplacer **le code TypeScript de la fonction** par le fichier GitHub :
   `race-controle-windows/server/vce-telemetry/index.ts`.
4. Cliquer sur **Deploy updates**. Conserver la configuration existante de cette fonction, ses variables d'environnement et ses autorisations. **Ne pas coller ce code dans SQL Editor.**
5. La fonction VCE existante utilise `verify_jwt=false` pour accepter les messages des appareils : son code valide lui-même les secrets des PC et les JWT des utilisateurs avant toute opération sensible. Ne pas supprimer ces contrôles.
6. Vérifier la réponse de l'action `pilot_account_ready` depuis l'outil Test de l'Edge Function. Le code de contrôle doit retourner `ready:false` pour un pilote sans compte.

Autre méthode pour un environnement local déjà configuré : placer le TypeScript dans `supabase/functions/vce-telemetry/index.ts` puis exécuter `supabase functions deploy vce-telemetry --no-verify-jwt`. Ce fichier est distinct des autres fonctions VCE : ne pas écraser une fonction différente.

## Création des comptes dans l'interface STAFF

Après déploiement de la fonction :
1. Se connecter à `staff.html` avec un compte STAFF Supabase autorisé.
2. Ouvrir **Télémétrie pilotes & appareils** → `telemetry-staff.html`.
3. Utiliser le nouveau panneau **ACCÈS PILOTES · COMPTES SUPABASE** pour choisir un profil.
4. Cliquer sur **CRÉER**. Le serveur génère un compte et renvoie un code temporaire visible sur cet écran.
5. Remettre ce code uniquement au bon pilote par un canal privé. Ne pas publier les codes dans Discord public, GitHub ou captures d'écran.
6. Faire la première connexion du pilote, puis vérifier que le changement de mot de passe est imposé.
7. Pour un compte existant, utiliser **RÉINITIALISER** uniquement à la demande du pilote.

Les comptes utilisent en interne un alias de connexion `vce-pilote+slug@virtual-center-experience.fr` géré par le serveur. Ce n'est pas une boîte mail réelle à transmettre : l'identifiant affiché reste **virtualcenterexperience**. Les réinitialisations se font depuis le STAFF.

## Association des données
Le serveur utilise `auth.users.id` comme preuve d'identité. Lorsqu'un compte pilote est créé, il est associé aux appareils approuvés et aux sessions correspondantes dont `pilot_slug` correspond. Lorsqu'un STAFF approuve un nouvel appareil, le serveur retrouve le compte pilote et lie l'appareil à ce compte.

Les comptes non créés restent sur l'ancien affichage public du dashboard pendant l'activation progressive ; la télémétrie privée reste protégée par l'authentification Supabase. Dès qu'un compte est créé, son profil nécessite la connexion vérifiée.

## Contrôles avant ouverture à tous
- Connexion du pilote A, puis tentative d'ouvrir la télémétrie du pilote B : **accès refusé**.
- Vérifier que **Télémétrie Tour** et **Télémétrie Setup** fonctionnent avec la même session, sans seconde connexion.
- Vérifier l'accès STAFF au Tour et au Setup des pilotes sans utiliser leurs identifiants.
- Vérifier l'association des PC et le chargement des tours, valides ou invalides.
- Vérifier la déconnexion et la réinitialisation du code provisoire.
- Essayer sur un navigateur privé et sur un autre ordinateur pour confirmer le comportement attendu.

## Fichiers créés / modifiés
- **Créés :** `vce-pilot-auth.js`, `vce-staff-pilot-accounts.js`, ce guide.
- **Modifiés :** `pilote.html`, `telemetry-cloud.js`, `telemetry-salon.html`, `telemetry-staff.html`, `telemetry-trackstyle.css`, `race-controle-windows/server/vce-telemetry/index.ts`.
- **Inchangés :** application Windows `.exe`, autres HTML/CSS/scripts, schéma SQL existant.

## Statut réel
**GitHub : modifications publiées.** **Supabase : déploiement de l'Edge Function et création des comptes à effectuer.** Aucun compte pilote n'a été créé à distance durant cette opération : aucune clé de service Supabase ni accès administrateur de ce projet n'était disponible dans cet environnement.
