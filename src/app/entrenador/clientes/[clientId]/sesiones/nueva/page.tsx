import { ArrowLeft } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewSessionForm } from '@/features/trainer/new-session-form';
import { Card, CardHeader } from '@/ui/card';
import { getTrainerContext } from '@/server/context';
import { getNewSessionForm } from '@/server/services/trainer-sessions';
import { createSessionAction } from '../actions';

export const metadata: Metadata = { title: 'Nueva sesión' };

/** A4 · Nueva sesión. El identificador se emite aquí: reenviar el formulario no duplica. */
export default async function NewSessionPage(
  props: PageProps<'/entrenador/clientes/[clientId]/sesiones/nueva'>,
) {
  const [{ clientId }, search] = await Promise.all([props.params, props.searchParams]);
  const date = typeof search.fecha === 'string' ? search.fecha : undefined;
  const vm = await getNewSessionForm(await getTrainerContext(), clientId, date);
  if (!vm) notFound();
  return (
    <>
      <Link
        href={`/entrenador/clientes/${vm.clientId}/sesiones`}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft aria-hidden className="size-4" /> Sesiones
      </Link>
      <Card className="max-w-3xl">
        <CardHeader
          as="h2"
          title={`Nueva sesión para ${vm.clientFirstName}`}
          description="Primero los datos de la sesión; después añadirás los ejercicios. Hasta que publiques, es un borrador que no ve."
        />
        <NewSessionForm vm={vm} action={createSessionAction} />
      </Card>
    </>
  );
}
