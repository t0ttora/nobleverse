import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      );

    const allowed = [
      'username',
      'role',
      'company_name',
      'website',
      'location',
      'phone',
      'email',
      'bio',
      'avatar_url',
      'banner_url',
      'details',
      'display_name'
    ] as const;
    const update: Record<string, any> = {};
    for (const k of allowed) {
      if (k in body) update[k] = body[k];
    }

    // If display_name is present but the DB column doesn't exist, persist it under details.display_name
    if (typeof update.display_name === 'string') {
      update.details = {
        ...(update.details ?? {}),
        display_name: update.display_name
      };
      delete update.display_name;
    }

    // Normalize and validate username
    if (typeof update.username === 'string') {
      update.username = update.username.trim().toLowerCase();
    }

    // Merge details with existing
    if ('details' in update) {
      if (typeof update.details === 'string') {
        try {
          update.details = JSON.parse(update.details);
        } catch {
          // ignore invalid JSON input for details; keep as-is
        }
      }
      const { data: current } = await supabase
        .from('profiles')
        .select('details')
        .eq('id', user.id)
        .maybeSingle();
      update.details = {
        ...(current?.details ?? {}),
        ...(update.details ?? {})
      };
    }

    update.updated_at = new Date().toISOString();
    update.onboarding_completed = true;
    update.first_time = false;

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...update }, { onConflict: 'id' });
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN' }, { status: 500 });
  }
}
