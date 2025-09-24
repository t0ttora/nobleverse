import { ensureProfileServer, getProfileByNobleId } from '@/lib/profile';
import TouchLastActive from '@/features/profile/components/touch-last-active';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
// import Link from 'next/link';
import ProfileHeaderInline from '@/features/profile/components/profile-header-inline';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, MapPin, Phone, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function ProfilePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ensure current user's profile exists (best effort)
  try {
    await ensureProfileServer();
  } catch {
    // best-effort: ignore ensureProfileServer failure
  }

  const profile = await getProfileByNobleId(id);
  if (!profile) {
    return (
      <div className='text-muted-foreground py-10 text-center'>
        Profile not found.
      </div>
    );
  }

  // Detect self for inline editing
  let isSelf = false;
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (user && user.id === profile.id) {
      isSelf = true;
    }
  } catch {
    // ignore auth lookup failures and treat as viewer
  }

  // Compute name with first + last preference (match user-nav.tsx behavior)
  const details: any = profile.details || {};
  const d = (v: any) => (typeof v === 'string' ? v.trim() : '');
  let firstName = d(details.first_name || (profile as any).first_name || '');
  let lastName = d(details.last_name || (profile as any).last_name || '');
  // If viewing self, prefer auth metadata like user-nav
  if (isSelf) {
    try {
      const cookieStore2 = await cookies();
      const supabase2 = createSupabaseServerClient(cookieStore2);
      const { data } = await supabase2.auth.getUser();
      const meta: any = data?.user?.user_metadata || {};
      const metaFirst = d(
        meta.first_name ||
          meta.given_name ||
          (meta.name ? String(meta.name).split(' ')[0] : '')
      );
      const metaLast = d(
        meta.last_name ||
          meta.family_name ||
          (meta.name ? String(meta.name).split(' ').slice(1).join(' ') : '')
      );
      firstName = metaFirst || firstName;
      lastName = metaLast || lastName;
    } catch {
      // ignore metadata enrichment failures
    }
  }
  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    d((profile as any).display_name) ||
    d(details.display_name || details.name) ||
    profile.username;

  // skills-like chips
  const chips: string[] =
    (
      details.skills ||
      details.services ||
      details.certs ||
      details.corridors ||
      []
    )?.filter?.(Boolean) || [];

  // simple completion score
  const completionKeys = [
    'bio',
    'location',
    'company_name',
    'website',
    'phone',
    'avatar_url',
    'banner_url'
  ];
  const completed = completionKeys.reduce(
    (acc, key) => acc + (profile?.[key as keyof typeof profile] ? 1 : 0),
    0
  );
  const completionPct = Math.round((completed / completionKeys.length) * 100);

  // activities & connections fallbacks
  // initials based on firstName + lastName like user-nav
  const initials = (
    (firstName?.[0] || profile.username?.[0] || 'U') +
    (lastName?.[0] || profile.username?.[1] || '')
  ).toUpperCase();

  return (
    <div className='w-full px-4 py-6 sm:px-6 lg:px-8'>
      <TouchLastActive />

      {/* Top banner + name */}
      <div className='bg-background relative overflow-hidden rounded-2xl border shadow-sm'>
        <div className='relative h-40 w-full'>
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt='Banner'
              className='h-full w-full object-cover'
            />
          ) : (
            // hero_bg orange-inspired gradient
            <div className='h-full w-full bg-gradient-to-r from-[#ff3c00] via-orange-400 to-amber-300' />
          )}
          {/* change cover button removed as requested */}
        </div>

        <div className='px-4 pt-0 pb-6 sm:px-6'>
          <div className='-mt-12'>
            <Avatar className='border-background h-24 w-24 border-4 shadow-md'>
              <AvatarImage
                src={profile.avatar_url || undefined}
                alt={displayName}
              />
              <AvatarFallback className='text-lg'>{initials}</AvatarFallback>
            </Avatar>
            <div className='mt-3'>
              <div className='flex items-center gap-2'>
                <h1 className='text-2xl leading-tight font-semibold'>
                  {displayName}
                </h1>
                {profile.role && (
                  <Badge variant='outline' className='capitalize'>
                    {profile.role}
                  </Badge>
                )}
              </div>
              <div className='text-muted-foreground text-sm'>
                @{profile.username}
              </div>
              {profile.location && (
                <div className='text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-sm'>
                  <MapPin className='h-3.5 w-3.5' /> {profile.location}
                </div>
              )}
            </div>
            {/* About me short block under all */}
            <div className='text-foreground/80 mt-4 text-sm whitespace-pre-line'>
              {profile.bio || 'No bio added yet.'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs below header */}
      <div className='mt-4'>
        <Tabs defaultValue='overview' className='w-full'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='shipments'>Shipments</TabsTrigger>
            <TabsTrigger value='reviews'>Reviews</TabsTrigger>
            <TabsTrigger value='contacts'>Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='mt-4'>
            <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
              {/* Left side information card (contacts and links) */}
              <Card className='lg:col-span-1'>
                <CardHeader>
                  <CardTitle className='text-base'>Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className='space-y-2 text-sm'>
                    {profile.email && (
                      <li className='text-foreground/80 flex items-center gap-2'>
                        <Mail className='text-muted-foreground h-4 w-4' />{' '}
                        {profile.email}
                      </li>
                    )}
                    {profile.phone && (
                      <li className='text-foreground/80 flex items-center gap-2'>
                        <Phone className='text-muted-foreground h-4 w-4' />{' '}
                        {profile.phone}
                      </li>
                    )}
                    {profile.website && (
                      <li className='text-foreground/80 flex items-center gap-2'>
                        <Globe className='text-muted-foreground h-4 w-4' />{' '}
                        <a
                          href={profile.website}
                          target='_blank'
                          rel='noreferrer'
                          className='hover:underline'
                        >
                          {profile.website}
                        </a>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              {/* Metrics on right two columns */}
              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle className='text-base'>History / Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                    <Stat label='NobleScore' value={profile.noble_score} />
                    <Stat
                      label='Completed Requests'
                      value={profile.completed_requests ?? 0}
                    />
                    <Stat
                      label='Completed Shipments'
                      value={profile.completed_shipments ?? 0}
                    />
                    <Stat
                      label='Average Rating'
                      value={profile.average_rating}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Empty placeholders for other tabs for now */}
          <TabsContent value='shipments' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Shipments</CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                No shipments to show yet.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='reviews' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Reviews</CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                No reviews yet.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='contacts' className='mt-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Contacts</CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-sm'>
                No contacts yet.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({
  label,
  value
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className='bg-card rounded border p-3'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <div className='text-base font-semibold'>{value ?? '-'}</div>
    </div>
  );
}
