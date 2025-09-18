'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/../utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import DarkVeil from '@/features/auth/components/darkveil';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);

  // Initialize and tick a resend cooldown so users don't trigger rate limits repeatedly
  useEffect(() => {
    const last = Number.parseInt(
      typeof window !== 'undefined'
        ? window.localStorage.getItem('nv_reset_last') || '0'
        : '0',
      10
    );
    const remaining = Math.max(
      0,
      60 - Math.floor((Date.now() - (last || 0)) / 1000)
    );
    setCooldown(remaining);
    if (remaining > 0) {
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        // Gracefully handle rate limit by pretending success
        if (msg.includes('rate limit')) {
          setMessage(
            'We recently sent a reset link. Please check your inbox or try again in a minute.'
          );
          setStatus('sent');
        } else {
          throw error;
        }
      } else {
        setStatus('sent');
      }
      // Start a local cooldown to avoid spamming
      try {
        window.localStorage.setItem('nv_reset_last', Date.now().toString());
      } catch {}
      setCooldown(60);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8'>
      {/* Background animation */}
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

      <Card className='relative z-10 w-full max-w-[28rem] md:max-w-[32rem]'>
        {status === 'idle' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CardTitle className='text-center text-2xl md:text-3xl'>
                Forgot your password?
              </CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4 p-8 pt-0 md:p-10'>
              <form onSubmit={onSubmit} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    type='email'
                    placeholder='you@example.com'
                    className='h-11 text-base'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {message && (
                  <div className='text-center text-sm text-red-500'>
                    {message}
                  </div>
                )}
                <Button
                  type='submit'
                  size='lg'
                  className='w-full'
                  disabled={submitting || cooldown > 0}
                >
                  {submitting ? (
                    <span className='inline-flex items-center gap-2'>
                      <Loader2 className='size-4 animate-spin' /> Sending
                      link...
                    </span>
                  ) : cooldown > 0 ? (
                    `Resend in ${cooldown}s`
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {status === 'sent' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <MailCheck className='mx-auto size-12 -rotate-6 text-green-600 md:size-14' />
              <CardTitle className='mt-1 text-center text-2xl md:text-3xl'>
                Check your inbox
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex flex-col items-center gap-3 p-8 pt-0 text-center md:p-10'>
              <p className='text-sm md:text-base'>
                We emailed a password reset link to {email}. Open it to set a
                new password.
              </p>
              {message && (
                <p className='text-muted-foreground text-xs md:text-sm'>
                  {message}
                </p>
              )}
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={() => (window.location.href = '/auth/sign-in')}
              >
                Return to sign in
              </Button>
            </CardContent>
          </>
        )}

        {status === 'error' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CardTitle className='text-center text-2xl md:text-3xl'>
                Couldn’t send link
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex flex-col items-center gap-5 p-8 pt-0 text-center md:p-10'>
              <p className='text-center text-sm md:text-base'>
                {message || 'Please check the email and try again.'}
              </p>
              <Button
                size='lg'
                className='w-full'
                variant='outline'
                onClick={() => setStatus('idle')}
              >
                Try again
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
