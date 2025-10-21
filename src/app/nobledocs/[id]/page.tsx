import { notFound } from 'next/navigation';
import { getDocByIdServer } from '@/../utils/supabase/docs';
import NobleDocEditorScreen from '@/components/docs/nobledoc-editor-screen';

export default async function DocByIdPage({
  params
}: {
  params: { id: string };
}) {
  const doc = await getDocByIdServer(params.id);
  if (!doc) return notFound();
  return (
    <NobleDocEditorScreen
      docId={doc.id}
      initialTitle={doc.title}
      initialHtml={doc.content_html}
    />
  );
}
