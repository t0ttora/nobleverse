'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const formSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' })
});
type FormValues = z.infer<typeof formSchema>;

export default function SupabaseAuthForm() {
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, startTransition] = useTransition();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' }
  });

  const onSubmit = async (data: FormValues) => {
    setError('');
    setInfo('');
    startTransition(async () => {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : '';
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: mode === 'signup',
          emailRedirectTo: redirectTo
        }
      });
      if (error) setError(error.message);
      else setInfo('Check your email for the magic link!');
    });
  };

  return (
    <div className='mx-auto flex w-full max-w-md flex-col items-center justify-center'>
      <div className='mb-6 flex w-full flex-col items-center'>
        <h1 className='mb-2 text-center text-3xl font-bold tracking-tight'>
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h1>
        <p className='text-muted-foreground mb-4 text-center text-base'>
          {mode === 'signin'
            ? 'Sign in to your account.'
            : 'Create your account with email and password.'}
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
                  <Input
                    type='email'
                    placeholder='your@email.com'
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && (
            <div className='text-destructive text-center text-sm'>{error}</div>
          )}
          {info && (
            <div className='text-primary text-center text-sm'>{info}</div>
          )}
          <Button
            disabled={loading}
            className='mt-2 w-full transition-all duration-200 hover:scale-[1.03] hover:shadow-lg'
            type='submit'
          >
            {mode === 'signin' ? 'Send Magic Link' : 'Send Magic Link'}
          </Button>
        </form>
      </Form>
      <div className='mt-4 text-center text-sm'>
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button
              type='button'
              className='text-primary cursor-pointer underline transition hover:opacity-80'
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              disabled={loading}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <button
              type='button'
              className='text-primary cursor-pointer underline transition hover:opacity-80'
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              disabled={loading}
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
