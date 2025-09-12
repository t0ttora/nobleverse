import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

// Refund (full) - converts escrow to REFUND entry and updates status
type RouteContext = { params: { id: string } };
export async function POST(_req: Request, context: RouteContext | any) {
  const { params } = context as RouteContext;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (![shipment.owner_id, shipment.forwarder_id].includes(uid))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (shipment.escrow_status === 'refunded')
    return NextResponse.json({ ok: true, already: true });

  await supabase
    .from('shipments')
    .update({ escrow_status: 'refunded', status: 'cancelled' })
    .eq('id', shipment.id);
  await supabase.from('escrow_ledger').insert({
    shipment_id: shipment.id,
    entry_type: 'REFUND',
    amount_cents: shipment.net_amount_cents,
    meta: { full: true }
  });
  try {
    await supabase.from('notifications').insert({
      user_id:
        shipment.owner_id === uid ? shipment.forwarder_id : shipment.owner_id,
      actor_id: uid,
      type: 'shipment_refunded',
      title: 'Shipment refunded',
      body: shipment.code || shipment.id,
      data: { shipment_id: shipment.id }
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
