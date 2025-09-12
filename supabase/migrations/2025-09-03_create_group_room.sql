-- Create a helper to create group rooms in one step (SECURITY DEFINER)
-- Inserts chat_rooms with created_by = auth.uid() and adds members.

create or replace function public.create_group_room(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  -- create room
  insert into public.chat_rooms(type, title, created_by)
  values ('group', p_title, uid)
  returning id into rid;

  -- add creator as admin
  insert into public.chat_members(room_id, user_id, role)
  values (rid, uid, 'admin')
  on conflict do nothing;

  -- add provided members as member (creator remains admin)
  if p_member_ids is not null then
    insert into public.chat_members(room_id, user_id, role)
    select rid, m, case when m = uid then 'admin' else 'member' end
    from unnest(p_member_ids) as m
    on conflict do nothing;
  end if;

  return rid;
end
$$;

grant execute on function public.create_group_room(text, uuid[]) to authenticated;
