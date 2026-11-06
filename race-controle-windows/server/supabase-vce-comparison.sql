-- VCE · optional cross-driver lap sharing
alter table public.vce_agent_devices
 add column if not exists allow_team_comparison boolean not null default false;
create index if not exists vce_agent_devices_shared on public.vce_agent_devices(allow_team_comparison,pilot_slug)
where status='approved' and allow_team_comparison=true;
-- Only the device itself or an authenticated owning pilot can enable sharing.
-- An unrelated pilot may not fetch a private driver's laps.
