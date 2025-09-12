'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  FileKey2,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Plug,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Users,
  Search,
  Bug
} from 'lucide-react';
import { toast } from 'sonner';

// Helpers: minimal validation utilities
const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
const validateUsername = (u: string) => /^[a-z0-9_\-]{3,20}$/i.test(u);
const validatePhone = (p: string) => /^(\+?[0-9\- ]{7,15})$/.test(p);
const SETTINGS_TABLE = 'settings'; // Supabase table name for user settings

type SectionKey =
  | 'my-details'
  | 'profile'
  | 'password'
  | 'team'
  | 'plan'
  | 'billing'
  | 'email'
  | 'notifications'
  | 'integrations'
  | 'api';

type Profile = {
  username: string;
  website: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  language: string;
  timezone: string;
  avatarUrl: string;
  verified: boolean;
};

const initialProfile: Profile = {
  username: 'olivia',
  website: 'www.nobleverse.com',
  fullName: 'Olivia Rhye',
  email: 'olivia@example.com',
  emailVerified: true,
  phone: '+1 555 0101',
  language: 'en',
  timezone: 'UTC',
  avatarUrl: '/hero.png', // sample asset in repo
  verified: true
};

type ChannelToggles = {
  email: boolean;
  push: boolean;
  sms: boolean;
};

type NotificationTypes = {
  shipments: boolean;
  messages: boolean;
  system: boolean;
};

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  primary?: boolean;
};

// Password strength (0-4)
function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong'] as const;
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-emerald-600'
  ] as const;
  return { score, label: labels[score], color: colors[score] };
}

export default function SettingsPage() {
  // Navigation & search
  const [active, setActive] = React.useState<SectionKey>('profile');
  const [topSearch, setTopSearch] = React.useState('');

  // Profile state
  const [profile, setProfile] = React.useState<Profile>(initialProfile);
  const [draft, setDraft] = React.useState<Profile>(initialProfile);
  const [avatarDialogOpen, setAvatarDialogOpen] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);

  // Avatar crop state (very small, dependency-free cropper)
  const [rawImage, setRawImage] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  // Password state
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');

  // Notifications state + saved baseline for cancel
  const initialChannels: ChannelToggles = {
    email: true,
    push: true,
    sms: false
  };
  const initialTypes: NotificationTypes = {
    shipments: true,
    messages: true,
    system: true
  };
  const [channels, setChannels] =
    React.useState<ChannelToggles>(initialChannels);
  const [notifTypes, setNotifTypes] =
    React.useState<NotificationTypes>(initialTypes);
  const [frequency, setFrequency] = React.useState<
    'realtime' | 'daily' | 'weekly'
  >('realtime');
  const [sound, setSound] = React.useState('Chime');
  const [dnd, setDnd] = React.useState({
    enabled: false,
    from: '22:00',
    to: '07:00'
  });
  type NotifSaved = {
    channels: ChannelToggles;
    types: NotificationTypes;
    frequency: 'realtime' | 'daily' | 'weekly';
    sound: string;
    dnd: { enabled: boolean; from: string; to: string };
  };
  const [savedNotif, setSavedNotif] = React.useState<NotifSaved>({
    channels: initialChannels,
    types: initialTypes,
    frequency: 'realtime',
    sound: 'Chime',
    dnd: { enabled: false, from: '22:00', to: '07:00' }
  });
  const unreadNotifications = 2; // dummy count badge

  // Billing state
  const [plan, setPlan] = React.useState<'Free' | 'Pro' | 'Business'>('Pro');
  const [methods, setMethods] = React.useState<PaymentMethod[]>([
    { id: 'pm_1', brand: 'Visa', last4: '4242', primary: true }
  ]);
  const [billingHistory, setBillingHistory] = React.useState(
    Array.from({ length: 5 }).map((_, i) => ({
      id: `inv_${1000 + i}`,
      date: new Date(Date.now() - i * 86400000 * 30).toLocaleDateString(),
      amount: '$29.00',
      status: 'Paid'
    }))
  );

  // Integrations / API state
  const [integrations, setIntegrations] = React.useState({
    google: true,
    slack: false,
    onedrive: true
  });
  const [webhooks, setWebhooks] = React.useState({
    endpoint: '',
    secret: '',
    events: ['shipment.created', 'message.new', 'system.alert'] as string[]
  });
  const [emailPrefs, setEmailPrefs] = React.useState({
    updates: false,
    weekly: false,
    security: true,
    tips: false
  });

  const [apiKeys, setApiKeys] = React.useState<
    { id: string; key: string; created: string }[]
  >([
    {
      id: 'k1',
      key: 'nv_live_************************abcd',
      created: new Date().toLocaleDateString()
    }
  ]);

  const [devMode, setDevMode] = React.useState(false);

  // Helper to persist email preferences immediately on toggle
  function setEmailPref<K extends keyof typeof emailPrefs>(
    key: K,
    value: boolean
  ) {
    setEmailPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (userId)
        supabase
          .from(SETTINGS_TABLE)
          .upsert({ user_id: userId, email_prefs: next });
      return next;
    });
  }
  const [logs, setLogs] = React.useState<string[]>([
    'Boot OK',
    'Connected to NobleVerse Realtime',
    'Notifications service ready'
  ]);

  // Derived validation state for profile
  const profileErrors = React.useMemo(() => {
    const e: Partial<Record<keyof Profile, string>> = {};
    if (!validateUsername(draft.username))
      e.username = 'Username must be 3-20 chars (letters, numbers, _ or -).';
    if (
      draft.website &&
      !/^([a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,})$/.test(draft.website)
    )
      e.website = 'Enter a valid domain (e.g. example.com).';
    if (!draft.fullName.trim()) e.fullName = 'Full name is required.';
    if (!validateEmail(draft.email)) e.email = 'Enter a valid email.';
    if (draft.phone && !validatePhone(draft.phone))
      e.phone = 'Enter a valid phone number.';
    return e;
  }, [draft]);
  const isProfileValid = Object.keys(profileErrors).length === 0;
  const isProfileDirty = JSON.stringify(draft) !== JSON.stringify(profile);

  // Avatar helpers
  function onAvatarFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setRawImage(String(reader.result));
    reader.readAsDataURL(file);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function applyCrop() {
    if (!rawImage) return;
    const img = new Image();
    img.onload = () => {
      // Draw to a square canvas (256x256)
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const iw = img.width;
      const ih = img.height;
      // Fit image within square considering zoom
      const scale = Math.max(size / iw, size / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (size - dw) / 2 + offset.x;
      const dy = (size - dh) / 2 + offset.y;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
      const url = canvas.toDataURL('image/png');
      setDraft((p) => ({ ...p, avatarUrl: url }));
      setAvatarDialogOpen(false);
      setRawImage(null);
    };
    img.src = rawImage;
  }

  // Save handlers per section
  function saveProfile() {
    if (!isProfileValid) return;
    setProfile(draft);
    if (userId) {
      // Persist preferences (language, timezone, maybe website copy) to settings
      const { language, timezone } = draft as any;
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, profile: { language, timezone } });
      // Persist authoritative profile fields to public.profiles
      const payload: any = {
        username: draft.username,
        display_name: draft.fullName,
        website: draft.website,
        phone: draft.phone,
        email: draft.email,
        avatar_url: draft.avatarUrl,
        updated_at: new Date().toISOString()
      };
      supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .then(({ error }) => {
          if (error) {
            toast.error('Profile save failed', { description: error.message });
          } else {
            toast.success('Profile saved', {
              description: 'Your profile has been updated.'
            });
          }
        });
    }
  }
  function cancelProfile() {
    setDraft(profile);
  }

  function savePassword() {
    // Simple demo: pretend success if current provided and new match
    if (
      currentPw &&
      newPw === confirmPw &&
      getPasswordStrength(newPw).score >= 2
    ) {
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setLogs((l) => [
        ...l,
        `Password changed (${new Date().toLocaleTimeString()})`
      ]);
      if (userId) {
        supabase
          .from(SETTINGS_TABLE)
          .upsert({
            user_id: userId,
            security: { last_password_change: new Date().toISOString() }
          })
          .then(({ error }) => {
            if (error)
              toast.error('Password update failed', {
                description: error.message
              });
            else toast.success('Password updated');
          });
      }
    }
  }
  function cancelPassword() {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  }

  function downloadInvoice(id: string) {
    const data = `Invoice ${id} for ${profile.fullName} (Plan: ${plan})`;
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function addPaymentMethod() {
    const id = `pm_${Date.now()}`;
    const last4 = String(Math.floor(Math.random() * 9000) + 1000);
    const updated = [...methods, { id, brand: 'Mastercard', last4 }];
    setMethods(updated);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, payment_methods: updated })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to add payment method', {
              description: error.message
            });
          else toast.success('Payment method added');
        });
  }
  function makePrimary(id: string) {
    const updated = methods.map((pm) => ({ ...pm, primary: pm.id === id }));
    setMethods(updated);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, payment_methods: updated })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to set primary card', {
              description: error.message
            });
          else toast.success('Primary card set');
        });
  }
  function removeMethod(id: string) {
    const updated = methods.filter((pm) => pm.id !== id);
    setMethods(updated);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, payment_methods: updated })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to remove payment method', {
              description: error.message
            });
          else toast.success('Payment method removed');
        });
  }

  function toggleIntegration(key: keyof typeof integrations) {
    const next = { ...integrations, [key]: !integrations[key] };
    setIntegrations(next);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, integrations: next })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to update integrations', {
              description: error.message
            });
          else toast.success('Integrations updated');
        });
  }
  function generateKey() {
    const id = `k_${Date.now()}`;
    const key = `nv_live_${Math.random().toString(36).slice(2, 8)}************************${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const created = { id, key, created: new Date().toLocaleDateString() };
    const updated = [created, ...apiKeys];
    setApiKeys(updated);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, api_keys: updated })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to generate API key', {
              description: error.message
            });
          else toast.success('API key generated');
        });
  }
  function revokeKey(id: string) {
    const updated = apiKeys.filter((x) => x.id !== id);
    setApiKeys(updated);
    if (userId)
      supabase
        .from(SETTINGS_TABLE)
        .upsert({ user_id: userId, api_keys: updated })
        .then(({ error }) => {
          if (error)
            toast.error('Failed to revoke API key', {
              description: error.message
            });
          else toast.success('API key revoked');
        });
  }
  function exportAccount() {
    const blob = new Blob(
      [JSON.stringify({ profile, channels, notifTypes, plan }, null, 2)],
      {
        type: 'application/json'
      }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nobleverse-account.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Sidebar items
  const items: {
    key: SectionKey;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      key: 'my-details',
      label: 'My details',
      icon: <User className='h-4 w-4' />
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: <ShieldCheck className='h-4 w-4' />
    },
    { key: 'password', label: 'Password', icon: <Lock className='h-4 w-4' /> },
    { key: 'team', label: 'Team', icon: <Users className='h-4 w-4' /> },
    { key: 'plan', label: 'Plan', icon: <SettingsIcon className='h-4 w-4' /> },
    {
      key: 'billing',
      label: 'Billing',
      icon: <CreditCard className='h-4 w-4' />
    },
    { key: 'email', label: 'Email', icon: <Globe className='h-4 w-4' /> },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: <Bell className='h-4 w-4' />,
      badge: unreadNotifications
    },
    {
      key: 'integrations',
      label: 'Integrations',
      icon: <Plug className='h-4 w-4' />
    },
    { key: 'api', label: 'API', icon: <FileKey2 className='h-4 w-4' /> }
  ];

  // Sidebar shows all items (search removed)
  const filteredItems = items;

  // Fetch current user id from Supabase
  React.useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load or initialize settings row for this user
  React.useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) return;
      if (!data) {
        await supabase.from(SETTINGS_TABLE).upsert({
          user_id: userId,
          profile: initialProfile,
          notifications: {
            channels: initialChannels,
            types: initialTypes,
            frequency: 'realtime',
            sound: 'Chime',
            dnd: { enabled: false, from: '22:00', to: '07:00' }
          },
          plan: 'Pro',
          api_keys: [],
          payment_methods: [],
          email_prefs: {
            updates: false,
            weekly: false,
            security: true,
            tips: false
          },
          dev_mode: false
        });
        return;
      }
      if (data.profile) {
        setProfile((p) => ({ ...p, ...data.profile }));
        setDraft((p) => ({ ...p, ...data.profile }));
      }
      if (data.notifications) {
        const s = data.notifications as any;
        setChannels(s.channels ?? initialChannels);
        setNotifTypes(s.types ?? initialTypes);
        setFrequency(s.frequency ?? 'realtime');
        setSound(s.sound ?? 'Chime');
        setDnd(s.dnd ?? { enabled: false, from: '22:00', to: '07:00' });
        setSavedNotif({
          channels: s.channels ?? initialChannels,
          types: s.types ?? initialTypes,
          frequency: s.frequency ?? 'realtime',
          sound: s.sound ?? 'Chime',
          dnd: s.dnd ?? { enabled: false, from: '22:00', to: '07:00' }
        });
      }
      if (data.plan) setPlan(data.plan);
      if (data.api_keys) setApiKeys(data.api_keys);
      if (data.payment_methods) setMethods(data.payment_methods);
      if (data.integrations) setIntegrations(data.integrations);
      if (data.webhooks)
        setWebhooks({
          endpoint: data.webhooks.endpoint ?? '',
          secret: data.webhooks.secret ?? '',
          events: Array.isArray(data.webhooks.events)
            ? data.webhooks.events
            : []
        });
      if (data.email_prefs) setEmailPrefs(data.email_prefs);
      if (typeof data.dev_mode === 'boolean') setDevMode(data.dev_mode);

      // Hydrate from profiles
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, display_name, website, phone, email, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      const { data: auth } = await supabase.auth.getUser();
      const authed = auth?.user;
      if (prof) {
        setProfile((p) => ({
          ...p,
          username: prof.username ?? p.username,
          fullName: prof.display_name ?? p.fullName,
          website: prof.website ?? p.website,
          phone: prof.phone ?? p.phone,
          email: prof.email ?? authed?.email ?? p.email,
          avatarUrl: prof.avatar_url ?? p.avatarUrl,
          emailVerified: Boolean((authed as any)?.email_confirmed_at)
        }));
        setDraft((p) => ({
          ...p,
          username: prof.username ?? p.username,
          fullName: prof.display_name ?? p.fullName,
          website: prof.website ?? p.website,
          phone: prof.phone ?? p.phone,
          email: prof.email ?? authed?.email ?? p.email,
          avatarUrl: prof.avatar_url ?? p.avatarUrl,
          emailVerified: Boolean((authed as any)?.email_confirmed_at)
        }));
      }
    })();
  }, [userId]);

  // Realtime subscription for settings changes for this user
  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`settings_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SETTINGS_TABLE,
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row) return;
          if (row.profile) {
            setProfile((p) => ({ ...p, ...row.profile }));
            setDraft((p) => ({ ...p, ...row.profile }));
          }
          if (row.notifications) {
            const s = row.notifications as any;
            setChannels(s.channels ?? initialChannels);
            setNotifTypes(s.types ?? initialTypes);
            setFrequency(s.frequency ?? 'realtime');
            setSound(s.sound ?? 'Chime');
            setDnd(s.dnd ?? { enabled: false, from: '22:00', to: '07:00' });
          }
          if (row.plan) setPlan(row.plan);
          if (row.api_keys) setApiKeys(row.api_keys);
          if (row.payment_methods) setMethods(row.payment_methods);
          if (row.integrations) setIntegrations(row.integrations);
          if (row.webhooks)
            setWebhooks({
              endpoint: row.webhooks.endpoint ?? '',
              secret: row.webhooks.secret ?? '',
              events: Array.isArray(row.webhooks.events)
                ? row.webhooks.events
                : []
            });
          if (row.email_prefs) setEmailPrefs(row.email_prefs);
          if (typeof row.dev_mode === 'boolean') setDevMode(row.dev_mode);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <TooltipProvider>
      <div className='flex min-h-[calc(100dvh-4rem)] gap-6 p-4 md:p-6'>
        {/* Sidebar */}
        <aside className='bg-card supports-[backdrop-filter]:bg-card/80 w-64 shrink-0 rounded-xl border p-2 shadow-sm backdrop-blur dark:border-zinc-800'>
          {/* Sidebar header removed (search) */}
          <Separator className='my-2' />
          <nav className='space-y-1'>
            {filteredItems.map((it) => (
              <button
                key={it.key}
                onClick={() => setActive(it.key)}
                className={cn(
                  'group hover:bg-muted flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                  active === it.key && 'bg-muted'
                )}
                aria-current={active === it.key ? 'page' : undefined}
              >
                <span className='flex items-center gap-2'>
                  {it.icon}
                  {it.label}
                </span>
                {typeof it.badge === 'number' && it.badge > 0 && (
                  <Badge
                    variant='secondary'
                    className='rounded-full px-2 py-0.5 text-[10px]'
                  >
                    {it.badge}
                  </Badge>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main panel */}
        <main className='flex-1 space-y-6'>
          {/* Top bar: header left, search right */}
          <div className='flex items-center justify-between gap-4'>
            <div className='min-w-0'>
              <h1 className='truncate text-xl leading-tight font-semibold'>
                Settings
              </h1>
              <p className='text-muted-foreground mt-0.5 text-sm'>
                Manage your NobleVerse account preferences.
              </p>
            </div>
            <div className='relative w-full max-w-sm'>
              <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
              <Input
                className='pl-8'
                placeholder='Search settings'
                aria-label='Search settings'
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
              />
            </div>
          </div>
          {active === 'profile' && (
            <section className='space-y-4'>
              {/* Banner */}
              <div
                aria-hidden
                className='h-44 w-full rounded-2xl bg-gradient-to-r from-indigo-500/30 via-sky-400/20 to-fuchsia-500/30 dark:from-indigo-600/20 dark:via-sky-500/10 dark:to-fuchsia-600/20'
              />

              <Card>
                <CardHeader className='flex flex-row items-center justify-between'>
                  <div>
                    <CardTitle className='text-xl'>Profile</CardTitle>
                    <CardDescription>
                      Update your photo and personal details.
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      onClick={cancelProfile}
                      disabled={!isProfileDirty}
                    >
                      Cancel
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            onClick={saveProfile}
                            disabled={!isProfileDirty || !isProfileValid}
                          >
                            Save
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Save changes</TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className='space-y-8'>
                  {/* Avatar + verified */}
                  <div className='flex items-center gap-6'>
                    <div className='relative'>
                      <Avatar className='border-background h-24 w-24 border-2 shadow-sm'>
                        <AvatarImage
                          src={draft.avatarUrl}
                          alt='Profile photo'
                        />
                        <AvatarFallback>NV</AvatarFallback>
                      </Avatar>
                      {profile.verified && (
                        <Badge
                          className='absolute -right-2 -bottom-2 gap-1'
                          variant='secondary'
                        >
                          <Check className='h-3 w-3' /> Verified
                        </Badge>
                      )}
                    </div>

                    <Dialog
                      open={avatarDialogOpen}
                      onOpenChange={setAvatarDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant='secondary' size='sm' className='gap-2'>
                          <Camera className='h-4 w-4' /> Change photo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className='sm:max-w-[600px]'>
                        <DialogHeader>
                          <DialogTitle>Upload and crop</DialogTitle>
                        </DialogHeader>
                        <div className='grid gap-4'>
                          <Input
                            type='file'
                            accept='image/*'
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onAvatarFile(f);
                            }}
                          />

                          {rawImage ? (
                            <div className='space-y-3'>
                              <div className='relative mx-auto h-64 w-64 overflow-hidden rounded-xl border bg-black/5'>
                                {/* Render the raw image as background for simple pan/zoom */}
                                <div
                                  className='absolute inset-0'
                                  style={{
                                    backgroundImage: `url(${rawImage})`,
                                    backgroundSize: `${zoom * 100}% ${zoom * 100}%`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: `calc(50% + ${offset.x}px) calc(50% + ${offset.y}px)`
                                  }}
                                />
                              </div>
                              <div className='grid grid-cols-3 gap-3'>
                                <div>
                                  <Label className='text-xs'>Zoom</Label>
                                  <Input
                                    type='range'
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(e) =>
                                      setZoom(parseFloat(e.target.value))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className='text-xs'>X offset</Label>
                                  <Input
                                    type='range'
                                    min={-100}
                                    max={100}
                                    step={1}
                                    value={offset.x}
                                    onChange={(e) =>
                                      setOffset((o) => ({
                                        ...o,
                                        x: parseInt(e.target.value)
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className='text-xs'>Y offset</Label>
                                  <Input
                                    type='range'
                                    min={-100}
                                    max={100}
                                    step={1}
                                    value={offset.y}
                                    onChange={(e) =>
                                      setOffset((o) => ({
                                        ...o,
                                        y: parseInt(e.target.value)
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className='text-muted-foreground flex items-center gap-3 rounded-md border border-dashed p-6 text-sm'>
                              <ImageIcon className='h-4 w-4' /> Choose an image
                              to start cropping
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button
                            variant='ghost'
                            onClick={() => setAvatarDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={applyCrop} disabled={!rawImage}>
                            Apply
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Form */}
                  <div className='grid gap-6 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label>Username</Label>
                      <div className='flex'>
                        <span className='text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm'>
                          nobleverse.com/
                        </span>
                        <Input
                          value={draft.username}
                          onChange={(e) =>
                            setDraft({ ...draft, username: e.target.value })
                          }
                          aria-invalid={!!profileErrors.username}
                          className='rounded-l-none'
                        />
                      </div>
                      {profileErrors.username && (
                        <p role='alert' className='text-destructive text-xs'>
                          {profileErrors.username}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label>Website</Label>
                      <div className='flex'>
                        <span className='text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm'>
                          http://
                        </span>
                        <Input
                          value={draft.website}
                          onChange={(e) =>
                            setDraft({ ...draft, website: e.target.value })
                          }
                          aria-invalid={!!profileErrors.website}
                          className='rounded-l-none'
                        />
                      </div>
                      {profileErrors.website && (
                        <p role='alert' className='text-destructive text-xs'>
                          {profileErrors.website}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label>Full name</Label>
                      <Input
                        value={draft.fullName}
                        onChange={(e) =>
                          setDraft({ ...draft, fullName: e.target.value })
                        }
                        aria-invalid={!!profileErrors.fullName}
                      />
                      {profileErrors.fullName && (
                        <p role='alert' className='text-destructive text-xs'>
                          {profileErrors.fullName}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label>Email</Label>
                      <div className='flex items-center gap-2'>
                        <Input
                          type='email'
                          value={draft.email}
                          onChange={(e) =>
                            setDraft({ ...draft, email: e.target.value })
                          }
                          aria-invalid={!!profileErrors.email}
                        />
                        <Badge
                          variant={
                            draft.emailVerified ? 'secondary' : 'destructive'
                          }
                        >
                          {draft.emailVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                      {profileErrors.email && (
                        <p role='alert' className='text-destructive text-xs'>
                          {profileErrors.email}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label>Phone</Label>
                      <Input
                        value={draft.phone}
                        onChange={(e) =>
                          setDraft({ ...draft, phone: e.target.value })
                        }
                        aria-invalid={!!profileErrors.phone}
                      />
                      {profileErrors.phone && (
                        <p role='alert' className='text-destructive text-xs'>
                          {profileErrors.phone}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label>Language</Label>
                      <Select
                        value={draft.language}
                        onValueChange={(v) =>
                          setDraft({ ...draft, language: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select language' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='en'>English</SelectItem>
                          <SelectItem value='es'>Spanish</SelectItem>
                          <SelectItem value='fr'>French</SelectItem>
                          <SelectItem value='de'>German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-2'>
                      <Label>Timezone</Label>
                      <Select
                        value={draft.timezone}
                        onValueChange={(v) =>
                          setDraft({ ...draft, timezone: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select timezone' />
                        </SelectTrigger>
                        <SelectContent className='max-h-64'>
                          {[
                            'UTC',
                            'America/New_York',
                            'America/Los_Angeles',
                            'Europe/London',
                            'Europe/Berlin',
                            'Asia/Istanbul',
                            'Asia/Tokyo'
                          ].map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'password' && (
            <section>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between'>
                  <div>
                    <CardTitle className='text-xl'>Change password</CardTitle>
                    <CardDescription>
                      Use a strong password you don’t use elsewhere.
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button variant='ghost' onClick={cancelPassword}>
                      Cancel
                    </Button>
                    <Button
                      onClick={savePassword}
                      disabled={
                        !currentPw ||
                        newPw !== confirmPw ||
                        getPasswordStrength(newPw).score < 2
                      }
                    >
                      Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className='grid gap-6 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label>Current password</Label>
                    <Input
                      type='password'
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>New password</Label>
                    <Input
                      type='password'
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                    />
                    <PasswordMeter value={newPw} />
                  </div>
                  <div className='space-y-2'>
                    <Label>Confirm new password</Label>
                    <Input
                      type='password'
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                    />
                    {newPw && confirmPw && newPw !== confirmPw && (
                      <p role='alert' className='text-destructive text-xs'>
                        Passwords do not match.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'notifications' && (
            <section className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Notifications</CardTitle>
                  <CardDescription>
                    Choose how and when you want to be notified.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div>
                    <h4 className='mb-3 text-sm font-medium'>Channels</h4>
                    <div className='grid gap-4 md:grid-cols-3'>
                      {(
                        [
                          ['email', 'Email'],
                          ['push', 'Push'],
                          ['sms', 'SMS']
                        ] as const
                      ).map(([k, label]) => (
                        <div
                          key={k}
                          className='flex items-center justify-between rounded-md border p-3'
                        >
                          <div className='flex items-center gap-2 text-sm'>
                            {k === 'email' ? (
                              <Globe className='h-4 w-4' />
                            ) : k === 'push' ? (
                              <Bell className='h-4 w-4' />
                            ) : (
                              <PhoneIcon />
                            )}
                            {label}
                          </div>
                          <Switch
                            checked={channels[k]}
                            onCheckedChange={(v) =>
                              setChannels((c) => ({ ...c, [k]: v }))
                            }
                            aria-label={`Enable ${label} notifications`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className='mb-3 text-sm font-medium'>Types</h4>
                    <div className='grid gap-3 md:grid-cols-3'>
                      {(
                        [
                          ['shipments', 'Shipments'],
                          ['messages', 'Messages'],
                          ['system', 'System alerts']
                        ] as const
                      ).map(([k, label]) => (
                        <label
                          key={k}
                          className='flex cursor-pointer items-center justify-between rounded-md border p-3'
                        >
                          <span className='text-sm'>{label}</span>
                          <Switch
                            checked={notifTypes[k]}
                            onCheckedChange={(v) =>
                              setNotifTypes((t) => ({ ...t, [k]: v }))
                            }
                            aria-label={`Toggle ${label}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className='grid gap-6 md:grid-cols-2'>
                    <div className='space-y-3'>
                      <Label>Frequency</Label>
                      <Tabs
                        value={frequency}
                        onValueChange={(v) => setFrequency(v as any)}
                        className='w-full'
                      >
                        <TabsList className='grid w-full grid-cols-3'>
                          <TabsTrigger value='realtime'>Real-time</TabsTrigger>
                          <TabsTrigger value='daily'>Daily</TabsTrigger>
                          <TabsTrigger value='weekly'>Weekly</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className='space-y-2'>
                      <Label>Sound</Label>
                      <Select value={sound} onValueChange={setSound}>
                        <SelectTrigger>
                          <SelectValue placeholder='Select sound' />
                        </SelectTrigger>
                        <SelectContent>
                          {['Chime', 'Bleep', 'Pop', 'None'].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className='rounded-lg border p-4'>
                    <div className='mb-3 flex items-center justify-between'>
                      <div className='space-y-1'>
                        <Label>Do not disturb</Label>
                        <p className='text-muted-foreground text-xs'>
                          Silence notifications during selected hours.
                        </p>
                      </div>
                      <Switch
                        checked={dnd.enabled}
                        onCheckedChange={(v) =>
                          setDnd((d) => ({ ...d, enabled: v }))
                        }
                      />
                    </div>
                    <div className='grid gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <Label>From</Label>
                        <Input
                          type='time'
                          value={dnd.from}
                          onChange={(e) =>
                            setDnd((d) => ({ ...d, from: e.target.value }))
                          }
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label>To</Label>
                        <Input
                          type='time'
                          value={dnd.to}
                          onChange={(e) =>
                            setDnd((d) => ({ ...d, to: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className='justify-end gap-2'>
                  <Button
                    variant='secondary'
                    onClick={() => {
                      setChannels(savedNotif.channels);
                      setNotifTypes(savedNotif.types);
                      setFrequency(savedNotif.frequency);
                      setSound(savedNotif.sound);
                      setDnd(savedNotif.dnd);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setSavedNotif({
                        channels,
                        types: notifTypes,
                        frequency,
                        sound,
                        dnd
                      });
                      if (userId) {
                        supabase
                          .from(SETTINGS_TABLE)
                          .upsert({
                            user_id: userId,
                            notifications: {
                              channels,
                              types: notifTypes,
                              frequency,
                              sound,
                              dnd
                            }
                          })
                          .then(({ error }) => {
                            if (error)
                              toast.error('Notification settings failed', {
                                description: error.message
                              });
                            else toast.success('Notification settings saved');
                          });
                      }
                    }}
                  >
                    Save
                  </Button>
                </CardFooter>
              </Card>
            </section>
          )}

          {active === 'billing' && (
            <section className='space-y-6'>
              <div className='grid gap-6 md:grid-cols-2'>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-xl'>Current plan</CardTitle>
                    <CardDescription>
                      Your NobleVerse subscription
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-muted-foreground text-sm'>Plan</p>
                        <p className='text-lg font-medium'>{plan}</p>
                      </div>
                      <Badge variant='secondary'>$29 / mo</Badge>
                    </div>
                    <div className='space-y-2'>
                      <Label>Change plan</Label>
                      <Select
                        value={plan}
                        onValueChange={(v) => {
                          setPlan(v as any);
                          if (userId)
                            supabase
                              .from(SETTINGS_TABLE)
                              .upsert({ user_id: userId, plan: v })
                              .then(({ error }) => {
                                if (error)
                                  toast.error('Failed to update plan', {
                                    description: error.message
                                  });
                                else toast.success(`Plan updated to ${v}`);
                              });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select a plan' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='Free'>Free</SelectItem>
                          <SelectItem value='Pro'>Pro</SelectItem>
                          <SelectItem value='Business'>Business</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='text-xl'>Payment methods</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {methods.map((m) => (
                      <div
                        key={m.id}
                        className='flex items-center justify-between rounded-md border p-3'
                      >
                        <div className='flex items-center gap-3 text-sm'>
                          <CreditCard className='h-4 w-4' />
                          {m.brand} •••• {m.last4}{' '}
                          {m.primary && <Badge className='ml-2'>Primary</Badge>}
                        </div>
                        <div className='flex items-center gap-2'>
                          {!m.primary && (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => makePrimary(m.id)}
                            >
                              Make primary
                            </Button>
                          )}
                          <Button
                            variant='destructive'
                            size='icon'
                            onClick={() => removeMethod(m.id)}
                            aria-label='Remove method'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant='secondary'
                      className='gap-2'
                      onClick={addPaymentMethod}
                    >
                      <PlusIcon /> Add method
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Billing history</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>Your invoice history</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingHistory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.id}</TableCell>
                          <TableCell>{row.amount}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className='text-right'>
                            <Button
                              size='sm'
                              variant='outline'
                              className='gap-2'
                              onClick={() => downloadInvoice(row.id)}
                            >
                              <Download className='h-4 w-4' /> Download
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'integrations' && (
            <section className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Integrations</CardTitle>
                  <CardDescription>
                    Connect external apps to NobleVerse.
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-3'>
                  {(
                    [
                      ['google', 'Google Workspace'],
                      ['slack', 'Slack'],
                      ['onedrive', 'OneDrive']
                    ] as const
                  ).map(([k, label]) => (
                    <div
                      key={k}
                      className='flex items-center justify-between rounded-md border p-3'
                    >
                      <span className='text-sm'>{label}</span>
                      <Switch
                        checked={integrations[k]}
                        onCheckedChange={() => toggleIntegration(k)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>API keys</CardTitle>
                  <CardDescription>
                    Generate and revoke API keys.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <Button className='gap-2' onClick={generateKey}>
                    <KeyRound className='h-4 w-4' /> Generate key
                  </Button>
                  <div className='space-y-2'>
                    {apiKeys.map((k) => (
                      <div
                        key={k.id}
                        className='flex items-center justify-between rounded-md border p-3'
                      >
                        <div>
                          <div className='text-sm font-medium'>{k.key}</div>
                          <div className='text-muted-foreground text-xs'>
                            Created {k.created}
                          </div>
                        </div>
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => revokeKey(k.id)}
                          aria-label='Revoke key'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Webhooks setup */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Webhooks</CardTitle>
                  <CardDescription>
                    Notify your systems when events occur.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label>Endpoint URL</Label>
                      <Input
                        placeholder='https://example.com/webhooks'
                        aria-label='Webhook endpoint'
                        value={webhooks.endpoint}
                        onChange={(e) =>
                          setWebhooks((w) => ({
                            ...w,
                            endpoint: e.target.value
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>Secret</Label>
                      <Input
                        placeholder='Generate or paste secret'
                        aria-label='Webhook secret'
                        value={webhooks.secret}
                        onChange={(e) =>
                          setWebhooks((w) => ({ ...w, secret: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label>Events</Label>
                    <div className='grid gap-2 md:grid-cols-3'>
                      {['shipment.created', 'message.new', 'system.alert'].map(
                        (e) => {
                          const list = Array.isArray(webhooks.events)
                            ? webhooks.events
                            : [];
                          const checked = list.includes(e);
                          return (
                            <label
                              key={e}
                              className='flex items-center gap-2 text-sm'
                            >
                              <input
                                type='checkbox'
                                className='accent-foreground'
                                checked={checked}
                                onChange={() =>
                                  setWebhooks((w) => ({
                                    ...w,
                                    events: checked
                                      ? Array.isArray(w.events)
                                        ? w.events.filter((x) => x !== e)
                                        : []
                                      : [
                                          ...(Array.isArray(w.events)
                                            ? w.events
                                            : []),
                                          e
                                        ]
                                  }))
                                }
                              />
                              {e}
                            </label>
                          );
                        }
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className='justify-end gap-2'>
                  <Button
                    variant='secondary'
                    onClick={() => alert('Webhook test sent (demo)')}
                  >
                    Send test
                  </Button>
                  <Button
                    onClick={() => {
                      if (userId)
                        supabase
                          .from(SETTINGS_TABLE)
                          .upsert({ user_id: userId, webhooks })
                          .then(({ error }) => {
                            if (error)
                              toast.error('Failed to save webhooks', {
                                description: error.message
                              });
                            else toast.success('Webhooks saved');
                          });
                    }}
                  >
                    Save
                  </Button>
                </CardFooter>
              </Card>
            </section>
          )}

          {active === 'api' && (
            <section className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Developer settings</CardTitle>
                  <CardDescription>
                    Advanced tools for power users.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div className='flex items-center justify-between rounded-md border p-3'>
                    <div className='space-y-1'>
                      <Label>Developer mode</Label>
                      <p className='text-muted-foreground text-xs'>
                        Enable verbose logging and experimental features.
                      </p>
                    </div>
                    <Switch
                      checked={devMode}
                      onCheckedChange={(v) => {
                        setDevMode(v);
                        if (userId)
                          supabase
                            .from(SETTINGS_TABLE)
                            .upsert({ user_id: userId, dev_mode: v })
                            .then(({ error }) => {
                              if (error)
                                toast.error('Failed to update developer mode', {
                                  description: error.message
                                });
                              else
                                toast.success(
                                  `Developer mode ${v ? 'enabled' : 'disabled'}`
                                );
                            });
                      }}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label>Export account data</Label>
                    <Button className='gap-2' onClick={exportAccount}>
                      <Upload className='h-4 w-4' /> Export JSON
                    </Button>
                  </div>

                  <div className='space-y-2'>
                    <Label className='flex items-center gap-2'>
                      <Bug className='h-4 w-4' /> Debug log
                    </Label>
                    <Textarea
                      readOnly
                      value={logs.join('\n')}
                      className='min-h-[160px] font-mono text-xs'
                    />
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setLogs((l) => [
                            ...l,
                            `Ping ${new Date().toLocaleTimeString()}`
                          ])
                        }
                      >
                        Append log
                      </Button>
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={() => setLogs([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'plan' && (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Plan</CardTitle>
                  <CardDescription>
                    Overview of plan features (demo).
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-3 sm:grid-cols-2'>
                  <FeatureChip title='Unlimited team members' />
                  <FeatureChip title='Priority support' />
                  <FeatureChip title='Analytics' />
                  <FeatureChip title='Custom roles' />
                </CardContent>
                <CardFooter className='gap-2'>
                  <Button>Upgrade</Button>
                  <Button variant='outline'>Downgrade</Button>
                </CardFooter>
              </Card>
            </section>
          )}

          {active === 'my-details' && (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>My details</CardTitle>
                  <CardDescription>Quick account summary.</CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4 sm:grid-cols-2'>
                  <DetailRow label='Name' value={profile.fullName} />
                  <DetailRow label='Email' value={profile.email} />
                  <DetailRow label='Username' value={profile.username} />
                  <DetailRow label='Plan' value={plan} />
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'team' && (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Team</CardTitle>
                  <CardDescription>
                    Invite teammates (demo only)
                  </CardDescription>
                </CardHeader>
                <CardContent className='flex gap-2'>
                  <Input placeholder='Email address' />
                  <Button>Invite</Button>
                </CardContent>
              </Card>
            </section>
          )}

          {active === 'email' && (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className='text-xl'>Email preferences</CardTitle>
                  <CardDescription>
                    Choose what we send to your inbox.
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-3 md:grid-cols-2'>
                  <PrefToggle
                    title='Product updates'
                    checked={emailPrefs.updates}
                    onChange={(v) => setEmailPref('updates', v)}
                  />
                  <PrefToggle
                    title='Weekly summary'
                    checked={emailPrefs.weekly}
                    onChange={(v) => setEmailPref('weekly', v)}
                  />
                  <PrefToggle
                    title='Security alerts'
                    checked={emailPrefs.security}
                    onChange={(v) => setEmailPref('security', v)}
                  />
                  <PrefToggle
                    title='Tips and tricks'
                    checked={emailPrefs.tips}
                    onChange={(v) => setEmailPref('tips', v)}
                  />
                </CardContent>
              </Card>
            </section>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}

// Small reusable pieces
function PasswordMeter({ value }: { value: string }) {
  const { score, label, color } = getPasswordStrength(value);
  return (
    <div className='space-y-1'>
      <div className='flex gap-1'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn('bg-muted h-1 flex-1 rounded', i < score && color)}
          />
        ))}
      </div>
      <span className='text-muted-foreground text-xs'>Strength: {label}</span>
    </div>
  );
}

function FeatureChip({ title }: { title: string }) {
  return (
    <div className='flex items-center gap-2 rounded-md border p-3 text-sm'>
      <Check className='h-4 w-4 text-emerald-500' /> {title}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-3 text-sm'>
      <div className='text-muted-foreground'>{label}</div>
      <div className='font-medium'>{value}</div>
    </div>
  );
}

function PrefToggle({
  title,
  defaultChecked = false,
  checked,
  onChange
}: {
  title: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [localChecked, setLocalChecked] = React.useState(defaultChecked);
  const isControlled = typeof checked === 'boolean';
  const value = isControlled ? checked! : localChecked;
  const handleChange = (v: boolean) => {
    if (isControlled) {
      onChange?.(v);
    } else {
      setLocalChecked(v);
    }
  };
  return (
    <label className='flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm'>
      {title}
      <Switch checked={value} onCheckedChange={handleChange} />
    </label>
  );
}

// Minimal icons in case not present elsewhere
function PhoneIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='h-4 w-4'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden
    >
      <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.3 1.89.54 2.79a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.38-.2a2 2 0 0 1 2.11-.45c.9.24 1.83.42 2.79.54A2 2 0 0 1 22 16.92z' />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      className='h-4 w-4'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden
    >
      <path d='M12 5v14M5 12h14' />
    </svg>
  );
}
