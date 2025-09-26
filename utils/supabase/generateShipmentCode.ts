// Generate a unique shipment code similar to requests, but with SHP prefix
import { SupabaseClient } from '@supabase/supabase-js';

export async function generateShipmentCode(supabase: SupabaseClient) {
  const codePrefix = 'SHP';
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;

  // Count shipments for the current month to compute next serial
  const { count, error } = await supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .ilike('code', `${codePrefix}-${yymm}-%`);
  if (error) throw error;
  const serial = ((count || 0) + 1).toString().padStart(4, '0');
  return `${codePrefix}-${yymm}-${serial}`;
}
