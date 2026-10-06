import Link from 'next/link';
import { getClient, getInjury, injuryComparison } from '@tp/application';
import { DomainError, localDate } from '@tp/domain';
import { notFound } from 'next/navigation';
import {
  AdvancePhaseButton,
  AlertReviewForm,
  CloseInjuryButton,
  CriterionCheck,
  DecisionForm,
  RequestDecisionButton,
  SymptomForm,
} from '@/components/injury/forms';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatDateTime, formatValue } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { STATUS_TONE } from '../../injury-tab';

const EVIDENCE_TONE = { evidence: 'ok', consensus: 'accent', practical: 'neutral' } as const;
const READING_TONE = {
  improves: 'ok',
  worsens: 'danger',
  stable: 'neutral',
  no_data: 'neutral',
} as const;
const CHECK_TONE = { met: 'ok', pending: 'warn', not_applicable: 'neutral' } as const;
const CHECK_LABEL = { met: 'Cumplido', pending: 'Pendiente', not_applicable: 'No aplica' } as const;
const v = (x: number | null) => (x == null ? '—' : formatValue(x));

/**
 * Injury case (restructure phase 7): LESIÓN → FASE → CRITERIOS → PROGRESIÓN → RETURN TO SPORT.
 * Alerts first (they block progression), then the current phase with its criteria and
 * [Avanzar de fase], the return-to-sport screen, symptoms, the readaptation comparison (only the
 * protocol's variables) and the protocol with its sources. Never «apto».
 */
export default async function InjuryPage({
  params,
}: {
  params: Promise<{ clientId: string; injuryId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, injuryId } = await params;
  const [client, c, cmp] = await Promise.all([
    getClient(ctx, clientId),
    getInjury(ctx, clientId, injuryId),
    injuryComparison(ctx, clientId, injuryId, {}),
  ]).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const today = localDate(new Date());
  const open = c.status !== 'closed';
  const openAlerts = c.alerts.filter((a) => !a.reviewedAt);
  const phaseIdx = c.phase ? c.phase.number - 1 : -1;
  const next = c.protocol?.phases[phaseIdx + 1] ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/app/clients/${clientId}?tab=readaptacion`}
          className="text-sm text-muted hover:underline"
        >
          ← {client.firstName} {client.lastName} · Readaptación
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {c.condition}
            {c.side !== 'none' ? ` · ${c.sideLabel.toLowerCase()}` : ''}
          </h1>
          <Badge tone={STATUS_TONE[c.status]}>{c.statusLabel}</Badge>
        </div>
        <p className="text-sm text-muted">
          {[
            `Lesión: ${formatDate(c.occurredOn)}`,
            c.protocol ? `${c.protocol.name} · v${c.protocol.protocolVersion}` : 'Sin protocolo',
            c.phase
              ? `Fase ${c.phase.number}/${c.protocol!.phases.length} desde ${formatDate(c.phaseStartedOn!)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {openAlerts.length ? (
        <section
          aria-labelledby="alerts-h"
          className="flex flex-col gap-3 rounded-lg border border-danger p-4"
        >
          <h2 id="alerts-h" className="text-base font-semibold text-danger">
            Alertas de seguridad sin revisar ({openAlerts.length})
          </h2>
          <p className="text-sm">
            Bloquean el avance de fase hasta que una persona las revise. Ante síntomas neurológicos,
            empeoramiento claro o dolor que no cede: requiere valoración por profesional sanitario.
          </p>
          <ul className="flex flex-col gap-3">
            {openAlerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-sm">
                  <Badge tone={a.severity === 'stop' ? 'danger' : 'warn'}>
                    {a.severity === 'stop' ? 'Detener' : 'Revisar'}
                  </Badge>{' '}
                  {a.message} <span className="text-muted">({formatDateTime(a.createdAt)})</span>
                </p>
                {open ? (
                  <AlertReviewForm clientId={clientId} injuryId={injuryId} alertId={a.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {c.phase ? (
        <Card title={`Fase ${c.phase.number}: ${c.phase.name}`}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {c.phase.goals.length ? (
                <div>
                  <h3 className="font-medium">Objetivos</h3>
                  <ul className="list-disc pl-5">
                    {c.phase.goals.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {c.phase.exercises.length ? (
                <div>
                  <h3 className="font-medium">Ejercicios orientativos</h3>
                  <ul className="list-disc pl-5">
                    {c.phase.exercises.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {c.phase.dosage ? (
                <p>
                  <span className="font-medium">Dosis: </span>
                  {c.phase.dosage}
                </p>
              ) : null}
              {c.phase.restrictions || c.restrictions ? (
                <p>
                  <span className="font-medium">Restricciones: </span>
                  {[c.phase.restrictions, c.restrictions].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Criterios de la fase</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Criterio
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Tipo
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.phase.criteria.map((k) => {
                    const st = k.state;
                    return (
                      <tr key={k.id} className="border-b border-border align-top">
                        <td className="py-2 pr-3">
                          <p>
                            {k.text}
                            {k.mandatory && (k.role === 'progression' || k.role === 'success') ? (
                              <span className="text-muted"> (obligatorio)</span>
                            ) : null}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            <Badge tone={EVIDENCE_TONE[k.evidence]}>{k.evidenceLabel}</Badge>
                          </p>
                          {k.sources.length || k.limitations ? (
                            <details className="mt-1 text-xs text-muted">
                              <summary className="cursor-pointer">Fuentes y limitaciones</summary>
                              <ul className="list-disc pl-5">
                                {k.sources.map((s) => (
                                  <li key={s}>{s}</li>
                                ))}
                              </ul>
                              {k.limitations ? <p>{k.limitations}</p> : null}
                            </details>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-muted">{k.roleLabel}</td>
                        <td className="py-2 pr-3">
                          {st?.source === 'auto' ? (
                            <span>
                              <Badge tone={st.met ? 'ok' : 'warn'}>
                                {st.met ? 'Cumplido' : 'No cumplido'}
                              </Badge>{' '}
                              <span className="text-muted">
                                {k.auto?.metric === 'lsi' ? 'Simetría' : 'Valor'} {v(st.value)}
                                {k.auto?.metric === 'lsi' ? ' %' : ''} (evaluación{' '}
                                {formatDate(st.checkedOn!)}; objetivo {k.auto?.operator}{' '}
                                {v(k.auto?.threshold ?? null)})
                              </span>
                            </span>
                          ) : open && k.role !== 'stop' ? (
                            <div className="flex flex-col gap-1">
                              {k.auto ? (
                                <span className="text-xs text-muted">
                                  Sin evaluación de este test después de la lesión: regístralo en
                                  Evaluación o márcalo a mano.
                                </span>
                              ) : null}
                              <CriterionCheck
                                clientId={clientId}
                                injuryId={injuryId}
                                criterionId={k.id}
                                met={st?.met ?? null}
                                name={k.text}
                              />
                            </div>
                          ) : open ? (
                            <CriterionCheck
                              clientId={clientId}
                              injuryId={injuryId}
                              criterionId={k.id}
                              met={st?.met ?? null}
                              name={k.text}
                            />
                          ) : (
                            <span className="text-muted">
                              {st?.met == null ? 'Sin dato' : st.met ? 'Cumplido' : 'No cumplido'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {open ? (
              <AdvancePhaseButton
                clientId={clientId}
                injuryId={injuryId}
                phaseId={c.phase.id}
                allowed={c.canAdvance.allowed}
                reasons={c.canAdvance.reasons}
                nextName={next?.name ?? null}
              />
            ) : null}
          </div>
        </Card>
      ) : (
        <Card title="Fases">
          <EmptyState>Este caso no tiene protocolo asignado.</EmptyState>
        </Card>
      )}

      <Card title="Vuelta al deporte">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            La plataforma reúne los criterios; la decisión la toma y la firma el equipo responsable
            (sanitario, cuerpo técnico y deportista).
          </p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {c.checklist.map((i) => (
              <li key={i.item} className="flex items-center justify-between gap-2">
                <span>{i.label}</span>
                <Badge tone={CHECK_TONE[i.status]}>{CHECK_LABEL[i.status]}</Badge>
              </li>
            ))}
          </ul>
          {c.status === 'ready_for_assessment' && open ? (
            <RequestDecisionButton clientId={clientId} injuryId={injuryId} />
          ) : null}
          {c.decisions.length ? (
            <div>
              <h3 className="text-sm font-medium">Decisiones registradas</h3>
              <ul className="divide-y divide-border text-sm">
                {c.decisions.map((d) => (
                  <li key={d.id} className="py-2">
                    <span className="font-medium">{d.stageLabel}:</span> {d.outcomeLabel} ·{' '}
                    {d.decidedByName} ({d.decidedByRole}), {formatDate(d.decidedOn)}
                    {d.rationale ? <p className="text-muted">{d.rationale}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {open ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-accent">
                Registrar una decisión del equipo responsable
              </summary>
              <div className="mt-3">
                <DecisionForm
                  clientId={clientId}
                  injuryId={injuryId}
                  stages={c.stages}
                  outcomes={c.outcomes}
                  today={today}
                />
              </div>
            </details>
          ) : null}
        </div>
      </Card>

      <Card title="Síntomas">
        <div className="flex flex-col gap-4">
          {open ? (
            <SymptomForm
              clientId={clientId}
              injuryId={injuryId}
              today={today}
              painThreshold={c.protocol?.painThreshold ?? 5}
            />
          ) : null}
          {c.symptoms.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Registros de síntomas</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Fecha
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Dolor
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Señales y nota
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.symptoms.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="py-2 pr-3 tabular-nums">{formatDate(s.recordedOn)}</td>
                      <td className="py-2 pr-3 tabular-nums">{s.pain}/10</td>
                      <td className="py-2 pr-3">
                        {[
                          s.worseThanBefore && 'peor',
                          s.persistsNextDay && 'persiste',
                          s.swelling && 'inflamación',
                          s.instability && 'inestabilidad',
                          s.functionLoss && 'pérdida de función',
                          s.adverseReaction && 'reacción adversa',
                          s.neurological && 'neurológicos',
                          s.note,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Sin registros de síntomas.</EmptyState>
          )}
        </div>
      </Card>

      <Card title="Comparativa de readaptación">
        {cmp.rows.length ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Solo las variables del protocolo. En los tests por lados se muestra el lado afectado y
              la simetría (afectado / sano). «Mejora» o «Empeora» solo cuando el cambio supera el
              error de medida conocido.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Evolución de las variables del protocolo</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Test
                    </th>
                    {cmp.columns.map((col) => (
                      <th key={col.id} scope="col" className="py-2 pr-3 font-medium">
                        {col.label === col.date ? formatDate(col.date) : col.label}
                        <span className="block text-xs font-normal">
                          {col.phase ?? (col.label === col.date ? '' : formatDate(col.date))}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Lectura
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.rows.map((r) => (
                    <tr key={r.slug} className="border-b border-border align-top">
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        {r.name} <span className="text-muted">({r.unit})</span>
                      </th>
                      {r.cells.map((cell) => (
                        <td key={cell.assessmentId} className="py-2 pr-3 tabular-nums">
                          {v(cell.value)}
                          {cell.lsi != null ? (
                            <span className="block text-xs text-muted">
                              Simetría {v(cell.lsi)} %
                            </span>
                          ) : null}
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        <Badge tone={READING_TONE[r.reading]}>{r.readingLabel}</Badge>
                        {!r.errorKnown && r.reading !== 'no_data' ? (
                          <span className="block text-xs text-muted">
                            Error de medida desconocido
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cmp.notes.map((n) => (
              <p key={n} className="text-xs text-muted">
                {n}
              </p>
            ))}
          </div>
        ) : (
          <EmptyState>
            {cmp.notes[0] ?? 'Sin datos.'}{' '}
            <Link
              href={`/app/clients/${clientId}?tab=evaluacion`}
              className="text-accent underline"
            >
              Registrar una evaluación
            </Link>
          </EmptyState>
        )}
      </Card>

      <Card title="Información del caso">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {c.diagnosis ? (
            <div className="sm:col-span-2">
              <dt className="font-medium">Información recibida del profesional sanitario</dt>
              <dd>{c.diagnosis}</dd>
            </div>
          ) : null}
          {c.professional ? (
            <div>
              <dt className="font-medium">Profesional</dt>
              <dd>{c.professional}</dd>
            </div>
          ) : null}
          {c.mechanism ? (
            <div>
              <dt className="font-medium">Mecanismo</dt>
              <dd>{c.mechanism}</dd>
            </div>
          ) : null}
        </dl>
        {c.history.length ? (
          <div className="mt-3">
            <h3 className="text-sm font-medium">Historial de fases</h3>
            <ol className="list-decimal pl-5 text-sm">
              {c.history.map((h) => (
                <li key={`${h.phaseId}-${h.startedOn}`}>
                  {h.phase}: {formatDate(h.startedOn)}
                  {h.endedOn ? ` → ${formatDate(h.endedOn)}` : ' (actual)'}
                  {h.note ? <span className="text-muted"> · {h.note}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {open ? (
          <div className="mt-3">
            <CloseInjuryButton clientId={clientId} injuryId={injuryId} />
          </div>
        ) : null}
      </Card>

      {c.protocol ? (
        <Card title="Protocolo">
          <div className="flex flex-col gap-2 text-sm">
            <ol className="list-decimal pl-5">
              {c.protocol.phases.map((p, i) => (
                <li key={p.id} className={i === phaseIdx ? 'font-medium' : 'text-muted'}>
                  {p.name}
                  {i === phaseIdx ? ' (actual)' : ''}
                </li>
              ))}
            </ol>
            {c.protocol.painThresholdBasis ? (
              <p>
                <span className="font-medium">Umbral de dolor {c.protocol.painThreshold}/10: </span>
                {c.protocol.painThresholdBasis}
              </p>
            ) : null}
            {c.protocol.limitations ? (
              <p>
                <span className="font-medium">Limitaciones: </span>
                {c.protocol.limitations}
              </p>
            ) : null}
            {c.protocol.sources.length ? (
              <details>
                <summary className="cursor-pointer font-medium">Fuentes</summary>
                <ul className="list-disc pl-5 text-muted">
                  {c.protocol.sources.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
