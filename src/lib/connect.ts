import { supabase } from '@/../utils/supabase/client';

type ConnectResult =
  | { ok: true; status: 'pending'; requestId: string }
  | { ok: true; status: 'already_pending' }
  | { ok: true; status: 'connected' }
  | { ok: false; error: string };

function getDisplayName(meta: any, fallbackEmail?: string | null): string {
  const display = (
    meta?.user_metadata?.full_name ||
    meta?.user_metadata?.name ||
    ''
  )
    .toString()
    .trim();
  if (display) return display;
  const emailLocal = (fallbackEmail || '').split('@')[0];
  return emailLocal || 'Bir kullanıcı';
}

export async function connectRequest(
  receiverId: string
): Promise<ConnectResult> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' };

  // If already connected, short-circuit
  {
    const { data: exists } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', me.id)
      .eq('contact_id', receiverId)
      .maybeSingle();
    if (exists) return { ok: true, status: 'connected' };
  }

  // If there's an outgoing pending already
  {
    const { data: pendingOut } = await supabase
      .from('contact_requests')
      .select('id')
      .eq('requester_id', me.id)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingOut) return { ok: true, status: 'already_pending' };
  }

  // If there's an incoming pending from the receiver, auto-accept to connect quickly
  const { data: pendingIn } = await supabase
    .from('contact_requests')
    .select('id,requester_id,receiver_id,status')
    .eq('requester_id', receiverId)
    .eq('receiver_id', me.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingIn) {
    await supabase
      .from('contact_requests')
      .update({ status: 'accepted' })
      .eq('id', pendingIn.id);
    // Insert both directions explicitly to ensure symmetric rows exist
    await supabase
      .from('contacts')
      .upsert(
        { user_id: me.id, contact_id: receiverId },
        { onConflict: 'user_id,contact_id' }
      );
    await supabase
      .from('contacts')
      .upsert(
        { user_id: receiverId, contact_id: me.id },
        { onConflict: 'user_id,contact_id' }
      );
    // Notify the original requester (receiverId) that you accepted
    const display = getDisplayName(me, me.email ?? null);
    await supabase.from('notifications').insert({
      user_id: receiverId,
      actor_id: me.id,
      type: 'contact_accept',
      title: `${display} accepted your connection request.`,
      category: 'inbox',
      data: { kind: 'contact_accept', accepter_id: me.id }
    });
    return { ok: true, status: 'connected' };
  }

  // Create pending request
  const ins = await supabase
    .from('contact_requests')
    .insert({ requester_id: me.id, receiver_id: receiverId, status: 'pending' })
    .select('*')
    .maybeSingle();
  if (ins.error) {
    // Unique violation means already requested; treat as already_pending
    return { ok: true, status: 'already_pending' };
  }
  const request = ins.data as { id: string } | null;

  // Fetch my display name for the notification title
  const display = getDisplayName(me, me.email ?? null);
  await supabase.from('notifications').insert({
    user_id: receiverId,
    actor_id: me.id,
    type: 'contact_request',
    title: `${display} wants to connect with you.`,
    category: 'inbox',
    data: {
      kind: 'contact_request',
      request_id: request?.id,
      requester_id: me.id,
      receiver_id: receiverId
    }
  });

  // Insert both directions immediately so both users see each other in Contacts
  await supabase
    .from('contacts')
    .upsert(
      { user_id: me.id, contact_id: receiverId },
      { onConflict: 'user_id,contact_id' }
    );
  await supabase
    .from('contacts')
    .upsert(
      { user_id: receiverId, contact_id: me.id },
      { onConflict: 'user_id,contact_id' }
    );

  return { ok: true, status: 'pending', requestId: request?.id || '' };
}

export async function acceptRequestFromNotification(opts: {
  notificationId: string;
  requestId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { notificationId, requestId } = opts;
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' };

  const { data: req, error: reqErr } = await supabase
    .from('contact_requests')
    .select('id,requester_id,receiver_id,status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr || !req) return { ok: false, error: 'NOT_FOUND' };

  // Accept
  const { error: upErr } = await supabase
    .from('contact_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (upErr) return { ok: false, error: upErr.message };

  await supabase
    .from('contacts')
    .upsert(
      { user_id: req.requester_id, contact_id: req.receiver_id },
      { onConflict: 'user_id,contact_id' }
    );
  await supabase
    .from('contacts')
    .upsert(
      { user_id: req.receiver_id, contact_id: req.requester_id },
      { onConflict: 'user_id,contact_id' }
    );

  // Archive current notification
  await supabase
    .from('notifications')
    .update({
      archived_at: new Date().toISOString(),
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  // Notify requester that you accepted
  const display = getDisplayName(me, me.email ?? null);
  await supabase.from('notifications').insert({
    user_id: req.requester_id,
    actor_id: me.id,
    type: 'contact_accept',
    title: `${display} accepted your connection request.`,
    category: 'inbox',
    data: { kind: 'contact_accept', request_id: requestId, accepter_id: me.id }
  });

  return { ok: true };
}

export async function declineRequestFromNotification(opts: {
  notificationId: string;
  requestId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { notificationId, requestId } = opts;
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user;
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' };

  const { data: req, error: reqErr } = await supabase
    .from('contact_requests')
    .select('id,requester_id,receiver_id,status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr || !req) return { ok: false, error: 'NOT_FOUND' };

  const { error: upErr } = await supabase
    .from('contact_requests')
    .update({ status: 'declined' })
    .eq('id', requestId);
  if (upErr) return { ok: false, error: upErr.message };

  // Archive current notification
  await supabase
    .from('notifications')
    .update({
      archived_at: new Date().toISOString(),
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  // Remove any pre-inserted contacts (both directions)
  await supabase
    .from('contacts')
    .delete()
    .eq('user_id', req.requester_id)
    .eq('contact_id', req.receiver_id);
  await supabase
    .from('contacts')
    .delete()
    .eq('user_id', req.receiver_id)
    .eq('contact_id', req.requester_id);

  // Notify requester of decline (red vibe handled in UI)
  await supabase.from('notifications').insert({
    user_id: req.requester_id,
    actor_id: me.id,
    type: 'contact_decline',
    title: 'Your connection request was declined.',
    category: 'inbox',
    data: { kind: 'contact_decline', request_id: requestId, decliner_id: me.id }
  });

  return { ok: true };
}
