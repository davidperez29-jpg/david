import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { type ReactNode } from 'react';
import { ServiceWorkerRegistrar } from '@/features/shared/service-worker-registrar';
import './globals.css';

// Las fuentes se descargan al compilar y se sirven desde el propio dominio:
// el navegador del usuario no hace ninguna petición a Google.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jakarta',
  display: 'swap',
});
const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'TrainPro', template: '%s · TrainPro' },
  description:
    'Gestión del entrenamiento, la evaluación, el rendimiento, la salud y la readaptación para profesionales del ejercicio y sus clientes.',
  applicationName: 'TrainPro',
  appleWebApp: { capable: true, title: 'TrainPro', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#FFF8EA',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-cream-50"
        >
          Saltar al contenido
        </a>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
