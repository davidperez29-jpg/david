import { redirect } from 'next/navigation';
import { currentSession } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { state } = await currentSession();
  if (state.status === 'second_factor_required') redirect('/login/2fa');
  if (state.status !== 'authenticated') redirect('/login');
  const staff = state.actor.roles.some((r) => r === 'ADMIN' || r === 'TRAINER');
  redirect(staff ? '/app' : '/me');
}
