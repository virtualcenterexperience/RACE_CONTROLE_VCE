# RACE CONTROLE VCE — Notifications de candidatures Google Forms

## Ce qui est en place
- STAFF CONTROL : rubrique **Candidatures** (`staff.html#candidatures`) après connexion Staff.
- Notifications non lues, pastille rouge, actualisation toutes les 30 secondes pendant que l'onglet est ouvert, bouton « Tout marquer comme lu ».
- Edge Function `vce-applications` : accès Staff authentifié pour lire/configurer, et ingestion par secret distinct pour Google Apps Script.
- Base Supabase : `public.vce_application_notifications` + `public.vce_application_webhook_settings`. Les réponses nominatives ne sont **pas** copiées dans Supabase.
- La notification est l’événement « une nouvelle réponse a été envoyée », sans contenu du formulaire.

## Dernière étape à effectuer sur ton compte Google
1. Ouvre ton formulaire Google Forms dans son interface d'édition (pas le lien public `viewform`).
2. Onglet **Réponses** → associe une **feuille de calcul Google Sheets**.
3. Ouvre cette feuille → **Extensions** → **Apps Script**.
4. Dans Apps Script, colle le contenu de `integrations/google-forms/onFormSubmit.gs` (disponible dans le dépôt GitHub VCE), enregistre.
5. Dans STAFF CONTROL, connecte-toi à Supabase puis ouvre **Candidatures** et déroule « Connexion Google Forms ». Clique sur **Créer le secret du webhook**. Copie-le avant de fermer cette page.
6. Dans Apps Script → **Paramètres du projet** → **Propriétés de script**, crée une propriété **VCE_WEBHOOK_SECRET** contenant ce secret. Il ne doit jamais être mis dans le code public GitHub.
7. Dans Apps Script → **Déclencheurs** → **Ajouter un déclencheur** :
   - Fonction : `vceOnFormSubmit`
   - Source de l'événement : **Feuille de calcul**
   - Type d'événement : **Lors de l'envoi du formulaire**
8. Autorise le script avec ton compte Google. Les prochaines réponses au formulaire créeront des notifications dans Staff.
9. Utilise une vraie réponse de test si tu veux vérifier, puis consulte les **Exécutions** Apps Script ou les logs de `vce-applications` en cas de problème.

**Important :** le lien public Google Forms reçu dans la conversation sert uniquement à remplir le formulaire. Il ne permet pas au site d'accéder aux candidatures, au contenu des réponses ni à la feuille de réponses.

**Sécurité :** le webhook rejette les appels sans secret. Le secret est généré côté serveur et n'est affiché qu'une seule fois dans Staff. « Créer le secret » une deuxième fois invalide immédiatement l'ancien. Les tables ne sont pas lisibles par `anon` ou `authenticated` directement ; seul le rôle de service serveur y accède. Les réponses et coordonnées restent dans Google Forms/Sheets.
