-- Unified inbox: chat rooms + shipment conversations
-- Idempotent creation of get_inbox_rooms_unified()

create or replace function public.get_inbox_rooms_unified()
returns table (
  room_id uuid,
  type text,
  title text,
  is_admin boolean,
  last_content text,
  last_created_at timestamptz,
  members jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with chat as (
    select
      room_id,
      type,
      title,
      is_admin,
      last_content,
      last_created_at,
      (members)::jsonb as members
    from public.get_inbox_rooms()
  ), ship as (
    select
      s.id as room_id,
      'shipment'::text as type,
      coalesce(s.code, 'Shipment') as title,
      (s.owner_id = auth.uid()) as is_admin,
      lm.content as last_content,
      lm.created_at as last_created_at,
      coalesce(
        (
          select jsonb_agg(distinct jsonb_build_object(
            'id', p.id,
            'username', p.username,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url
          ))
          from (
            select s.owner_id as uid
            union select s.forwarder_id
            union all select (jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)))::uuid
          ) u
          join public.profiles p on p.id = u.uid
        ), '[]'::jsonb
      ) as members
    from public.shipments s
    join lateral (
      select m.content, m.created_at
      from public.shipment_messages m
      where m.shipment_id = s.id
      order by m.created_at desc
      limit 1
    ) lm on true
    where public.is_shipment_participant(s, auth.uid())
  )
  select room_id, type, title, is_admin, last_content, last_created_at, members from chat
  union all
  select room_id, type, title, is_admin, last_content, last_created_at, members from ship
  order by last_created_at desc nulls last;
$$;

grant execute on function public.get_inbox_rooms_unified() to authenticated, anon;
