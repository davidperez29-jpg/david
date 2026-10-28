import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { INSTALL_BOOT } from '@/lib/install';
import { THEME_BOOT } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'Plataforma de entrenamiento', template: '%s · Plataforma de entrenamiento' },
  description: 'Evaluación, programación y seguimiento del entrenamiento basado en evidencia.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  // PNG for the iPhone home screen, which ignores SVG icons (restructure phase 24).
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  // Opened from the home screen, the app fills the screen like any other.
  appleWebApp: { capable: true, title: 'Entreno', statusBarStyle: 'default' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f766e' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Per-request CSP nonce (src/proxy.ts): every page is rendered dynamically.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT + INSTALL_BOOT }} />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
