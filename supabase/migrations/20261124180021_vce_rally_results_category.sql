-- Add Rallye to result proposals. Existing ownership/review policies remain in force.
alter table public.vce_race_result_submissions
 drop constraint vce_race_result_submissions_category_check,
 add constraint vce_race_result_submissions_category_check
 check (category in ('sprint','esport','qualification','endurance','special','rally'));
