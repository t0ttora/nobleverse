'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Lightweight router prefetcher for common routes; avoids prefetch on slow networks
export default function RoutePrefetcher() {
  const router = useRouter();
  useEffect(() => {
    try {
      const nav = navigator as any;
      const connection = nav && nav.connection;
      if (connection?.saveData) return; // respect data saver
      const et = connection?.effectiveType as string | undefined;
      if (et && /(^|-)2g$|^slow-2g$/.test(et)) return; // skip on slow links
    } catch {}

    const routes = [
      '/dashboard',
      '/shipments',
      '/inbox',
      '/chat',
      '/contacts',
      '/settings'
    ];

    const tid = setTimeout(() => {
      routes.forEach((r) => {
        try {
          // router.prefetch returns void; ignore failures silently
          // @ts-ignore - next/navigation prefetch is available in app router
          router.prefetch?.(r);
        } catch {}
      });
    }, 400); // wait a bit after mount

    return () => clearTimeout(tid);
  }, [router]);

  return null;
}
