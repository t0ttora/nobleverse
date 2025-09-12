import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './utils/supabase/middleware';

const PUBLIC_PATHS = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/callback',
  '/favicon.ico',
  '/assets',
  '/api',
  '/_next',
  '/public',
  '/profile'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const supabase = createClient(request);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Eğer kullanıcı giriş yapmamışsa ve korumalı sayfaya erişiyorsa login'e yönlendir
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    return NextResponse.redirect(url);
  }

  // Eğer kullanıcı giriş yapmışsa ve login/signup sayfalarına erişiyorsa dashboard'a yönlendir
  if (
    user &&
    (pathname.startsWith('/auth/sign-in') ||
      pathname.startsWith('/auth/sign-up'))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|assets|api|public).*)']
};
