import { notFound } from 'next/navigation';
import { getDocByIdServer } from '@/../utils/supabase/docs.server';
import NobleDocEditorScreen from '@/components/docs/nobledoc-editor-screen';

export default async function DocByIdPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocByIdServer(id);
  if (!doc) return notFound();
  return (
    <NobleDocEditorScreen
      docId={doc.id}
      initialTitle={doc.title}
      initialHtml={doc.content_html}
      initialCreatedAt={doc.created_at}
    />
  );
}
