'use client';

import { useEffect, useState } from 'react';
import { formatCell, parseSessionTsv, type PastedRow } from '@tp/domain';
import { ExerciseCombobox } from '@/components/library/exercise-combobox';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import type { NewRow, StoreResult } from './grid-store';

interface Resolution {
  name: string;
  match: { id: string; name: string } | null;
  candidates: { id: string; name: string; score: number }[];
}

const SHOWN = ['sets', 'reps', 'load', 'rir', 'rpe', 'rest'] as const;
const LABEL: Record<(typeof SHOWN)[number], string> = {
  sets: 'Series',
  reps: 'Reps',
  load: 'Carga',
  rir: 'RIR',
  rpe: 'RPE',
  rest: 'Desc.',
};

/**
 * Rows copied from Excel or Google Sheets → preview → added to the session in one go. Exercises are
 * recognized by name; when unsure the trainer picks one. Nothing is added until confirmed, and if
 * any row is invalid nothing is added at all.
 */
export function PastePanel({
  gridId,
  initial,
  onAdd,
  onDone,
}: {
  gridId: string;
  initial: string;
  /** Adds the rows where the table saves (a client's session or a template). */
  onAdd: (rows: NewRow[]) => Promise<StoreResult<{ ids: string[] }>>;
  onDone: (ids: string[]) => void;
}) {
  const [text, setText] = useState(initial);
  const [rows, setRows] = useState<PastedRow[]>(() => parseSessionTsv(initial));
  const [found, setFound] = useState<Resolution[]>([]);
  const [chosen, setChosen] = useState<Record<number, { id: string; name: string }>>({});
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const parsed = parseSessionTsv(text);
    setRows(parsed);
    setChosen({});
    setSkip(new Set());
    setRowErrors({});
    setError(null);
    if (!parsed.length) return setFound([]);
    let live = true;
    const t = setTimeout(async () => {
      const r = await api<Resolution[]>('/exercises/resolve', {
        method: 'POST',
        body: { names: parsed.map((p) => p.exercise || '—') },
      });
      if (live) {
        if (r.ok) setFound(r.data);
        else setError(r.error.message);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text]);

  const exerciseOf = (i: number) => chosen[i] ?? found[i]?.match ?? null;
  const ready = rows
    .map((row, i) => ({ row, i, ex: exerciseOf(i) }))
    .filter((x) => !skip.has(x.i) && x.ex);
  const missing = rows.filter((_, i) => !skip.has(i) && !exerciseOf(i)).length;

  async function add() {
    setPending(true);
    setError(null);
    const res = await onAdd(
      ready.map(({ row, ex }) => ({
        exerciseId: ex!.id,
        exerciseName: ex!.name,
        prescription: row.prescription,
        notesForClient: row.notes,
      })),
    );
    setPending(false);
    if (res.ok) return onDone(res.ids);
    setError(res.message);
    const byRow: Record<number, string> = {};
    for (const [k, v] of Object.entries(res.details ?? {})) {
      const m = /^rows\.(\d+)\./.exec(k);
      if (m) byRow[ready[Number(m[1])]!.i] = v.join(' ');
    }
    setRowErrors(byRow);
  }

  return (
    <section
      aria-label="Pegar filas desde Excel"
      className="flex flex-col gap-3 rounded-md border border-accent bg-bg p-3"
    >
      <label htmlFor={`${gridId}-paste`} className="text-sm font-medium">
        Pega aquí las filas copiadas de Excel o Google Sheets (con o sin la fila de títulos)
      </label>
      <textarea
        id={`${gridId}-paste`}
        autoFocus={!initial}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(8, Math.max(3, text.split('\n').length))}
        placeholder={
          'EJERCICIO\tSERIES\tREPS\tCARGA\tDESC.\nSentadilla trasera con barra\t4\t6-8\t80 kg\t2:30'
        }
        className="w-full rounded-md border border-border bg-bg p-2 font-mono text-xs"
      />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Vista previa de las filas pegadas</caption>
            <thead className="text-left text-muted">
              <tr>
                <th scope="col" className="py-1 pr-2">
                  Añadir
                </th>
                <th scope="col" className="pr-2">
                  Ejercicio
                </th>
                {SHOWN.map((c) => (
                  <th key={c} scope="col" className="pr-2">
                    {LABEL[c]}
                  </th>
                ))}
                <th scope="col">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => {
                const ex = exerciseOf(i);
                const res = found[i];
                const problems = [
                  ...Object.entries(row.errors).map(
                    ([k, v]) => `${LABEL[k as keyof typeof LABEL] ?? k}: ${v}`,
                  ),
                  ...(rowErrors[i] ? [rowErrors[i]!] : []),
                ];
                return (
                  <tr key={i} className={skip.has(i) ? 'opacity-50' : undefined}>
                    <td className="py-1 pr-2 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Añadir la fila ${row.line} (${row.exercise || 'sin nombre'})`}
                        checked={!skip.has(i)}
                        onChange={() =>
                          setSkip((s) => {
                            const n = new Set(s);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="min-w-56 pr-2 align-top">
                      {ex ? (
                        <span>
                          <span className="font-medium">{ex.name}</span>
                          {ex.name !== row.exercise ? (
                            <span className="text-muted"> («{row.exercise}»)</span>
                          ) : null}{' '}
                          <span className="text-ok">
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">reconocido</span>
                          </span>
                        </span>
                      ) : res ? (
                        <span className="flex flex-col gap-1">
                          <span className="text-warn">
                            «{row.exercise || 'sin nombre'}»: elige el ejercicio
                          </span>
                          {res.candidates.length ? (
                            <select
                              aria-label={`Ejercicio para «${row.exercise}»`}
                              className="h-8 rounded border border-border bg-bg px-1"
                              value=""
                              onChange={(e) => {
                                const c = res.candidates.find((x) => x.id === e.target.value);
                                if (c) setChosen({ ...chosen, [i]: { id: c.id, name: c.name } });
                              }}
                            >
                              <option value="">Parecidos…</option>
                              {res.candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <ExerciseCombobox
                            label={`Buscar el ejercicio de la fila ${row.line}`}
                            placeholder="Buscar otro…"
                            onPick={(h) => setChosen({ ...chosen, [i]: h })}
                          />
                        </span>
                      ) : (
                        <span className="text-muted">Buscando…</span>
                      )}
                      {problems.length ? (
                        <p className="mt-1 text-danger">{problems.join(' · ')}</p>
                      ) : null}
                    </td>
                    {SHOWN.map((c) => (
                      <td key={c} className="pr-2 align-top tabular-nums">
                        {formatCell(c, row.prescription) || '·'}
                      </td>
                    ))}
                    <td className="align-top">{row.notes ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending || !ready.length || missing > 0}
          onClick={() => void add()}
        >
          {pending
            ? 'Añadiendo…'
            : `Añadir ${ready.length} ejercicio${ready.length === 1 ? '' : 's'}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone([])}>
          Cancelar
        </Button>
        {missing ? (
          <span className="text-xs text-warn">
            {missing} fila(s) sin ejercicio: elígelo o desmarca la fila.
          </span>
        ) : null}
      </div>
    </section>
  );
}
