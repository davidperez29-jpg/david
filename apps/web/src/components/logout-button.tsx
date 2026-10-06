'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { clearQueue, flush, pending } from '@/lib/offline-queue';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`text-sm text-muted hover:text-text ${className}`}
      onClick={async () => {
        // Unsynced workout entries stay on this device only while their owner is signed in.
        await flush();
        const left = (await pending()).length;
        if (
          left &&
          !window.confirm(
            `Hay ${left} registro${left === 1 ? '' : 's'} sin sincronizar (sin conexión). Si cierras sesión ahora se borrarán de este dispositivo. ¿Cerrar sesión igualmente?`,
          )
        )
          return;
        await api('/auth/logout', { method: 'POST', body: {} });
        await clearQueue();
        // Cached client pages may hold personal data: the service worker forgets them.
        navigator.serviceWorker?.controller?.postMessage('clear');
        router.replace('/login');
      }}
    >
      Cerrar sesión
    </button>
  );
}
