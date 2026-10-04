'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { passwordProblemText } from '@/lib/password-text';

type Status = {
  totpEnabled: boolean;
  recoveryCodesLeft: number;
  twoFactorRequired: boolean;
  sessions: { id: string; createdAt: Date | string; lastSeenAt: Date | string; current: boolean }[];
};

const when = (d: Date | string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-md border border-warn p-3">
      <p className="text-sm font-medium">Códigos de recuperación (se muestran solo ahora)</p>
      <p className="text-xs text-muted">
        Guárdalos en un lugar seguro. Cada uno sirve una sola vez para entrar si pierdes el móvil.
      </p>
      <ul
        className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm"
        aria-label="Códigos de recuperación"
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function SecuritySettings({
  status,
  recommend2fa,
}: {
  status: Status;
  recommend2fa: boolean;
}) {
  const totpEnabled = status.totpEnabled;
  const enroll = useApiAction();
  const confirm = useApiAction();
  const regen = useApiAction();
  const revoke = useApiAction();
  const pwd = useApiAction();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [regenCode, setRegenCode] = useState('');
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
        {status.twoFactorRequired ? (
          <p role="alert" className="mb-3 rounded-md border border-danger p-2 text-sm">
            Tu organización exige la verificación en dos pasos para administración. Actívala para
            seguir usando la aplicación.
          </p>
        ) : null}
        {codes ? <RecoveryCodes codes={codes} /> : null}
        {totpEnabled ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Se pedirá un código de tu aplicación de autenticación al iniciar sesión. Te quedan{' '}
              <strong>{status.recoveryCodesLeft}</strong> códigos de recuperación.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                aria-label="Código actual para generar nuevos códigos"
                inputMode="numeric"
                placeholder="Código de 6 dígitos"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ''))}
                className="w-40"
              />
              <Button
                variant="secondary"
                disabled={regen.pending || regenCode.length !== 6}
                onClick={async () => {
                  const r = await regen.run<{ recoveryCodes: string[] }>(
                    '/auth/2fa/recovery-codes',
                    'POST',
                    { code: regenCode },
                  );
                  if (r) {
                    setCodes(r.recoveryCodes);
                    setRegenCode('');
                  }
                }}
              >
                Generar nuevos códigos de recuperación
              </Button>
            </div>
            <FormError error={regen.error} />
          </div>
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
                onClick={async () => {
                  const r = await confirm.run<{ recoveryCodes: string[] }>(
                    '/auth/2fa/confirm',
                    'POST',
                    {
                      code,
                    },
                  );
                  if (r) setCodes(r.recoveryCodes);
                }}
              >
                Confirmar
              </Button>
            </div>
            <FormError error={confirm.error} />
          </div>
        )}
      </Card>
      <Card title="Sesiones abiertas">
        <ul className="divide-y divide-border text-sm">
          {status.sessions.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
              <span>
                Iniciada {when(x.createdAt)} · última actividad {when(x.lastSeenAt)}
              </span>
              {x.current ? (
                <Badge tone="accent">Esta sesión</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.pending}
                  onClick={() => void revoke.run(`/auth/sessions/${x.id}`, 'DELETE')}
                >
                  Cerrar
                </Button>
              )}
            </li>
          ))}
        </ul>
        <FormError error={revoke.error} />
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
