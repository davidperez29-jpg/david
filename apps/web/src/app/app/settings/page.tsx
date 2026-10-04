import Link from 'next/link';
import { getSecurityStatus } from '@tp/application';
import { currentSessionId, requireRequestContext } from '@/server/session';
import { SecuritySettings } from '@/components/security-settings';
import { ThemeSwitch } from '@/components/theme-switch';

export default async function SettingsPage() {
  const ctx = await requireRequestContext();
  const sec = await getSecurityStatus(ctx, await currentSessionId());
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <Link href="/app/settings/alertas" className="text-sm text-accent underline">
        Reglas y umbrales de las alertas de seguimiento
      </Link>
      <Link href="/app/settings/decision" className="text-sm text-accent underline">
        Reglas del motor de decisión (necesidades, prioridades, métodos)
      </Link>
      {ctx.actor.roles.includes('ADMIN') ? (
        <Link href="/app/admin/privacidad" className="text-sm text-accent underline">
          Privacidad y RGPD: solicitudes de derechos, conservación de datos y 2FA obligatoria
        </Link>
      ) : null}
      <ThemeSwitch />
      <SecuritySettings status={sec} recommend2fa={ctx.actor.roles.some((r) => r !== 'CLIENT')} />
    </div>
  );
}
