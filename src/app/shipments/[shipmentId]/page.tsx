import { createClient } from '@/lib/server';
import { notFound } from 'next/navigation';
import { ShipmentRoom } from '@/components/shipment';

// NOTE: Next.js 15 warns if you synchronously access params. We allow for params possibly being a Promise.
type ParamsMaybeAsync =
  | { shipmentId: string }
  | Promise<{ shipmentId: string }>;

export default async function ShipmentPage(props: any) {
  // Allow any prop shape; resolve params if promise-like
  const rawParams: any = props?.params;
  const resolvedParams =
    rawParams && typeof rawParams.then === 'function'
      ? await rawParams
      : rawParams;
  const codeOrId = resolvedParams.shipmentId;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return notFound();

  // Helper to surface real error details in environments where Error props are non-enumerable
  const serializeError = (e: unknown) => {
    if (e instanceof Error) {
      return {
        name: e.name,
        message: e.message,
        stack: e.stack,
        cause: (e as any).cause
      };
    }
    if (typeof e === 'object' && e) return { ...(e as any) };
    return { value: String(e) };
  };

  try {
    const looksLikeUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
        codeOrId
      );

    // First attempt: treat the param as a human-readable code
    let { data: shipment, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('code', codeOrId)
      .limit(1)
      .maybeSingle();

    // If not found and it looks like a UUID, retry by id
    if (!shipment && looksLikeUuid) {
      const second = await supabase
        .from('shipments')
        .select('*')
        .eq('id', codeOrId)
        .limit(1)
        .maybeSingle();
      shipment = second.data || null;
      error = second.error;
    }

    if (error) {
      console.error('SHIPMENT_PAGE_DB_ERROR', {
        codeOrId,
        error: serializeError(error)
      });
      return notFound();
    }
    if (!shipment) {
      // Distinguish true not-found vs possible RLS filtered scenario (no error, no row)
      console.warn('SHIPMENT_PAGE_NOT_FOUND', {
        codeOrId,
        lookedUpBy: looksLikeUuid ? 'code_then_uuid' : 'code_only'
      });
      return notFound();
    }
    return <ShipmentRoom shipment={shipment} currentUserId={uid} />;
  } catch (err) {
    console.error('SHIPMENT_PAGE_UNEXPECTED', {
      codeOrId,
      error: serializeError(err)
    });
    return notFound();
  }
}
