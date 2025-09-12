import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);
  return NextResponse.json({ ok: true });
}
