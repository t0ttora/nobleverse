import { NextResponse } from 'next/server';
import { getContactsForUser, getOwnUserId } from '@/lib/contacts';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;
    const userId = await getOwnUserId();
    if (!userId)
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    const items = await getContactsForUser(userId, { search: q });
    return NextResponse.json({
      ok: true,
      items: items.map((c) => ({
        id: c.id,
        username: (c as any).username || null,
        display_name: c.display_name || null,
        email: (c as any).email || null,
        avatar_url: (c as any).avatar_url || null
      }))
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'CONTACTS_FAILED' },
      { status: 500 }
    );
  }
}
