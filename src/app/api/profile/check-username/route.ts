import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = (searchParams.get('u') || '').trim().toLowerCase();
    if (!username) {
      return NextResponse.json(
        { available: false, reason: 'missing' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { available: false, reason: 'error' },
        { status: 500 }
      );
    }

    const available = !data || (userId && data.id === userId);
    return NextResponse.json({ available });
  } catch (e) {
    return NextResponse.json(
      { available: false, reason: 'exception' },
      { status: 500 }
    );
  }
}
