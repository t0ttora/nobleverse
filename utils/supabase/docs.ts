import { supabase } from '@/../utils/supabase/client';

export type NvDoc = {
  id: string;
  owner_id: string | null;
  title: string;
  content_html: string;
  created_at: string;
  updated_at: string;
};

export async function updateDocClient(
  id: string,
  patch: Partial<Pick<NvDoc, 'title' | 'content_html'>>
): Promise<void> {
  const { error } = await supabase.from('nv_docs').update(patch).eq('id', id);
  if (error) throw error;
}
