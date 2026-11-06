-- RACE CONTROLE VCE — Correctif à exécuter dans SUPABASE > SQL EDITOR.
-- Répare vce_publications_kind_check et restaure la liste initiale de pilotes.
-- Ne supprime aucune session, aucun chrono, aucun compte ni aucun résultat.
-- Conserve les catégories déjà présentes dans la table.
BEGIN;
DO $migration$
DECLARE allowed text;
BEGIN
  SELECT string_agg(quote_literal(kind), ', ') INTO allowed
  FROM (
    SELECT kind FROM public.vce_publications
    UNION
    SELECT unnest(ARRAY['calendrier','lineup','resultats','pilotes','overlays'])
  ) kinds;
  EXECUTE 'ALTER TABLE public.vce_publications DROP CONSTRAINT IF EXISTS vce_publications_kind_check';
  EXECUTE 'ALTER TABLE public.vce_publications ADD CONSTRAINT vce_publications_kind_check CHECK (kind IN (' || allowed || '))';
END $migration$;

-- Initialiser seulement si la liste n'existe pas : ne remplace aucun roster existant.
INSERT INTO public.vce_publications (kind,payload,updated_at)
VALUES ('pilotes', '{"version":2,"items":[{"id":"anthony-mangieracina","name":"ANTHONY MANGIERACINA"},{"id":"dylan-dubois","name":"DYLAN DUBOIS"},{"id":"antonin-collin","name":"ANTONIN COLLIN"},{"id":"mathys-goyat","name":"MATHYS GOYAT"},{"id":"jules-baque","name":"JULES BAQUE"},{"id":"victor-auger","name":"VICTOR AUGER"},{"id":"maldonado-marius","name":"MALDONADO MARIUS"},{"id":"mathis-ocquident","name":"MATHIS OCQUIDENT"},{"id":"samuel-mendez","name":"SAMUEL MENDEZ"},{"id":"noe-fernandez","name":"NOE FERNANDEZ"},{"id":"william-orlinzoo","name":"WILLIAM ORLINZOO"},{"id":"alex-lehoux","name":"ALEX LEHOUX"},{"id":"lucas-galy","name":"LUCAS GALY"},{"id":"nicolas-lefrancois","name":"NICOLAS LEFRANCOIS"}],"updatedAt":"2026-11-06T00:00:00.000Z"}'::jsonb, now())
ON CONFLICT (kind) DO NOTHING;
COMMIT;

-- Vérification :
SELECT kind, jsonb_array_length(payload->'items') AS nombre_pilotes
FROM public.vce_publications WHERE kind='pilotes';
