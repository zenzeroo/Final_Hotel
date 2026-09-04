import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Phase 20 #28 — Sentry error monitoring
// `withSentryConfig` wraps the next config and injects:
//   - Sentry SDK auto-instrumentation for SSR + server actions + API routes
//   - Source map upload (skipped when SENTRY_AUTH_TOKEN is empty)
//   - Tunnel route for ad-blocker-friendly error reporting
//
// All Sentry features are optional — when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
// are empty, the SDK no-ops and build/serve proceeds normally.
const nextConfig: NextConfig = {
  // Allow images from R2 public bucket and Google (for migration only)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-bd00e642ff7946b0b63fbec785554bf8.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/webp"],
  },
};

// `silent: !process.env.CI` — don't print Sentry messages on local builds
// but allow them in CI for source-map upload diagnostics.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map upload. Empty = skip upload silently.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  // Upload source maps only when explicitly enabled (e.g. in CI/CD)
  // to avoid noisy builds for devs without a Sentry account.
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  disableLogger: true,
});
