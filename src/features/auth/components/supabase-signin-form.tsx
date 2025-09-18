'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

const formSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
});
type FormValues = z.infer<typeof formSchema>;

export default function SupabaseSignInForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' }
  });

  useEffect(() => {
    // Eğer kullanıcı giriş yaptıysa, dashboard'a yönlendir
    const checkSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkSession();
  }, [router]);

  const onSubmit = async (data: FormValues) => {
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password
    });
    setLoading(false);
    if (error) setError(error.message);
    else {
      // Ensure session is available and cookies are persisted before navigating
      const waitForSession = async () => {
        for (let i = 0; i < 4; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) return true;
          await new Promise((r) => setTimeout(r, 150));
        }
        return false;
      };
      const hasSession = await waitForSession();
      // Try SPA nav first, then hard reload to guarantee SSR sees cookies
      try {
        router.replace('/dashboard');
        router.refresh();
      } finally {
        if (!hasSession) {
          window.location.replace('/dashboard');
        }
      }
    }
  };

  return (
    <div className='mx-auto flex w-full max-w-md flex-col items-center justify-center'>
      <div className='mb-6 flex w-full flex-col items-center'>
        <h1 className='mb-2 text-center text-3xl font-bold tracking-tight'>
          Welcome back!
        </h1>
        <p className='text-muted-foreground mb-4 text-center text-base'>
          Sign in to your account with your email and password.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='bg-card w-full space-y-4 rounded-xl border p-6 shadow-md'
        >
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
            Sign In
          </Button>
        </form>
      </Form>
      <div className='mt-3 text-center text-sm'>
        <Link
          href='/auth/forgot-password'
          className='text-muted-foreground hover:text-foreground underline underline-offset-4'
        >
          Forgot password?
        </Link>
      </div>
      <div className='mt-3 text-center text-sm'>
        Don&apos;t have an account?{' '}
        <Link
          href='/auth/sign-up'
          className='text-primary cursor-pointer underline transition hover:opacity-80'
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
