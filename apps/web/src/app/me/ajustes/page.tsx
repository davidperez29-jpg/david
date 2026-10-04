import { getSecurityStatus } from '@tp/application';
import { LogoutButton } from '@/components/logout-button';
import { SecuritySettings } from '@/components/security-settings';
import { currentSessionId, requireClientUser } from '@/server/session';
import { ThemeSwitch } from '@/components/theme-switch';

export default async function ClientSettings() {
  const ctx = await requireClientUser();
  const sec = await getSecurityStatus(ctx, await currentSessionId());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <ThemeSwitch />
      <SecuritySettings status={sec} recommend2fa={false} />
      <LogoutButton className="self-start" />
    </div>
  );
}
