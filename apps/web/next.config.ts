import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Strict security headers (§14.1). React escapes output; CSP is a second line of defence.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  // Exercise videos are embedded only from privacy-friendly players (§28).
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

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
          { key: 'Content-Security-Policy', value: csp },
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
