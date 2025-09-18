'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';
import DarkVeil from '@/features/auth/components/darkveil';

type ViewState = 'verifying' | 'form' | 'submitting' | 'success' | 'error';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<ViewState>('verifying');
  const [message, setMessage] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    // const type = url.searchParams.get('type'); // not used
    // Some Supabase emails place tokens in the URL hash
    const hash = window.location.hash?.startsWith('#')
      ? window.location.hash.slice(1)
      : '';
    const hashParams = new URLSearchParams(hash);
    const hType = hashParams.get('type');
    const hAccess = hashParams.get('access_token');
    const hRefresh = hashParams.get('refresh_token');

    const run = async () => {
      try {
        // Prefer session from URL hash (access_token + refresh_token)
        if (hType === 'recovery' && hAccess && hRefresh) {
          const { error } = await supabase.auth.setSession({
            access_token: hAccess,
            refresh_token: hRefresh
          });
          if (error) throw error;
        }
        // Or verify the OTP token hash (query param ?code=)
        else if (code) {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: code
          });
          if (error) throw error;
        }
        // Otherwise fall back to an existing session if present
        else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setMessage('Reset link is invalid or expired.');
            setStatus('error');
            return;
          }
        }
        setStatus('form');
      } catch (err: any) {
        setMessage(err?.message ?? 'Could not verify reset link.');
        setStatus('error');
      }
    };
    void run();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Wait for session persistence (cookies) then route to dashboard
      const waitForSession = async () => {
        for (let i = 0; i < 4; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) return true;
          await new Promise((r) => setTimeout(r, 150));
        }
        return false;
      };
      const hasSession = await waitForSession();
      setStatus('success');

      // Navigate after a brief pause to show success
      setTimeout(() => {
        try {
          router.replace('/dashboard');
          router.refresh();
        } finally {
          if (!hasSession) {
            window.location.replace('/dashboard');
          }
        }
      }, 600);
    } catch (err: any) {
      setMessage(err?.message ?? 'Could not update password.');
      setStatus('error');
    }
  };

  return (
    <div className='relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8'>
      {/* Background */}
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
        {status === 'verifying' && (
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center md:p-10'>
            <Loader2 className='text-muted-foreground size-7 animate-spin md:size-8' />
            <div className='text-center text-base md:text-lg'>
              Verifying reset link…
            </div>
          </CardContent>
        )}

        {status === 'form' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CardTitle className='text-center text-2xl md:text-3xl'>
                Set a new password
              </CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4 p-8 pt-0 md:p-10'>
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='password'>New password</Label>
                  <Input
                    id='password'
                    type='password'
                    placeholder='••••••••'
                    className='h-11 text-base'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='confirm'>Confirm password</Label>
                  <Input
                    id='confirm'
                    type='password'
                    placeholder='••••••••'
                    className='h-11 text-base'
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {message && (
                  <div className='text-center text-sm text-red-500'>
                    {message}
                  </div>
                )}
                <Button type='submit' size='lg' className='w-full'>
                  Update password
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {status === 'submitting' && (
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center md:p-10'>
            <Loader2 className='text-muted-foreground size-7 animate-spin md:size-8' />
            <div className='text-center text-base md:text-lg'>
              Updating password…
            </div>
          </CardContent>
        )}

        {status === 'success' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CheckCircle2 className='mx-auto size-12 -rotate-6 text-green-600 md:size-14' />
              <CardTitle className='mt-1 text-center text-2xl md:text-3xl'>
                Password updated
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex flex-col items-center gap-3 p-8 pt-0 text-center md:p-10'>
              <p className='text-sm md:text-base'>
                You’re signed in and will be redirected to your dashboard.
              </p>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={() => (window.location.href = '/dashboard')}
              >
                Continue now
              </Button>
            </CardContent>
          </>
        )}

        {status === 'error' && (
          <>
            <CardHeader className='items-center pt-8 text-center md:pt-10'>
              <CardTitle className='text-center text-2xl md:text-3xl'>
                Reset link issue
              </CardTitle>
            </CardHeader>
            <CardContent className='text-muted-foreground flex flex-col items-center gap-5 p-8 pt-0 text-center md:p-10'>
              <p className='text-center text-sm md:text-base'>
                {message ||
                  'The link may be invalid or expired. Request a new one.'}
              </p>
              <Button
                size='lg'
                className='w-full'
                variant='outline'
                onClick={() => (window.location.href = '/auth/forgot-password')}
              >
                Request new link
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
