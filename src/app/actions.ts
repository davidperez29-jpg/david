'use server';

import { redirect } from 'next/navigation';
import { enterAsDemoIdentity } from '@/server/context';

/**
 * «Entrar como…» (B0, P-76). Solo en `TRAINPRO_MODE=local-demo`; el servidor comprueba que la
 * persona elegida es una de las identidades ficticias y existe. NO es autenticación.
 */
export async function enterAs(formData: FormData) {
  const id = formData.get('persona');
  const target = typeof id === 'string' ? await enterAsDemoIdentity(id) : null;
  redirect(target ?? '/');
}
