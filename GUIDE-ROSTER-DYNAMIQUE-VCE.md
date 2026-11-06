## Correctif du 6 novembre — liste vide et refus d'ajout

Si **vce_publications_kind_check** refuse la création du roster :

1. Dans **Supabase > SQL Editor**, exécuter le SQL (et non un fichier TypeScript) : [supabase-correctif-roster-2026-11-06.sql](supabase-correctif-roster-2026-11-06.sql). Cette migration conserve les catégories existantes et initialise les **14 pilotes d'origine uniquement si la liste n'existe pas encore**.
2. Dans **Supabase > Edge Functions > vce-telemetry**, redéployer [la dernière version de index.ts](race-controle-windows/server/vce-telemetry/index.ts). Une version déployée avant la gestion dynamique ne connaît pas `staff_roster_add` / `staff_roster_remove`.
3. Sur GitHub Pages, faire **Ctrl + F5** dans `pilote.html`, `gestion-donnees-pilotes.html` et `telemetry-staff.html`.
4. Si « Lucas Galy » ou un autre pilote existe déjà, **ne pas le rajouter** : le sélectionner dans la gestion STAFF et créer ou réinitialiser son code provisoire si nécessaire.

Aucun historique de chrono, résultat ou entraînement n'est effacé par ce correctif.

# VCE ESPORT — Pilotes dynamiques et comptes automatiques

**Mise à jour GitHub : 6 novembre 2026.**

## Utilisation au quotidien — aucun script à modifier

1. Se connecter avec le compte STAFF Supabase sur `staff.html`.
2. Ouvrir **Ajouter / retirer des pilotes** → `gestion-donnees-pilotes.html`.
3. Saisir **Prénom NOM** puis cliquer sur **+ Ajouter le pilote**.
4. Le serveur ajoute le profil dans `vce_publications(kind='pilotes')`, crée (ou réactive) le compte d'authentification et génère un **code provisoire individuel**.
5. Le code s'affiche **une seule fois** dans l'espace STAFF. Le transmettre au pilote en privé, sans le publier.
6. Le pilote sélectionne son profil sur `pilote.html`, utilise l'identifiant visible **virtualcenterexperience**, saisit son code et choisit un nouveau mot de passe personnel.
7. La télémétrie Tour / Setup réutilise sa session Supabase. Le STAFF utilise son propre compte pour examiner les sessions des autres pilotes.
8. Pour retirer un pilote, utiliser **Retirer le pilote**. Sa connexion est désactivée, son nom n'apparaît plus dans la liste active et son historique sportif est conservé.

### Comptes des pilotes déjà présents

Les 14 pilotes existants peuvent être activés dans **Télémétrie pilotes & appareils** → `telemetry-staff.html`.
Dans la liste déroulante **ACCÈS PILOTES · COMPTES SUPABASE**, choisir le pilote : si son compte n'existe pas, la création est proposée automatiquement, avec confirmation du STAFF. Le code temporaire n'est pas conservé côté site. En cas de perte, cliquer sur **Réinitialiser**.

### Source de données unique

La liste officielle des pilotes se trouve dans le document Supabase `vce_publications` avec `kind='pilotes'`.
La gestion STAFF l'initialise automatiquement **une seule fois** depuis `data/vce/pilotes.json` si aucun document n'existe encore. Une fois initialisée, les ajouts/retraits passent par le serveur. Les pages pilotes et les menus de sélection lisent la liste Supabase en direct au chargement. Ne pas modifier les listes dans des fichiers JS/HTML.

### Sécurité et historiques

- Ajout/suppression et émission de codes : **JWT STAFF vérifié sur le serveur**, jamais depuis une simple sélection publique.
- Un mot de passe basé sur le prénom n'est pas utilisé (prénoms visibles publiquement). Les codes provisoires sont aléatoires.
- Le compte d'un pilote retiré est **désactivé**, pas supprimé physiquement. Les historiques sont donc conservés pour le STAFF.
- Les requêtes privées de télémétrie contrôlent le compte Supabase et l'appartenance au roster actif, même avec une ancienne session.
- Un pilote sans compte provisionné peut encore voir l'ancien dashboard pendant la transition ; cela n'ouvre pas la télémétrie privée.

## Activation technique indispensable — une seule fois

**Attention : les modifications du dépôt GitHub ne déploient PAS automatiquement l'Edge Function Supabase.**

Ouvrir Supabase → Edge Functions → fonction `vce-telemetry`. Y déployer le contenu du fichier :
`race-controle-windows/server/vce-telemetry/index.ts` depuis la branche principale GitHub.

Ne **pas** coller ce code dans le SQL Editor. Ne pas écraser les autres fonctions. Préserver les variables d'environnement et la configuration de la fonction, notamment les validations JWT internes pour les actions STAFF et les secrets d'appareils.

La table `vce_publications` doit autoriser `kind='pilotes'`. Si ce n'est pas le cas, l'installation initiale se fait depuis le SQL existant `supabase-pilotes-management.sql`. Vérifier les politiques RLS du projet avant l'ouverture à tous les pilotes.

## Tests après le déploiement

- STAFF : ajouter un profil de test → voir le code temporaire → vérifier l'apparition dans la liste publique.
- Pilote : se connecter → obligation de changer le code → accéder à Tour et Setup sans seconde connexion.
- STAFF : approuver un PC sur un profil ajouté → retrouver ses tours.
- STAFF : retirer le profil de test → il disparaît de la liste, et une ancienne connexion ne peut plus interroger la télémétrie privée.
- Recréer le même profil → réactivation du compte avec **un nouveau code provisoire**, sans perte de son historique.

## Fichiers créés/régénérés
- `GUIDE-ROSTER-DYNAMIQUE-VCE.md` : nouveau guide.
- `race-controle-windows/server/vce-telemetry/index.ts` : serveur modifié (ajout/retrait auto, activation/désactivation).
- `gestion-donnees-pilotes.html` : boutons STAFF ajout/retrait.
- `pilote.html` : liste et présence des pilotes dynamiques, suppression des tableaux codés en dur.
- `vce-pilot-auth.js` : refuse un profil retiré de la liste.
- `vce-staff-pilot-accounts.js` : sélection dynamique et activation des comptes existants.
- `telemetry-staff.html` : menu dynamique d'association de PC.
- `vce-roster-select.js` : source du roster uniquement Supabase quand disponible.
- `staff.html` : navigation renommée.

**Fichiers inchangés :** application Windows `.exe`, collecteur Python, autres HTML/CSS/JS, données JSON de départ, base SQL en production.

**État :** GitHub mis à jour ; déploiement serveur Supabase et tests fonctionnels réels restent nécessaires.
