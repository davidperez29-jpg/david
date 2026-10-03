import { listUsers } from '@tp/application';
import { redirect } from 'next/navigation';
import { Badge, Card } from '@/components/ui/card';
import { formatDateTime, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { InviteStaffForm, UserStatusButton } from './forms';

export default async function UsersPage() {
  const ctx = await requireStaff();
  if (!ctx.actor.roles.includes('ADMIN')) redirect('/app');
  const { users, pendingInvitations } = await listUsers(ctx);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <Card title="Cuentas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr>
                <th className="py-2">Nombre</th>
                <th>Email</th>
                <th>Roles</th>
                <th>2FA</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-medium">{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>{u.roles.map((r) => label('role', r)).join(', ')}</td>
                  <td>{u.totpEnabled ? <Badge tone="ok">Sí</Badge> : <Badge>No</Badge>}</td>
                  <td className="text-muted">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}
                  </td>
                  <td>
                    <Badge tone={u.status === 'active' ? 'ok' : 'neutral'}>
                      {u.status === 'active' ? 'Activa' : 'Desactivada'}
                    </Badge>
                  </td>
                  <td>
                    {u.id !== ctx.actor.userId ? (
                      <UserStatusButton userId={u.id} active={u.status === 'active'} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {pendingInvitations.length ? (
        <Card title="Invitaciones pendientes">
          <ul className="text-sm">
            {pendingInvitations.map((i) => (
              <li key={i.id}>
                {i.email} · {label('role', i.role)} · caduca {formatDateTime(i.expiresAt)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <InviteStaffForm />
    </div>
  );
}
