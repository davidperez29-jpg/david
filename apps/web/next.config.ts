import type { NextConfig } from 'next';

// Strict security headers (§14.1). The Content-Security-Policy (with a per-request nonce) is set
// in src/proxy.ts.

const config: NextConfig = {
  reactStrictMode: true,
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
