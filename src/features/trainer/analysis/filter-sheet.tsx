'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/ui/cn';

/**
 * Periodo y filtros de A9 y A10. En el escritorio, en línea sobre los resultados; en el móvil,
 * en una hoja inferior que se abre con un botón (docs/BLOCK3_SPEC.md §9.5). El formulario de
 * dentro es un GET normal: funciona también sin JavaScript en el escritorio.
 */
export function FilterSheet({ summary, children }: { summary: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  /** Cierra la hoja y devuelve el foco al botón que la abrió. */
  const hide = () => {
    setOpen(false);
    opener.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      opener.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-line bg-white px-4 text-left text-sm font-semibold text-ink-900 md:hidden"
      >
        <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">
          Periodo y filtros
          <span className="block truncate font-normal text-ink-500">{summary}</span>
        </span>
      </button>
      {open ? (
        <div aria-hidden className="fixed inset-0 z-40 bg-ink-900/30 md:hidden" onClick={hide} />
      ) : null}
      <div
        id={id}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Periodo y filtros' : undefined}
        className={cn(
          open
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-soft'
            : 'hidden',
          'md:static md:z-auto md:block md:max-h-none md:overflow-visible md:rounded-none md:bg-transparent md:p-0 md:shadow-none',
        )}
      >
        {open ? (
          <div className="mb-3 flex items-center justify-between md:hidden">
            <p className="text-lg font-bold text-ink-900">Periodo y filtros</p>
            <button
              ref={close}
              type="button"
              onClick={hide}
              className="inline-flex size-11 items-center justify-center rounded-full text-ink-700 hover:bg-cream-50"
            >
              <X aria-hidden className="size-5" />
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}
