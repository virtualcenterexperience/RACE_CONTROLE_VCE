-- RACE CONTROL VCE: index for bounded, sorted STAFF history pages.
-- No deletion or mutation of existing sessions or telemetry samples.
create index if not exists vce_agent_sessions_history_date
on public.vce_agent_sessions (started_at desc, session_id desc);
