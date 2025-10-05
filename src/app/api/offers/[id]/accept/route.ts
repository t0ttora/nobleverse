import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

function extractId(request: Request, fallback?: string): string | null {
  try {
    const u = new URL(request.url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'offers');
    if (idx !== -1 && parts.length > idx + 1) return parts[idx + 1];
  } catch {}
  return fallback || null;
}

function looksLikeUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v
  );
}

export async function POST(request: Request, context: any) {
  let step = 'INIT';
  try {
    // Support both old and new params behavior
    const ctxParams = await (context?.params ||
      context?.params?.then?.((v: any) => v));
    const rawId = ctxParams?.id || extractId(request);
    if (!rawId)
      return NextResponse.json({ error: 'MISSING_ID', step }, { status: 400 });

    const supabase = await createClient();
    step = 'AUTH';
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid)
      return NextResponse.json({ error: 'UNAUTH', step }, { status: 401 });

    step = 'FETCH_OFFER';
    const { data: offer, error: offerErr } = await supabase
      .from('offers')
      .select('*')
      .eq('id', rawId)
      .maybeSingle();
    if (offerErr)
      return NextResponse.json(
        { error: 'OFFER_FETCH', detail: offerErr.message, step },
        { status: 500 }
      );
    if (!offer)
      return NextResponse.json({ error: 'NOT_FOUND', step }, { status: 404 });
    if (offer.status === 'accepted')
      return NextResponse.json({ ok: true, already: true, step: 'ALREADY' });

    step = 'CHECK_EXISTING';
    const { data: existingAccepted, error: existErr } = await supabase
      .from('offers')
      .select('id')
      .eq('request_id', offer.request_id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (existErr)
      return NextResponse.json(
        { error: 'CHECK_EXISTING', detail: existErr.message, step },
        { status: 500 }
      );
    if (existingAccepted) {
      return NextResponse.json(
        {
          error: 'ALREADY_ACCEPTED',
          acceptedOfferId: existingAccepted.id,
          step
        },
        { status: 409 }
      );
    }

    step = 'FETCH_REQUEST';
    const { data: reqRow, error: reqErr } = await supabase
      .from('requests')
      .select('*')
      .eq('id', offer.request_id)
      .maybeSingle();
    if (reqErr)
      return NextResponse.json(
        { error: 'REQUEST_FETCH', detail: reqErr.message, step },
        { status: 500 }
      );
    if (!reqRow || reqRow.user_id !== uid)
      return NextResponse.json({ error: 'FORBIDDEN', step }, { status: 403 });

    step = 'AMOUNTS';
    const priceNum =
      offer.details?.price_total ?? offer.details?.total_price ?? 0;
    const totalCents = Math.max(0, Math.round(priceNum * 100));
    if (totalCents <= 0) {
      return NextResponse.json(
        {
          error: 'INVALID_AMOUNT',
          step,
          detail: 'Offer total price missing or zero'
        },
        { status: 422 }
      );
    }
    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || '5');
    const platformFeeCents = Math.round((totalCents * feePercent) / 100);
    const netCents = totalCents - platformFeeCents;

    const insertShipment: any = {
      owner_id: reqRow.user_id,
      forwarder_id: offer.forwarder_id,
      total_amount_cents: totalCents,
      platform_fee_cents: platformFeeCents,
      net_amount_cents: netCents,
      participants: []
    };
    if (looksLikeUUID(offer.id)) insertShipment.offer_id = offer.id;
    // If not UUID we still keep a reference inside escrow meta later.

    step = 'INSERT_SHIPMENT';
    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .insert(insertShipment)
      .select('*')
      .single();
    if (shipErr || !shipment) {
      return NextResponse.json(
        {
          error: 'SHIP_CREATE_FAILED',
          detail: shipErr?.message,
          step,
          hint: shipErr?.message?.includes('row-level security')
            ? 'Run latest migrations adding shipments_insert policy.'
            : undefined
        },
        { status: 500 }
      );
    }

    step = 'UPDATE_OFFER';
    const { error: updOfferErr } = await supabase
      .from('offers')
      .update({ status: 'accepted' })
      .eq('id', offer.id);
    if (updOfferErr)
      return NextResponse.json(
        { error: 'OFFER_UPDATE_FAILED', detail: updOfferErr.message, step },
        { status: 500 }
      );

    step = 'CONVERT_REQUEST';
    await supabase
      .from('requests')
      .update({ status: 'converted' })
      .eq('id', offer.request_id);

    step = 'REJECT_OTHERS';
    await supabase
      .from('offers')
      .update({ status: 'rejected' })
      .eq('request_id', offer.request_id)
      .neq('id', offer.id)
      .in('status', ['sent']);

    step = 'LEDGER_INSERT';
    const { error: ledgerErr } = await supabase.from('escrow_ledger').insert([
      {
        shipment_id: shipment.id,
        entry_type: 'HOLD',
        amount_cents: totalCents,
        meta: { offer_id: offer.id }
      },
      {
        shipment_id: shipment.id,
        entry_type: 'FEE',
        amount_cents: platformFeeCents,
        meta: { percent: feePercent, offer_id: offer.id }
      }
    ]);
    if (ledgerErr)
      return NextResponse.json(
        { error: 'LEDGER_INSERT_FAILED', detail: ledgerErr.message, step },
        { status: 500 }
      );

    step = 'NOTIFICATION';
    try {
      await supabase.from('notifications').insert({
        user_id: offer.forwarder_id,
        actor_id: uid,
        type: 'offer_accepted',
        title: 'Offer accepted',
        body: shipment.code || shipment.id,
        data: { shipment_id: shipment.id, request_id: offer.request_id }
      });
    } catch {}

    step = 'CHAT_ROOM';
    try {
      const { data: room } = await supabase
        .from('chat_rooms')
        .insert({
          shipment_id: shipment.id,
          type: 'shipment',
          participants: [reqRow.user_id, offer.forwarder_id]
        })
        .select('id')
        .single();
      if (room?.id)
        await supabase.from('chat_messages').insert({
          room_id: room.id,
          user_id: uid,
          content: 'Shipment room created.'
        });
    } catch {}

    step = 'DONE';
    return NextResponse.json({
      ok: true,
      shipmentId: shipment.id,
      code: shipment.code,
      redirect: `/shipments/${shipment.code || shipment.id}`,
      step,
      offerId: offer.id
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'UNEXPECTED', step, detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
