'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const access_token = url.searchParams.get('access_token');

    async function handleAuth() {
      let session = null;
      if (code || access_token) {
        const token = code ?? access_token;
        if (token) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(token);
          session = data?.session ?? null;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      if (session) {
        window.location.replace('/dashboard');
      } else {
        window.location.replace('/auth/sign-in');
      }
    }
    handleAuth();
  }, [router]);

  return <div>Signing you in, please wait...</div>;
}
