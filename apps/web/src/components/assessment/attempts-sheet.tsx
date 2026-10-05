'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { api } from '@/lib/api-client';

export interface SheetRow {
  key: string;
  label: string;
  /** e.g. «Derecha», or the test name in a per-member sheet. */
  sublabel?: string | null;
  assessmentId: string;
  testId: string;
  side: 'both' | 'left' | 'right';
  unit: string;
  /** Attempt columns (the test's default; more if more were recorded). */
  columns: number;
  existing: { id: string; attempts: number[]; valid: boolean } | null;
  /** Value in force (after the result rule) as shown by the server. */
  value?: string | null;
  flag?: string | null;
}

type Status = { kind: 'saving' | 'saved' | 'error'; message?: string };

const fmt = (x: number) => String(x).replace('.', ',');
const parseCell = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * «Hoja de intentos» (restructure phase 4): attempts as an Excel-like grid. Type or paste a block
 * copied from Excel (tabs and line breaks), Enter moves down, each row saves when you leave it;
 * the result rule (mediana, mejor, mínimo…) and the formulas run on the server.
 */
export function AttemptsSheet({
  rows,
  caption,
  rule,
}: {
  rows: SheetRow[];
  caption: string;
  /** Plain-language result rule, shown above the grid. */
  rule?: string;
}) {
  const router = useRouter();
  const width = Math.max(
    1,
    ...rows.map((r) => Math.max(r.columns, r.existing?.attempts.length ?? 0)),
  );
  const initial = () =>
    Object.fromEntries(
      rows.map((r) => [
        r.key,
        Array.from({ length: width }, (_, i) =>
          r.existing?.attempts[i] != null ? fmt(r.existing.attempts[i]!) : '',
        ),
      ]),
    );
  const [cells, setCells] = useState<Record<string, string[]>>(initial);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const dirty = useRef(new Set<string>());
  const grid = useRef<HTMLTableElement>(null);

  const focusCell = (r: number, c: number) =>
    grid.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)?.focus();

  async function save(row: SheetRow, values: string[]) {
    const parsed = values.map(parseCell);
    if (parsed.some((x) => Number.isNaN(x))) {
      setStatus((s) => ({ ...s, [row.key]: { kind: 'error', message: 'Solo números' } }));
      return;
    }
    const attempts = parsed.filter((x): x is number => x != null);
    setStatus((s) => ({ ...s, [row.key]: { kind: 'saving' } }));
    const r = attempts.length
      ? await api(`/assessments/${row.assessmentId}/results`, {
          method: 'POST',
          body: { testId: row.testId, side: row.side, attempts },
        })
      : row.existing
        ? await api(`/assessment-results/${row.existing.id}`, { method: 'DELETE' })
        : { ok: true as const, data: null };
    setStatus((s) => ({
      ...s,
      [row.key]: r.ok ? { kind: 'saved' } : { kind: 'error', message: r.error.message },
    }));
    if (r.ok) router.refresh();
  }

  function flush(key: string) {
    if (!dirty.current.has(key)) return;
    dirty.current.delete(key);
    const row = rows.find((r) => r.key === key)!;
    void save(row, cells[key]!);
  }

  function setCell(key: string, c: number, v: string) {
    dirty.current.add(key);
    setCells((all) => ({ ...all, [key]: all[key]!.map((x, i) => (i === c ? v : x)) }));
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    const text = e.clipboardData.getData('text/plain');
    if (!/[\t\n]/.test(text.trim())) return; // a single value: normal paste
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    const next = { ...cells };
    const touched: string[] = [];
    lines.forEach((line, i) => {
      const row = rows[r + i];
      if (!row) return;
      const vals = [...next[row.key]!];
      line.split('\t').forEach((v, j) => {
        if (c + j < width) vals[c + j] = v.trim();
      });
      next[row.key] = vals;
      touched.push(row.key);
    });
    setCells(next);
    for (const key of touched)
      void save(
        rows.find((x) => x.key === key)!,
        next[key]!,
      );
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusCell(e.shiftKey ? r - 1 : r + 1, c);
    } else if (e.key === 'ArrowDown') focusCell(r + 1, c);
    else if (e.key === 'ArrowUp') focusCell(r - 1, c);
  }

  return (
    <div className="flex flex-col gap-2">
      {rule ? <p className="text-xs text-muted">{rule}</p> : null}
      <p className="text-xs text-muted">
        Escribe o pega un bloque copiado de Excel. Intro baja a la fila siguiente; cada fila se
        guarda al salir de ella. Vaciar una fila borra su resultado.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table ref={grid} className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-2 py-1 font-medium">
                Fila
              </th>
              {Array.from({ length: width }, (_, i) => (
                <th key={i} scope="col" className="px-2 py-1 font-medium">
                  Intento {i + 1}
                </th>
              ))}
              <th scope="col" className="px-2 py-1 font-medium">
                Resultado
              </th>
              <th scope="col" className="px-2 py-1 font-medium">
                <span className="sr-only">Estado</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const st = status[row.key];
              return (
                <tr
                  key={row.key}
                  className="border-t border-border"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) flush(row.key);
                  }}
                >
                  <th scope="row" className="px-2 py-1 text-left font-medium whitespace-nowrap">
                    {row.label}
                    {row.sublabel ? (
                      <span className="ml-1 text-xs font-normal text-muted">{row.sublabel}</span>
                    ) : null}
                  </th>
                  {cells[row.key]!.map((v, c) => (
                    <td key={c} className="px-1 py-1">
                      <input
                        data-r={r}
                        data-c={c}
                        inputMode="decimal"
                        aria-label={`${row.label}${row.sublabel ? ` ${row.sublabel}` : ''}, intento ${c + 1} (${row.unit})`}
                        value={v}
                        onChange={(e) => setCell(row.key, c, e.target.value)}
                        onPaste={(e) => onPaste(e, r, c)}
                        onKeyDown={(e) => onKey(e, r, c)}
                        className="h-9 w-20 rounded border border-border bg-bg px-2 text-right tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                    {row.value ?? '—'} <span className="text-xs text-muted">{row.unit}</span>
                    {row.flag ? <span className="ml-1 text-xs text-warn">{row.flag}</span> : null}
                  </td>
                  <td className="px-2 py-1 text-xs whitespace-nowrap" aria-live="polite">
                    {st?.kind === 'saving' ? (
                      <span className="text-muted">Guardando…</span>
                    ) : st?.kind === 'saved' ? (
                      <span className="text-ok">Guardado</span>
                    ) : st?.kind === 'error' ? (
                      <span className="text-danger">{st.message}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
