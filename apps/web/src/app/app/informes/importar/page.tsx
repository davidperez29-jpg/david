import Link from 'next/link';
import { IMPORT_COLUMNS } from '@tp/contracts';
import { ImportUploadForm } from '@/components/reports/actions';
import { Card } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

const TITLES = {
  clients: 'Clientes',
  exercises: 'Ejercicios (se crean como borrador para revisar)',
  assessments: 'Evaluaciones (solo de clientes asignados; una evaluación por cliente y fecha)',
  references: 'Referencias bibliográficas (entran como no verificadas)',
} as const;

export default async function ImportPage() {
  await requireStaff();
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Link href="/app/informes" className="text-sm text-muted hover:underline">
        ← Informes
      </Link>
      <h1 className="text-2xl font-semibold">Importar datos</h1>
      <Card title="1. Sube el archivo">
        <ImportUploadForm />
        <p className="mt-2 text-xs text-muted">
          Primero se valida cada fila (formato, catálogos, duplicados y permisos) y verás los
          errores por columna. No se importa nada hasta que confirmes. El archivo no se guarda.
        </p>
      </Card>
      <Card title="Columnas por tipo">
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(IMPORT_COLUMNS) as (keyof typeof IMPORT_COLUMNS)[]).map((e) => (
            <div key={e}>
              <h3 className="text-sm font-semibold">{TITLES[e]}</h3>
              <ul className="text-xs">
                {IMPORT_COLUMNS[e].map((c) => (
                  <li key={c.key}>
                    <span className="font-medium">{c.header}</span>
                    {c.required ? ' (obligatoria)' : ''}
                    {c.help ? <span className="text-muted"> · {c.help}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
