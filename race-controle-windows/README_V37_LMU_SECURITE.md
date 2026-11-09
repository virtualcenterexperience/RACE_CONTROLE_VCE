# RACE CONTROL VCE 3.7 — règles strictes pour Le Mans Ultimate

## Ce que fait VCE
- Détection LMU **uniquement** par l'existence du mapping Windows officiel `LMU_Data`, ouvert avec `OpenFileMappingW(FILE_MAP_READ)`, puis fermé immédiatement.
- Télémétrie lue via `MapViewOfFile(FILE_MAP_READ)`, jamais écrite dans le processus ou les fichiers du jeu.
- Vérification des installations par les seuls manifests Steam `appmanifest_*.acf`, sans analyser les DLL de LMU.
- Si LMU est sélectionné dans les paramètres VCE, le scan ne parcourt **aucun processus**.
- Quand LMU publie `LMU_Data`, le scan ne parcourt **aucun processus**, même en sélection AUTO.
- Les enregistrements officiels `.duckdb` ne sont **pas scannés pendant que LMU est actif**. Après la fermeture du jeu, ils peuvent être consultés en lecture seule au maximum une fois toutes les dix secondes, et seulement lorsqu'ils sont stabilisés.
- Les fichiers JSON/CSV locaux sont créés dans le dossier VCE `ANTICHEAT`, **jamais** dans le dossier du jeu.

## Ce que VCE ne fait pas
- Aucune modification de `version.dll`, des exécutables, des DLL, des fichiers `Plugins`, `EasyAntiCheat` ou de la configuration LMU.
- Aucune injection de DLL, aucun `OpenProcess` sur LMU/EAC, aucun hook, aucun scan de mémoire de processus, aucune tentative de désactiver/contourner EAC.
- Aucun pilote noyau ou service Windows supplémentaire pour lire LMU.

## Préparation du jeu
Si VCE reste « EN ATTENTE DE JEU » alors que LMU est ouvert, vérifier dans les paramètres de LMU que **Enable Plugins** est activé, puis redémarrer le jeu normalement depuis Steam. Cette opération est un paramètre officiel du jeu, pas une modification de fichiers. Ne pas remettre une DLL tierce dans le dossier du jeu.

## Limites et validation
**Aucune application externe ne peut garantir sa propre acceptation par Easy Anti-Cheat.** Les erreurs EAC 30005 et Windows 0xc000007b peuvent avoir d'autres causes et nécessitent un diagnostic indépendant.

Avant de diffuser la version :
1. Exécuter les tests `race-controle-windows/tests/test_v37.py` dans le workflow Windows.
2. Compiler l'installateur unique EXE et vérifier les fichiers de l'archive.
3. Sur une installation LMU propre, lancer LMU seul, puis LMU avec VCE déjà ouvert.
4. Vérifier que LMU démarre et que VCE détecte le mapping en session, que les inputs sont plausibles et que le scan ne ralentit pas le jeu.
5. Tester l'ordre inverse : lancer VCE après l'entrée en piste.
6. Tester la capture locale hors ligne et le transfert vers Supabase après approbation STAFF.

**HTML du site : aucun fichier modifié pour cette version.**
