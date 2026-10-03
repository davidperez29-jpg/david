import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/card';
import { label } from '@/lib/labels';

type Level = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

const LEVEL_TONE: Record<Level, 'ok' | 'accent' | 'warn' | 'danger' | 'neutral'> = {
  A: 'ok',
  B: 'ok',
  C: 'accent',
  D: 'warn',
  E: 'neutral',
  F: 'neutral',
  G: 'neutral',
  H: 'danger',
};

/** Evidence level with its meaning, never a bare letter (§10.4). */
export function LevelBadge({ level }: { level: string }) {
  return (
    <Badge tone={LEVEL_TONE[level as Level] ?? 'neutral'}>{label('evidenceLevel', level)}</Badge>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const tone =
    status === 'verified' || status === 'verified_with_corrections'
      ? 'ok'
      : status === 'retracted'
        ? 'danger'
        : 'warn';
  return <Badge tone={tone}>{label('verification', status)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === 'published' ? 'ok' : status === 'deprecated' ? 'danger' : 'neutral'}>
      {label('scienceStatus', status)}
    </Badge>
  );
}

const ext = 'text-accent underline underline-offset-2';

/** DOI and PubMed links. Identifiers only come from verified records, never typed by the UI. */
export function Identifiers({ doi, pmid }: { doi: string | null; pmid: string | null }) {
  if (!doi && !pmid) return <span className="text-muted">Sin DOI ni PMID</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3">
      {doi ? (
        <a
          className={ext}
          href={`https://doi.org/${doi}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          DOI {doi}
        </a>
      ) : null}
      {pmid ? (
        <a
          className={ext}
          href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          PMID {pmid}
        </a>
      ) : null}
    </span>
  );
}

export function citation(s: { authors?: string[] | null; year?: number | null }): string {
  const a = s.authors ?? [];
  const who = a.length === 0 ? 's. a.' : a.length > 2 ? `${a[0]} et al.` : a.join(' y ');
  return `${who} (${s.year ?? 's. f.'})`;
}

/** Shown wherever bibliographic data was checked against PubMed. */
export function PubMedAttribution({ method }: { method: string | null | undefined }) {
  if (!method || !/pubmed/i.test(method)) return null;
  return <p className="text-xs text-muted">Según PubMed (NCBI). Verificación: {method}.</p>;
}

export function QaList({
  issues,
  empty = 'Sin incidencias de calidad.',
}: {
  issues: { code: string; severity: string; message: string; href?: string; label?: string }[];
  empty?: ReactNode;
}) {
  if (!issues.length) return <p className="text-sm text-ok">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {issues.map((i, n) => (
        <li key={`${i.code}-${n}`} className="flex flex-wrap items-start gap-2">
          <Badge tone={i.severity === 'error' ? 'danger' : 'warn'}>
            {i.severity === 'error' ? 'Bloquea' : 'Revisar'}
          </Badge>
          <span>
            {i.href ? (
              <a className="font-medium underline" href={i.href}>
                {i.label}
              </a>
            ) : null}
            {i.href ? ': ' : ''}
            {i.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScienceDisclaimer() {
  return (
    <p className="text-xs text-muted">
      La evidencia orienta; no diagnostica ni garantiza resultados. Ante dolor, lesión o síntomas:
      requiere valoración por profesional sanitario. El entrenador decide.
    </p>
  );
}
