'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  ChevronRight,
  Bell,
  Globe,
  Pencil,
  XCircle,
  User,
  Shield,
  Plug,
  Eye,
  Building2,
  Package,
  CreditCard,
  Truck,
  ArrowLeft
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProfileRole } from '@/hooks/use-profile-role';

type Tab = 'profile' | 'notifications' | 'language';
type LeftSection =
  | 'account'
  | 'privacy'
  | 'integrations'
  | 'appearance'
  | 'org'
  | 'offers'
  | 'billing'
  | 'shipping';

export default function SettingsContent({
  initialSection
}: {
  initialSection?: string;
}) {
  const { setTheme: applyTheme } = useTheme();
  const [activeTab, setActiveTab] = React.useState<Tab>('profile');
  const [left, setLeft] = React.useState<LeftSection>('account');
  const isMobile = useIsMobile();
  const [showDetail, setShowDetail] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const unsavedWarnedRef = React.useRef(false);
  const { role } = useProfileRole();

  // Initial snapshots for dirty-state tracking
  const initialProfile = React.useRef({
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: null as string | null
  });
  const initialNotifications = React.useRef({
    orders: true,
    messages: true,
    system: false
  });
  const initialLangRegion = React.useRef({
    language: 'English (US)',
    region: 'United States',
    currency: 'USD',
    timezone: 'Europe/Istanbul',
    dateFormat: 'MM/DD/YYYY'
  });
  const initialPrivacy = React.useRef({
    twoFactor: false,
    sessionTimeout: '30'
  });
  const initialIntegrations = React.useRef({
    slack: false,
    google: false,
    onedrive: false
  });
  const initialAppearance = React.useRef({
    theme: 'system',
    density: 'comfortable',
    brandColor: 'orange',
    sidebarFeature: 'Recent Changes'
  });
  const initialOrg = React.useRef({ companyName: '', companyWebsite: '' });
  const initialOffers = React.useRef({ currency: 'USD', validityDays: '14' });
  const initialBilling = React.useRef<{
    plan: 'Free' | 'Pro' | 'Business';
    methods: { id: string; brand: string; last4: string; primary?: boolean }[];
  }>({ plan: 'Pro', methods: [] });
  const initialShipping = React.useRef<{
    incoterm: 'EXW' | 'FOB' | 'CIF' | 'DAP' | 'DDP';
    carriers: string[];
  }>({ incoterm: 'DAP', carriers: [] });

  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');

  // Inline edit toggles
  const [editName, setEditName] = React.useState(false);
  const [editEmail, setEditEmail] = React.useState(false);
  const [editPhone, setEditPhone] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const [emailDraft, setEmailDraft] = React.useState('');
  const [phoneDraft, setPhoneDraft] = React.useState('');

  // Notifications minimal state
  const [notifOrders, setNotifOrders] = React.useState(true);
  const [notifMessages, setNotifMessages] = React.useState(true);
  const [notifSystem, setNotifSystem] = React.useState(false);

  // Language & Region
  const [language, setLanguage] = React.useState('English (US)');
  const [region, setRegion] = React.useState('United States');
  const [lrCurrency, setLrCurrency] = React.useState<
    'USD' | 'EUR' | 'TRY' | 'GBP'
  >('USD');
  const [timezone, setTimezone] = React.useState<string>('Europe/Istanbul');
  const [dateFormat, setDateFormat] = React.useState<
    'MM/DD/YYYY' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'YYYY-MM-DD'
  >('MM/DD/YYYY');

  const is = (s: LeftSection) => left === s;

  React.useEffect(() => {
    if (initialSection === 'notifications') {
      setLeft('account');
      setActiveTab('notifications');
    } else if (initialSection && initialSection.includes('language')) {
      setLeft('account');
      setActiveTab('language');
    } else {
      setLeft('account');
      setActiveTab('profile');
    }
  }, [initialSection]);

  React.useEffect(() => {
    if (!isMobile) setShowDetail(true);
    else setShowDetail(false);
  }, [isMobile]);

  React.useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    (async () => {
      // auth.users prefill
      const { data: authData } = await supabase.auth.getUser();
      const u = authData.user;
      const authFullName = (u?.user_metadata?.full_name ||
        u?.user_metadata?.name ||
        '') as string;
      const authEmail = (u?.email || '') as string;
      const authPhone = (u?.phone || '') as string;

      // Profiles prefill and merge
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, email, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      const f = (authFullName ||
        (prof?.display_name as string) ||
        '') as string;
      const e = (authEmail || (prof?.email as string) || '') as string;
      const ph = (authPhone || (prof?.phone as string) || '') as string;
      const a = prof?.avatar_url ?? null;
      setFullName(f);
      setEmail(e);
      setPhone(ph);
      setAvatarUrl(a);
      initialProfile.current = {
        fullName: f,
        email: e,
        phone: ph,
        avatarUrl: a
      };

      const { data: st } = await supabase
        .from('settings')
        .select(
          'notifications, profile, integrations, ui, security, plan, payment_methods, shipping, org, offers'
        )
        .eq('user_id', userId)
        .maybeSingle();
      if (st?.notifications) {
        const n = st.notifications as any;
        setNotifOrders(!!n.orders);
        setNotifMessages(!!n.messages);
        setNotifSystem(!!n.system);
        initialNotifications.current = {
          orders: !!n.orders,
          messages: !!n.messages,
          system: !!n.system
        };
      }
      if (st?.profile) {
        const p = st.profile as any;
        if (p.language) setLanguage(p.language);
        if (p.region) setRegion(p.region);
        if (p.currency) setLrCurrency(p.currency);
        if (p.timezone) setTimezone(p.timezone);
        if (p.date_format) setDateFormat(p.date_format);
        initialLangRegion.current = {
          language: p.language ?? 'English (US)',
          region: p.region ?? 'United States',
          currency: p.currency ?? 'USD',
          timezone: p.timezone ?? 'Europe/Istanbul',
          dateFormat: p.date_format ?? 'MM/DD/YYYY'
        } as any;
      }
      // Prefill integrations
      if (st?.integrations) {
        const i = st.integrations as any;
        setIntSlack(!!i.slack);
        setIntGoogle(!!i.google);
        setIntOneDrive(!!i.onedrive);
        initialIntegrations.current = {
          slack: !!i.slack,
          google: !!i.google,
          onedrive: !!i.onedrive
        };
      }
      // Prefill UI
      if (st?.ui) {
        const u = st.ui as any;
        const t = (u.theme as any) || 'system';
        setAppearanceTheme(t);
        try {
          applyTheme(t);
        } catch {}
        const d = (u.density as any) || 'comfortable';
        setDensity(d);
        const bc = (u.brand_color as any) || 'orange';
        setBrandColor(bc);
        const sf = (u.sidebar_feature as any) || 'Recent Changes';
        setSidebarFeature(sf);
        try {
          const root = document.documentElement;
          if (d === 'compact') root.classList.add('density-compact');
          else root.classList.remove('density-compact');
        } catch {}
        initialAppearance.current = {
          theme: (u.theme as any) || 'system',
          density: (u.density as any) || 'comfortable',
          brandColor: bc,
          sidebarFeature: sf
        } as any;
      }
      // Prefill security
      if (st?.security) {
        const s = st.security as any;
        setTwoFactor(!!s.two_factor);
        setSessionTimeout(String(s.session_timeout_minutes ?? '30'));
        initialPrivacy.current = {
          twoFactor: !!s.two_factor,
          sessionTimeout: String(s.session_timeout_minutes ?? '30')
        };
      }
      // Prefill billing
      if (st?.plan) setPlan(st.plan as any);
      if (st?.payment_methods && Array.isArray(st.payment_methods))
        setMethods(st.payment_methods as any);
      initialBilling.current = {
        plan: (st?.plan as any) ?? 'Pro',
        methods: (st?.payment_methods as any) ?? []
      };
      // Prefill shipping
      if (st?.shipping) {
        const sh = st.shipping as any;
        setIncoterm((sh.incoterm as any) || 'DAP');
        setCarriers(
          Array.isArray(sh.carriers) ? (sh.carriers as string[]) : []
        );
        initialShipping.current = {
          incoterm: (sh.incoterm as any) || 'DAP',
          carriers: Array.isArray(sh.carriers) ? (sh.carriers as string[]) : []
        } as any;
      }
      // Prefill organization
      if (st?.org) {
        const o = st.org as any;
        setCompanyName(o.company_name ?? '');
        setCompanyWebsite(o.website ?? '');
        initialOrg.current = {
          companyName: o.company_name ?? '',
          companyWebsite: o.website ?? ''
        };
      }
      // Prefill offers
      if (st?.offers) {
        const of = st.offers as any;
        setCurrency(of.currency ?? 'USD');
        setValidityDays(String(of.validity_days ?? '14'));
        initialOffers.current = {
          currency: of.currency ?? 'USD',
          validityDays: String(of.validity_days ?? '14')
        } as any;
      }
    })();
  }, [userId]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const saveProfile = async () => {
    if (!userId) return;
    if (!emailRegex.test(email)) {
      toast.error('Invalid email format');
      return;
    }
    setLoading(true);
    try {
      // Update profile table
      await supabase
        .from('profiles')
        .update({ display_name: fullName, email, phone, avatar_url: avatarUrl })
        .eq('id', userId);
      // Update auth user metadata for display name
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName, name: fullName }
        } as any);
      } catch {
        /* ignore metadata update failure */
      }
      await supabase
        .from('settings')
        .upsert({
          user_id: userId,
          profile: { language, region, full_name: fullName, email, phone }
        });
      toast.success('Saved');
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        notifications: {
          orders: notifOrders,
          messages: notifMessages,
          system: notifSystem
        }
      });
    initialNotifications.current = {
      orders: notifOrders,
      messages: notifMessages,
      system: notifSystem
    };
    toast.success('Notifications updated');
  };

  const saveLanguage = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        profile: {
          language,
          region,
          currency: lrCurrency,
          timezone,
          date_format: dateFormat
        }
      });
    initialLangRegion.current = {
      language,
      region,
      currency: lrCurrency,
      timezone,
      dateFormat
    } as any;
    toast.success('Language & Region saved');
  };

  // Privacy & Security
  const [twoFactor, setTwoFactor] = React.useState(false);
  const [sessionTimeout, setSessionTimeout] = React.useState('30');
  const savePrivacy = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        security: {
          two_factor: twoFactor,
          session_timeout_minutes: Number(sessionTimeout)
        }
      });
    initialPrivacy.current = { twoFactor, sessionTimeout };
    toast.success('Privacy & Security saved');
  };

  // Integrations
  const [intSlack, setIntSlack] = React.useState(false);
  const [intGoogle, setIntGoogle] = React.useState(false);
  const [intOneDrive, setIntOneDrive] = React.useState(false);
  const saveIntegrations = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        integrations: {
          slack: intSlack,
          google: intGoogle,
          onedrive: intOneDrive
        }
      });
    initialIntegrations.current = {
      slack: intSlack,
      google: intGoogle,
      onedrive: intOneDrive
    };
    toast.success('Integrations saved');
  };

  // Appearance
  const [appearanceTheme, setAppearanceTheme] = React.useState<
    'light' | 'dark' | 'system'
  >('system');
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>(
    'comfortable'
  );
  const [brandColor, setBrandColor] = React.useState<string>('orange');
  const [sidebarFeature, setSidebarFeature] =
    React.useState<string>('Recent Changes');
  const saveAppearance = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        ui: {
          theme: appearanceTheme,
          density,
          brand_color: brandColor,
          sidebar_feature: sidebarFeature
        }
      });
    initialAppearance.current = {
      theme: appearanceTheme,
      density,
      brandColor,
      sidebarFeature
    } as any;
    try {
      applyTheme(appearanceTheme);
    } catch {}
    try {
      const root = document.documentElement;
      if (density === 'compact') root.classList.add('density-compact');
      else root.classList.remove('density-compact');
    } catch {}
    toast.success('Appearance saved');
  };

  // Billing (plan + payment methods)
  const [plan, setPlan] = React.useState<'Free' | 'Pro' | 'Business'>('Pro');
  type PaymentMethod = {
    id: string;
    brand: string;
    last4: string;
    primary?: boolean;
  };
  const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
  function addMethod() {
    const id = `pm_${Date.now()}`;
    const last4 = String(Math.floor(Math.random() * 9000) + 1000);
    const updated = [...methods, { id, brand: 'Visa', last4 }];
    setMethods(updated);
  }
  function makePrimary(id: string) {
    setMethods((m) => m.map((x) => ({ ...x, primary: x.id === id })));
  }
  function removeMethod(id: string) {
    setMethods((m) => m.filter((x) => x.id !== id));
  }
  const saveBilling = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({ user_id: userId, plan, payment_methods: methods });
    initialBilling.current = { plan, methods };
    toast.success('Billing saved');
  };

  // Shipping & Delivery
  const [incoterm, setIncoterm] = React.useState<
    'EXW' | 'FOB' | 'CIF' | 'DAP' | 'DDP'
  >('DAP');
  const [carriers, setCarriers] = React.useState<string[]>([]);
  function toggleCarrier(c: string) {
    setCarriers((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }
  const saveShipping = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({ user_id: userId, shipping: { incoterm, carriers } });
    initialShipping.current = { incoterm, carriers } as any;
    toast.success('Shipping & Delivery saved');
  };

  // Organization
  const [companyName, setCompanyName] = React.useState('');
  const [companyWebsite, setCompanyWebsite] = React.useState('');
  const saveOrg = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        org: { company_name: companyName, website: companyWebsite }
      });
    initialOrg.current = { companyName, companyWebsite };
    toast.success('Organization saved');
  };

  // Offers & Products
  const [currency, setCurrency] = React.useState<'USD' | 'EUR' | 'TRY'>('USD');
  const [validityDays, setValidityDays] = React.useState('14');
  const saveOffers = async () => {
    if (!userId) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: userId,
        offers: { currency, validity_days: Number(validityDays) }
      });
    initialOffers.current = { currency, validityDays } as any;
    toast.success('Offers & Products saved');
  };

  const onTopSave = () => {
    if (left === 'account') {
      if (activeTab === 'profile') return saveProfile();
      if (activeTab === 'notifications') return saveNotifications();
      if (activeTab === 'language') return saveLanguage();
    } else if (left === 'privacy') return savePrivacy();
    else if (left === 'integrations') return saveIntegrations();
    else if (left === 'appearance') return saveAppearance();
    else if (left === 'billing') return saveBilling();
    else if (left === 'shipping') return saveShipping();
    else if (left === 'org') return saveOrg();
    else if (left === 'offers') return saveOffers();
  };

  const onTopDiscard = () => {
    // Simple reload: refetch minimal current section data
    if (!userId) return;
    if (left === 'account') {
      supabase
        .from('profiles')
        .select('display_name, email, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          const f = data?.display_name ?? '';
          const e = data?.email ?? '';
          const ph = data?.phone ?? '';
          const a = data?.avatar_url ?? null;
          setFullName(f);
          setEmail(e);
          setPhone(ph);
          setAvatarUrl(a);
          initialProfile.current = {
            fullName: f,
            email: e,
            phone: ph,
            avatarUrl: a
          };
        });
    }
    supabase
      .from('settings')
      .select(
        'notifications, profile, integrations, ui, security, plan, payment_methods, shipping, org, offers'
      )
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (left === 'account') {
          if (data.notifications) {
            const n = data.notifications as any;
            setNotifOrders(!!n.orders);
            setNotifMessages(!!n.messages);
            setNotifSystem(!!n.system);
            initialNotifications.current = {
              orders: !!n.orders,
              messages: !!n.messages,
              system: !!n.system
            };
          }
          if (data.profile) {
            const p = data.profile as any;
            if (p.language) setLanguage(p.language);
            if (p.region) setRegion(p.region);
            if (p.currency) setLrCurrency(p.currency);
            if (p.timezone) setTimezone(p.timezone);
            if (p.date_format) setDateFormat(p.date_format);
            initialLangRegion.current = {
              language: p.language ?? 'English (US)',
              region: p.region ?? 'United States',
              currency: p.currency ?? 'USD',
              timezone: p.timezone ?? 'Europe/Istanbul',
              dateFormat: p.date_format ?? 'MM/DD/YYYY'
            } as any;
          }
        } else if (left === 'integrations' && data.integrations) {
          const i = data.integrations as any;
          setIntSlack(!!i.slack);
          setIntGoogle(!!i.google);
          setIntOneDrive(!!i.onedrive);
          initialIntegrations.current = {
            slack: !!i.slack,
            google: !!i.google,
            onedrive: !!i.onedrive
          };
        } else if (left === 'appearance' && data.ui) {
          const u = data.ui as any;
          const t = (u.theme as any) || 'system';
          setAppearanceTheme(t);
          try {
            applyTheme(t);
          } catch {}
          const d = (u.density as any) || 'comfortable';
          setDensity(d);
          try {
            const root = document.documentElement;
            if (d === 'compact') root.classList.add('density-compact');
            else root.classList.remove('density-compact');
          } catch {}
          initialAppearance.current = {
            theme: (u.theme as any) || 'system',
            density: (u.density as any) || 'comfortable'
          } as any;
        } else if (left === 'privacy' && data.security) {
          const s = data.security as any;
          setTwoFactor(!!s.two_factor);
          setSessionTimeout(String(s.session_timeout_minutes ?? '30'));
          initialPrivacy.current = {
            twoFactor: !!s.two_factor,
            sessionTimeout: String(s.session_timeout_minutes ?? '30')
          };
        } else if (left === 'billing') {
          if (data.plan) setPlan(data.plan as any);
          if (data.payment_methods) setMethods(data.payment_methods as any);
          initialBilling.current = {
            plan: (data.plan as any) ?? 'Pro',
            methods: (data.payment_methods as any) ?? []
          };
        } else if (left === 'shipping' && data.shipping) {
          const sh = data.shipping as any;
          setIncoterm((sh.incoterm as any) || 'DAP');
          setCarriers(
            Array.isArray(sh.carriers) ? (sh.carriers as string[]) : []
          );
          initialShipping.current = {
            incoterm: (sh.incoterm as any) || 'DAP',
            carriers: Array.isArray(sh.carriers)
              ? (sh.carriers as string[])
              : []
          } as any;
        } else if (left === 'org' && data.org) {
          const o = data.org as any;
          setCompanyName(o.company_name ?? '');
          setCompanyWebsite(o.website ?? '');
          initialOrg.current = {
            companyName: o.company_name ?? '',
            companyWebsite: o.website ?? ''
          };
        } else if (left === 'offers' && data.offers) {
          const of = data.offers as any;
          setCurrency(of.currency ?? 'USD');
          setValidityDays(String(of.validity_days ?? '14'));
          initialOffers.current = {
            currency: of.currency ?? 'USD',
            validityDays: String(of.validity_days ?? '14')
          } as any;
        }
      });
  };

  // Derived dirty-state per section/tab
  const isDirty = React.useMemo(() => {
    if (left === 'account') {
      if (activeTab === 'profile') {
        const i = initialProfile.current;
        return (
          i.fullName !== fullName ||
          i.email !== email ||
          i.phone !== phone ||
          i.avatarUrl !== avatarUrl
        );
      }
      if (activeTab === 'notifications') {
        const i = initialNotifications.current;
        return (
          i.orders !== notifOrders ||
          i.messages !== notifMessages ||
          i.system !== notifSystem
        );
      }
      if (activeTab === 'language') {
        const i = initialLangRegion.current as any;
        return (
          i.language !== language ||
          i.region !== region ||
          i.currency !== lrCurrency ||
          i.timezone !== timezone ||
          i.dateFormat !== dateFormat
        );
      }
      return false;
    }
    if (left === 'privacy') {
      const i = initialPrivacy.current;
      return i.twoFactor !== twoFactor || i.sessionTimeout !== sessionTimeout;
    }
    if (left === 'integrations') {
      const i = initialIntegrations.current;
      return (
        i.slack !== intSlack ||
        i.google !== intGoogle ||
        i.onedrive !== intOneDrive
      );
    }
    if (left === 'appearance') {
      const i = initialAppearance.current as any;
      return (
        i.theme !== appearanceTheme ||
        i.density !== density ||
        i.brandColor !== brandColor ||
        i.sidebarFeature !== sidebarFeature
      );
    }
    if (left === 'org') {
      const i = initialOrg.current;
      return (
        i.companyName !== companyName || i.companyWebsite !== companyWebsite
      );
    }
    if (left === 'offers') {
      const i = initialOffers.current as any;
      return i.currency !== currency || i.validityDays !== validityDays;
    }
    if (left === 'billing') {
      const i = initialBilling.current;
      if (i.plan !== plan) return true;
      if (i.methods.length !== methods.length) return true;
      const a = JSON.stringify(i.methods);
      const b = JSON.stringify(methods);
      return a !== b;
    }
    if (left === 'shipping') {
      const i = initialShipping.current as any;
      if (i.incoterm !== incoterm) return true;
      const a = JSON.stringify(i.carriers);
      const b = JSON.stringify(carriers);
      return a !== b;
    }
    return false;
  }, [
    left,
    activeTab,
    fullName,
    email,
    phone,
    avatarUrl,
    notifOrders,
    notifMessages,
    notifSystem,
    language,
    region,
    lrCurrency,
    timezone,
    dateFormat,
    twoFactor,
    sessionTimeout,
    intSlack,
    intGoogle,
    intOneDrive,
    appearanceTheme,
    density,
    companyName,
    companyWebsite,
    currency,
    validityDays,
    plan,
    methods,
    incoterm,
    carriers
  ]);

  // Unsaved changes toast on first dirty transition
  React.useEffect(() => {
    if (isDirty && !unsavedWarnedRef.current) {
      toast.info('You have unsaved changes');
      unsavedWarnedRef.current = true;
    }
    if (!isDirty) unsavedWarnedRef.current = false;
  }, [isDirty]);

  return (
    <div className='flex max-h-[85vh] min-h-[560px] w-full gap-0 rounded-lg bg-white text-[13px] leading-5 dark:bg-neutral-950'>
      {/* Left nav */}
      <aside
        className={cn(
          'w-[260px] shrink-0 border-r border-neutral-200 px-3 py-4 transition-all duration-200 ease-out dark:border-neutral-800',
          isMobile && !showDetail ? 'w-full' : '',
          isMobile && showDetail ? 'hidden' : ''
        )}
      >
        <SectionLabel>PERSONAL SETTINGS</SectionLabel>
        <div
          onClick={() => {
            setLeft('account');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'account'}
            icon={<User className='h-4 w-4' />}
            label='Account Settings'
          />
        </div>
        <div
          onClick={() => {
            setLeft('privacy');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'privacy'}
            icon={<Shield className='h-4 w-4' />}
            label='Privacy & Security'
          />
        </div>
        <div
          onClick={() => {
            setLeft('integrations');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'integrations'}
            icon={<Plug className='h-4 w-4' />}
            label='Integrations'
          />
        </div>
        <div
          onClick={() => {
            setLeft('appearance');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'appearance'}
            icon={<Eye className='h-4 w-4' />}
            label='Appearance'
          />
        </div>

        <SectionLabel className='mt-6'>GENERAL SETTINGS</SectionLabel>
        <div
          onClick={() => {
            setLeft('org');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'org'}
            icon={<Building2 className='h-4 w-4' />}
            label='Store Settings'
          />
        </div>
        <div
          onClick={() => {
            setLeft('offers');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'offers'}
            icon={<Package className='h-4 w-4' />}
            label='Products Settings'
          />
        </div>
        <div
          onClick={() => {
            setLeft('billing');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'billing'}
            icon={<CreditCard className='h-4 w-4' />}
            label='Payment & Billing'
          />
        </div>
        <div
          onClick={() => {
            setLeft('shipping');
            if (isMobile) setShowDetail(true);
          }}
        >
          <NavItem
            active={left === 'shipping'}
            icon={<Truck className='h-4 w-4' />}
            label='Shipping & Delivery'
          />
        </div>
      </aside>

      {/* Right content */}
      <main
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-all duration-200 ease-out',
          isMobile && !showDetail ? 'hidden' : ''
        )}
      >
        {/* Static header */}
        <div className='px-5 pt-5'>
          {isMobile && (
            <div className='mb-2 flex items-center gap-2'>
              <Button
                variant='ghost'
                size='sm'
                className='h-8 px-2'
                onClick={() => setShowDetail(false)}
              >
                <ArrowLeft className='mr-1 h-4 w-4' /> Back
              </Button>
            </div>
          )}
          <div className='mb-4 flex items-center justify-between'>
            <div>
              <h2 className='text-[16px] font-semibold'>
                {left === 'account'
                  ? 'Account Settings'
                  : left === 'privacy'
                    ? 'Privacy & Security'
                    : left === 'integrations'
                      ? 'Integrations'
                      : left === 'appearance'
                        ? 'Appearance'
                        : left === 'org'
                          ? 'Organization Settings'
                          : left === 'offers'
                            ? 'Offers & Products'
                            : left === 'billing'
                              ? 'Payment & Billing'
                              : 'Shipping & Delivery'}
              </h2>
              <p className='text-neutral-500 dark:text-neutral-400'>
                Manage and collaborate on your {left.replace('&', 'and')}{' '}
                settings
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='h-8 rounded-md border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                onClick={onTopDiscard}
              >
                Discard
              </Button>
              <Button
                size='sm'
                className='h-8 rounded-md bg-orange-500 px-3 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-orange-500'
                onClick={onTopSave}
                disabled={!isDirty || loading}
              >
                Save Changes
              </Button>
            </div>
          </div>
          {left === 'account' && (
            <div className='mb-3 flex gap-6 border-b border-neutral-200 dark:border-neutral-800'>
              <TabBtn
                active={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
              >
                Profile
              </TabBtn>
              <TabBtn
                active={activeTab === 'notifications'}
                onClick={() => setActiveTab('notifications')}
              >
                Notifications
              </TabBtn>
              <TabBtn
                active={activeTab === 'language'}
                onClick={() => setActiveTab('language')}
              >
                Language & Region
              </TabBtn>
            </div>
          )}
        </div>
        {/* Scrollable content */}
        <ScrollArea className='flex-1 px-5 pb-5'>
          {left === 'account' && activeTab === 'profile' && (
            <div className='divide-y divide-dashed divide-neutral-200 rounded-md border border-transparent'>
              {/* Profile Photo */}
              <Row
                label='Profile Photo'
                hint='Min 400×400px, PNG or JPEG formats.'
              >
                <div className='flex items-center gap-3'>
                  <div className='relative'>
                    <Avatar className='h-10 w-10'>
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback>NV</AvatarFallback>
                    </Avatar>
                    <span className='absolute -top-1 -right-1 rounded-full bg-red-500 p-[2px] text-white'>
                      <XCircle className='h-3 w-3' />
                    </span>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-7 rounded-md border-neutral-300'
                    onClick={() =>
                      document.getElementById('profile-photo-input')?.click()
                    }
                  >
                    Change
                  </Button>
                  <input
                    id='profile-photo-input'
                    type='file'
                    accept='image/png,image/jpeg'
                    className='hidden'
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!['image/png', 'image/jpeg'].includes(f.type)) {
                        toast.error('PNG or JPEG only');
                        return;
                      }
                      const img = new Image();
                      img.onload = async () => {
                        if (img.width < 400 || img.height < 400) {
                          toast.error('Minimum 400x400 required');
                          return;
                        }
                        // Upload stub – implemented next step
                        try {
                          const fileExt = f.name.split('.').pop();
                          const filePath = `avatars/${userId}-${Date.now()}.${fileExt}`;
                          const { error } = await supabase.storage
                            .from('avatars')
                            .upload(filePath, f, {
                              upsert: true,
                              cacheControl: '3600',
                              contentType: f.type
                            });
                          if (error) throw error;
                          const { data } = supabase.storage
                            .from('avatars')
                            .getPublicUrl(filePath);
                          const url = data.publicUrl;
                          setAvatarUrl(url);
                          toast.success('Photo updated');
                        } catch (err: any) {
                          toast.error('Upload failed', {
                            description: err?.message
                          });
                        }
                      };
                      img.src = URL.createObjectURL(f);
                    }}
                  />
                </div>
              </Row>

              {/* Full Name */}
              <Row
                label='Full Name'
                hint='Your name will be visible to your contacts.'
              >
                {!editName ? (
                  <InlineValue
                    value={fullName}
                    onEdit={() => {
                      setEditName(true);
                      setNameDraft(fullName);
                    }}
                  />
                ) : (
                  <div className='flex items-center gap-2'>
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className='h-8 w-64'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8'
                      onClick={() => setEditName(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='h-8 bg-orange-500 text-white hover:bg-orange-600'
                      onClick={() => {
                        setFullName(nameDraft.trim());
                        setEditName(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </Row>

              {/* Email Address */}
              <Row
                label='Email Address'
                hint='Business email address recommended.'
              >
                {!editEmail ? (
                  <InlineValue
                    value={email}
                    onEdit={() => {
                      setEditEmail(true);
                      setEmailDraft(email);
                    }}
                  />
                ) : (
                  <div className='flex items-center gap-2'>
                    <Input
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      className='h-8 w-64'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8'
                      onClick={() => setEditEmail(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='h-8 bg-orange-500 text-white hover:bg-orange-600'
                      onClick={() => {
                        setEmail(emailDraft.trim());
                        setEditEmail(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </Row>

              {/* Phone Number */}
              <Row
                label='Phone Number'
                hint='Business phone number recommended.'
              >
                {!editPhone ? (
                  <InlineValue
                    value={phone}
                    onEdit={() => {
                      setEditPhone(true);
                      setPhoneDraft(phone);
                    }}
                  />
                ) : (
                  <div className='flex items-center gap-2'>
                    <Input
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      className='h-8 w-64'
                    />
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8'
                      onClick={() => setEditPhone(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='h-8 bg-orange-500 text-white hover:bg-orange-600'
                      onClick={() => {
                        setPhone(phoneDraft.trim());
                        setEditPhone(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </Row>
              {/* NobleID & Role (read-only) */}
              <Row label='Noble ID' hint='Your unique user identifier'>
                <div className='text-neutral-600 dark:text-neutral-300'>
                  {userId || '—'}
                </div>
              </Row>
              <Row label='Role' hint='Role-based interface customization'>
                <div className='text-neutral-600 dark:text-neutral-300'>
                  {role ?? '—'}
                </div>
              </Row>
            </div>
          )}

          {left === 'account' && activeTab === 'notifications' && (
            <div className='rounded-md border border-neutral-200 dark:border-neutral-800'>
              <div className='flex items-center justify-between border-b border-dashed p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Orders & Shipments</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Get notified when your orders update
                  </div>
                </div>
                <Switch
                  checked={notifOrders}
                  onCheckedChange={setNotifOrders}
                />
              </div>
              <div className='flex items-center justify-between border-b border-dashed p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Messages</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Receive chat and inbox messages
                  </div>
                </div>
                <Switch
                  checked={notifMessages}
                  onCheckedChange={setNotifMessages}
                />
              </div>
              <div className='flex items-center justify-between p-4'>
                <div>
                  <div className='font-medium'>System</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Product tips and announcements
                  </div>
                </div>
                <Switch
                  checked={notifSystem}
                  onCheckedChange={setNotifSystem}
                />
              </div>
            </div>
          )}

          {left === 'account' && activeTab === 'language' && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Language</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Display the app in your selected language.
                  </div>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger size='sm' className='h-8 min-w-44'>
                    <SelectValue placeholder='Language' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='English (US)'>English (US)</SelectItem>
                    <SelectItem value='English (UK)'>English (UK)</SelectItem>
                    <SelectItem value='Türkçe'>Türkçe</SelectItem>
                    <SelectItem value='Deutsch'>Deutsch</SelectItem>
                    <SelectItem value='Français'>Français</SelectItem>
                    <SelectItem value='Español'>Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Region</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Used to format dates and numbers
                  </div>
                </div>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger size='sm' className='h-8 min-w-44'>
                    <SelectValue placeholder='Region' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='United States'>United States</SelectItem>
                    <SelectItem value='United Kingdom'>
                      United Kingdom
                    </SelectItem>
                    <SelectItem value='Germany'>Germany</SelectItem>
                    <SelectItem value='Turkey'>Turkey</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Currency</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    View balances in your selected currency.
                  </div>
                </div>
                <Select
                  value={lrCurrency}
                  onValueChange={(v) => setLrCurrency(v as any)}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-44'>
                    <SelectValue placeholder='Currency' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='USD'>US Dollar (USD)</SelectItem>
                    <SelectItem value='EUR'>Euro (EUR)</SelectItem>
                    <SelectItem value='TRY'>Turkish Lira (TRY)</SelectItem>
                    <SelectItem value='GBP'>British Pound (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Timezone and Format</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Choose your timezone and preferred format.
                  </div>
                </div>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger size='sm' className='h-8 min-w-56'>
                    <SelectValue placeholder='Timezone' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Europe/Istanbul'>
                      (GMT+03:00) Istanbul
                    </SelectItem>
                    <SelectItem value='Europe/London'>
                      (GMT+01:00) London
                    </SelectItem>
                    <SelectItem value='America/New_York'>
                      (GMT-04:00) New York
                    </SelectItem>
                    <SelectItem value='America/Los_Angeles'>
                      (GMT-07:00) Los Angeles
                    </SelectItem>
                    <SelectItem value='Asia/Dubai'>
                      (GMT+04:00) Dubai
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Date Format</div>
                  <div className='text-neutral-500 dark:text-neutral-400'>
                    Choose your preferred date format.
                  </div>
                </div>
                <Select
                  value={dateFormat}
                  onValueChange={(v) => setDateFormat(v as any)}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-44'>
                    <SelectValue placeholder='Date format' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='MM/DD/YYYY'>MM/DD/YYYY</SelectItem>
                    <SelectItem value='DD/MM/YYYY'>DD/MM/YYYY</SelectItem>
                    <SelectItem value='DD.MM.YYYY'>DD.MM.YYYY</SelectItem>
                    <SelectItem value='YYYY-MM-DD'>YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {is('privacy') && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Two-factor authentication</div>
                  <div className='text-neutral-500'>
                    Extra security on sign-in
                  </div>
                </div>
                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Session timeout</div>
                  <div className='text-neutral-500'>
                    Auto sign-out after inactivity
                  </div>
                </div>
                <Select
                  value={sessionTimeout}
                  onValueChange={setSessionTimeout}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='15'>15 minutes</SelectItem>
                    <SelectItem value='30'>30 minutes</SelectItem>
                    <SelectItem value='60'>60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='font-medium'>Change Password</div>
                <ChangePasswordBlock />
              </div>
              <div className='space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='font-medium'>Active Sessions</div>
                <ActiveSessionsBlock />
              </div>
            </div>
          )}

          {is('integrations') && (
            <div className='space-y-3 rounded-md border border-neutral-200 p-2 dark:border-neutral-800'>
              <Row label='Slack'>
                <Switch checked={intSlack} onCheckedChange={setIntSlack} />
              </Row>
              <Row label='Google Drive'>
                <Switch checked={intGoogle} onCheckedChange={setIntGoogle} />
              </Row>
              <Row label='OneDrive'>
                <Switch
                  checked={intOneDrive}
                  onCheckedChange={setIntOneDrive}
                />
              </Row>
            </div>
          )}

          {is('appearance') && (
            <div className='space-y-4'>
              {/* Interface Theme */}
              <div className='rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='mb-2 font-medium'>Interface Theme</div>
                <div className='mb-1 text-neutral-500 dark:text-neutral-400'>
                  Select and customize your UI theme.
                </div>
                <RadioGroup
                  value={appearanceTheme}
                  onValueChange={(v) => {
                    setAppearanceTheme(v as any);
                    try {
                      applyTheme(v as any);
                    } catch {}
                  }}
                  className='grid grid-cols-3 gap-3 sm:max-w-[360px]'
                >
                  <label className='flex items-center gap-2'>
                    <RadioGroupItem value='light' id='theme-light' />
                    <span>Light</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <RadioGroupItem value='dark' id='theme-dark' />
                    <span>Dark</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <RadioGroupItem value='system' id='theme-system' />
                    <span>System</span>
                  </label>
                </RadioGroup>
              </div>
              {/* Brand Color */}
              <div className='rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='mb-2 font-medium'>Brand Color</div>
                <div className='mb-3 text-neutral-500 dark:text-neutral-400'>
                  Select or customize your brand color.
                </div>
                <div className='flex flex-wrap items-center gap-3'>
                  {[
                    { key: 'orange', class: 'bg-orange-500' },
                    { key: 'blue', class: 'bg-blue-500' },
                    { key: 'red', class: 'bg-red-500' },
                    { key: 'green', class: 'bg-green-500' },
                    { key: 'yellow', class: 'bg-yellow-500' },
                    { key: 'indigo', class: 'bg-indigo-500' },
                    { key: 'cyan', class: 'bg-cyan-500' },
                    { key: 'pink', class: 'bg-pink-500' },
                    { key: 'teal', class: 'bg-teal-500' }
                  ].map((c) => (
                    <button
                      key={c.key}
                      type='button'
                      onClick={() => setBrandColor(c.key)}
                      className={cn(
                        'relative size-6 rounded-full ring-2 ring-transparent transition',
                        brandColor === c.key &&
                          'ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950'
                      )}
                      style={{ backgroundColor: undefined }}
                    >
                      <span
                        className={cn('absolute inset-0 rounded-full', c.class)}
                      />
                    </button>
                  ))}
                </div>
              </div>
              {/* Sidebar Feature */}
              <div className='rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='mb-2 font-medium'>Sidebar Feature</div>
                <div className='mb-3 text-neutral-500 dark:text-neutral-400'>
                  What’s shows in the desktop sidebar.
                </div>
                <Select
                  value={sidebarFeature}
                  onValueChange={setSidebarFeature}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-48'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Recent Changes'>
                      Recent Changes
                    </SelectItem>
                    <SelectItem value='Pinned Shortcuts'>
                      Pinned Shortcuts
                    </SelectItem>
                    <SelectItem value='Usage Stats'>Usage Stats</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='mb-2 font-medium'>Density</div>
                <div className='mb-2 text-neutral-500'>
                  Control spacing and compactness
                </div>
                <RadioGroup
                  value={density}
                  onValueChange={(v) => setDensity(v as any)}
                  className='grid w-[280px] grid-cols-2 gap-3'
                >
                  <label className='flex items-center gap-2'>
                    <RadioGroupItem
                      value='comfortable'
                      id='density-comfortable'
                    />
                    <span>Comfortable</span>
                  </label>
                  <label className='flex items-center gap-2'>
                    <RadioGroupItem value='compact' id='density-compact' />
                    <span>Compact</span>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {is('org') && (
            <div className='space-y-4'>
              <Row label='Company Name'>
                <Input
                  className='h-8 w-64'
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </Row>
              <Row label='Website'>
                <Input
                  className='h-8 w-64'
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                />
              </Row>
            </div>
          )}

          {is('offers') && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Default currency</div>
                  <div className='text-neutral-500'>
                    Used in offers and pricing
                  </div>
                </div>
                <Select
                  value={currency}
                  onValueChange={(v) => setCurrency(v as any)}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='USD'>USD</SelectItem>
                    <SelectItem value='EUR'>EUR</SelectItem>
                    <SelectItem value='TRY'>TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Offer validity</div>
                  <div className='text-neutral-500'>
                    Default days your offer remains valid
                  </div>
                </div>
                <Select value={validityDays} onValueChange={setValidityDays}>
                  <SelectTrigger size='sm' className='h-8 min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='7'>7 days</SelectItem>
                    <SelectItem value='14'>14 days</SelectItem>
                    <SelectItem value='30'>30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {is('billing') && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Plan</div>
                  <div className='text-neutral-500'>Your subscription plan</div>
                </div>
                <Select value={plan} onValueChange={(v) => setPlan(v as any)}>
                  <SelectTrigger size='sm' className='h-8 min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Free'>Free</SelectItem>
                    <SelectItem value='Pro'>Pro</SelectItem>
                    <SelectItem value='Business'>Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='rounded-md border border-neutral-200 p-3 dark:border-neutral-800'>
                <div className='mb-2 text-sm font-medium'>Payment methods</div>
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className='flex items-center justify-between border-b border-dashed py-2 last:border-b-0 dark:border-neutral-800'
                  >
                    <div className='text-neutral-700 dark:text-neutral-200'>
                      {m.brand} •••• {m.last4}{' '}
                      {m.primary && (
                        <span className='ml-2 rounded bg-neutral-100 px-1 py-[1px] text-[11px] dark:bg-neutral-800 dark:text-neutral-200'>
                          Primary
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      {!m.primary && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-7'
                          onClick={() => makePrimary(m.id)}
                        >
                          Make primary
                        </Button>
                      )}
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-7'
                        onClick={() => removeMethod(m.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3 h-7'
                  onClick={addMethod}
                >
                  Add method
                </Button>
              </div>
            </div>
          )}

          {is('shipping') && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div>
                  <div className='font-medium'>Default Incoterm</div>
                  <div className='text-neutral-500'>
                    Used when creating shipments
                  </div>
                </div>
                <Select
                  value={incoterm}
                  onValueChange={(v) => setIncoterm(v as any)}
                >
                  <SelectTrigger size='sm' className='h-8 min-w-36'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='EXW'>EXW</SelectItem>
                    <SelectItem value='FOB'>FOB</SelectItem>
                    <SelectItem value='CIF'>CIF</SelectItem>
                    <SelectItem value='DAP'>DAP</SelectItem>
                    <SelectItem value='DDP'>DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='rounded-md border border-neutral-200 p-4 dark:border-neutral-800'>
                <div className='mb-2 font-medium'>Preferred carriers</div>
                <div className='flex flex-wrap gap-2'>
                  {['Maersk', 'MSC', 'CMA CGM', 'DHL', 'FedEx'].map((c) => {
                    const on = carriers.includes(c);
                    return (
                      <button
                        key={c}
                        type='button'
                        onClick={() => toggleCarrier(c)}
                        className={cn(
                          'rounded border px-2 py-1 text-xs',
                          on
                            ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                            : 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
}

function SectionLabel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-2 px-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400',
        className
      )}
    >
      {children}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900',
        active && 'bg-neutral-100 dark:bg-neutral-900'
      )}
    >
      <div className='flex items-center gap-2 text-neutral-800 dark:text-neutral-200'>
        {icon}
        <span>{label}</span>
      </div>
      <ChevronRight className='h-4 w-4 text-neutral-400 dark:text-neutral-500' />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative -mb-px px-1 pb-2 text-[13px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        active && 'text-neutral-900 dark:text-neutral-100'
      )}
    >
      {children}
      <span
        className={cn(
          'absolute top-[calc(100%-1px)] right-0 left-0 h-[2px] bg-orange-500 opacity-0 transition-opacity',
          active && 'opacity-100'
        )}
      />
    </button>
  );
}

function Row({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-[1fr_minmax(0,1fr)] items-center gap-6 border-t border-dashed px-1 py-4 first:border-t-0 dark:border-neutral-800'>
      <div>
        <div className='font-medium'>{label}</div>
        {hint && (
          <div className='text-neutral-500 dark:text-neutral-400'>{hint}</div>
        )}
      </div>
      <div className='flex justify-end'>{children}</div>
    </div>
  );
}

function InlineValue({ value, onEdit }: { value: string; onEdit: () => void }) {
  return (
    <div className='flex items-center gap-2'>
      <div className='text-[13px] text-neutral-800 dark:text-neutral-100'>
        {value}
      </div>
      <button
        className='text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300'
        onClick={onEdit}
        aria-label='Edit'
      >
        <Pencil className='h-4 w-4' />
      </button>
    </div>
  );
}

function ChangePasswordBlock() {
  const [pw1, setPw1] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const score = React.useMemo(() => {
    let s = 0;
    if (pw1.length >= 8) s += 25;
    if (/[A-Z]/.test(pw1)) s += 25;
    if (/[0-9]/.test(pw1)) s += 25;
    if (/[^A-Za-z0-9]/.test(pw1)) s += 25;
    return s;
  }, [pw1]);
  const canSave = pw1.length >= 8 && pw1 === pw2 && score >= 50;
  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-[160px_1fr] items-center gap-3'>
        <div className='text-sm'>New Password</div>
        <Input
          type='password'
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          className='h-8'
          placeholder='Enter a strong password'
        />
      </div>
      <div className='grid grid-cols-[160px_1fr] items-center gap-3'>
        <div className='text-sm'>Confirm Password</div>
        <Input
          type='password'
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className='h-8'
          placeholder='Re-enter password'
        />
      </div>
      <div className='grid grid-cols-[160px_1fr] items-center gap-3'>
        <div className='text-sm'>Strength</div>
        <div className='flex items-center gap-2'>
          <div className='w-64'>
            <Progress value={score} />
          </div>
          <span className='text-xs text-neutral-500 dark:text-neutral-400'>
            {score < 50 ? 'Weak' : score < 75 ? 'Good' : 'Strong'}
          </span>
        </div>
      </div>
      <div className='flex justify-end'>
        <Button
          size='sm'
          disabled={!canSave || busy}
          onClick={async () => {
            if (!canSave) return;
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({
                password: pw1
              });
              if (error) throw error;
              toast.success('Password updated');
              setPw1('');
              setPw2('');
            } catch (e: any) {
              toast.error('Could not update password', {
                description: e?.message
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Update Password
        </Button>
      </div>
    </div>
  );
}

function ActiveSessionsBlock() {
  const [busy, setBusy] = React.useState<'local' | 'global' | null>(null);
  return (
    <div className='flex items-center justify-end gap-2'>
      <Button
        variant='outline'
        size='sm'
        disabled={busy === 'local'}
        onClick={async () => {
          setBusy('local');
          try {
            await supabase.auth.signOut();
            toast.success('Signed out of this device');
          } catch (e: any) {
            toast.error('Sign out failed', { description: e?.message });
          } finally {
            setBusy(null);
          }
        }}
      >
        Sign out this device
      </Button>
      <Button
        variant='destructive'
        size='sm'
        disabled={busy === 'global'}
        onClick={async () => {
          if (!confirm('Sign out from all devices?')) return;
          setBusy('global');
          try {
            // Supabase JS v2 does not support global sign-out without admin API. Force refresh token revoke by updating password or rotating keys server-side.
            // As a client-side fallback, we sign out here and instruct user to re-login everywhere.
            await supabase.auth.signOut();
            toast.success(
              'Signed out. Other sessions may remain until token expiry.'
            );
          } catch (e: any) {
            toast.error('Global sign out failed', { description: e?.message });
          } finally {
            setBusy(null);
          }
        }}
      >
        Sign out everywhere
      </Button>
    </div>
  );
}
