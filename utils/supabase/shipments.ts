import { SupabaseClient } from '@supabase/supabase-js';
import { generateShipmentCode } from './generateShipmentCode';

const FREIGHT_ABBR: Record<string, string> = {
  road: 'RDF',
  sea: 'SEF',
  air: 'ARF',
  rail: 'RAF',
  multimodal: 'MMF',
  courier: 'CRX'
};

export async function createShipment({
  supabase,
  ownerId,
  forwarderId,
  freightType,
  details
}: {
  supabase: SupabaseClient;
  ownerId: string; // booking created by (shipper/owner)
  forwarderId?: string | null; // optional preselected forwarder
  freightType: string; // can be long form or abbr
  details: any;
}) {
  const code = await generateShipmentCode(supabase);
  const abbr = FREIGHT_ABBR[freightType] || freightType; // accept ARF/RDF etc
  const payload: any = {
    code,
    owner_id: ownerId,
    forwarder_id: forwarderId || null,
    status: 'booked',
    details,
    freight_type: abbr
  };
  const { data, error } = await supabase
    .from('shipments')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}
