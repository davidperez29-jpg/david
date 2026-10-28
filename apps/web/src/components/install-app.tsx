'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { announce } from '@/components/ui/announcer';
import { Card } from '@/components/ui/card';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
declare global {
  interface Window {
    __tpInstall?: InstallPrompt | null;
    __tpInstalled?: boolean;
  }
}

type State = 'unknown' | 'installed' | 'prompt' | 'iphone' | 'manual';
const DISMISSED = 'tp-install-dismissed';

function current(): State {
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || window.__tpInstalled) return 'installed';
  if (window.__tpInstall) return 'prompt';
  const iphone =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iphone ? 'iphone' : 'manual';
}

const IPHONE_STEPS = (
  <>
    Pulsa <strong>Compartir</strong> (el cuadrado con la flecha) y luego{' '}
    <strong>Añadir a pantalla de inicio</strong>.
  </>
);

/**
 * The web app installed on the phone or the computer, free and without an app store
 * (restructure phase 24, A72): the browser's own prompt where there is one, the steps for the
 * iPhone, where there is none. `card`: a suggestion on the client's «Hoy» that can be dismissed;
 * `settings`: a section of Ajustes that is always there.
 */
export function InstallApp({ variant }: { variant: 'card' | 'settings' }) {
  const [state, setState] = useState<State>('unknown');
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    const update = () => setState(current());
    update();
    try {
      setDismissed(localStorage.getItem(DISMISSED) === '1');
    } catch {
      setDismissed(false);
    }
    window.addEventListener('tp:installable', update);
    return () => window.removeEventListener('tp:installable', update);
  }, []);

  async function install() {
    const e = window.__tpInstall;
    if (!e) return;
    window.__tpInstall = null; // the browser shows its prompt once
    await e.prompt();
    if ((await e.userChoice).outcome === 'accepted') {
      window.__tpInstalled = true;
      announce('App instalada.');
    }
    setState(current());
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Not remembered in this browser: it shows again next time.
    }
  }

  if (variant === 'card') {
    if (dismissed || (state !== 'prompt' && state !== 'iphone')) return null;
    return (
      <section aria-labelledby="install-title" className="rounded-xl border border-border p-5">
        <h2 id="install-title" className="text-xs font-semibold tracking-wide text-muted uppercase">
          Tenla como una app
        </h2>
        <p className="mt-2 text-sm">
          {state === 'prompt'
            ? 'Instálala en el móvil, gratis y sin tienda: se abre desde la pantalla de inicio.'
            : IPHONE_STEPS}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {state === 'prompt' ? (
            <Button onClick={() => void install()}>Instalar la app</Button>
          ) : null}
          <Button variant="ghost" onClick={dismiss}>
            {state === 'prompt' ? 'Ahora no' : 'Entendido'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <Card title="App en el móvil y el ordenador">
      {state === 'installed' ? (
        <p className="text-sm">Ya la tienes instalada en este dispositivo.</p>
      ) : state === 'prompt' ? (
        <>
          <p className="text-sm">Instálala gratis, sin tienda: se abre como cualquier otra app.</p>
          <Button className="mt-3" onClick={() => void install()}>
            Instalar la app
          </Button>
        </>
      ) : state === 'iphone' ? (
        <p className="text-sm">En el iPhone o el iPad: {IPHONE_STEPS}</p>
      ) : (
        <p className="text-sm">
          Abre esta dirección en Chrome o Edge y pulsa <strong>Instalar</strong> en la barra de
          direcciones o en el menú. En el iPhone: {IPHONE_STEPS}
        </p>
      )}
    </Card>
  );
}
