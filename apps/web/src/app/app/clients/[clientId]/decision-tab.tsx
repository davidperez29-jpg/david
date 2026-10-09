import Link from 'next/link';
import { getDecision, type DecisionView, type RequestContext } from '@tp/application';
import type { Explanation, Priority } from '@tp/domain';
import {
  RecommendationActions,
  RunDecisionButton,
  TraitFlagControl,
} from '@/components/decision/actions';
import { Why } from '@/components/decision/why';
import { RuleOverrideToggle } from '@/components/monitoring/actions';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDateTime, label } from '@/lib/labels';

type Rec = DecisionView['recommendations'][number];

const DIRECTION_TONE = {
  desarrollar: 'accent',
  mantener: 'ok',
  'no prioritario': 'neutral',
} as const;
const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral' | 'accent'> = {
  proposed: 'accent',
  accepted: 'ok',
  accepted_with_changes: 'ok',
  rejected: 'danger',
  postponed: 'warn',
};
const num = (n: number) => n.toLocaleString('es-ES');

function Proposal({
  rec,
  clientId,
  title,
  children,
}: {
  rec: Rec | undefined;
  clientId: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{title}</span>
        {rec ? (
          <Badge tone={STATUS_TONE[rec.status] ?? 'neutral'}>
            {label('recommendationStatus', rec.status)}
          </Badge>
        ) : null}
        {rec?.decisionReason ? (
          <span className="text-xs text-muted">· {rec.decisionReason}</span>
        ) : null}
      </div>
      {children}
      {rec ? (
        <>
          <Why e={rec.explanation} />
          <RecommendationActions
            id={rec.id}
            clientId={clientId}
            type={rec.type}
            status={rec.status}
            payload={rec.payload}
            ruleKeys={rec.ruleKeys}
          />
        </>
      ) : null}
    </li>
  );
}

/** Client "Necesidades" tab: the engine's proposals, each with its "¿Por qué?" and the trainer's decision. */
export async function DecisionTab({
  ctx,
  clientId,
  isAdmin,
}: {
  ctx: RequestContext;
  clientId: string;
  isAdmin: boolean;
}) {
  const d = await getDecision(ctx, clientId);
  const intro = (
    <p className="text-sm text-muted">
      El motor propone necesidades, prioridades, métodos, ejercicios y dosis a partir de los datos
      del cliente, las reglas del centro y la evidencia verificada. Es una propuesta: tú decides, y
      cada cambio queda auditado. No es un diagnóstico.
    </p>
  );
  if (!d.run)
    return (
      <div className="flex flex-col gap-4">
        {intro}
        <Card
          title="Sin propuestas todavía"
          actions={<RunDecisionButton clientId={clientId} first />}
        >
          <EmptyState>
            Calcula las propuestas cuando el cliente tenga objetivo, perfil y evaluación.
          </EmptyState>
        </Card>
      </div>
    );

  const { result: r, context } = d.run;
  const recs = d.recommendations;
  const byType = (t: string) => recs.filter((x) => x.type === t);
  const flags = new Map(d.traitFlags.map((f) => [f.trait, f.value]));
  const referral = byType('referral_notice')[0];
  const plan = byType('plan_proposal')[0];
  // Missing data are already listed above; show only the other warnings.
  const warnings = r.warnings.filter((w) => !context.missing.includes(w));

  return (
    <div className="flex flex-col gap-4">
      {intro}
      <Card title="Cálculo" actions={<RunDecisionButton clientId={clientId} first={false} />}>
        <p className="text-sm">
          {formatDateTime(d.run.createdAt)} · reglas{' '}
          {d.run.ruleSetVersion ? `versión ${d.run.ruleSetVersion}` : 'por defecto'} · huella{' '}
          <code className="text-xs">{d.run.inputHash.slice(0, 10)}</code>
        </p>
        <p className="text-xs text-muted">
          Mismos datos y misma versión de reglas → misma propuesta. Recalcular sustituye las
          propuestas pendientes; las ya decididas quedan en el historial.
        </p>
        {context.missing.length ? (
          <div className="mt-2 text-sm">
            <span className="font-medium">Datos que faltan:</span>
            <ul className="list-disc pl-5 text-muted">
              {context.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warnings.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {warnings.map((w) => (
              <li key={w} className="rounded-md border border-warn px-2 py-1">
                {w}
              </li>
            ))}
          </ul>
        ) : null}
        {r.populationValues?.length ? (
          <div className="mt-2 text-sm">
            <span className="font-medium">Valores del centro para su población:</span>
            <ul className="list-disc pl-5 text-muted">
              {r.populationValues.map((p) => (
                <li key={p.ruleKey}>
                  {p.summary} ({p.population}){p.note ? ` · ${p.note}` : ''}{' '}
                  <span className="font-mono text-xs">{p.ruleKey}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {r.pendingRules.length ? (
          <p className="mt-2 text-sm">
            Reglas con parámetros sin definir:{' '}
            <span className="font-mono text-xs">
              {r.pendingRules.map((p) => `${p.key} (${p.params.join(', ')})`).join(' · ')}
            </span>
            .{' '}
            {isAdmin ? (
              <Link href="/app/settings/decision" className="text-accent underline">
                Definir umbrales del centro
              </Link>
            ) : (
              'Pide a la administración que defina los umbrales del centro.'
            )}
          </p>
        ) : null}
      </Card>

      <Card title="Cribado">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge
            tone={
              r.screening.status === 'clear'
                ? 'ok'
                : r.screening.status === 'refer'
                  ? 'danger'
                  : 'warn'
            }
          >
            {r.screening.status === 'clear'
              ? 'Sin limitaciones declaradas'
              : r.screening.status === 'refer'
                ? 'Requiere valoración por profesional sanitario'
                : 'Precaución'}
          </Badge>
        </p>
        {r.screening.reasons.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {r.screening.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        {referral ? (
          <ul>
            <Proposal rec={referral} clientId={clientId} title="Aviso de derivación" />
          </ul>
        ) : null}
      </Card>

      <Card title="Perfil">
        <ul className="divide-y divide-border">
          {r.traits.map((t) => (
            <li key={t.key} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.label}</span>
                <Badge tone={t.value === true ? 'warn' : t.value === false ? 'ok' : 'neutral'}>
                  {t.value === true ? 'Sí' : t.value === false ? 'No' : 'Sin valorar'}
                </Badge>
                <span className="text-xs text-muted">Base: {label('traitBasis', t.basis)}</span>
              </div>
              <p className="text-muted">{t.detail}</p>
              {t.basis === 'manual' || t.basis === 'unknown' || flags.has(t.key) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs">Tu valoración:</span>
                  <TraitFlagControl
                    clientId={clientId}
                    trait={t.key}
                    name={t.label}
                    value={flags.get(t.key) ?? null}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Tu valoración se usa solo cuando no hay umbral del centro ni referencia verificada
          aplicable. Se aplica al recalcular.
        </p>
      </Card>

      <Card title="Necesidades">
        {r.needs.length === 0 ? (
          <EmptyState>Sin necesidades calculadas (falta el objetivo principal).</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {r.needs.map((n) => (
              <Proposal
                key={n.quality}
                rec={byType('need').find((x) => x.payload.quality === n.quality)}
                clientId={clientId}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {n.label}
                    <Badge tone={DIRECTION_TONE[n.direction]}>{n.direction}</Badge>
                    <span className="text-xs text-muted tabular-nums">
                      puntuación {num(n.score)}
                    </span>
                  </span>
                }
              >
                <p className="text-sm text-muted">{n.explanation.proposal}</p>
              </Proposal>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Prioridades">
        {r.priorities.length === 0 ? (
          <EmptyState>Sin prioridades.</EmptyState>
        ) : (
          <ol className="divide-y divide-border">
            {r.priorities.map((p: Priority) => (
              <Proposal
                key={p.quality}
                rec={byType('priority').find((x) => x.payload.quality === p.quality)}
                clientId={clientId}
                title={`P${p.rank} · ${p.label}`}
              >
                <p className="text-sm tabular-nums">
                  {p.sessionsPerWeek} {p.sessionsPerWeek === 1 ? 'sesión' : 'sesiones'}/semana ·{' '}
                  {num(p.minutesPerWeek)} min/semana
                </p>
              </Proposal>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Métodos">
        {r.methods.length === 0 ? (
          <EmptyState>Sin métodos propuestos.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {r.methods.map((m) => (
              <Proposal
                key={m.method}
                rec={byType('method').find((x) => x.payload.method === m.method)}
                clientId={clientId}
                title={m.name}
              >
                <p className="text-sm text-muted">{m.rationale}</p>
              </Proposal>
            ))}
          </ul>
        )}
        {r.excludedMethods.length ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer">
              Métodos descartados ({r.excludedMethods.length})
            </summary>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {r.excludedMethods.map((x) => (
                <li key={`${x.method}-${x.ruleKey}`}>
                  {x.method}: {x.reason} <span className="font-mono text-xs">({x.ruleKey})</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <Card title="Ejercicios candidatos">
        {r.exercises.length === 0 ? (
          <EmptyState>Sin candidatos (no hay métodos o ejercicios vinculados).</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {r.exercises.map((x) => (
              <div key={`${x.method}-${x.slot}`} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted">
                  {x.method} · {x.slot}
                </p>
                {x.candidates.length ? (
                  <ol className="list-decimal pl-5 text-sm">
                    {x.candidates.map((c) => (
                      <li key={c.exerciseId}>
                        {c.name}
                        {c.reasons.length ? (
                          <span className="text-xs text-muted"> · {c.reasons.join(' · ')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">Ningún ejercicio cumple los filtros.</p>
                )}
                {x.excluded.length ? (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Excluidos ({x.excluded.length})</summary>
                    <ul className="pl-4">
                      {x.excluded.map((e) => (
                        <li key={e.exerciseId}>
                          {e.name}: {e.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Dosis orientativas">
        {r.doses.length === 0 ? (
          <EmptyState>Sin dosis (los métodos no tienen variables con evidencia).</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1">Método</th>
                  <th>Variable</th>
                  <th>Rango</th>
                  <th>Sugerido</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {r.doses.map((x) => (
                  <tr key={`${x.method}-${x.variable}`} className="border-t border-border">
                    <td className="py-1">{x.method}</td>
                    <td>{x.variable}</td>
                    <td className="tabular-nums">
                      {x.min ?? '—'}–{x.max ?? '—'} {x.unit ?? ''}
                    </td>
                    <td className="tabular-nums">{x.suggested ?? '—'}</td>
                    <td className="text-xs text-muted">{x.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Fase de introducción y propuesta de plan">
        <p className="text-sm">
          <span className="font-medium">{r.introPhase.level}</span>
          {r.introPhase.weeks ? ` · ${r.introPhase.weeks}` : ''}
        </p>
        {r.introPhase.reasons.length ? (
          <ul className="list-disc pl-5 text-sm text-muted">
            {r.introPhase.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        <Why e={r.introPhase.explanation as Explanation} />
        {r.planSkeleton ? (
          <ul>
            <Proposal
              rec={plan}
              clientId={clientId}
              title={r.planSkeleton.templateName ?? 'Estructura propuesta'}
            >
              <p className="text-sm">
                {r.planSkeleton.sessionsPerWeek} sesiones/semana · reevaluar cada{' '}
                {r.planSkeleton.reassessmentEveryWeeks} semanas
              </p>
              <Link href={`?tab=programa`} className="text-sm text-accent underline">
                Crear el plan desde una plantilla
              </Link>
            </Proposal>
          </ul>
        ) : null}
      </Card>

      {d.disabledRules.length ? (
        <Card title="Reglas desactivadas para este cliente">
          <ul>
            {d.disabledRules.map((x) => (
              <RuleOverrideToggle
                key={x.ruleKey}
                clientId={clientId}
                ruleKey={x.ruleKey}
                name={x.ruleKey}
                disabled
                reason={x.reason}
              />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
