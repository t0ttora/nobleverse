import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const { display_name } = await req.json();
  if (!display_name || typeof display_name !== 'string') {
    return NextResponse.json(
      { available: false, error: 'Invalid NobleID' },
      { status: 400 }
    );
  }
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('display_name', display_name)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { available: false, error: 'Database error' },
      { status: 500 }
    );
  }
  return NextResponse.json({ available: !data });
}
