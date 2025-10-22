export async function register() {
  // Only initialize Sentry in production builds unless explicitly enabled
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_SENTRY_DISABLED
  ) {
    const Sentry = await import('@sentry/nextjs');
    const sentryOptions: any = {
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      spotlight: false,
      sendDefaultPii: true,
      tracesSampleRate: 1,
      debug: false
    };

    if (process.env.NEXT_RUNTIME === 'nodejs') {
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init(sentryOptions);
    }
  }
  // Ensure the async function contains an await to satisfy lint rule
  await Promise.resolve();
}
export const onRequestError = async (...args: any[]) => {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_SENTRY_DISABLED
  ) {
    const Sentry = await import('@sentry/nextjs');
    return (Sentry as any).captureRequestError(...args);
  }
};
