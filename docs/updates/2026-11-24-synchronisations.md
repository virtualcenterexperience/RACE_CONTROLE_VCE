# UPDATE — Corrections de synchronisation pilote / STAFF

## Causes trouvées

- Deux scripts écrivaient dans la même liste d’attributions du profil : une lecture locale pouvait effacer la liste Supabase. La synchronisation n’écoutait pas non plus l’arrivée tardive de l’effectif.
- La page STAFF enregistrait d’abord un brouillon local : une seconde action était nécessaire pour publier la séance. L’écriture de la liste entière pouvait écraser une attribution créée entre-temps dans un autre onglet.
- Coach IRL pouvait reprendre une ancienne sélection mémorisée dans le navigateur. Certaines lectures pouvaient se terminer après un changement de profil ou une déconnexion.
- Le flux d’activité du dashboard STAFF suivait les entraînements, mais pas les propositions de résultats.
- Le salon Discord des entraînements était configuré ; aucun salon dédié aux résultats ne l’était.

## Corrections

- Une seule source Supabase pour les attributions du profil, avec rafraîchissement après authentification, arrivée de l’effectif et action manuelle. Les anciennes données locales ne remplacent plus les attributions partagées.
- Identité du pilote et numéro de requête contrôlés avant affichage ; les réponses en retard sont ignorées et l’affichage est nettoyé à la déconnexion.
- « Attribuer au pilote » publie directement. « Enregistrer un brouillon » reste une action distincte. Une écriture serveur atomique conserve les attributions déjà présentes et renvoie la liste confirmée.
- Les nouvelles attributions enregistrent l’identifiant stable du pilote ; les anciennes attributions par nom restent lisibles.
- Coach IRL confirme le destinataire via l’effectif et l’identité serveur, sans reprendre une ancienne sélection de session. Les retours de séance et décisions STAFF sont synchronisés.
- Flux et cloche STAFF : entraînements et résultats en attente, liens vers leur validation. Les erreurs de lecture ne sont pas annoncées comme une absence d’envoi.
- Notifications de résultats vers le salon STAFF des entraînements si aucun salon de résultats distinct n’est défini. Le STAFF peut toujours choisir un salon séparé. Aucun lien secret n’est exposé.
- Fréquence automatique de deux minutes conservée ; les boutons Actualiser relancent les lectures sans attendre ce délai. Les changements dans les autres onglets du même navigateur sont signalés.
- Suppression de panneaux secondaires du profil qui relisaient l’ancien historique GitHub : les séances et résultats officiels restent dans les panneaux principaux.
- Correction du libellé des séances approuvées, qui pouvait rester « en attente ». Ajustements CSS de débordement des listes et notifications.

## Vérifications

18 comptes pilotes actifs, aucun hors effectif. Aucun résultat accepté absent ou incohérent dans le miroir de rating. Aucun point modifié manuellement et aucun compte réinitialisé.

Tests transactionnels annulés en base : lecture du bon pilote, refus d’un autre profil, refus d’écriture par un pilote, création successive de deux attributions sans perte, retrait ciblé, identité du destinataire, routage Discord. Aucun faux message Discord envoyé.

Tests JavaScript : réponse retardée après changement de profil/déconnexion ignorée, effectif tardif, attribution cloud sans cache local, plafonnement à 3 séances validées par jour / 9 points, séparation des pilotes, barème course et dédoublonnage. Contrôles HTML/JSON/CSS, sessions, boutons et traduction.

## HTML modifiés

pilote.html, staff.html, coach-irl.html, entrainement-staff.html, team-resultat-envoyer.html, team-resultats-recus.html, validation-seances.html, avec-coach.html, sans-coach.html.

Aucun nouvel HTML. Les autres pages HTML sont inchangées. Les fichiers JS/CSS et la migration correspondante sont livrés avec ces pages sur GitHub ; aucune réinstallation de l’application Windows n’est nécessaire.
