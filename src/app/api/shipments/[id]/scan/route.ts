import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { hmacLabelToken } from '@/lib/shipment-label';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const token = body.token as string | undefined;
  if (!token) return NextResponse.json({ error: 'NO_TOKEN' }, { status: 400 });
  const supabase = await createClient();
  const hmac = hmacLabelToken(token);
  const { data: shipment } = await supabase
    .from('shipments')
    .select('id,label_hmac')
    .eq('id', params.id)
    .maybeSingle();
  if (!shipment)
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (shipment.label_hmac !== hmac)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  await supabase
    .from('scans')
    .insert({ shipment_id: shipment.id, meta: { via: 'label' } });
  return NextResponse.json({ ok: true });
}
