'use client';

import { useState } from 'react';

type ProfileVisibility = 'public' | 'private';

interface PrivacySettingsProps {
  userId: string;
  initialVisibility: ProfileVisibility;
}

export default function PrivacySettings({
  userId,
  initialVisibility
}: PrivacySettingsProps) {
  const [visibility, setVisibility] =
    useState<ProfileVisibility>(initialVisibility);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVisibility = e.target.value as ProfileVisibility;
    setVisibility(newVisibility);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: { visibility: newVisibility } })
      });
      const data: unknown = await res.json();
      if (
        !res.ok ||
        !(
          typeof data === 'object' &&
          data !== null &&
          'ok' in data &&
          (data as { ok?: unknown }).ok === true
        )
      ) {
        throw new Error('update failed');
      }
    } catch (_err) {
      setError('Update failed.');
    }
    setLoading(false);
  };

  return (
    <div className='max-w-md rounded-md border p-4'>
      <h2 className='mb-2 text-lg font-semibold'>Privacy Settings</h2>
      <div className='mb-2 flex gap-4'>
        <label>
          <input
            type='radio'
            value='public'
            checked={visibility === 'public'}
            onChange={(e) => {
              void handleChange(e);
            }}
            disabled={loading}
          />{' '}
          Public
        </label>
        <label>
          <input
            type='radio'
            value='private'
            checked={visibility === 'private'}
            onChange={(e) => {
              void handleChange(e);
            }}
            disabled={loading}
          />{' '}
          Private
        </label>
      </div>
      {error && <div className='text-sm text-red-500'>{error}</div>}
      {loading && <div className='text-sm text-gray-500'>Kaydediliyor...</div>}
    </div>
  );
}
