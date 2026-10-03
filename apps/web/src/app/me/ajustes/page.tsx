import { getSecurityStatus } from '@tp/application';
import { LogoutButton } from '@/components/logout-button';
import { SecuritySettings } from '@/components/security-settings';
import { requireClientUser } from '@/server/session';

export default async function ClientSettings() {
  const ctx = await requireClientUser();
  const sec = await getSecurityStatus(ctx);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <SecuritySettings totpEnabled={sec.totpEnabled} recommend2fa={false} />
      <LogoutButton className="self-start" />
    </div>
  );
}
