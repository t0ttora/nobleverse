-- Chat schema (minimal tables, rich data via generic events table)
-- Requires existing table: public.profiles (id uuid primary key, username, display_name, avatar_url, email)

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm','group')),
  title text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.chat_rooms is 'Rooms for direct or group conversations.';

create table if not exists public.chat_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (room_id, user_id)
);

comment on table public.chat_members is 'Membership of users in rooms; last_read_at used for unread counts.';

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  attachments jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_id_created_at_idx on public.chat_messages (room_id, created_at desc);

comment on table public.chat_messages is 'Messages inside rooms. Attachments stored as JSON array of objects.';

-- Generic events table covers reactions, pins, stars, read receipts
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_event_type') then
    create type public.chat_event_type as enum ('reaction','pin','star','receipt');
  end if;
end $$;

create table if not exists public.chat_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.chat_event_type not null,
  emoji text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_events_room_message_idx on public.chat_events (room_id, message_id, created_at desc);

comment on table public.chat_events is 'Generic events: reactions (emoji), pins (visible to all), stars (private), receipts (read)';

-- Convenience view for last message per room
create or replace view public.chat_room_last_message as
select distinct on (m.room_id)
  m.room_id,
  m.id as message_id,
  m.content,
  m.sender_id,
  m.created_at
from public.chat_messages m
order by m.room_id, m.created_at desc;

-- RLS
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_events enable row level security;

-- Helper functions (SECURITY DEFINER) to avoid recursive RLS lookups
drop function if exists public.is_room_member(uuid) cascade;
drop function if exists public.is_room_admin(uuid) cascade;
drop function if exists public.is_room_creator(uuid) cascade;

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members cm
  where cm.room_id = p_room and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_admin(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members cm
  where cm.room_id = p_room and cm.user_id = auth.uid() and cm.role = 'admin'
  );
$$;

create or replace function public.is_room_creator(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms r
  where r.id = p_room and r.created_by = auth.uid()
  );
$$;

grant execute on function public.is_room_member(uuid) to authenticated, anon;
grant execute on function public.is_room_admin(uuid) to authenticated, anon;
grant execute on function public.is_room_creator(uuid) to authenticated, anon;

-- Performance indexes for membership lookups
create index if not exists chat_members_user_room_idx on public.chat_members (user_id, room_id);
create index if not exists chat_members_room_id_idx on public.chat_members (room_id);

-- Fast inbox RPC: returns rooms user belongs to with last message and members (SECURITY INVOKER to respect RLS)
drop function if exists public.get_inbox_rooms();
create function public.get_inbox_rooms()
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
  with my_rooms as (
    select cm.room_id,
           bool_or(cm.role = 'admin') filter (where cm.user_id = auth.uid()) as is_admin
    from public.chat_members cm
    where cm.user_id = auth.uid()
    group by cm.room_id
  )
  select r.id as room_id,
         r.type,
         r.title,
         mr.is_admin,
         lm.content as last_content,
         lm.created_at as last_created_at,
         coalesce(
           (
             select json_agg(
                      json_build_object(
                        'id', p.id,
                        'username', p.username,
                        'display_name', p.display_name,
                        'avatar_url', p.avatar_url
                      )
                    )
             from public.chat_members m2
             join public.profiles p on p.id = m2.user_id
             where m2.room_id = r.id
           ), '[]'::json
         ) as members
  from public.chat_rooms r
  join my_rooms mr on mr.room_id = r.id
  left join public.chat_room_last_message lm on lm.room_id = r.id
  order by coalesce(lm.created_at, r.created_at) desc
$$;

-- Policies
-- Rooms: members can select; creators can insert; members can delete if admin
drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms
  for select using (public.is_room_member(chat_rooms.id));

drop policy if exists chat_rooms_insert on public.chat_rooms;
create policy chat_rooms_insert on public.chat_rooms
  for insert with check (created_by = auth.uid());

drop policy if exists chat_rooms_update on public.chat_rooms;
create policy chat_rooms_update on public.chat_rooms
  for update using (public.is_room_admin(chat_rooms.id));

drop policy if exists chat_rooms_delete on public.chat_rooms;
create policy chat_rooms_delete on public.chat_rooms
  for delete using (public.is_room_admin(chat_rooms.id));

-- Members: members can select; insert allowed for any existing member of the room; updates only self; delete by admin or self leaving
drop policy if exists chat_members_select on public.chat_members;
create policy chat_members_select on public.chat_members
  for select using (public.is_room_member(chat_members.room_id));

drop policy if exists chat_members_insert on public.chat_members;
create policy chat_members_insert on public.chat_members
  for insert
  with check (
    public.is_room_creator(chat_members.room_id)
    or public.is_room_admin(chat_members.room_id)
  );

drop policy if exists chat_members_update on public.chat_members;
create policy chat_members_update on public.chat_members
  for update using (user_id = auth.uid());

drop policy if exists chat_members_delete on public.chat_members;
create policy chat_members_delete on public.chat_members
  for delete using (
    user_id = auth.uid() or public.is_room_admin(chat_members.room_id)
  );

-- Messages: room members can select/insert; update/delete only sender within 10 minutes
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select using (public.is_room_member(chat_messages.room_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    public.is_room_member(chat_messages.room_id) and sender_id = auth.uid()
  );

drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages
  for update using (sender_id = auth.uid() and chat_messages.created_at > now() - interval '10 minutes');

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages
  for delete using (sender_id = auth.uid() and chat_messages.created_at > now() - interval '10 minutes');

-- Events: room members can select; insert allowed for members; delete own events
drop policy if exists chat_events_select on public.chat_events;
create policy chat_events_select on public.chat_events
  for select using (public.is_room_member(chat_events.room_id));

drop policy if exists chat_events_insert on public.chat_events;
create policy chat_events_insert on public.chat_events
  for insert with check (
    public.is_room_member(chat_events.room_id) and user_id = auth.uid()
  );

drop policy if exists chat_events_delete on public.chat_events;
create policy chat_events_delete on public.chat_events
  for delete using (user_id = auth.uid());

-- Helper function to upsert DM room by member set (2 users)
create or replace function public.get_or_create_dm_room(p_user1 uuid, p_user2 uuid)
returns uuid language plpgsql security definer as $$
declare
  rid uuid;
  lock_key bigint;
  a uuid;
  b uuid;
begin
  -- normalize pair order
  if p_user1 = p_user2 then
    raise exception 'Cannot create DM with self';
  end if;
  if p_user1 < p_user2 then a := p_user1; b := p_user2; else a := p_user2; b := p_user1; end if;

  -- Pair-scoped advisory lock to avoid duplicate creation under concurrency
  select ('x'||substr(md5(a::text||'|'||b::text),1,16))::bit(64)::bigint into lock_key;
  perform pg_advisory_xact_lock(lock_key);

  -- find existing dm room containing both users
  select r.id into rid
  from public.chat_rooms r
  where r.type = 'dm'
    and exists (select 1 from public.chat_members cm where cm.room_id = r.id and cm.user_id = a)
    and exists (select 1 from public.chat_members cm where cm.room_id = r.id and cm.user_id = b)
  limit 1;
  if rid is not null then
    return rid;
  end if;

  -- create new dm room and add both users
  insert into public.chat_rooms(type, created_by)
  values('dm', a)
  returning id into rid;
  insert into public.chat_members(room_id, user_id, role) values (rid, a, 'admin');
  insert into public.chat_members(room_id, user_id, role) values (rid, b, 'member');
  return rid;
end $$;

-- Enforce that DM rooms cannot exceed two members
create or replace function public.enforce_dm_member_limit()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.chat_rooms r where r.id = new.room_id and r.type = 'dm') then
    if (select count(*) from public.chat_members where room_id = new.room_id) >= 2 then
      raise exception 'DM rooms cannot have more than two members';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_dm_member_limit on public.chat_members;
create trigger trg_enforce_dm_member_limit
before insert on public.chat_members
for each row execute function public.enforce_dm_member_limit();

-- Trigger to bump member.last_read_at when a receipt event is created
create or replace function public.sync_last_read_on_receipt()
returns trigger language plpgsql as $$
begin
  if new.type = 'receipt' then
    update chat_members set last_read_at = greatest(coalesce(last_read_at, 'epoch'), new.created_at)
    where room_id = new.room_id and user_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_last_read on public.chat_events;
create trigger trg_sync_last_read after insert on public.chat_events
for each row execute function public.sync_last_read_on_receipt();
