'use client';

import type { SessionDetail } from '@tp/application';
import { useMemo } from 'react';
import { SessionGrid, type GridBlock } from '@/components/sessions/session-grid';
import { label } from '@/lib/labels';
import { ExerciseRow } from './forms';

/**
 * The session as a spreadsheet-like table (restructure phase 2). Advanced options of each row
 * (tempo, velocity, methods, alternatives, coach notes) open under the row with «⋯».
 */
export function SessionTable({ s, editable }: { s: SessionDetail; editable: boolean }) {
  const blocks: GridBlock[] = useMemo(
    () =>
      s.blocks.map((b) => ({
        id: b.id,
        title: `${b.label ?? label('blockType', b.type)} · ${label('blockOrganization', b.organization)}${b.rounds ? ` · ${b.rounds} vueltas` : ''}`,
        rows: b.exercises.map((e) => ({
          id: e.id,
          blockId: b.id,
          version: e.version,
          exercise: { id: e.exercise.id, name: e.exercise.name },
          category: e.categories[0] ?? null,
          prescription: e.prescription,
          notes: e.notesForClient,
          derived: e.derived,
          issues: Object.values(e.issues).flat(),
        })),
      })),
    [s],
  );
  const byId = useMemo(
    () => new Map(s.blocks.flatMap((b) => b.exercises.map((e) => [e.id, e] as const))),
    [s],
  );
  return (
    <SessionGrid
      sessionId={s.id}
      blocks={blocks}
      editable={editable}
      renderDetails={(id) => {
        const e = byId.get(id);
        return e ? (
          <ul>
            <ExerciseRow key={`${e.id}-${e.version}`} e={e} editable={editable} />
          </ul>
        ) : null;
      }}
    />
  );
}
