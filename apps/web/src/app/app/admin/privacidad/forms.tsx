'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

export function ResolveRequestForm({
  id,
  type,
  clientId,
}: {
  id: string;
  type: string;
  clientId: string;
}) {
  const { run, pending, error, fieldError } = useApiAction();
  const [response, setResponse] = useState('');
  const resolve = (status: 'completed' | 'rejected') =>
    run(`/privacy-requests/${id}/resolve`, 'POST', { status, response });
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      {type === 'erasure' ? (
        <p className="text-xs text-muted">
          Para atender una supresión, ejecútala antes en la{' '}
          <Link className="text-accent underline" href={`/app/clients/${clientId}?tab=privacidad`}>
            ficha del cliente → Privacidad
          </Link>
          ; la solicitud se marca como atendida automáticamente.
        </p>
      ) : null}
      <Field label="Respuesta al interesado" htmlFor={`resp-${id}`} error={fieldError('response')}>
        <Textarea
          id={`resp-${id}`}
          rows={2}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
      </Field>
      <FormError error={error} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => resolve('completed')}>
          Marcar como atendida
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => resolve('rejected')}
        >
          Denegar
        </Button>
      </div>
    </div>
  );
}

export function PrivacySettingsForm({
  initial,
  archivedNotAnonymized,
}: {
  initial: { retentionMonths: number | null; requireAdmin2fa: boolean };
  archivedNotAnonymized: number;
}) {
  const { run, pending, error, fieldError, done } = useApiAction();
  const [months, setMonths] = useState(initial.retentionMonths?.toString() ?? '');
  const [twoFa, setTwoFa] = useState(initial.requireAdmin2fa);
  return (
    <Card title="Conservación y seguridad">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run('/privacy/settings', 'PUT', {
            retentionMonths: months.trim() === '' ? null : months,
            requireAdmin2fa: twoFa,
          });
        }}
      >
        <Field
          label="Plazo de conservación de clientes archivados (meses)"
          htmlFor="ret-months"
          error={fieldError('retentionMonths')}
        >
          <Input
            id="ret-months"
            type="number"
            min={1}
            max={240}
            inputMode="numeric"
            placeholder="Sin definir"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">
          Al vencer el plazo, el proceso diario anonimiza al cliente archivado. Vacío = no se
          anonimiza automáticamente. La plataforma no propone un plazo: lo decide el responsable del
          tratamiento [REQUIERE VALIDACIÓN LEGAL]. Ahora hay {archivedNotAnonymized} cliente(s)
          archivado(s) sin anonimizar.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={twoFa} onChange={(e) => setTwoFa(e.target.checked)} />
          Exigir verificación en dos pasos a las cuentas de administración
        </label>
        <FormError error={error} />
        {done ? (
          <p role="status" className="text-sm text-ok">
            Guardado.
          </p>
        ) : null}
        <Button type="submit" className="self-start" disabled={pending}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}
