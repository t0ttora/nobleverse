import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { generateLabelToken, hmacLabelToken } from '@/lib/shipment-label';

export async function POST(_req: Request, context: any) {
  const { params } = context || {};
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (error || !shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (![shipment.owner_id, shipment.forwarder_id].includes(uid))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const token = generateLabelToken();
  const hmac = hmacLabelToken(token);
  await supabase
    .from('shipments')
    .update({ label_hmac: hmac })
    .eq('id', shipment.id);
  // Minimal PNG-like placeholder (return JSON for now)
  return NextResponse.json({ token, shipmentId: shipment.id });
}
