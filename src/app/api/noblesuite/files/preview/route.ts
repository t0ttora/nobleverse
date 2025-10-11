import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

// GET /api/noblesuite/files/preview?id=<file_id>
// Streams the file bytes with proper Content-Type after checking access.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'FILE_ID_REQUIRED' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }

  // Load file metadata
  const { data: file, error: fileErr } = await supabase
    .from('files')
    .select(
      'id, owner_id, storage_path, mime_type, ext, visibility, is_deleted'
    )
    .eq('id', id)
    .single();
  if (fileErr || !file) {
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }
  if (file.is_deleted) {
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  // Access check: owner, shared with me, or public visibility
  let allowed = file.owner_id === auth.user.id;
  if (!allowed) {
    // Try shared
    const { data: sharedRows } = await supabase
      .from('files_shares')
      .select('id')
      .eq('file_id', file.id)
      .eq('user_id', auth.user.id)
      .limit(1);
    if (sharedRows && sharedRows.length > 0) allowed = true;
  }
  if (!allowed) {
    // If visibility column is missing in schema, field will be undefined; ignore then
    if (file.visibility && file.visibility === 'public') {
      allowed = true;
    }
  }
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!file.storage_path) {
    return NextResponse.json(
      { ok: false, error: 'NO_STORAGE_PATH' },
      { status: 400 }
    );
  }

  // Download from storage and stream back
  const { data: blob, error: dlErr } = await supabase.storage
    .from(FILES_BUCKET)
    .download(file.storage_path);
  if (dlErr || !blob) {
    // Hide internal storage errors from end-user iframe; respond 404
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const type =
    (file.mime_type && typeof file.mime_type === 'string' && file.mime_type) ||
    (file.ext && file.ext.toLowerCase() === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream');

  // Convert Blob to ArrayBuffer for Response body
  const ab = await blob.arrayBuffer();
  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=60',
      'Content-Disposition': 'inline'
    }
  });
}
