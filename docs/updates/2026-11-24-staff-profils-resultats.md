# UPDATE — Session STAFF et profil pilote

- Une session STAFF valide ouvre les profils classiques sans exiger une seconde connexion pilote, y compris depuis un lien de connexion pilote existant.
- Un raccourci « Envoyer un résultat » est ajouté au profil. Le profil sélectionné est conservé dans la navigation TEAM puis dans le formulaire d’envoi.
- Le formulaire affiche le pilote concerné. Le STAFF peut utiliser sa session en cours ; aucun mot de passe pilote n’est demandé et aucun jeton pilote n’est créé.
- Le serveur vérifie le rôle STAFF, l’effectif actif et le compte propriétaire du pilote. Il rattache le résultat à ce compte et enregistre séparément le membre connecté dans submitted_by.
- Le résultat reste pending : les points et la validation STAFF suivent le parcours habituel. Le formulaire personnel filtre les envois du pilote choisi.
- Les pilotes ordinaires restent limités à leur propre compte. Les changements de compte au cours de la saisie bloquent l’envoi.

Tests transactionnels annulés en base : refus du rôle pilote sur l’accès STAFF, identité distincte du propriétaire, audit du membre connecté, statut en attente forcé même si le client demande accepted, absence de points avant validation. Aucun résultat de test ni message Discord conservé.

HTML modifiés : pilote.html, team.html, team-resultat-envoyer.html, team-resultats-recus.html. Aucun nouveau HTML. Les autres HTML sont inchangés.
