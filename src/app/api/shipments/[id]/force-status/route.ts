import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// PATCH body: { status: 'delivered' | 'in_transit' | 'cancelled' }
// Only participants or admins (role check) may force status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { status } = (await req.json().catch(() => ({}))) as {
    status?: string;
  };
  if (!status || !['delivered', 'in_transit', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch shipment & participant check
  const { data: shipment, error: shipErr } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', params.id)
    .single();
  if (shipErr || !shipment)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Basic participant check (shipper/forwarder) or system role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  const isParticipant =
    shipment.shipper_id === user.id || shipment.forwarder_id === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isParticipant && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Perform update
  const { data: updated, error: updateErr } = await supabase
    .from('shipments')
    .update({ status })
    .eq('id', shipment.id)
    .select()
    .single();
  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ shipment: updated });
}
