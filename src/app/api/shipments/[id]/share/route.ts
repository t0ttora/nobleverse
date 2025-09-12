import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import crypto from 'crypto';

type RouteContext = { params: { id: string } };
// POST -> create share link, DELETE -> revoke all
export async function POST(_req: Request, context: RouteContext | any) {
  const { params } = context as RouteContext;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Validate participant
  const { data: s } = await supabase
    .from('shipments')
    .select('id, code')
    .eq('id', params.id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // random token
  const raw = crypto.randomBytes(24).toString('base64url');
  const hash = await hashToken(raw);
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await supabase.from('shipment_share_tokens').insert({
    shipment_id: s.id,
    token_hash: hash,
    expires_at: expires,
    created_by: uid
  });
  const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/s/${raw}`;
  return NextResponse.json({ url, expires });
}

export async function DELETE(_req: Request, context: RouteContext | any) {
  const { params } = context as RouteContext;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await supabase
    .from('shipment_share_tokens')
    .delete()
    .eq('shipment_id', params.id);
  return NextResponse.json({ ok: true });
}

async function hashToken(raw: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw + ':v1');
  // Node 18 subtle crypto
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}
