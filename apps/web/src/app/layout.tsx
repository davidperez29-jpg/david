import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Plataforma de entrenamiento', template: '%s · Plataforma de entrenamiento' },
  description: 'Evaluación, programación y seguimiento del entrenamiento basado en evidencia.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f766e' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
