'use client';

import { useEffect } from 'react';
import { setQueueOwner, wireAutoSync } from '@/lib/offline-queue';

/**
 * Registers the service worker and replays the offline queue on reconnect (§4.5). The queue is
 * bound to the signed-in user (`userId`).
 */
export function Pwa({ userId }: { userId: string }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    void setQueueOwner(userId);
    wireAutoSync();
  }, [userId]);
  return null;
}
