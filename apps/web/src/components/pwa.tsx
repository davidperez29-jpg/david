'use client';

import { useEffect } from 'react';
import { wireAutoSync } from '@/lib/offline-queue';

/** Registers the service worker and replays the offline queue on reconnect (§4.5). */
export function Pwa() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    wireAutoSync();
  }, []);
  return null;
}
