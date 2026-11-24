# UPDATE V3.9.1 — Télémétrie et trajectoires

- Direct : priorité aux positions X/Z et aux inputs récents, sans rejouer une file de mesures anciennes. Chaque lot contient au maximum 12 échantillons d’origine de la fenêtre récente de 200 ms. Aucun point interpolé n’est ajouté aux archives.
- Analyse : envoi des tours terminés pendant la session, sans attendre la fermeture du jeu. Le worker vérifie les nouveaux tours toutes les 2 secondes ; le délai réel dépend du réseau et de la file d’envoi.
- Archives : ordre, coordonnées et canaux de chaque échantillon conservés. Segments de 160 mesures au lieu de 120 (25 % de requêtes en moins pour un même volume, hors dernier segment).
- Fiabilité : confirmation serveur exigée avant de considérer un tour envoyé ; les données restent locales en cas d’erreur. Les tours confirmés ne sont pas renvoyés à la fermeture dans le même démarrage de l’application.
- Site : recherche des nouveaux tours toutes les 5 secondes pendant une session active, 2 minutes au repos ; reprise progressive après erreur et aucune lecture automatique dans un onglet masqué. Actualiser reste immédiat.
- Site : réutilisation des tours déjà chargés, récupération des nouvelles pages seulement. Le changement de séance change aussi le canal direct.
- Affichage : lecture horodatée des échantillons réels avec un tampon de 200 ms pour le HUD et les courbes. Aucun GPS, position ou canal voiture n’est inventé si le jeu ne le transmet pas.

Les coordonnées X/Z du jeu décrivent la position sur la piste ; ce ne sont pas des coordonnées GPS géographiques. La précision dépend de la source native du jeu. L’acquisition LMU reste en lecture seule, sans modification du jeu ni interaction avec EAC.

## Déploiement

L’application 3.9.0 doit être remplacée par l’installateur 3.9.1 pour bénéficier des changements d’envoi. Les modifications du site sont indépendantes. La compilation produit un artefact Windows ; la publication d’une release exige le workflow manuel avec `publish_release=true` et une vérification Microsoft Defender réussie.

HTML modifié : `telemetry.html` (versions des scripts). Aucun HTML créé. Tous les autres HTML inchangés. Aucune migration ou modification de configuration Supabase nécessaire.

## Vérifications

Tests hors ligne : récupération du direct après retard, conservation de tous les échantillons d’archive, accusés de réception, envoi d’un tour pendant le roulage, absence de doublon à la fermeture, reprise après erreur, lecture incrémentale, fréquence adaptative et lecture horodatée sans extrapolation. Un essai réel Windows/LMU avec l’application et le site reste nécessaire pour mesurer la latence de bout en bout.
