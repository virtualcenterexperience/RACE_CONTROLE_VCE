-- VCE ESPORT : autoriser les attributions d'entraînements dans la table existante.
-- À exécuter dans Supabase SQL Editor après supabase-setup.sql.
-- Les anciennes publications et les résultats ne sont pas modifiés.
ALTER TABLE public.vce_publications DROP CONSTRAINT IF EXISTS vce_publications_kind_check;
ALTER TABLE public.vce_publications ADD CONSTRAINT vce_publications_kind_check
 CHECK (kind IN ('calendrier','lineup','resultats','training_assignments'));
-- Les politiques existantes vce_staff_insert / vce_staff_update
-- continuent de réserver les écritures aux comptes STAFF habilités.
