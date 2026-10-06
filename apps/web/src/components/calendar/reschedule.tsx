'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api-client';

/**
 * Rescheduling from the calendar (restructure phase 12): drag a pending session to another day,
 * or use «Mover» (week view, keyboard). The server decides what may move: only sessions nobody
 * has recorded, to today or later, inside the weeks of an editable plan.
 */
type Move = (id: string, version: number, date: string) => Promise<void>;
const Ctx = createContext<{ move: Move; today: string } | null>(null);
const TYPE = 'application/x-tp-session';

const DAY = (d: string) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));

export function RescheduleProvider({ today, children }: { today: string; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const move: Move = async (id, version, date) => {
    setStatus({ ok: true, text: 'Moviendo…' });
    const r = await api(`/plan-sessions/${id}/reschedule`, {
      method: 'POST',
      body: { expectedVersion: version, date },
    });
    if (!r.ok) {
      setStatus({ ok: false, text: r.error.message });
      return;
    }
    setStatus({ ok: true, text: `Sesión movida al ${DAY(date)}.` });
    router.refresh();
  };
  return (
    <Ctx.Provider value={{ move, today }}>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${status && !status.ok ? 'text-danger' : 'text-muted'}`}
      >
        {status?.text ?? ''}
      </p>
      {children}
    </Ctx.Provider>
  );
}

/** A session that can be dragged to another day (only when it may move). */
export function DraggableSession({
  id,
  version,
  movable,
  children,
}: {
  id: string;
  version: number;
  movable: boolean;
  children: ReactNode;
}) {
  if (!movable) return <>{children}</>;
  return (
    <div
      draggable
      data-session-id={id}
      className="cursor-grab"
      onDragStart={(e) => {
        e.dataTransfer.setData(TYPE, JSON.stringify({ id, version }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {children}
    </div>
  );
}

/** A day of the grid that accepts a dragged session (today or later). */
export function DropDay({
  date,
  className,
  children,
}: {
  date: string;
  className: string;
  children: ReactNode;
}) {
  const c = useContext(Ctx);
  const [over, setOver] = useState(false);
  const accepts = !!c && date >= c.today;
  return (
    <div
      data-day={date}
      className={`${className} ${over ? 'outline-2 -outline-offset-2 outline-accent' : ''}`}
      onDragOver={(e) => {
        if (!accepts || !e.dataTransfer.types.includes(TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const raw = e.dataTransfer.getData(TYPE);
        if (!accepts || !raw) return;
        e.preventDefault();
        const { id, version } = JSON.parse(raw) as { id: string; version: number };
        void c!.move(id, version, date);
      }}
    >
      {children}
    </div>
  );
}

/** Keyboard and touch alternative to dragging: «Mover» with a date (week view). */
export function MoveSessionForm({
  id,
  version,
  date,
  label,
}: {
  id: string;
  version: number;
  date: string;
  label: string;
}) {
  const c = useContext(Ctx);
  const [value, setValue] = useState(date);
  // Shown once hydrated: before that, «Mover» would submit the form natively and reload the page.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!c || !ready) return null;
  return (
    <details className="text-[11px]">
      <summary className="cursor-pointer text-accent">Mover</summary>
      <form
        className="mt-1 flex flex-wrap items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (value && value !== date) void c.move(id, version, value);
        }}
      >
        <label className="sr-only" htmlFor={`mv-${id}`}>
          Nuevo día para {label}
        </label>
        <input
          id={`mv-${id}`}
          type="date"
          min={c.today}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 rounded border border-border bg-bg px-1"
        />
        <button className="h-7 rounded border border-border px-2">Mover a ese día</button>
      </form>
    </details>
  );
}
