import type { Explanation } from '@tp/domain';
import { label } from '@/lib/labels';

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</dt>
      <dd>
        <ul className="list-disc pl-5">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

/**
 * "¿Por qué?" (§13.6): DATOS → INTERPRETACIÓN → REGLA → EVIDENCIA → APLICABILIDAD →
 * LIMITACIONES → CONFIANZA. Native <details>, so it works without JavaScript and with a keyboard.
 */
export function Why({ e }: { e: Explanation }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent underline-offset-2 hover:underline">
        ¿Por qué?
      </summary>
      <dl className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
        <Section title="Datos" items={e.data} />
        <Section title="Interpretación" items={e.interpretation} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Regla</dt>
          <dd className="font-mono text-xs">
            {e.rules.map((r) => `${r.key} (v${r.version})`).join(' · ') || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Evidencia</dt>
          <dd>
            {e.evidence.length === 0 ? (
              <span className="text-muted">
                Sin afirmación científica aplicable: recomendación práctica configurable (nivel F).
              </span>
            ) : (
              <ul className="flex flex-col gap-1">
                {e.evidence.map((ev) => (
                  <li key={ev.claimKey}>
                    {ev.statement}{' '}
                    <span className="text-xs text-muted">
                      (confianza {label('confidence', ev.confidence).toLowerCase()})
                    </span>
                    {ev.sources.length ? (
                      <ul className="pl-4 text-xs text-muted">
                        {ev.sources.map((s, i) => (
                          <li key={i}>
                            {s.citation}
                            {s.doi ? (
                              <>
                                {' · '}
                                <a
                                  className="underline"
                                  href={`https://doi.org/${s.doi}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  DOI {s.doi}
                                </a>
                              </>
                            ) : null}
                            {s.pmid ? ` · PMID ${s.pmid}` : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <Section title="Aplicabilidad" items={e.applicability} />
        <Section title="Limitaciones" items={e.limitations} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Confianza</dt>
          <dd>{label('confidence', e.confidence)}</dd>
        </div>
      </dl>
    </details>
  );
}
