-- Keep segment validation, storage and final assembly in Postgres.
-- Only the Edge Function's service role can call this after device authentication.
create function public.vce_ingest_telemetry_segment(
 p_device uuid, p_session uuid, p_lap integer, p_offset integer, p_total integer,
 p_samples jsonb, p_lap_time integer, p_valid boolean
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_owner uuid;
 v_next integer;
 v_expected integer;
 v_gap integer;
 v_samples jsonb;
begin
 if p_device is null or p_session is null or p_lap is null or p_offset is null or p_total is null
    or p_lap not between 1 and 100000 or p_offset not between 0 and p_total or p_total not between 10 and 100000
    or jsonb_typeof(p_samples) is distinct from 'array' then
   return jsonb_build_object('error', 'Segment de tour invalide', 'status', 400);
 end if;
 v_next := p_offset + jsonb_array_length(p_samples);
 if jsonb_array_length(p_samples) not between 1 and 160 or v_next > p_total then
   return jsonb_build_object('error', 'Segment de tour invalide', 'status', 400);
 end if;

 select device_id into v_owner from public.vce_agent_sessions where session_id = p_session;
 if not found then
   return jsonb_build_object('error', 'Session non initialisée', 'expected_offset', 0, 'status', 409);
 end if;
 if v_owner is distinct from p_device then
   return jsonb_build_object('error', 'Session d''un autre PC', 'status', 403);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_session::text || ':' || p_lap::text, 0));

 if p_offset = 0 then
   delete from public.vce_agent_lap_segments where session_id = p_session and lap_number = p_lap;
 end if;

 insert into public.vce_agent_lap_segments as stored
   (session_id, lap_number, sample_offset, total_samples, samples)
 values (p_session, p_lap, p_offset, p_total, p_samples)
 on conflict (session_id, lap_number, sample_offset) do update
 set total_samples = excluded.total_samples, samples = excluded.samples
 where (stored.total_samples, stored.samples) is distinct from (excluded.total_samples, excluded.samples);

 if v_next <> p_total then
   return jsonb_build_object('ok', true, 'offset', v_next, 'complete', false);
 end if;

 select min(expected_offset) filter (where sample_offset <> expected_offset or total_samples <> p_total),
        sum(sample_count)::integer,
        jsonb_path_query_array(jsonb_agg(samples order by sample_offset), '$[*][*]')
 into v_gap, v_expected, v_samples
 from (
   select sample_offset, total_samples, samples, jsonb_array_length(samples) as sample_count,
          coalesce(sum(jsonb_array_length(samples)) over (
            order by sample_offset rows between unbounded preceding and 1 preceding
          ), 0)::integer as expected_offset
   from public.vce_agent_lap_segments
   where session_id = p_session and lap_number = p_lap
 ) chunks;
 if v_gap is not null or v_expected is distinct from p_total then
   return jsonb_build_object('error', 'Enregistrement incomplet', 'expected_offset', coalesce(v_gap, v_expected, 0), 'status', 409);
 end if;

 insert into public.vce_agent_laps as stored (session_id, lap_number, lap_time_ms, valid, sample_count, samples)
 values (p_session, p_lap, p_lap_time, p_valid, p_total, v_samples)
 on conflict (session_id, lap_number) do update
 set lap_time_ms = excluded.lap_time_ms, valid = excluded.valid,
     sample_count = excluded.sample_count, samples = excluded.samples
 where (stored.lap_time_ms, stored.valid, stored.sample_count, stored.samples)
   is distinct from (excluded.lap_time_ms, excluded.valid, excluded.sample_count, excluded.samples);

 delete from public.vce_agent_lap_segments where session_id = p_session and lap_number = p_lap;
 update public.vce_agent_devices set last_seen_at = now() where device_id = p_device;
 return jsonb_build_object('ok', true, 'offset', p_total, 'complete', true);
end;
$$;
revoke all on function public.vce_ingest_telemetry_segment(uuid, uuid, integer, integer, integer, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.vce_ingest_telemetry_segment(uuid, uuid, integer, integer, integer, jsonb, integer, boolean) to service_role;
