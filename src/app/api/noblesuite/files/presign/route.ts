import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';
import { randomUUID } from 'crypto';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

// POST body: { fileName, fileType, parentId }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { fileName, fileType, parentId } = body;
  if (!fileName)
    return NextResponse.json(
      { ok: false, error: 'FILE_NAME_REQUIRED' },
      { status: 400 }
    );
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const id = randomUUID();
  const path = `${auth.user.id}/${id}/${fileName}`;

  // Insert metadata row first (binary file placeholder)
  const { error: insertErr } = await supabase.from('files').insert({
    id,
    name: fileName,
    parent_id: parentId || null,
    type: 'binary',
    owner_id: auth.user.id,
    ext,
    mime_type: fileType || null,
    size_bytes: null,
    storage_path: path
  });
  if (insertErr)
    return NextResponse.json(
      { ok: false, error: insertErr.message },
      { status: 400 }
    );

  // For Supabase storage simple upload (no real presign needed for standard JS client) we just return path.
  // Client will use public bucket 'files' (ensure it exists) via supabase.storage.from('files').upload(path, file)
  // Return also a public URL if bucket is public
  const { data: pub } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    fileId: id,
    path,
    publicUrl: pub?.publicUrl || null
  });
}
