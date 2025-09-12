-- Paginated fetch of messages for a room (for details panel)
create or replace function public.get_room_messages(p_room uuid, p_page integer, p_size integer)
returns table (
  id uuid,
  content text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.content, m.created_at
  from public.chat_messages m
  where m.room_id = p_room
  order by m.created_at desc
  limit coalesce(p_size, 100)
  offset greatest(coalesce(p_page, 0), 0) * coalesce(p_size, 100);
$$;

grant execute on function public.get_room_messages(uuid, integer, integer) to authenticated;
