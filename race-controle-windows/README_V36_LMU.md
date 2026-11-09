# RACE CONTROL VCE 3.6 — télémétrie LMU en lecture seule

## Compatibilité Easy Anti-Cheat
- VCE lit uniquement le mapping Windows **LMU_Data**, publié par Le Mans Ultimate lui-même.
- Aucun fichier DLL n'est ajouté au dossier LMU, aucun hook, injection, patch du processus ou contournement EAC.
- Dans LMU : **Settings → Gameplay → Enable Plugins** puis redémarrer le jeu pour rendre le mapping disponible.
- Cette méthode réduit les conflits liés aux plugins tiers, mais **ne garantit pas** qu'une installation LMU déjà modifiée ou bloquée par EAC démarrera. En particulier, `version.dll`/Koaloader doit être diagnostiqué indépendamment.

## Inputs et capture
- LMU : accélérateur, frein, volant, embrayage, rapports, régime moteur, vitesse, carburant, coordonnées monde, forces aérodynamiques et hauteur de caisse (si le jeu publie des valeurs valides).
- Mesures natives : pas de fausses valeurs, ni répétition de frames pour afficher 120 Hz. Le flux LMU_Data fournit généralement une horloge télémétrique autour de 100 Hz ; la fréquence effective doit être mesurée sur Windows.
- Le flux LIVE envoie au plus 12 mesures par lot ; si le réseau prend du retard, la priorité est donnée aux dernières mesures. Les tours complets sont conservés pour l'archive.

## ANTICHEAT : archives de sessions
- Dossier local `ANTICHEAT` à la racine de l'installation si accessible, sinon dans le dossier de données utilisateur.
- Bouton **ARCHIVES LOCALES** dans l'application.
- Exports `JSON`, `CSV` et empreinte `SHA256` par session ; les colonnes manquantes restent vides.
- Aucun secret de liaison VCE, IP ni token dans les exports.
- Le nom `ANTICHEAT` n'accorde aucune exception à Easy Anti-Cheat.
- Le CSV est un export générique, **pas** un fichier MoTeC i2 natif. Pour MoTeC, passer par un convertisseur approprié ou les exports natifs du jeu.

## Tests avant diffusion
1. GitHub Actions : vérifier que `patch_v36.py` s'applique et que la compilation Windows réussit.
2. Lancer LMU avec EAC et sans DLL tierce ; vérifier que le mapping `LMU_Data` est présent.
3. Contrôler la validité des inputs, des chronos, de l'identification du pilote et de la fréquence réelle.
4. Couper Internet pendant un roulage, vérifier les archives locales et la reprise de synchronisation.
5. Vérifier la réception du LIVE et l'archivage complet sur Supabase avec un PC approuvé.
6. Faire une vérification antivirus indépendante de l'EXE avant toute publication officielle.

Les fichiers HTML du site ne sont pas nécessaires pour la capture native. Le tableau INPUTS a néanmoins été étendu à l'embrayage et au régime moteur.
