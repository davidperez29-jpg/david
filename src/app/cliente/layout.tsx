import { type Metadata } from 'next';
import { type ReactNode } from 'react';
import { DemoBanner } from '@/features/shared/demo-banner';

export const metadata: Metadata = { title: { default: 'Hoy', template: '%s · TrainPro' } };

/** Experiencia del cliente: una columna pensada para el móvil, también usable en ordenador. */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-100">
      <DemoBanner compact />
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
