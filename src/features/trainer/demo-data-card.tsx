import { Archive, Database, RotateCcw } from 'lucide-react';
import { type DemoDataVM } from '@/contracts/sessions';
import { formatDate, formatNumber } from '@/domain/format';
import { ConfirmSubmit } from '@/features/shared/confirm-submit';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardHeader } from '@/ui/card';

type FormAction = (form: FormData) => void | Promise<void>;

/** Configuración · Datos de la demostración local: dónde están, copias y restablecer. */
export function DemoDataCard({
  vm,
  backupAction,
  resetAction,
}: {
  vm: DemoDataVM;
  backupAction: FormAction;
  resetAction: FormAction;
}) {
  return (
    <Card className="md:col-span-2">
      <CardHeader
        as="h2"
        icon={<Database className="size-5" />}
        title="Datos de la demostración"
        action={<Badge tone="sun">SQLite local · ficticios</Badge>}
      />
      <dl className="space-y-2 text-sm">
        <div className="flex flex-col gap-1 border-t border-line pt-2 sm:flex-row sm:justify-between sm:gap-4">
          <dt className="text-ink-500">Archivo</dt>
          <dd className="font-mono text-xs break-all text-ink-900 sm:text-right">{vm.file}</dd>
        </div>
        {vm.space ? (
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt className="text-ink-500">Espacio de pruebas</dt>
            <dd className="font-semibold text-ink-900">{vm.space}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-line pt-2">
          <dt className="text-ink-500">Datos sembrados el</dt>
          <dd className="font-semibold text-ink-900">{formatDate(vm.seedDate, 'long')}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-2">
          <dt className="text-ink-500">Persistencia</dt>
          <dd className="text-right font-semibold text-ink-900">
            Se conserva al recargar, al cerrar el navegador y al reiniciar el servidor
          </dd>
        </div>
      </dl>

      <h3 className="mt-5 text-sm font-bold text-ink-900">Copias de seguridad</h3>
      {vm.backups.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">Todavía no hay copias.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {vm.backups.map((backup) => (
            <li key={backup.name} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs break-all text-ink-700">{backup.name}</span>
              <span className="shrink-0 text-ink-500">
                {formatNumber(backup.sizeBytes / 1024, 0)} KB
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-ink-500">
        Para restaurar una copia, para el servidor y usa{' '}
        <code className="font-mono">pnpm db:restore &lt;copia&gt;</code>: comprueba la integridad
        antes de sustituir y guarda el estado actual.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={backupAction}>
          <Button type="submit" variant="secondary">
            <Archive aria-hidden className="size-4" /> Hacer una copia ahora
          </Button>
        </form>
        <form action={resetAction}>
          <ConfirmSubmit
            variant="ghost"
            message="¿Restablecer los datos de la demostración? Se guarda antes una copia, y después se vuelve a crear la base con los datos ficticios de hoy: se pierden las sesiones que hayas creado."
          >
            <RotateCcw aria-hidden className="size-4" /> Restablecer datos demo
          </ConfirmSubmit>
        </form>
      </div>
    </Card>
  );
}
