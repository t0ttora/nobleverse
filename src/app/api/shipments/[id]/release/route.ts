import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

type RouteContext = { params: Promise<{ id: string }> };
export async function POST(_req: Request, context: RouteContext | any) {
  const { id } = await (context as RouteContext).params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });
  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (shipment.escrow_status !== 'hold')
    return NextResponse.json({ error: 'NOT_HOLD' }, { status: 400 });
  if (![shipment.owner_id, shipment.forwarder_id].includes(uid))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  await supabase
    .from('shipments')
    .update({
      escrow_status: 'released',
      status: shipment.status === 'created' ? 'in_transit' : shipment.status
    })
    .eq('id', shipment.id);
  await supabase.from('escrow_ledger').insert({
    shipment_id: shipment.id,
    entry_type: 'RELEASE',
    amount_cents: shipment.net_amount_cents,
    meta: { manual: true }
  });
  return NextResponse.json({ ok: true });
}
