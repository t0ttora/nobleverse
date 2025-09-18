'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/client';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

const formSchema = z.object({
  firstName: z.string().min(2, { message: 'Enter your first name' }),
  lastName: z.string().min(2, { message: 'Enter your last name' }),
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
});
type FormValues = z.infer<typeof formSchema>;

export default function SupabaseSignUpForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' }
  });

  useEffect(() => {
    // Eğer kullanıcı giriş yaptıysa, profili var mı kontrol et; yoksa auth flow'da kal
    const checkAndRedirect = async (attempt = 0) => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return; // oturum yok, auth flow'da kal
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.id) {
        router.replace('/dashboard');
      } else if (attempt < 20) {
        // trigger gecikmesine karşı 10s'e kadar bekle (500ms * 20)
        setTimeout(() => void checkAndRedirect(attempt + 1), 500);
      }
    };
    void checkAndRedirect();

    // Oturum başka bir sekmede doğrulanırsa bu sekmede de yakala ve yönlendir
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void checkAndRedirect();
    });

    // Callback sayfasından gelen mesajı dinle
    const onMessage = (e: MessageEvent) => {
      if (e?.data?.type === 'supabase:auth:signed-in') {
        void checkAndRedirect();
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      sub.subscription?.unsubscribe();
      window.removeEventListener('message', onMessage);
    };
  }, [router]);

  const onSubmit = async (data: FormValues) => {
    setError('');
    setLoading(true);
    setResendError('');
    setResendSuccess('');
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        // Verification email tıklandığında bu route'a dön
        emailRedirectTo: redirectTo,
        data: {
          first_name: data.firstName,
          last_name: data.lastName
        }
      }
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      setSignupEmail(data.email);
      setEmailSent(true);
    }
  };

  const handleResend = async () => {
    setResendError('');
    setResendSuccess('');
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: signupEmail
    });
    setResendLoading(false);
    if (error) setResendError(error.message);
    else setResendSuccess('Verification email resent!');
  };

  if (emailSent) {
    return (
      <div className='mx-auto flex w-full max-w-md flex-col items-center justify-center'>
        <div className='mb-6 flex w-full flex-col items-center'>
          <h1 className='mb-2 text-center text-3xl font-bold tracking-tight'>
            Check your email
          </h1>
          <p className='text-muted-foreground mb-4 text-center text-base'>
            We sent a verification link to{' '}
            <span className='font-semibold'>{signupEmail}</span>.<br />
            Please verify your email to activate your account.
            <br />
            After verification, you can sign in.
          </p>
          <Button
            onClick={handleResend}
            disabled={resendLoading}
            variant='outline'
            className='mt-2'
          >
            {resendLoading ? 'Resending...' : 'Resend verification email'}
          </Button>
          {resendError && (
            <div className='mt-2 text-center text-red-500'>{resendError}</div>
          )}
          {resendSuccess && (
            <div className='mt-2 text-center text-green-600'>
              {resendSuccess}
            </div>
          )}
        </div>
        <div className='mt-4 text-center text-sm'>
          Already have an account?{' '}
          <Link
            href='/auth/sign-in'
            className='text-primary cursor-pointer underline transition hover:opacity-80'
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto flex w-full max-w-md flex-col items-center justify-center'>
      <div className='mb-6 flex w-full flex-col items-center'>
        <h1 className='mb-2 text-center text-3xl font-bold tracking-tight'>
          Welcome!
        </h1>
        <p className='text-muted-foreground mb-4 text-center text-base'>
          Create your account with your email and password.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='bg-card w-full space-y-4 rounded-xl border p-6 shadow-md'
        >
          <FormField
            control={form.control}
            name='firstName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input type='text' placeholder='First Name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='lastName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input type='text' placeholder='Last Name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type='email' placeholder='Email' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type='password' placeholder='Password' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && <div className='text-center text-red-500'>{error}</div>}
          <Button type='submit' className='w-full' disabled={loading}>
            Sign Up
          </Button>
        </form>
      </Form>
      <div className='mt-4 text-center text-sm'>
        Already have an account?{' '}
        <Link
          href='/auth/sign-in'
          className='text-primary cursor-pointer underline transition hover:opacity-80'
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
