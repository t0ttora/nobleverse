// Benzersiz request code (seri numarası) üretici
import { SupabaseClient } from '@supabase/supabase-js';

const FREIGHT_CODES: Record<string, string> = {
  road: 'RDF',
  sea: 'SEF',
  air: 'ARF',
  rail: 'RAF',
  multimodal: 'MMF',
  courier: 'CRX'
};

export async function generateRequestCode(
  supabase: SupabaseClient,
  freightType: string
) {
  const codePrefix = FREIGHT_CODES[freightType];
  if (!codePrefix) throw new Error('Invalid freight type');
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // O ay ve tür için kaç kayıt var?
  const { count, error } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .ilike('code', `${codePrefix}-${yymm}-%`);
  if (error) throw error;
  const serial = ((count || 0) + 1).toString().padStart(4, '0');
  return `${codePrefix}-${yymm}-${serial}`;
}
