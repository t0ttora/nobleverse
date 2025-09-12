import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const amountCents = Number(body.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents <= 0)
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });

  const { data: shipment } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (![shipment.owner_id, shipment.forwarder_id].includes(uid))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const already = Number(shipment.refunded_amount_cents || 0);
  if (already + amountCents > shipment.net_amount_cents)
    return NextResponse.json({ error: 'EXCEEDS_NET' }, { status: 400 });

  await supabase
    .from('shipments')
    .update({
      refunded_amount_cents: already + amountCents,
      escrow_status:
        already + amountCents === shipment.net_amount_cents
          ? 'refunded'
          : shipment.escrow_status
    })
    .eq('id', shipment.id);
  await supabase
    .from('escrow_ledger')
    .insert({
      shipment_id: shipment.id,
      entry_type: 'REFUND',
      amount_cents: amountCents,
      meta: { partial: true }
    });
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id:
          shipment.owner_id === uid ? shipment.forwarder_id : shipment.owner_id,
        actor_id: uid,
        type: 'shipment_partial_refund',
        title: 'Partial refund',
        body: `${(amountCents / 100).toFixed(2)} refunded`,
        data: { shipment_id: shipment.id }
      });
  } catch {}

  return NextResponse.json({ ok: true });
}
