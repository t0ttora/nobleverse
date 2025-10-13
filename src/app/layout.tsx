import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/font';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';
import './theme.css';
// UniverJS styles (UI for Sheets/Docs)
// Cells/Docs UI styles removed
import DashboardShell from '@/components/layout/dashboard-shell';
import PlainLayout from '@/components/layout/plain-layout';
import { getUserSession } from '@/../utils/supabase/server';

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

export const metadata: Metadata = {
  title: 'NobleVerse',
  description: 'The Backbone of Modern Logistics',
  icons: {
    // Prefer SVG site logo everywhere, keep .ico as a broad fallback
    icon: [
      { url: '/logo_meta.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: ['/logo_meta.svg'],
    apple: ['/logo_meta.svg']
  }
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // Default to 'noble' theme when no cookie is present so SSR matches client
  const activeThemeValue = cookieStore.get('active_theme')?.value ?? 'noble';
  const isScaled = activeThemeValue?.endsWith('-scaled');

  // Kullanıcı oturumunu kontrol et
  const user = await getUserSession();
  const bodyClasses = cn(
    'bg-background font-sans antialiased min-h-screen',
    // Allow scrolling on landing (no user). Keep dashboard behavior as before.
    user ? 'overflow-hidden overscroll-none' : 'overflow-x-hidden',
    activeThemeValue ? `theme-${activeThemeValue}` : '',
    isScaled ? 'theme-scaled' : '',
    fontVariables
  );

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  if (typeof document !== 'undefined') {
                    document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                  }
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body className={bodyClasses}>
        <NextTopLoader showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers activeThemeValue={activeThemeValue}>
              <Toaster />
              {user ? (
                <DashboardShell>{children}</DashboardShell>
              ) : (
                <PlainLayout>{children}</PlainLayout>
              )}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
