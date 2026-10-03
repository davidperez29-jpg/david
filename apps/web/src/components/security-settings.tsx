'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { passwordProblemText } from '@/lib/password-text';

export function SecuritySettings({
  totpEnabled,
  recommend2fa,
}: {
  totpEnabled: boolean;
  recommend2fa: boolean;
}) {
  const enroll = useApiAction();
  const confirm = useApiAction();
  const pwd = useApiAction();
  const [qr, setQr] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  return (
    <>
      <Card
        title="Verificación en dos pasos"
        actions={
          totpEnabled ? (
            <Badge tone="ok">Activa</Badge>
          ) : (
            <Badge tone={recommend2fa ? 'warn' : 'neutral'}>Inactiva</Badge>
          )
        }
      >
        {totpEnabled ? (
          <p className="text-sm">
            Se pedirá un código de tu aplicación de autenticación al iniciar sesión.
          </p>
        ) : !qr ? (
          <>
            <p className="mb-3 text-sm">
              {recommend2fa
                ? 'Muy recomendable para cuentas de entrenador y administración.'
                : 'Añade una capa extra de seguridad.'}
            </p>
            <Button
              disabled={enroll.pending}
              onClick={async () =>
                setQr(await enroll.run('/auth/2fa/enroll', 'POST', {}, { refresh: false }))
              }
            >
              Activar
            </Button>
            <FormError error={enroll.error} />
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Escanea el código con tu aplicación de autenticación y escribe el código de 6 dígitos.
            </p>
            <img
              src={qr.qrDataUrl}
              alt="Código QR para la aplicación de autenticación"
              width={180}
              height={180}
              className="rounded bg-white p-2"
            />
            <p className="text-xs text-muted">
              Clave manual: <code className="break-all">{qr.secret}</code>
            </p>
            <div className="flex gap-2">
              <Input
                aria-label="Código"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-32"
              />
              <Button
                disabled={confirm.pending || code.length !== 6}
                onClick={() => confirm.run('/auth/2fa/confirm', 'POST', { code })}
              >
                Confirmar
              </Button>
            </div>
            <FormError error={confirm.error} />
          </div>
        )}
      </Card>
      <Card
        title="Contraseña"
        actions={
          pwd.done ? (
            <span role="status" className="text-sm text-ok">
              Actualizada
            </span>
          ) : null
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await pwd.run(
                '/auth/password',
                'POST',
                { currentPassword: current, newPassword: next },
                { refresh: false },
              )
            ) {
              setCurrent('');
              setNext('');
            }
          }}
        >
          <Field
            label="Contraseña actual"
            htmlFor="cur"
            error={pwd.fieldError('currentPassword') ? 'Incorrecta.' : undefined}
          >
            <Input
              id="cur"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            label="Nueva contraseña"
            htmlFor="new"
            hint="Mínimo 12 caracteres. Se cerrarán tus otras sesiones."
            error={passwordProblemText(pwd.fieldError('password') ?? pwd.fieldError('newPassword'))}
          >
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <FormError error={pwd.error} />
          <div>
            <Button type="submit" disabled={pwd.pending || !current || !next}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
