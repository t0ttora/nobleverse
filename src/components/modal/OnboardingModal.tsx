'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { supabase } from '@/lib/supabaseClient';
import {
  LocationPicker,
  formatLocation
} from '@/components/onboarding/LocationPicker';
import Confetti from '@/components/onboarding/Confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from '@/components/icons';
import PixelBlast from '@/components/PixelBlast';
import type { Profile } from '@/types/profile';

type TeamSize = 'solo' | 'small' | 'medium' | 'large' | 'enterprise';

interface Details {
  team_size?: TeamSize;
  display_name?: string;
}

interface FormState {
  display_name: string;
  username: string;
  role: string;
  company_name: string;
  website: string;
  location: string;
  phone: string;
  email: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  details: Details;
}

const ROLES = [
  { value: 'shipper', label: 'Shipper' },
  { value: 'forwarder', label: 'Forwarder' },
  { value: 'carrier', label: 'Carrier' },
  { value: 'broker', label: 'Broker' },
  { value: 'other', label: 'Receiver' } // UI label Receiver, stored as other
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  shipper: 'Create and manage shipments.',
  forwarder: 'Coordinate logistics across carriers.',
  carrier: 'Transport and deliver freight.',
  broker: 'Match shippers with carriers.',
  other: 'Receive and manage shipments.'
};

const TEAM_SIZES: { key: TeamSize; label: string }[] = [
  { key: 'solo', label: 'Solo / Freelancer' },
  { key: 'small', label: 'Small (1–10)' },
  { key: 'medium', label: 'Medium (11–50)' },
  { key: 'large', label: 'Large (51–250)' },
  { key: 'enterprise', label: 'Enterprise (250+)' }
];

const initialForm: FormState = {
  display_name: '',
  username: '',
  role: '',
  company_name: '',
  website: '',
  location: '',
  phone: '',
  email: '',
  bio: '',
  avatar_url: '',
  banner_url: '',
  details: {}
};

export default function OnboardingModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState(1); // 1..5
  const totalSteps = 5;
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ country: string; city: string }>({
    country: '',
    city: ''
  });
  const [firstName, setFirstName] = useState('');
  const savingRef = useRef(false);
  const [usernameState, setUsernameState] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailLocal = useMemo(() => {
    const e = (profile as Profile | Partial<Profile> | undefined)?.email;
    if (!e) return '';
    const [local] = e.split('@');
    return local ?? '';
  }, [profile]);
  // first name from auth metadata (like user-nav)
  // Fallbacks to email local part if not present
  const authFirstName = firstName;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const run = async () => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const normalized = {
          ...(data ?? {}),
          username:
            ((data as Record<string, unknown>)?.username as
              | string
              | undefined) ?? '',
          display_name:
            ((data as Record<string, unknown>)?.display_name as
              | string
              | undefined) ?? '',
          company_name:
            ((data as Record<string, unknown>)?.company_name as
              | string
              | undefined) ?? '',
          website:
            ((data as Record<string, unknown>)?.website as
              | string
              | undefined) ?? '',
          location:
            ((data as Record<string, unknown>)?.location as
              | string
              | undefined) ?? '',
          phone:
            ((data as Record<string, unknown>)?.phone as string | undefined) ??
            '',
          email: user.email ?? '',
          bio:
            ((data as Record<string, unknown>)?.bio as string | undefined) ??
            '',
          avatar_url:
            ((data as Record<string, unknown>)?.avatar_url as
              | string
              | undefined) ?? '',
          banner_url:
            ((data as Record<string, unknown>)?.banner_url as
              | string
              | undefined) ?? '',
          details:
            ((data as Record<string, unknown>)?.details as
              | Details
              | undefined) ?? {}
        } as FormState;

        if (!cancelled) {
          setProfile({
            id: user.id,
            email: user.email ?? undefined,
            username: normalized.username
          });
          const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
          const fn =
            (meta.first_name as string | undefined) ??
            (meta.given_name as string | undefined) ??
            (typeof meta.name === 'string'
              ? meta.name.split(' ')[0]
              : (user.email?.split('@')[0] ?? ''));
          setFirstName(fn || '');
          const [country, city] = (normalized.location ?? '')
            .split(',')
            .map((s: string) => s.trim());
          setLoc({ country: country || '', city: city || '' });
          setForm((f) => ({ ...f, ...normalized }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const slugify = (raw: string) =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$|\.$/g, '');

  const checkUsername = async (u: string) => {
    try {
      const res = await fetch(
        `/api/profile/check-username?u=${encodeURIComponent(u)}`
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { available?: boolean };
      return (
        Boolean(data?.available) ||
        u === (profile as Profile | Partial<Profile> | undefined)?.username
      );
    } catch {
      return false;
    }
  };

  // Live username probe with debounce
  useEffect(() => {
    if (step !== 2) return;
    const candidate = slugify(form.username || '') || emailLocal;
    if (!candidate) {
      setUsernameState('idle');
      return;
    }
    setUsernameState('checking');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      const ok = await checkUsername(candidate);
      setUsernameState(ok ? 'available' : 'taken');
    }, 350);
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [form.username, emailLocal, step]);

  const handleNext = async () => {
    setError(null);
    // per-step validation
    if (step === 1) {
      if (!form.role) return setError('Please select a role.');
    }
    if (step === 2) {
      const nobleId = slugify(
        (form.username?.trim() ?? emailLocal).toLowerCase()
      );
      if (!nobleId) return setError('Please choose your NobleID.');
      const ok = await checkUsername(nobleId);
      if (!ok) return setError('This NobleID is already taken.');
      setForm((f) => ({ ...f, username: nobleId }));
    }
    if (step === 3) {
      if (!(form.location ?? '').trim())
        return setError('Please select your city and country.');
    }
    if (step === 4) {
      if (!form.details?.team_size)
        return setError('Please choose your team size.');
      if (
        form.details.team_size !== 'solo' &&
        !(form.company_name ?? '').trim()
      ) {
        return setError('Please enter your company name.');
      }
      // Save profile as we leave step 4
      try {
        if (!savingRef.current) {
          savingRef.current = true;
          await saveProfile();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save profile';
        setError(msg);
        savingRef.current = false;
        return;
      }
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const saveProfile = async () => {
    const payload = {
      id: (profile as Profile | Partial<Profile> | undefined)?.id,
      username: form.username?.trim().toLowerCase(),
      role: form.role,
      location: form.location,
      company_name: form.company_name,
      website: form.website,
      phone: form.phone,
      bio: form.bio,
      avatar_url: form.avatar_url,
      banner_url: form.banner_url,
      details: {
        ...(form.details ?? {}),
        display_name: form.display_name || undefined
      }
    };
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Failed to save profile');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await saveProfile();
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Profile could not be saved.';
      setError(msg);
    }
  };

  if (!isOpen) return null;
  if (loading) return null;

  const stepTitle =
    step === 1
      ? `Hey ${authFirstName}, what brings you here?`
      : step === 2
        ? 'Choose your NobleID'
        : step === 3
          ? 'Your location'
          : step === 4
            ? 'Team size & company'
            : 'All set';
  const stepDescription =
    step === 1
      ? 'Pick the role that best describes your day-to-day.'
      : step === 2
        ? 'This is your unique handle in NobleVerse. Letters, numbers, dots and dashes.'
        : step === 3
          ? 'We’ll use this to personalize content and availability.'
          : step === 4
            ? 'Choose your team size. If not solo, add your company name.'
            : "You're ready to go.";

  // PixelBlast density fixed to 2.0
  const pixelBlastDensity = 2;

  return (
    <Modal
      title={stepTitle}
      description={stepDescription}
      contentClassName='sm:max-w-[960px] w-[95vw] p-0 rounded-lg'
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      preventClose
    >
      <form
        onSubmit={handleSubmit}
        className='text-gray-900 dark:text-gray-100'
      >
        <div
          className={`grid grid-cols-1 ${step === 5 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} h-[680px] max-h-[85vh] grid-rows-[1fr_auto]`}
        >
          <div className='flex min-h-0 px-6 py-6 sm:px-8 sm:py-8'>
            <div className='mx-auto flex min-h-0 w-full max-w-[540px] flex-col'>
              {/* textual header inside content */}
              {step !== 5 && (
                <div className='mb-4'>
                  <h2 className='text-2xl font-semibold tracking-tight'>
                    {stepTitle}
                  </h2>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {stepDescription}
                  </p>
                </div>
              )}
              <div className='relative min-h-0 flex-1 overflow-visible pr-2 pb-2'>
                <AnimatePresence mode='wait' initial={false}>
                  {step === 1 && (
                    <motion.div
                      key='step1'
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='flex flex-col'
                    >
                      <div
                        role='radiogroup'
                        aria-label='Select your role'
                        className='mt-2 flex flex-col gap-3 sm:gap-4'
                      >
                        {ROLES.map((role) => {
                          const selected = form.role === role.value;
                          const RoleIcon =
                            role.value === 'shipper'
                              ? Icons.courier
                              : role.value === 'forwarder'
                                ? Icons.road
                                : role.value === 'carrier'
                                  ? Icons.courier
                                  : role.value === 'broker'
                                    ? Icons.addressBook
                                    : Icons.user;
                          return (
                            <button
                              type='button'
                              key={role.value}
                              onClick={() =>
                                setForm((f) => ({ ...f, role: role.value }))
                              }
                              role='radio'
                              aria-checked={selected}
                              className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-150 ${
                                selected
                                  ? 'border-2 border-orange-600 bg-orange-50 dark:bg-orange-900/30'
                                  : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                              }`}
                            >
                              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400'>
                                <RoleIcon size={20} />
                              </div>
                              <div className='flex flex-col'>
                                <span className='font-semibold'>
                                  {role.label}
                                </span>
                                <span className='text-muted-foreground text-xs'>
                                  {ROLE_DESCRIPTIONS[role.value]}
                                </span>
                              </div>
                              {/* Removed check badge and right-side indicator per request */}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key='step2'
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='flex h-full flex-col'
                    >
                      <div className='mt-2'>
                        <label className='mb-2 block text-sm font-medium'>
                          NobleID
                        </label>
                        <div className='relative'>
                          <div className='flex items-stretch rounded-xl border bg-white focus-within:ring-2 focus-within:ring-orange-500 dark:border-zinc-700 dark:bg-zinc-900'>
                            <span className='px-3 py-3 text-zinc-500 select-none'>
                              @
                            </span>
                            <input
                              name='username'
                              value={form.username ?? ''}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  username: slugify(e.target.value || '')
                                }))
                              }
                              placeholder={emailLocal}
                              autoComplete='off'
                              className='w-full bg-transparent px-0 py-3 pr-10 focus:outline-none'
                            />
                            <div className='pointer-events-none absolute top-1/2 right-3 -translate-y-1/2'>
                              {usernameState === 'checking' && (
                                <Icons.spinner
                                  className='animate-spin text-zinc-400'
                                  size={18}
                                />
                              )}
                              {usernameState === 'available' && (
                                <Icons.check
                                  className='text-green-600'
                                  size={18}
                                />
                              )}
                              {usernameState === 'taken' && (
                                <Icons.warning
                                  className='text-red-600'
                                  size={18}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <p className='mt-2 text-xs text-zinc-600 dark:text-zinc-400'>
                          Tip: Keep it short and memorable. Allowed: letters,
                          numbers, dot, dash, underscore.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key='step3'
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='flex h-full flex-col'
                    >
                      <div className='mt-2 space-y-2'>
                        <LocationPicker
                          value={loc}
                          onChange={(v) => {
                            setLoc(v);
                            setForm((f) => ({
                              ...f,
                              location: formatLocation(v)
                            }));
                          }}
                        />
                        <div className='text-muted-foreground text-xs'>
                          Location (Country, City)
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key='step4'
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='flex h-full flex-col'
                    >
                      <div
                        role='radiogroup'
                        aria-label='Select your team size'
                        className='grid grid-cols-1 gap-3 sm:grid-cols-2'
                      >
                        {TEAM_SIZES.map((opt) => {
                          const selected = form.details?.team_size === opt.key;
                          return (
                            <button
                              type='button'
                              key={opt.key}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  details: {
                                    ...(f.details || {}),
                                    team_size: opt.key
                                  }
                                }))
                              }
                              role='radio'
                              aria-checked={selected}
                              className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                                selected
                                  ? 'border-2 border-orange-600 bg-orange-50 dark:bg-orange-900/30'
                                  : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                              }`}
                            >
                              <span className='font-medium'>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {form.details?.team_size &&
                        form.details.team_size !== 'solo' && (
                          <div className='mt-auto pt-3'>
                            <div className='mb-2 inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                              Don’t worry, we made room for team invitations
                              too.
                            </div>
                            <input
                              name='company_name'
                              value={form.company_name ?? ''}
                              onChange={handleChange}
                              placeholder='Company name'
                              className='w-full rounded-xl border bg-white px-3 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
                            />
                          </div>
                        )}
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key='step5'
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className='flex h-full flex-col items-center justify-center'
                    >
                      <Confetti />
                      <div className='mb-3'>
                        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-orange-100'>
                          <svg
                            width='28'
                            height='28'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='text-orange-600'
                          >
                            <path d='M20 6L9 17l-5-5' />
                          </svg>
                        </div>
                      </div>
                      <div className='text-2xl font-semibold'>
                        You’re all set!
                      </div>
                      <div className='text-muted-foreground mt-2 text-center'>
                        Your onboarding is complete. NobleVerse adventure starts
                        now!
                      </div>
                      {/* Actions moved to footer */}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          {step !== 5 && (
            <div className='row-span-2 hidden h-full rounded-l pt-5 pr-5 pb-5 pl-0 sm:block'>
              <div className='relative h-full w-full overflow-hidden rounded-none'>
                <PixelBlast
                  variant='square'
                  pixelSize={7}
                  color='#ff5a26'
                  patternScale={90}
                  patternDensity={pixelBlastDensity}
                  pixelSizeJitter={5}
                  enableRipples={true}
                  rippleSpeed={0.4}
                  rippleThickness={0.12}
                  rippleIntensityScale={1.5}
                  speed={0.6}
                  edgeFade={0}
                  transparent
                />
              </div>
            </div>
          )}
          {/* Footer: Centered Finish on step 5; otherwise Back • Stepper • Continue */}
          <div
            className={`flex items-center px-8 pb-4 ${step === 5 ? 'justify-end' : 'justify-between'} col-start-1 row-start-2 gap-4`}
          >
            {step !== 5 && (
              <button
                type='button'
                onClick={() => {
                  handleBack();
                }}
                disabled={step === 1}
                className='rounded-md bg-zinc-100 px-4 py-2 text-zinc-800 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              >
                Back
              </button>
            )}

            {step !== 5 && (
              <div className='flex flex-1 items-center justify-center'>
                <div className='flex items-center gap-2'>
                  {Array.from({ length: totalSteps }).map((_, i) => {
                    const idx = i + 1;
                    const active = idx === step;
                    const completed = idx < step;
                    return (
                      <span
                        key={idx}
                        className={[
                          'h-2 w-2 rounded-full',
                          active
                            ? 'bg-orange-600'
                            : completed
                              ? 'bg-orange-600'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                        ].join(' ')}
                        aria-label={`Step ${idx}${active ? ' (current)' : completed ? ' (completed)' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {step < 5 ? (
              <button
                type='button'
                onClick={() => {
                  void handleNext();
                }}
                className='rounded-md bg-orange-600 px-4 py-2 text-white hover:bg-orange-700'
              >
                Continue
              </button>
            ) : (
              <button
                type='button'
                onClick={() => {
                  onClose();
                  void router.push('/dashboard');
                }}
                className='rounded-md bg-orange-600 px-4 py-2 text-white hover:bg-orange-700'
              >
                Finish
              </button>
            )}
          </div>
        </div>
        {error && <div className='px-8 pb-4 text-sm text-red-500'>{error}</div>}
      </form>
    </Modal>
  );
}
