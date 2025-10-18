-- Allow authenticated participants to write tracking events for non-token sources (air/sea)
create or replace function public.track_event_write(
  p_shipment uuid,
  p_source uuid,
  p_lat double precision,
  p_lon double precision,
  p_speed real default null,
  p_heading real default null,
  p_accuracy real default null,
  p_provider text default null
) returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if not public.is_shipment_participant(v_uid, p_shipment) then
    raise exception 'forbidden';
  end if;

  insert into public.tracking_events (shipment_id, source_id, lat, lon, speed, heading, accuracy, provider)
  values (p_shipment, p_source, p_lat, p_lon, p_speed, p_heading, p_accuracy, coalesce(p_provider, 'provider'));

  insert into public.tracking_status as ts (shipment_id, last_lat, last_lon, last_timestamp, provider, state, updated_at)
  values (p_shipment, p_lat, p_lon, now(), coalesce(p_provider, 'provider'), 'in_transit', now())
  on conflict (shipment_id) do update
    set last_lat = excluded.last_lat,
        last_lon = excluded.last_lon,
        last_timestamp = excluded.last_timestamp,
        provider = excluded.provider,
        state = excluded.state,
        updated_at = now();
end;
$$;

revoke all on function public.track_event_write from public;
grant execute on function public.track_event_write to authenticated;
