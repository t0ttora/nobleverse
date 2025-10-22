// Client-side Sentry is initialized only in production to reduce dev overhead
if (typeof window !== 'undefined') {
  (async () => {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.NEXT_PUBLIC_SENTRY_DISABLED
    ) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        integrations: [Sentry.replayIntegration()],
        sendDefaultPii: true,
        tracesSampleRate: 1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        debug: false
      });
      // Optionally expose transition capture
      (window as any).__sentry_onRouterTransitionStart =
        Sentry.captureRouterTransitionStart;
    }
  })();
}

export const onRouterTransitionStart = (..._args: any[]) => {};
