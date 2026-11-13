'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Aviso al salir con cambios sin confirmar (docs/AUDIT_BLOCK1.md A-06).
 *
 * - Cerrar o recargar la pestaña: el aviso del navegador (`beforeunload`).
 * - Ir a otra sección desde la aplicación (menú, migas, enlaces): la navegación interna de
 *   Next.js no dispara `beforeunload`, así que se interceptan los clics en enlaces internos y se
 *   ofrece una salida segura: guardar y salir, salir conservando la copia local, o seguir.
 * - El botón «atrás» del navegador no se puede bloquear con fiabilidad en una aplicación de una
 *   sola página: ahí protege la copia local, que se ofrece recuperar al volver.
 */
export function LeaveGuard({
  unsafe,
  saveNow,
  localCopyKept,
}: {
  unsafe: boolean;
  saveNow: () => Promise<boolean>;
  localCopyKept: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!unsafe) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      // Antes que el enlace de Next.js (que escucha en la raíz): no se navega sin preguntar.
      event.preventDefault();
      event.stopPropagation();
      setSaveFailed(false);
      setTarget(`${url.pathname}${url.search}${url.hash}`);
      dialog.current?.showModal();
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', intercept, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', intercept, true);
    };
  }, [unsafe]);

  const leave = () => {
    dialog.current?.close();
    if (target) router.push(target as Parameters<typeof router.push>[0]);
  };

  const saveAndLeave = async () => {
    setSaving(true);
    const ok = await saveNow();
    setSaving(false);
    if (ok) leave();
    else setSaveFailed(true);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="salir-titulo"
      className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-3xl bg-white p-6 shadow-lift backdrop:bg-ink-900/40"
    >
      <h2 id="salir-titulo" className="text-xl font-extrabold text-ink-900">
        Tienes cambios sin guardar
      </h2>
      <p className="mt-2 text-sm text-ink-700">
        {saveFailed
          ? 'No se han podido guardar ahora mismo. Puedes seguir editando y reintentarlo, o salir: '
          : 'Si sales ahora, el servidor todavía no tiene tus últimos cambios. '}
        {localCopyKept
          ? 'Se conserva una copia en este navegador y podrás recuperarla al volver.'
          : 'Este navegador no puede guardar una copia: se perderían.'}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => void saveAndLeave()}
          disabled={saving}
          className="min-h-11 rounded-2xl bg-ink-900 px-4 font-semibold text-cream-50 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar y salir'}
        </button>
        <button
          type="button"
          onClick={leave}
          className="min-h-11 rounded-2xl border border-line px-4 font-semibold text-ink-900"
        >
          {localCopyKept ? 'Salir (se conserva una copia)' : 'Salir sin guardar'}
        </button>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="min-h-11 rounded-2xl px-4 font-semibold text-ink-700"
        >
          Seguir editando
        </button>
      </div>
    </dialog>
  );
}
