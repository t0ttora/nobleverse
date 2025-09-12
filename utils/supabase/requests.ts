// Kullanıcının kendi request'lerini getirir
export async function getUserRequests({
  supabase,
  userId
}: {
  supabase: any;
  userId: string;
}) {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'converted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
import { SupabaseClient } from '@supabase/supabase-js';
import { generateRequestCode } from './generateRequestCode';

const FREIGHT_CODES: Record<string, string> = {
  road: 'RDF',
  sea: 'SEF',
  air: 'ARF',
  rail: 'RAF',
  multimodal: 'MMF',
  courier: 'CRX'
};

export async function createRequest({
  supabase,
  freightType,
  details,
  userId
}: {
  supabase: SupabaseClient;
  freightType: string;
  details: any;
  userId: string;
}) {
  if (!FREIGHT_CODES[freightType]) throw new Error('Invalid freight type');
  // Row sayısını al
  const { count, error: countError } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  const newId = (count || 0) + 1;

  let code;
  let exists = true;
  let tryCount = 0;
  // Kodun benzersizliğini garanti altına al
  while (exists && tryCount < 5) {
    code = await generateRequestCode(supabase, freightType);
    const { data: existing, error: checkError } = await supabase
      .from('requests')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (checkError) throw checkError;
    exists = !!existing;
    tryCount++;
  }
  if (exists)
    throw new Error('Benzersiz bir kod üretilemedi, lütfen tekrar deneyin.');
  const { data, error } = await supabase
    .from('requests')
    .insert([
      {
        id: newId,
        code,
        freight_type: FREIGHT_CODES[freightType],
        status: 'pending',
        user_id: userId,
        details
      }
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}
