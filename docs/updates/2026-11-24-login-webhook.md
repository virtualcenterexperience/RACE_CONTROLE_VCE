# UPDATE — Connexion pilote et notifications des résultats

- L’identifiant de connexion pilote est modifiable. Il accepte l’identifiant individuel, le prénom/nom normalisé ou l’e-mail du compte.
- Après connexion, le serveur confirme le pilote propriétaire avant l’ouverture du profil. Changer le texte du formulaire ou l’URL ne donne aucun droit sur un autre pilote.
- Le mot de passe saisi est effacé après chaque tentative, au changement de profil et à la déconnexion. Les codes provisoires et changements de mot de passe restent obligatoires selon l’état du compte.
- Le STAFF transmet désormais l’identifiant individuel dans la fiche de code provisoire. L’ancien identifiant d’affichage reste compatible avec le profil choisi.
- Les résultats affichés et les actions de validation sont retirés immédiatement à la déconnexion ou après un échec d’autorisation.
- Configuration Discord séparée pour les résultats : depuis le dashboard STAFF ou Résultats reçus. Aucun champ n’est proposé aux pilotes.
- Le serveur vérifie les droits STAFF pour consulter l’état ou enregistrer le webhook. Le lien est stocké dans Vault, jamais retourné dans une réponse ni stocké dans le navigateur.
- Un nouveau résultat en attente déclenche une notification serveur avec pilote, épreuve, circuit, classement et lien de validation. Les mentions Discord sont désactivées. Un échec de notification ne bloque pas l’envoi du résultat.
- Aucun webhook réel n’a été enregistré ni aucun message Discord envoyé pendant les vérifications. L’activation nécessite que le STAFF renseigne le salon destinataire.

## Validation

Tests du changement de compte, routage par identité serveur, effacement du mot de passe, nettoyage après déconnexion, résultat/Rallye, rating, sessions, traductions et boutons réussis. Audit des 43 pages HTML, ressources JSON et CSS sans erreur. Tests transactionnels en base : refus des comptes anonymes et pilotes, accès STAFF à l’état uniquement, refus des URL non Discord. Aucun compte ni mot de passe réinitialisé.

## Fichiers HTML modifiés

- pilote.html
- staff.html
- team-resultat-envoyer.html
- team-resultats-recus.html

Aucun nouveau HTML. Les autres pages HTML ne nécessitent pas de remplacement. Migration : 20261124185113_vce_results_discord_staff_only.sql.
