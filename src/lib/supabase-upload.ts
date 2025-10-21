import { supabase } from '@/lib/supabaseClient';

/**
 * Upload a file to Supabase Storage and return a public URL.
 * Uses the `docs-images` bucket by default.
 */
export async function uploadImageToSupabase(
  file: File,
  folder: string = 'public'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${folder}/${fileName}`;
  const { error } = await supabase.storage
    .from('docs-images')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('docs-images').getPublicUrl(path);
  return data.publicUrl;
}
