import { getSecurityStatus } from '@tp/application';
import { requireRequestContext } from '@/server/session';
import { SecuritySettings } from '@/components/security-settings';

export default async function SettingsPage() {
  const ctx = await requireRequestContext();
  const sec = await getSecurityStatus(ctx);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <SecuritySettings
        totpEnabled={sec.totpEnabled}
        recommend2fa={ctx.actor.roles.some((r) => r !== 'CLIENT')}
      />
    </div>
  );
}
