import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Only these routes are considered public. Everything else requires auth.
const PUBLIC_PATHS = [
  '/',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/callback',
  '/favicon.ico',
  '/assets',
  '/_next',
  '/public'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let res = NextResponse.next({ request });
  // Skip static assets, API routes and files (images, scripts, etc.)
  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.');
  const isApi = pathname.startsWith('/api');
  if (isStaticAsset || isApi) return res;

  // Only root ("/") and any "/auth/*" route are public
  const isPublic = pathname === '/' || pathname.startsWith('/auth');
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        }
      }
    }
  );
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Eğer kullanıcı giriş yapmamışsa ve korumalı sayfaya erişiyorsa login'e yönlendir
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    const redirectRes = NextResponse.redirect(url);
    // carry over any cookies Supabase may have set on res
    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value);
    }
    return redirectRes;
  }

  // Eğer kullanıcı giriş yapmışsa ve login/signup sayfalarına erişiyorsa dashboard'a yönlendir
  if (
    user &&
    (pathname === '/auth/sign-in' ||
      pathname === '/auth/sign-up' ||
      (pathname.startsWith('/auth/') && pathname !== '/auth/callback'))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectRes = NextResponse.redirect(url);
    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value);
    }
    return redirectRes;
  }

  return res;
}

// Apply middleware to all routes; we filter assets in code above
export const config = { matcher: ['/:path*'] };
