'use client';

import Link from 'next/link';
import { useState } from 'react';
import { announce } from '@/components/ui/announcer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FormError, useApiAction } from '@/components/use-form';
import { label, LABELS } from '@/lib/labels';

type Item = {
  id: string;
  name: string;
  version: number;
  status: string;
  pattern: string | null;
  level: string | null;
  categories: string[];
  gaps: string[];
  reviewNotes: string | null;
};
type Option = { id: string; name: string };

const ACTIONS = [
  ['set_pattern', 'Poner patrón de movimiento'],
  ['add_category', 'Añadir categoría'],
  ['add_primary_muscle', 'Añadir músculo principal'],
  ['set_level', 'Poner nivel'],
  ['set_profile', 'Poner perfil de prescripción'],
  ['mark_reviewed', 'Marcar como revisados'],
  ['publish', 'Publicar (solo los completos)'],
  ['archive', 'Archivar'],
] as const;
type Kind = (typeof ACTIONS)[number][0];
const NEEDS_VALUE: Partial<
  Record<Kind, 'patterns' | 'categories' | 'muscles' | 'levels' | 'profiles'>
> = {
  set_pattern: 'patterns',
  add_category: 'categories',
  add_primary_muscle: 'muscles',
  set_level: 'levels',
  set_profile: 'profiles',
};
const PARAM: Partial<Record<Kind, string>> = {
  set_pattern: 'patternId',
  add_category: 'categoryId',
  add_primary_muscle: 'muscleId',
  set_level: 'level',
  set_profile: 'profileId',
};

/**
 * The queue with checkboxes and one change for the selected exercises (restructure phase 19).
 * Texts are never written in bulk: each exercise opens with «Revisar» to complete it by hand.
 */
export function ReviewTable({
  items,
  options,
  queue,
  focusId,
}: {
  items: Item[];
  options: { patterns: Option[]; categories: Option[]; muscles: Option[]; profiles: Option[] };
  /** The queue's filters, carried to the exercise page for «Siguiente». */
  queue: string;
  focusId: string;
}) {
  const a = useApiAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>('mark_reviewed');
  const [value, setValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    applied: number;
    unchanged: number;
    skipped: { id: string; name: string | null; reason: string }[];
  } | null>(null);
  const valueList = NEEDS_VALUE[kind];
  const values: Option[] =
    valueList === 'levels'
      ? Object.entries(LABELS.level).map(([id, name]) => ({ id, name }))
      : valueList
        ? options[valueList]
        : [];
  const allOnPage = items.length > 0 && items.every((i) => selected.includes(i.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...new Set([...s, id])] : s.filter((x) => x !== id)));

  const apply = async () => {
    setConfirming(false);
    const r = await a.run<NonNullable<typeof result>>('/exercise-review/bulk', 'POST', {
      ids: selected,
      expectedVersions: Object.fromEntries(
        items.filter((i) => selected.includes(i.id)).map((i) => [i.id, i.version]),
      ),
      edit: { kind, ...(PARAM[kind] ? { [PARAM[kind]!]: value } : {}) },
    });
    if (!r) return;
    setResult(r);
    setSelected([]);
    announce(
      `${r.applied} cambiados, ${r.unchanged} ya estaban así y ${r.skipped.length} sin cambiar.`,
      focusId,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">
          Cambiar los seleccionados ({selected.length})
        </legend>
        <label className="flex flex-col gap-1 text-sm">
          Cambio
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setValue('');
              setConfirming(false);
            }}
            className="h-9 rounded-md border border-border bg-bg px-2"
          >
            {ACTIONS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {valueList ? (
          <label className="flex flex-col gap-1 text-sm">
            Valor
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 min-w-48 rounded-md border border-border bg-bg px-2"
            >
              <option value="">Elige…</option>
              {values.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'archive' && confirming ? (
          <span
            role="group"
            aria-label="Confirmar archivo"
            className="flex items-center gap-2 text-sm"
          >
            ¿Archivar {selected.length} ejercicios? Se pueden volver a borrador.
            <Button variant="danger" size="sm" autoFocus disabled={a.pending} onClick={apply}>
              Sí, archivar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button
            disabled={a.pending || !selected.length || (!!valueList && !value)}
            onClick={() => (kind === 'archive' ? setConfirming(true) : void apply())}
          >
            Aplicar a {selected.length} {selected.length === 1 ? 'ejercicio' : 'ejercicios'}
          </Button>
        )}
        <p className="w-full text-xs text-muted">
          Cada ejercicio se cambia y se audita por separado. Los que alguien ha modificado mientras
          tanto, los globales y los archivados se dejan como están y se listan abajo. Las
          explicaciones e instrucciones se escriben una a una con «Revisar».
        </p>
      </fieldset>
      <FormError error={a.error} />
      <div role="status" className="text-sm">
        {result ? (
          <div className="rounded-md border border-border p-3">
            <p>
              {result.applied} cambiados · {result.unchanged} ya estaban así ·{' '}
              {result.skipped.length} sin cambiar
            </p>
            {result.skipped.length ? (
              <ul className="mt-1 list-inside list-disc text-muted">
                {result.skipped.map((s) => (
                  <li key={s.id}>
                    {s.name ?? 'Ejercicio desconocido'}: {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Ejercicios de la cola con lo que les falta; marca los que quieras cambiar a la vez
          </caption>
          <thead className="text-left text-xs text-muted uppercase">
            <tr>
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los de esta página"
                  checked={allOnPage}
                  onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
                />
              </th>
              <th className="py-2">Ejercicio</th>
              <th>Patrón</th>
              <th>Nivel</th>
              <th>Le falta</th>
              <th>
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((e) => (
              <tr key={e.id}>
                <td className="py-2 align-top">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar «${e.name}»`}
                    checked={selected.includes(e.id)}
                    onChange={(ev) => toggle(e.id, ev.target.checked)}
                  />
                </td>
                <td className="py-2 align-top">
                  <span className="font-medium">{e.name}</span>
                  {e.categories.length ? (
                    <div className="text-xs text-muted">{e.categories.join(' · ')}</div>
                  ) : null}
                  {e.reviewNotes ? (
                    <div className="max-w-md text-xs text-muted">{e.reviewNotes}</div>
                  ) : null}
                </td>
                <td className="align-top">{e.pattern ?? <span className="text-muted">—</span>}</td>
                <td className="align-top">{label('level', e.level)}</td>
                <td className="align-top">
                  <span className="flex flex-wrap gap-1 py-2">
                    {e.status === 'published' ? <Badge tone="ok">Publicado</Badge> : null}
                    {e.gaps.length === 0 && e.status !== 'published' ? (
                      <Badge tone="ok">Listo para publicar</Badge>
                    ) : null}
                    {e.gaps.map((g) => (
                      <Badge key={g} tone={g === 'broken_video' ? 'danger' : 'warn'}>
                        {label('reviewGap', g)}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td className="align-top py-2">
                  <Link
                    href={`/app/library/${e.id}?revision=${encodeURIComponent(queue)}`}
                    className="text-accent underline"
                    aria-label={`Revisar «${e.name}»`}
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
