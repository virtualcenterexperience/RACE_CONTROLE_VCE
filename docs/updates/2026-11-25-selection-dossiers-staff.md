# UPDATE — Sélection des dossiers pilotes depuis le STAFF

Depuis la vue générale du STAFF, « Choisir une séance ou un résultat » ouvre un sélecteur en trois étapes : pilote, type de dossier, dossier précis. Des raccourcis sont aussi présents dans les catégories Entraînement et TEAM.

- Entraînements : séances envoyées avec leur décision STAFF, plus attributions pas encore envoyées. Une attribution déjà transmise n’apparaît pas une seconde fois ; chaque envoi réel reste consultable.
- Résultats : historique du pilote, incluant propositions en attente, acceptées et refusées. Chargement paginé pour ne pas masquer les plus anciens résultats.
- Détail : date, statut, circuit, voiture, consignes/débrief, classement et commentaires selon le dossier. Les preuves et replays HTTPS s’ouvrent à la demande.
- Action : ouverture de la séance attribuée, ou accès à la page de validation directement filtrée sur la séance / le résultat choisi. Un lien permet de revenir à la liste complète.
- Le dossier ciblé reste visible même s’il a déjà été accepté, contrairement au filtre « en attente » utilisé par défaut dans la boîte de réception.
- Actualisation manuelle immédiate et automatique toutes les deux minutes. Les données en retard sont ignorées après changement de pilote ou déconnexion ; le panneau et les détails sont vidés à la fermeture de session.
- Lecture réservée à une session STAFF vérifiée. Le sélecteur ne valide aucun dossier et ne modifie aucun point.

## Vérifications

Tests des droits STAFF, filtrage par pilote, dédoublonnage attribution/envoi, navigation vers une séance précise, navigation vers un ancien résultat accepté et refus des lignes appartenant à un autre pilote. Tests existants des validations, comptes, points, barèmes et traductions réussis. Audit HTML/JSON/CSS et syntaxe JavaScript sans erreur bloquante.

## Fichiers

HTML modifiés : staff.html, validation-seances.html, team-resultats-recus.html, team-resultat-envoyer.html. Aucun nouvel HTML ; les autres HTML sont inchangés.

Nouveaux composants : assets/js/vce-staff-records.js et assets/css/vce-staff-records.css. Aucun changement de schéma Supabase, d’identifiants ou de données sportives.
