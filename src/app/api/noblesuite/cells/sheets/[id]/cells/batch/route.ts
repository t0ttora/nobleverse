import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

// Batch upsert cells: [{ row, col, type, value, formula }]
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { cells } = body as {
    cells: Array<{
      row: number;
      col: number;
      type?: string;
      value?: string;
      formula?: string | null;
    }>;
  };
  if (!Array.isArray(cells))
    return NextResponse.json(
      { ok: false, error: 'INVALID_PAYLOAD' },
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
  const payload = cells.map((c) => ({
    sheet_id: id,
    row: c.row,
    col: c.col,
    type: c.type ?? (c.formula ? 'formula' : 'string'),
    value: c.value ?? null,
    formula: c.formula ?? null
  }));
  const { error } = await supabase.from('cells').upsert(payload, {
    onConflict: 'sheet_id,row,col'
  });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true });
}
