'use client';
import { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
// Calls API route instead of server fn to avoid RSC boundary issues
import { toast } from 'sonner';

const schema = z.object({
  display_name: z.string().min(2).optional(),
  username: z.string().min(2).optional(),
  role: z
    .enum(['shipper', 'forwarder', 'carrier', 'broker', 'other'])
    .optional(),
  company_name: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  banner_url: z.string().url().optional().or(z.literal('')),
  details: z.any().optional()
});

type FormValues = z.infer<typeof schema>;

export default function ProfileEditForm({
  initial
}: {
  initial: Partial<FormValues> & { details?: any };
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial as any
  });

  useEffect(() => {
    Object.entries(initial || {}).forEach(([k, v]) =>
      setValue(k as any, v as any)
    );
  }, [initial, setValue]);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Unknown');
      toast.success('Profil güncellendi');
    } catch (_e) {
      toast.error('Profil güncellenemedi');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div>
          <label className='text-sm font-medium'>Display name</label>
          <Input {...register('display_name')} placeholder='ACME Corp' />
        </div>
        <div>
          <label className='text-sm font-medium'>Username</label>
          <Input {...register('username')} placeholder='acme' />
        </div>
        <div>
          <label className='text-sm font-medium'>Role</label>
          <Select onValueChange={(v) => setValue('role', v as any)}>
            <SelectTrigger>
              <SelectValue placeholder={initial.role || 'Select role'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='shipper'>Shipper</SelectItem>
              <SelectItem value='forwarder'>Forwarder</SelectItem>
              <SelectItem value='carrier'>Carrier</SelectItem>
              <SelectItem value='broker'>Broker</SelectItem>
              <SelectItem value='other'>Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className='text-sm font-medium'>Company</label>
          <Input {...register('company_name')} placeholder='Company Ltd' />
        </div>
        <div>
          <label className='text-sm font-medium'>Website</label>
          <Input {...register('website')} placeholder='https://...' />
        </div>
        <div>
          <label className='text-sm font-medium'>Location</label>
          <Input {...register('location')} placeholder='Istanbul, TR' />
        </div>
        <div>
          <label className='text-sm font-medium'>Phone</label>
          <Input {...register('phone')} placeholder='+90 ...' />
        </div>
        <div>
          <label className='text-sm font-medium'>Email</label>
          <Input {...register('email')} placeholder='user@domain.com' />
        </div>
        <div>
          <label className='text-sm font-medium'>Avatar URL</label>
          <Input {...register('avatar_url')} placeholder='https://...' />
        </div>
        <div>
          <label className='text-sm font-medium'>Banner URL</label>
          <Input {...register('banner_url')} placeholder='https://...' />
        </div>
      </div>
      <div>
        <label className='text-sm font-medium'>Bio</label>
        <Textarea {...register('bio')} placeholder='Kısa bio' />
      </div>
      <div>
        <label className='text-sm font-medium'>
          Role specific details (JSON)
        </label>
        <Textarea
          {...register('details' as any)}
          placeholder='{"fleet":120,"corridors":["TR-DE"]}'
          rows={6}
        />
        <p className='text-xs text-gray-500'>
          Örn: shipper için tipik kargo ve koridorlar; forwarder/carrier için
          servisler, kapasite, sertifikalar.
        </p>
      </div>
      <Button type='submit' disabled={isSubmitting}>
        Save
      </Button>
    </form>
  );
}
