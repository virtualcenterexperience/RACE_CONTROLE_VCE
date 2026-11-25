-- The review form confirms category and field size as well as its decision.
-- UPDATE remains limited to STAFF by vce_race_results_staff_review RLS.
grant update (category,starters) on public.vce_race_result_submissions to authenticated;
notify pgrst, 'reload schema';
