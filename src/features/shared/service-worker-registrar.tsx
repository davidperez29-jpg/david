'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker solo en producción (en desarrollo provocaría cachés confusas).
 * El service worker no guarda datos personales: solo sirve una página sin conexión.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => {
        console.warn('No se pudo registrar el service worker', error);
      });
  }, []);
  return null;
}
