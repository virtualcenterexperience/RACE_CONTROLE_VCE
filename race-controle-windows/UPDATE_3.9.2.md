# UPDATE V3.9.2 — Capture, trajectoires et chronos

- Acquisition : cible de 50 Hz au lieu de 120 Hz, avec créneaux de 20 ms et conservation de la précision des nombres. Aucune répétition de trames pour masquer une source lente ou figée ; la fréquence réelle reste dépendante du jeu. Polling natif allégé (10 ms).
- ALT TAB : aucun contrôle de fenêtre active. Une indisponibilité momentanée du mapping ne clôture plus immédiatement la session ; capture et transferts restent indépendants. Après 60 secondes sans nouvelle mesure, la séance est sauvegardée et le mapping est rouvert pour permettre la reprise. Si le jeu lui-même cesse de publier hors focus, aucune nouvelle mesure ne peut être créée.
- Pédales : canaux bruts et appliqués séparés, valeurs en pourcentage avec deux décimales à l’écran ; valeurs natives conservées dans les archives. Les canaux absents restent indisponibles.
- Replay : caméra fixe par défaut, coordonnées réelles du tour et référence séparées, interruptions respectées. La ligne n’est plus lissée par une spline 3D. Suppression de la fausse route construite autour du pilote. Un couloir autour d’un tour de référence indépendant reste une option indicative, désactivée par défaut ; ce n’est pas une mesure des limites de piste ni du point de corde.
- Voiture 3D : carrosserie profilée, roues cylindriques et jantes, vitrages, feux, aileron et diffuseur. Modèle générique de visualisation, sans correspondance garantie au véhicule réel.
- LMU : lecture du classement natif dans LMU_Data, une fois par seconde. Sélection A/B des pilotes de la session pour comparer meilleur/dernier tour. La liste voyage sur le canal privé existant et dans le JSONB de la session, sans nouvelle table ni fréquence supplémentaire d’écriture. Les autres jeux restent sans classement natif dans cette version.
- Les chronos des adversaires ne donnent pas leurs inputs/trajectoires : ces comparaisons nécessitent leurs propres données partagées. Aucune identité de plateforme ou SteamID d’adversaire n’est collectée.

Sources de structure : SDK LMU SharedMemoryInterface pack(4), recoupé avec https://github.com/SeamusMullan/TeleMU/blob/main/backend/telemu/sharedmem/lmu_data.py (scoring base 1632, tableau +560, véhicules 584 octets) et https://github.com/stephenhoran/goLMUSharedMemory/blob/main/lmu_types_helper.go. Pas de copie de bibliothèque ni de scan par offsets hypothétiques.

HTML modifié : telemetry.html, pour les versions des scripts. Aucun HTML créé. Autres HTML inchangés. Le collecteur nécessite l’installation 3.9.2 ; le site et la fonction vce-telemetry sont mis à jour séparément.

Tests : capture à 50 créneaux/s depuis une source 120 Hz, aucune invention depuis une source 20 Hz, précision des pédales et coordonnées zéro, trames natives figées, lectures du classement synthétiques, trajets latéraux et lacunes, comparaison A/B isolée à la session. Essai Windows/LMU réel nécessaire pour valider ALT TAB et la précision de bout en bout.
