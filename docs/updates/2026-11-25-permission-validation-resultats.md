# Correctif — Validation des résultats STAFF

Le formulaire de validation du nouveau barème met à jour `category` et `starters`, en plus de `status`, `staff_notes`, `reviewed_by` et `reviewed_at`. Le rôle utilisé par le navigateur ne disposait du droit UPDATE que sur les quatre anciens champs. PostgreSQL refusait donc toute la requête avec « permission denied for table vce_race_result_submissions ».

La migration ajoute uniquement UPDATE(category, starters) au rôle authenticated. La politique RLS vce_race_results_staff_review reste inchangée : seuls les membres STAFF peuvent effectuer cette mise à jour. Le propriétaire du résultat reste non modifiable.

Vérification effectuée avec SET LOCAL ROLE authenticated et les identités réelles dans une transaction annulée : validation STAFF réussie, projection du rating présente, puis rollback ; un pilote peut lire son résultat mais sa tentative d’acceptation modifie zéro ligne. Aucun résultat utilisateur n’a été validé pendant le test.

Correction appliquée directement dans Supabase. Aucun fichier HTML, CSS ou JavaScript modifié ; aucune reconnexion nécessaire. Actualiser les propositions puis relancer l’acceptation suffit.
