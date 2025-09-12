'use server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export type ChatRoom = {
  id: string;
  type: 'dm' | 'group';
  title: string | null;
  created_at: string;
};

export type ChatMessageRow = {
  id: string;
  room_id: string;
  user_id?: string;
  sender_id?: string;
  content: string;
  created_at: string;
};

export async function getMyRooms() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [] as ChatRoom[];
  const { data } = await supabase
    .from('chat_members')
    .select('room_id, chat_rooms!inner(id,type,title,created_at)')
    .eq('user_id', uid)
    .order('created_at', { referencedTable: 'chat_rooms', ascending: false });
  const rooms = (data || []).map((r: any) => r.chat_rooms) as ChatRoom[];
  return rooms;
}

export async function getRoomMembers(roomId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase
    .from('chat_members')
    .select(
      'user_id, profiles:profiles!inner(id,display_name,username,avatar_url)'
    )
    .eq('room_id', roomId);
  return (data || []).map((r: any) => ({
    id: r.profiles.id as string,
    name: (r.profiles.display_name || r.profiles.username || 'User') as string,
    avatar_url: (r.profiles.avatar_url as string | null) ?? null
  }));
}

export async function getRoomMessages(roomId: string, limit = 50) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase
    .from('chat_messages')
    .select('id,room_id,user_id,sender_id,content,created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data || []) as ChatMessageRow[];
}

export async function createDmRoom(otherUserId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  const { data, error } = await supabase.rpc('get_or_create_dm_room', {
    p_user1: uid,
    p_user2: otherUserId
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, roomId: data as string };
}

export async function createGroupRoom(
  memberIds: string[],
  title: string | null
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  const all = Array.from(new Set([uid, ...memberIds]));
  const { data: rid, error } = await supabase.rpc('create_group_room', {
    p_title: title,
    p_member_ids: all
  });
  if (error || !rid)
    return {
      ok: false as const,
      error: error?.message || 'Could not create group'
    };
  return { ok: true as const, roomId: rid as string };
}

export async function sendMessage(roomId: string, content: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  let messageId: string | null = null;
  let { data, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, user_id: uid, content })
    .select('id')
    .single();
  if (error) {
    const alt = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, sender_id: uid, content })
      .select('id')
      .single();
    if (alt.error) return { ok: false as const, error: alt.error.message };
    messageId = (alt.data?.id as string) || null;
  } else {
    messageId = (data?.id as string) || null;
  }
  // Create receipt for sender
  if (messageId) {
    await supabase
      .from('chat_events')
      .insert({
        room_id: roomId,
        message_id: messageId,
        actor_id: uid,
        event_type: 'receipt'
      });
  }
  // Create notification for other members (simple fanout to notifications table if exists)
  try {
    const { data: members } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('room_id', roomId);
    const recipients = (members || [])
      .map((m) => m.user_id as string)
      .filter((id) => id !== uid);
    if (recipients.length) {
      await supabase.from('notifications').insert(
        recipients.map((r) => ({
          user_id: r,
          actor_id: uid,
          type: 'chat_message',
          title: 'Yeni mesaj',
          body: 'Bir sohbet odasında yeni mesaj var.',
          category: 'inbox',
          data: { room_id: roomId }
        }))
      );
    }
  } catch {}
  return { ok: true as const, id: data!.id as string };
}

export async function addReaction(
  roomId: string,
  messageId: string,
  emoji: string
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  const { error } = await supabase
    .from('chat_events')
    .insert({
      room_id: roomId,
      message_id: messageId,
      actor_id: uid,
      event_type: 'emoji',
      payload: { emoji }
    });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function togglePin(
  roomId: string,
  messageId: string,
  pin: boolean
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  if (pin) {
    const { error } = await supabase
      .from('chat_events')
      .insert({
        room_id: roomId,
        message_id: messageId,
        actor_id: uid,
        event_type: 'pin'
      });
    if (error) return { ok: false as const, error: error.message };
  } else {
    await supabase
      .from('chat_events')
      .delete()
      .match({
        room_id: roomId,
        message_id: messageId,
        actor_id: uid,
        event_type: 'pin'
      });
  }
  return { ok: true as const };
}

export async function toggleStar(
  roomId: string,
  messageId: string,
  star: boolean
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  if (star) {
    const { error } = await supabase
      .from('chat_events')
      .insert({
        room_id: roomId,
        message_id: messageId,
        actor_id: uid,
        event_type: 'star'
      });
    if (error) return { ok: false as const, error: error.message };
  } else {
    await supabase
      .from('chat_events')
      .delete()
      .match({
        room_id: roomId,
        message_id: messageId,
        actor_id: uid,
        event_type: 'star'
      });
  }
  return { ok: true as const };
}

export async function markRead(roomId: string, messageId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false as const, error: 'Not authenticated' };
  await supabase
    .from('chat_events')
    .insert({
      room_id: roomId,
      message_id: messageId,
      actor_id: uid,
      event_type: 'receipt'
    });
  return { ok: true as const };
}
