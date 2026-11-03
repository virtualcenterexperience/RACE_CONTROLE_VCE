-- VCE Race Control — activer la gestion du roster et la purge des tests.
-- À exécuter dans Supabase SQL Editor. Aucune donnée existante n'est supprimée.
ALTER TABLE public.vce_publications DROP CONSTRAINT IF EXISTS vce_publications_kind_check;
ALTER TABLE public.vce_publications ADD CONSTRAINT vce_publications_kind_check CHECK (kind IN ('calendrier','lineup','resultats','pilotes'));
GRANT DELETE ON public.vce_training_submissions TO authenticated;
DROP POLICY IF EXISTS vce_training_submissions_staff_delete ON public.vce_training_submissions;
CREATE POLICY vce_training_submissions_staff_delete ON public.vce_training_submissions FOR DELETE TO authenticated USING (public.vce_is_staff());
-- Les décisions sont déjà supprimables par STAFF via vce_training_reviews_delete.
