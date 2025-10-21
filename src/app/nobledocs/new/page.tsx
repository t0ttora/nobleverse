import { redirect } from 'next/navigation';
import { createDocServer } from '@/../utils/supabase/docs';

export default async function NewDocPage() {
  const doc = await createDocServer({
    title: 'Untitled Doc',
    content_html: '<p></p>'
  });
  redirect(`/nobledocs/${doc.id}`);
}
