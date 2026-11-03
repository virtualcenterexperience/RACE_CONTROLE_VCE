-- Réparation ciblée des permissions d'envoi des séances VCE.
-- Ne touche pas au dossier data/ ni aux autres tables.
BEGIN;
ALTER TABLE public.vce_training_submissions ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.vce_training_submissions TO anon, authenticated;
GRANT SELECT ON public.vce_training_submissions TO authenticated;
REVOKE UPDATE, DELETE ON public.vce_training_submissions FROM anon, authenticated;
DROP POLICY IF EXISTS vce_training_submission_insert ON public.vce_training_submissions;
CREATE POLICY vce_training_submission_insert ON public.vce_training_submissions
 AS PERMISSIVE FOR INSERT TO anon, authenticated
 WITH CHECK (
  session_id = payload->>'id'
  AND pilot = payload->>'driver'
  AND payload->>'status' = 'submitted'
 );
DROP POLICY IF EXISTS vce_training_submission_staff_read ON public.vce_training_submissions;
CREATE POLICY vce_training_submission_staff_read ON public.vce_training_submissions
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (public.vce_is_staff());
COMMIT;
-- Vérification : seules les règles INSERT pilotes et SELECT STAFF doivent s'appliquer.
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='vce_training_submissions';
