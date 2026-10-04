import path from 'node:path';
import type { NextConfig } from 'next';

// Strict security headers (§14.1). The Content-Security-Policy (with a per-request nonce) is set
// in src/proxy.ts.

// The production image builds a self-contained server (NEXT_OUTPUT=standalone, see Dockerfile);
// local runs and the E2E suite keep `next start`.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const config: NextConfig = {
  reactStrictMode: true,
  ...(standalone
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: path.join(__dirname, '../..'),
        // pdfkit reads its font metrics (.afm) from disk at runtime: tracing cannot see that.
        outputFileTracingIncludes: {
          '/**': ['../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**'],
        },
      }
    : {}),
  poweredByHeader: false,
  transpilePackages: ['@tp/application', '@tp/auth', '@tp/contracts', '@tp/db', '@tp/domain'],
  // pdfkit reads its font metrics from disk and exceljs is large: keep them out of the bundle.
  serverExternalPackages: ['@node-rs/argon2', 'postgres', 'pdfkit', 'exceljs'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default config;
