# UPDATE — Barème de compétition par type d’évènement

## Règles

Le rating de compétition des nouveaux résultats utilise le type d’épreuve, la position et la taille du classement concerné. Les épreuves de niveau Esport sont valorisées davantage qu’une Daily / OPEN à position relative identique. Le STAFF confirme le type et le nombre de participants avant validation ; le site ne prétend pas mesurer automatiquement le niveau réel des adversaires.

Un classement terminé donne uniquement des points positifs. Un abandon vaut 0 point. Aucun point n’est ajouté avant validation STAFF.

Le classement doit être comparable : même épreuve et même catégorie. En course/endurance, compter les voitures classées du plateau concerné, et non tous les pilotes d’un équipage. En hotlap/qualification, compter les pilotes du classement chronométrique concerné.

Position relative normalisée : `q = 100 × (position − 1) / (participants − 1)`. Le premier est à 0 et le dernier à 100. Pour moins de 20 participants, pondération `sqrt((participants − 1) / 19)`, plafonnée à 1. Arrondi au point le plus proche, avec un minimum de 1 pour un résultat terminé et valide. Un classement incomplet ne peut pas être validé avec le nouveau barème.

| Type d’épreuve | q ≤ 1 | q ≤ 5 | q ≤ 10 | q ≤ 25 | q ≤ 50 | q ≤ 75 | q > 75 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Course championnat | 80 | 65 | 50 | 35 | 20 | 8 | 2 |
| Daily / OPEN | 50 | 40 | 30 | 20 | 10 | 3 | 1 |
| Hotlap / time attack | 100 | 85 | 70 | 50 | 30 | 10 | 1 |
| Esport qualifications | 110 | 90 | 75 | 55 | 35 | 15 | 2 |
| Esport course | 120 | 100 | 85 | 65 | 45 | 15 | 3 |
| Rallye | 100 | 85 | 70 | 50 | 30 | 10 | 2 |

Les valeurs ci-dessus sont celles d’un plateau d’au moins 20 participants ; la pondération réduit les gains des plus petits plateaux.

## Exemples

- Hotlap P25 / 1200 : **+85 R**.
- Daily / OPEN P15 / 20 : **+3 R**.
- Esport course P15 / 20 : **+15 R**.
- Dernier d’une course Daily à 20 : **+1 R**, aucune perte.
- Abandon : **0 R**, aucune perte.

## Intégration

Six types dans le formulaire pilote et les filtres. Nombre de participants obligatoire. Estimation avant l’envoi et vérification du type/plateau par le STAFF avant validation. La projection des résultats acceptés transmet désormais aussi le plateau et la version du barème au profil et au leaderboard.

Les anciens résultats gardent explicitement la version 1 afin de ne pas inventer leur contexte ou modifier les classements déjà publiés. Le gestionnaire de classements permet au STAFF de sélectionner la nouvelle version après confirmation des données. Les nouvelles propositions sont forcées en version 2 côté serveur, même si le client demande l’ancienne version. Une affiche ne peut pas rétablir l’ancien calcul d’une proposition acceptée en version 2.

Les gains d’entraînement et la grille d’évaluation des coachs sont des calculs distincts.

## Vérification

Tests des six types, exemples ci-dessus, monotonie des points, petits plateaux, données manquantes, abandon, conservation historique et dédoublonnage avec une affiche. Test transactionnel annulé en base : version 2 obligatoire pour les nouveaux résultats, refus de validation sans plateau et copie du contexte après acceptation. Aucun résultat de test ni message Discord conservé.

HTML modifiés : pilote.html, team-resultat-envoyer.html, team-resultats-recus.html, resultats-classement-staff.html. Aucun nouvel HTML ; les autres HTML sont inchangés.
