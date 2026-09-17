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
// Allow next/image to fetch from the R2 public bucket. Hostname is derived
// from R2_PUBLIC_URL (set per environment in `.env.local` for dev + Vercel
// project settings for staging/prod) so the same code works in all envs.
// Throws at build time if R2_PUBLIC_URL is unset — explicit failure beats
// silently pointing at the dev bucket on prod. Default mirrors the Zod
// fallback in `lib/env.ts:19` so a bare `npm run dev` (no `.env.local`)
// still works against the dev bucket.
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ?? 'https://pub-bd00e642ff7946b0b63fbec785554bf8.r2.dev'
let r2Hostname: string
try {
  r2Hostname = new URL(R2_PUBLIC_URL).hostname
} catch {
  throw new Error(`next.config.ts: R2_PUBLIC_URL is not a valid URL: ${R2_PUBLIC_URL}`)
}

// `next.config.ts` is the ONLY place next/image's domain allowlist lives.
// We do NOT include `lh3.googleusercontent.com` here — all V1 images must
// have been migrated to R2 via `scripts/migrate-images.mjs` before deploy.
// Legacy URLs in unmigrated rows surface as `<RoomImage>` graceful
// fallback (gradient + MaterialIcon) instead of crashing the build.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: r2Hostname,
        pathname: '/**',
      },
    ],
    formats: ['image/webp'],
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
