import { cookies } from 'next/headers';
import { createClient } from './server';

export type NvDoc = {
  id: string;
  owner_id: string | null;
  title: string;
  content_html: string;
  created_at: string;
  updated_at: string;
};

export async function createDocServer(
  initial?: Partial<NvDoc>
): Promise<NvDoc> {
  const cookieStore = await cookies();
  const s = createClient(cookieStore);
  const { data: user } = await s.auth.getUser();
  const owner_id = user.user?.id ?? null;
  const { data, error } = await s
    .from('nv_docs')
    .insert({
      owner_id,
      title: initial?.title ?? 'Untitled Doc',
      content_html: initial?.content_html ?? '<p></p>'
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as NvDoc;
}

export async function getDocByIdServer(id: string): Promise<NvDoc | null> {
  const cookieStore = await cookies();
  const s = createClient(cookieStore);
  const { data, error } = await s
    .from('nv_docs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as NvDoc;
}
