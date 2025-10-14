'use client';

import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import React, { useEffect, useState } from 'react';
import OnboardingModal from '@/components/modal/OnboardingModal';
import { supabase } from '@/lib/supabaseClient';
import FloatingActionButton from '@/components/ui/floating-action-button';
import { usePathname } from 'next/navigation';

export default function DashboardShell({
  children
}: {
  children: React.ReactNode;
}) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const checkOnboarding = async (attempt = 0) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) {
          if (attempt < 3)
            setTimeout(() => {
              void checkOnboarding(attempt + 1);
            }, 300);
          return;
        }
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_time')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn('profile fetch error', error);
          return;
        }
        if (!profile) {
          const safeEmail = user.email ?? '';
          const safeUsername = safeEmail
            ? safeEmail.split('@')[0]
            : user.id.slice(0, 8);
          await supabase.from('profiles').upsert(
            {
              id: user.id,
              username: safeUsername.toLowerCase(),
              email: safeEmail,
              first_time: true
            },
            { onConflict: 'id' }
          );
          setShowOnboarding(true);
        } else if (profile.first_time === true) {
          setShowOnboarding(true);
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) void checkOnboarding();
    });

    void checkOnboarding();
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <KBar>
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
        }}
      />
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className='flex h-screen max-h-screen flex-col'>
          <Header />
          <div className='bg-sidebar flex h-full min-h-0 w-full flex-1 flex-col'>
            <div className='bg-background ring-border/40 border-border/40 dark:ring-border/60 dark:border-border/60 flex-1 overflow-auto border ring-1 md:rounded-tl-2xl'>
              {children}
            </div>
          </div>
          {/* Hide Floating Action Button on Inbox page */}
          {!(pathname || '').startsWith('/inbox') && <FloatingActionButton />}
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
