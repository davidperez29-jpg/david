'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`text-sm text-muted hover:text-text ${className}`}
      onClick={async () => {
        await api('/auth/logout', { method: 'POST', body: {} });
        // Cached client pages may hold personal data: the service worker forgets them.
        navigator.serviceWorker?.controller?.postMessage('clear');
        router.replace('/login');
      }}
    >
      Cerrar sesión
    </button>
  );
}
