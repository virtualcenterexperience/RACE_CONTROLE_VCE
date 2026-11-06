-- High-frequency lap recording: 120 Hz × 20 min can exceed old 12,000 samples.
-- Increase storage cap while maintaining a finite bound.
alter table public.vce_agent_laps drop constraint if exists vce_agent_laps_sample_count_check;
alter table public.vce_agent_laps add constraint vce_agent_laps_sample_count_check
 check (sample_count between 0 and 100000);
