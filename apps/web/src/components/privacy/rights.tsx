'use client';

import { PRIVACY_RIGHTS, type PrivacyRight } from '@tp/domain';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { formatDate } from '@/lib/labels';
import { PrivacyStatusBadge, rightName, type PrivacyRequestRow } from './labels';

/** The data subject's own rights: direct download, requests and their state. */
export function ClientRights({
  clientId,
  requests,
}: {
  clientId: string;
  requests: PrivacyRequestRow[];
}) {
  const { run, pending, error, fieldError, done } = useApiAction();
  const cancel = useApiAction();
  const [type, setType] = useState<PrivacyRight>('access');
  const [details, setDetails] = useState('');
  return (
    <section aria-labelledby="rights-h" className="flex flex-col gap-3">
      <h2 id="rights-h" className="text-lg font-semibold">
        Tus derechos
      </h2>
      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold">Descargar mis datos</h3>
        <p className="mt-1 text-sm text-muted">
          Una copia de todos tus datos en formato JSON (acceso y portabilidad). Queda registrada.
        </p>
        <a
          href={`/api/v1/clients/${clientId}/subject-data`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-medium hover:bg-surface"
          download
        >
          Descargar mis datos (JSON)
        </a>
      </div>

      <form
        className="flex flex-col gap-3 rounded-xl border border-border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(`/clients/${clientId}/privacy-requests`, 'POST', {
            type,
            details: details || undefined,
          });
          if (r) setDetails('');
        }}
      >
        <h3 className="font-semibold">Solicitar</h3>
        <Field label="Derecho" htmlFor="pr-type" error={fieldError('type')}>
          <Select
            id="pr-type"
            value={type}
            onChange={(e) => setType(e.target.value as PrivacyRight)}
            options={Object.entries(PRIVACY_RIGHTS).map(([value, r]) => ({
              value,
              label: r.name,
            }))}
          />
        </Field>
        <p className="text-sm text-muted">{PRIVACY_RIGHTS[type].text}</p>
        <Field label="Detalles (opcional)" htmlFor="pr-details" error={fieldError('details')}>
          <Textarea
            id="pr-details"
            rows={3}
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </Field>
        <FormError error={error} />
        {done ? (
          <p role="status" className="text-sm text-ok">
            Solicitud enviada. Tienes respuesta en un plazo máximo de un mes.
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          Enviar solicitud
        </Button>
      </form>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold">Mis solicitudes</h3>
        {requests.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No has hecho ninguna solicitud.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{rightName(r.type)}</span>
                  <PrivacyStatusBadge status={r.status} />
                </div>
                <span className="text-muted">
                  {formatDate(r.createdAt)}
                  {r.status === 'pending' ? ` · respuesta antes del ${formatDate(r.dueOn)}` : ''}
                </span>
                {r.response ? <span>{r.response}</span> : null}
                {r.status === 'pending' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    disabled={cancel.pending}
                    onClick={() => cancel.run(`/privacy-requests/${r.id}/cancel`, 'POST')}
                  >
                    Cancelar solicitud
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <FormError error={cancel.error} />
      </div>
    </section>
  );
}
