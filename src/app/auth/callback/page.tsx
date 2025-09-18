'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import DarkVeil from '@/features/auth/components/darkveil';

export default function AuthCallback() {
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');

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
          const { data } = await supabase.auth.exchangeCodeForSession(token);
          session = data?.session ?? null;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      if (session) {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'supabase:auth:signed-in' }, '*');
          }
        } catch {}
        try {
          window.close();
        } catch {}
        setStatus('done');
      } else {
        // Some email clients may remove params; perform a short retry using current session
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          setStatus(data.session ? 'done' : 'error');
        }, 600);
      }
    }
    handleAuth();
  }, []);

  return (
    <div className='relative flex min-h-dvh items-center justify-center overflow-hidden px-4 pt-10 pb-2'>
      {/* Background animation (fixed, behind card but above body) */}
      <div className='pointer-events-none fixed inset-0 z-0 h-dvh w-dvw [transform:translateZ(0)]'>
        <DarkVeil
          colorize={1}
          tintColor={'#FF3C00'}
          noiseIntensity={0.03}
          scanlineIntensity={0.08}
          scanlineFrequency={8}
          warpAmount={0.04}
          speed={0.5}
          resolutionScale={1}
        />
      </div>

      {/* Foreground card */}
      <Card className='relative z-10 w-full max-w-[28rem] translate-y-2 md:max-w-[32rem] md:translate-y-3'>
        {status === 'working' && (
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center md:p-10'>
            <Loader2 className='text-muted-foreground size-7 animate-spin md:size-8' />
            <div className='text-center text-base md:text-lg'>
              Verifying your account…
            </div>
          </CardContent>
        )}
        {status === 'done' && (
          <>
            <CardHeader className='items-center justify-items-center gap-2 pt-8 text-center md:pt-10'>
              <CheckCircle2 className='mx-auto size-12 -rotate-6 justify-self-center text-green-600 md:size-14' />
              <CardTitle className='mt-1 justify-self-center text-center text-2xl md:text-3xl'>
                Account verified
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex min-h-[260px] flex-col items-center gap-3 p-8 pt-0 text-center md:p-10'>
              <div className='mt-auto flex w-full flex-col items-center gap-2'>
                <p className='text-center text-sm md:text-base'>
                  You’re signed in on the original tab. You can close this page.
                </p>
                <Button
                  size='lg'
                  className='w-full'
                  onClick={() => {
                    try {
                      window.close();
                    } catch {}
                  }}
                >
                  Close this page
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground'
                  onClick={() => (window.location.href = '/dashboard')}
                >
                  Continue here
                </Button>
              </div>
            </CardContent>
          </>
        )}
        {status === 'error' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CardTitle className='text-center text-2xl md:text-3xl'>
                Verification failed
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex flex-col items-center gap-5 p-8 pt-0 text-center md:p-10'>
              <p className='text-center text-sm md:text-base'>
                Please try signing in again.
              </p>
              <Button
                size='lg'
                className='w-full'
                variant='outline'
                onClick={() => (window.location.href = '/auth/sign-in')}
              >
                Go to sign-in
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
