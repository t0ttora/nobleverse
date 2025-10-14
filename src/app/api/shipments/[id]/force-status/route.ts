import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH body: { status: 'delivered' | 'in_transit' | 'cancelled' }
// Only participants or admins (role check) may force status.
export async function PATCH(req: NextRequest, context: RouteContext | any) {
  const { id } = await (context as RouteContext).params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
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
    .eq('id', id)
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
