import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

// Accept a negotiation: create shipment, mark negotiation accepted, reject others, convert request
// NOTE: Loosen the param typing to sidestep Next.js 15 route generic constraint issue during build.
// The runtime shape we rely on is params.id (string).
type RouteContext = { params: { id: string } };
export async function POST(_req: Request, context: RouteContext | any) {
  const { params } = context as RouteContext;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const { data: negotiation, error: negErr } = await supabase
    .from('negotiations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (negErr || !negotiation)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (negotiation.status === 'accepted')
    return NextResponse.json({ ok: true, already: true });

  // Fetch request (owner) and ensure caller is owner
  const { data: reqRow } = await supabase
    .from('requests')
    .select('*')
    .eq('id', negotiation.request_id)
    .maybeSingle();
  if (!reqRow || reqRow.user_id !== uid)
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  // Prevent if another negotiation already accepted for this request
  const { data: existingAccepted } = await supabase
    .from('negotiations')
    .select('id')
    .eq('request_id', negotiation.request_id)
    .eq('status', 'accepted')
    .maybeSingle();
  if (existingAccepted)
    return NextResponse.json(
      { error: 'ALREADY_ACCEPTED', acceptedNegotiationId: existingAccepted.id },
      { status: 409 }
    );

  // Price extraction (assume negotiation.details.price_total similar to offer)
  const totalCents = Math.round((negotiation.details?.price_total || 0) * 100);
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || '5');
  const platformFeeCents = Math.round((totalCents * feePercent) / 100);
  const netCents = totalCents - platformFeeCents;

  const { data: shipment, error: shipErr } = await supabase
    .from('shipments')
    .insert({
      negotiation_id: negotiation.id,
      owner_id: reqRow.user_id,
      forwarder_id: negotiation.forwarder_id,
      total_amount_cents: totalCents,
      platform_fee_cents: platformFeeCents,
      net_amount_cents: netCents,
      participants: []
    })
    .select('*')
    .single();
  if (shipErr || !shipment)
    return NextResponse.json(
      { error: 'SHIP_CREATE_FAILED', detail: shipErr?.message },
      { status: 500 }
    );

  await supabase
    .from('negotiations')
    .update({ status: 'accepted' })
    .eq('id', negotiation.id);
  await supabase
    .from('negotiations')
    .update({ status: 'rejected' })
    .eq('request_id', negotiation.request_id)
    .neq('id', negotiation.id)
    .in('status', ['pending', 'counter']);
  try {
    await supabase
      .from('requests')
      .update({ status: 'converted' })
      .eq('id', negotiation.request_id);
  } catch {}

  await supabase.from('escrow_ledger').insert([
    {
      shipment_id: shipment.id,
      entry_type: 'HOLD',
      amount_cents: totalCents,
      meta: { negotiation_id: negotiation.id }
    },
    {
      shipment_id: shipment.id,
      entry_type: 'FEE',
      amount_cents: platformFeeCents,
      meta: { percent: feePercent }
    }
  ]);

  try {
    await supabase.from('notifications').insert({
      user_id: negotiation.forwarder_id,
      actor_id: uid,
      type: 'negotiation_accepted',
      title: 'Negotiation accepted',
      body: shipment.code || shipment.id,
      data: { shipment_id: shipment.id, request_id: negotiation.request_id }
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    shipmentId: shipment.id,
    code: shipment.code,
    redirect: `/shipments/${shipment.code}`
  });
}
