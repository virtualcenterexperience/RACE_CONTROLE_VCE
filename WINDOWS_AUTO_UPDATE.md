# VCE Race Control - mises à jour Windows

Ce module est une **base d'intégration**. Il ne modifie pas l'application 3.0.0 déjà installée.

## Pour activer les mises à jour

1. Intégrer `windows_updater.py` dans les **sources de l'application Windows** et empaqueter avec `packaging`.
2. Ajouter au lancement un contrôle de version avec `check_for_update()`, afficher les notes de version et demander l'accord du pilote.
3. Télécharger avec `prepare_update(info)`, sauvegarder/fermer l'application, puis lancer `launch_verified_installer(path, user_approved=True)`.
4. Publier chaque version dans **GitHub Releases** avec un unique `*Setup*.exe` et `SHA256SUMS.txt` contenant son SHA-256.
5. Conserver les données utilisateur hors du dossier d'installation (AppData) et faire tester l'installation/rollback sur Windows.

**Limite :** l'installateur v3.0.0 déjà distribué ne peut pas être modifié à distance s'il ne contient pas de mécanisme d'update. Une mise à niveau initiale ou une intervention locale sera nécessaire. Aucune version 3.1.0 n'est publiée par ce module.
