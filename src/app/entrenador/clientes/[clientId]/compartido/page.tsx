import { CircleCheck, CircleMinus, Eye, Info } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findAssessmentTest } from '@/domain/assessment';
import { Card, CardHeader } from '@/ui/card';
import { Notice } from '@/ui/notice';
import { getTrainerContext } from '@/server/context';
import { getClientProfile } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Información compartida' };

export default async function ClientSharingTab(
  props: PageProps<'/entrenador/clientes/[clientId]/compartido'>,
) {
  const { clientId } = await props.params;
  const profile = await getClientProfile(await getTrainerContext(), clientId);
  if (!profile) notFound();
  const { sharing } = profile;
  const rows: [string, boolean, string?][] = [
    ['Plan y sesiones', true, 'Siempre visible: el cliente lo necesita para entrenar.'],
    [
      'Evaluaciones',
      sharing.assessments.enabled,
      sharing.assessments.enabled
        ? `Solo: ${sharing.assessments.testIds.map((id) => findAssessmentTest(id)?.name ?? id).join(', ')}`
        : undefined,
    ],
    ['Carga y volumen', sharing.volume],
    ['Readaptación', sharing.rehab],
    ['Informes', sharing.reports],
    ['Notas privadas del entrenador', false, 'Nunca se comparten.'],
  ];
  return (
    <Card>
      <CardHeader
        as="h2"
        icon={<Eye className="size-5" />}
        title="Lo que ve el cliente"
        description="El cliente solo ve en su app lo que decidas compartir. Por defecto no se comparte nada."
      />
      <ul className="divide-y divide-line">
        {rows.map(([label, shared, detail]) => (
          <li key={label} className="flex items-start gap-3 py-2.5 text-sm">
            {shared ? (
              <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf-700" />
            ) : (
              <CircleMinus aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">{label}</p>
              {detail ? <p className="text-ink-500">{detail}</p> : null}
            </div>
            <span
              className={shared ? 'shrink-0 font-semibold text-leaf-700' : 'shrink-0 text-ink-500'}
            >
              {shared ? 'Compartido' : 'No compartido'}
            </span>
          </li>
        ))}
      </ul>
      <Notice className="mt-4" icon={<Info />}>
        En esta fase la configuración solo se puede consultar. Se podrá cambiar cuando exista la
        base de datos, y está previsto que cada cambio quede registrado.
      </Notice>
    </Card>
  );
}
