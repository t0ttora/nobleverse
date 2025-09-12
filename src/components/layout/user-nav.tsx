'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User as UserIcon } from 'lucide-react';

interface UserMeta {
  first_name?: string;
  given_name?: string;
  last_name?: string;
  family_name?: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
}

interface BasicUser {
  id: string;
  email: string | null;
  user_metadata?: UserMeta;
}

export function UserNav() {
  const [user, setUser] = useState<BasicUser | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user as BasicUser | null;
      setUser(u ?? null);
      if (u?.id) {
        const { data: profRaw } = await supabase
          .from('profiles')
          .select('username,avatar_url')
          .eq('id', u.id)
          .maybeSingle();
        let name: string | null = null;
        if (profRaw && typeof profRaw === 'object' && 'username' in profRaw) {
          const uname = (profRaw as { username?: unknown }).username;
          if (typeof uname === 'string') {
            const trimmed = uname.trim();
            name = trimmed.length > 0 ? trimmed : null;
          }
        }
        setProfileUsername(name);
        if (profRaw && typeof profRaw === 'object' && 'avatar_url' in profRaw) {
          const av = (profRaw as { avatar_url?: unknown }).avatar_url;
          if (typeof av === 'string' && av.trim().length > 0)
            setProfileAvatar(av);
        }
      }
      setLoading(false);
    };
    void fetchUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Tam sayfa yenileme ile localStorage/cookie temizliği garantilenir
    window.location.replace('/auth/sign-in');
  };

  if (loading || !user) {
    return null;
  }

  const meta = user.user_metadata ?? {};
  const firstName: string =
    meta.first_name ??
    meta.given_name ??
    (typeof meta.name === 'string' ? meta.name.split(' ')[0] : '');
  const lastName: string =
    meta.last_name ??
    meta.family_name ??
    (typeof meta.name === 'string'
      ? meta.name.split(' ').slice(1).join(' ')
      : '');
  const displayName: string =
    meta.display_name ??
    ([firstName, lastName].filter(Boolean).join(' ') || user.email) ??
    '';
  const initials = (
    (firstName?.[0] ?? '') + (lastName?.[0] ?? user.email?.[0] ?? '')
  ).toUpperCase();

  // Navigate to profile/[username] from profiles.username or fallback to email local part
  const fallback = (user.email ?? '').split('@')[0];
  const username = profileUsername ?? fallback;
  const profileUrl = `/profile/${username}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className='h-8 w-8 cursor-pointer'>
          <AvatarImage
            src={
              user.user_metadata?.avatar_url?.trim()
                ? user.user_metadata.avatar_url
                : (profileAvatar ?? undefined)
            }
            alt={displayName}
          />
          <AvatarFallback className='flex h-full w-full items-center justify-center text-xs font-normal'>
            {initials.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-56'>
        <DropdownMenuLabel className='flex flex-col gap-1'>
          <span className='font-medium'>{displayName}</span>
          <span className='text-muted-foreground text-xs'>{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              void router.push(profileUrl);
            }}
          >
            <UserIcon className='mr-2 h-4 w-4' />
            <span>Profile</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void handleSignOut();
          }}
          variant='destructive'
        >
          <LogOut className='mr-2 h-4 w-4' />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
