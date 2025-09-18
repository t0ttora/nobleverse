import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Define the base Next.js configuration
// Extend the type locally to allow the `turbopack` field until types catch up
const baseConfig: NextConfig & { turbopack?: { root?: string } } = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'],
  // Don't fail production builds on ESLint errors. Keep linting in CI or via `pnpm lint`.
  eslint: {
    ignoreDuringBuilds: true
  },
  // Pin Turbopack root to this project to avoid parent lockfile confusion
  turbopack: {
    root: __dirname
  }
};

let configWithPlugins = baseConfig;

// Conditionally enable Sentry configuration only in CI with required envs
const enableSentry =
  !!process.env.CI &&
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !process.env.NEXT_PUBLIC_SENTRY_DISABLED;

if (enableSentry) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options
    // FIXME: Add your Sentry organization and project names
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Only print logs for uploading source maps in CI
    silent: false,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    reactComponentAnnotation: {
      enabled: true
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Disable Sentry telemetry
    telemetry: false
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
