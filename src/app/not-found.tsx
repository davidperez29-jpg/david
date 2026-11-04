import Link from 'next/link';
import { KettlebellIllustration } from '@/features/brand/illustrations';
import { buttonClasses } from '@/ui/button';

export default function NotFound() {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <KettlebellIllustration />
        <h1 className="mt-4 text-3xl font-extrabold text-ink-900">
          No hemos encontrado esta página
        </h1>
        <p className="mt-2 text-ink-500">
          Puede que el enlace sea antiguo o que no tengas acceso a este contenido.
        </p>
        <Link href="/" className={buttonClasses('primary', 'md', 'mt-6')}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
