import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

// Open a dispute - marks shipment disputed
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(req: Request, context: RouteContext | any) {
  const { id } = await (context as RouteContext).params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const reason = (await req.json().catch(() => ({}))).reason || 'unspecified';

  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (![shipment.owner_id, shipment.forwarder_id].includes(uid))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (shipment.status === 'disputed')
    return NextResponse.json({ ok: true, already: true });

  await supabase
    .from('shipments')
    .update({ status: 'disputed' })
    .eq('id', shipment.id);
  await supabase.from('escrow_ledger').insert({
    shipment_id: shipment.id,
    entry_type: 'ADJUST',
    amount_cents: 0,
    meta: { dispute: true, reason }
  });
  try {
    await supabase.from('notifications').insert({
      user_id:
        shipment.owner_id === uid ? shipment.forwarder_id : shipment.owner_id,
      actor_id: uid,
      type: 'shipment_disputed',
      title: 'Shipment disputed',
      body: reason,
      data: { shipment_id: shipment.id }
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
