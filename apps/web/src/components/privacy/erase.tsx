'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

/** ADMIN: subject export and erasure with double confirmation (open, then type the full name). */
export function SubjectRightsPanel({
  clientId,
  fullName,
  anonymized,
}: {
  clientId: string;
  fullName: string;
  anonymized: boolean;
}) {
  const { run, pending, error, fieldError, done } = useApiAction();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('Solicitud de supresión del interesado');
  const matches = confirmation.trim().toLowerCase() === fullName.toLowerCase();

  if (anonymized)
    return (
      <Card title="Derechos del interesado">
        <p className="text-sm text-muted">
          Este cliente está anonimizado: sus datos personales se suprimieron y solo quedan datos de
          entrenamiento sin identificar.
        </p>
      </Card>
    );

  return (
    <Card title="Derechos del interesado">
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-muted">
            Copia completa en JSON de los datos del cliente (acceso y portabilidad). Queda auditada.
          </p>
          <a
            className="mt-2 inline-flex h-10 items-center rounded-md border border-border px-4 font-medium hover:bg-surface"
            href={`/api/v1/clients/${clientId}/subject-data`}
            download
          >
            Exportar datos del interesado
          </a>
        </div>
        <div className="rounded-md border border-danger p-3">
          <h3 className="font-semibold text-danger">Suprimir datos personales</h3>
          <p className="mt-1 text-muted">
            Borra salud, molestias, comentarios, archivos e invitaciones; cierra la cuenta;
            sustituye nombre y contacto; y suprime el detalle del registro de auditoría de este
            cliente. Los datos de entrenamiento quedan como anónimos.{' '}
            <strong>No se puede deshacer.</strong>
          </p>
          {done ? (
            <p role="status" className="mt-2 text-ok">
              Datos suprimidos.
            </p>
          ) : !open ? (
            <Button variant="danger" className="mt-2" onClick={() => setOpen(true)}>
              Suprimir datos…
            </Button>
          ) : (
            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`/clients/${clientId}/erase`, 'POST', { confirmation, reason });
              }}
            >
              <Field
                label={`Escribe «${fullName}» para confirmar`}
                htmlFor="erase-confirm"
                error={fieldError('confirmation')}
              >
                <Input
                  id="erase-confirm"
                  autoComplete="off"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </Field>
              <Field label="Motivo" htmlFor="erase-reason" error={fieldError('reason')}>
                <Input
                  id="erase-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <FormError error={error} />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={pending || !matches}>
                  Suprimir definitivamente
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
