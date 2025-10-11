import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { fileIds, recipientIds, text } = body || {};
  if (!Array.isArray(fileIds) || fileIds.length === 0)
    return NextResponse.json(
      { ok: false, error: 'FILE_IDS_REQUIRED' },
      { status: 400 }
    );
  if (!Array.isArray(recipientIds) || recipientIds.length === 0)
    return NextResponse.json(
      { ok: false, error: 'RECIPIENTS_REQUIRED' },
      { status: 400 }
    );

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );

  // Load files and ensure requester can share them (owner)
  const { data: files, error: filesErr } = await supabase
    .from('files')
    .select('id,name,owner_id')
    .in('id', fileIds)
    .eq('is_deleted', false);
  if (filesErr)
    return NextResponse.json(
      { ok: false, error: filesErr.message },
      { status: 400 }
    );
  if (!files || files.length === 0)
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  const unauthorized = (files as any[]).some((f) => f.owner_id !== uid);
  if (unauthorized)
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN' },
      { status: 403 }
    );

  // Grant access via files_shares
  const shareRows = [] as Array<{ file_id: string; user_id: string }>;
  for (const f of files as any[]) {
    for (const rid of recipientIds as string[]) {
      shareRows.push({ file_id: f.id as string, user_id: rid });
    }
  }
  if (shareRows.length) {
    // Try upsert; if constraint not defined, fallback to insert and ignore dup errors
    let shareErr: any = null;
    try {
      const { error } = await supabase.from('files_shares').upsert(shareRows, {
        onConflict: 'file_id,user_id'
      } as any);
      shareErr = error;
    } catch (e: any) {
      shareErr = e;
    }
    if (shareErr) {
      try {
        await supabase.from('files_shares').insert(shareRows);
      } catch {
        /* ignore duplicate errors */
      }
    }
  }

  // Create chat: DM for single recipient, group for multiple
  let roomId: string | null = null;
  if (recipientIds.length === 1) {
    const other = recipientIds[0];
    const { data, error } = await supabase.rpc('get_or_create_dm_room', {
      p_user1: uid,
      p_user2: other
    });
    if (!error && data) roomId = data as string;
  } else {
    const all = Array.from(new Set([uid, ...recipientIds]));
    const { data, error } = await supabase.rpc('create_group_room', {
      p_title: null,
      p_member_ids: all
    });
    if (!error && data) roomId = data as string;
  }

  // Compose message content with optional text and attachments block
  const base =
    typeof text === 'string' && text.trim()
      ? text.trim()
      : `Shared ${files.length} file${files.length > 1 ? 's' : ''}`;
  const attachments = ['Attachments:'];
  for (const f of files as any[]) {
    const name = (f.name as string) || 'file';
    const url = `/api/noblesuite/files/preview?id=${encodeURIComponent(
      String(f.id)
    )}`;
    attachments.push(`- [${name}](${url})`);
  }
  const content = `${base}\n\n${attachments.join('\n')}`;

  if (roomId) {
    // Insert message referencing current user as sender
    const { error } = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, sender_id: uid, content });
    if (error) {
      // best-effort: continue even if chat insert fails
    }
  }

  return NextResponse.json({ ok: true, roomId });
}
