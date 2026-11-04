-- VCE ESPORT — autoriser uniquement le STAFF à supprimer les historiques d'entraînement.
-- À exécuter dans Supabase SQL Editor avec le rôle administrateur.
-- Les pilotes ne reçoivent aucun droit DELETE.
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT DELETE ON TABLE public.vce_training_submissions TO authenticated;
GRANT DELETE ON TABLE public.vce_training_reviews TO authenticated;
ALTER TABLE public.vce_training_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vce_training_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vce_training_submission_staff_delete ON public.vce_training_submissions;
CREATE POLICY vce_training_submission_staff_delete ON public.vce_training_submissions
FOR DELETE TO authenticated USING (public.vce_is_staff());
DROP POLICY IF EXISTS vce_training_review_staff_delete ON public.vce_training_reviews;
CREATE POLICY vce_training_review_staff_delete ON public.vce_training_reviews
FOR DELETE TO authenticated USING (public.vce_is_staff());
COMMIT;
-- Vérification : policies DELETE STAFF et droits SQL.
SELECT tablename, policyname, cmd, roles, qual FROM pg_policies
WHERE schemaname='public' AND tablename IN ('vce_training_submissions','vce_training_reviews') AND cmd='DELETE';
