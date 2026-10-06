'use client';

import type { ClaimDetail, FindingOption, MethodDetail, ScienceTaxonomies } from '@tp/application';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';
import { LABELS } from '@/lib/labels';

const opts = (o: Record<string, string>) =>
  Object.entries(o).map(([value, l]) => ({ value, label: l }));
const nul = (v: string) => (v.trim() === '' ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

// ── Status ───────────────────────────────────────────────────────────────────

export function StatusActions({
  path,
  status,
  canPublish,
  blocked = [],
}: {
  path: string;
  status: string;
  canPublish: boolean;
  blocked?: string[];
}) {
  const a = useApiAction();
  const set = (s: string) => a.run(`${path}/status`, 'POST', { status: s });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== 'published' && canPublish ? (
          <Button disabled={a.pending || blocked.length > 0} onClick={() => set('published')}>
            Publicar
          </Button>
        ) : null}
        {status === 'draft' && canPublish ? (
          <Button variant="secondary" disabled={a.pending} onClick={() => set('reviewed')}>
            Marcar como revisada
          </Button>
        ) : null}
        {status !== 'draft' ? (
          <Button variant="secondary" disabled={a.pending} onClick={() => set('draft')}>
            Volver a borrador
          </Button>
        ) : null}
        {status !== 'deprecated' ? (
          <Button variant="danger" disabled={a.pending} onClick={() => set('deprecated')}>
            Marcar como obsoleta
          </Button>
        ) : null}
      </div>
      {!canPublish ? (
        <p className="text-xs text-muted">Solo la administración puede revisar y publicar.</p>
      ) : null}
      {blocked.length ? (
        <p className="text-xs text-danger">No se puede publicar: {blocked.join(' ')}</p>
      ) : null}
      <FormError error={a.error} />
      {a.error?.details
        ? Object.values(a.error.details)
            .flat()
            .map((m) => (
              <p key={m} className="text-xs text-danger">
                {m}
              </p>
            ))
        : null}
    </div>
  );
}

// ── Methods ──────────────────────────────────────────────────────────────────

export function NewMethodForm() {
  const router = useRouter();
  const a = useApiAction();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('training_method');
  const [definition, setDefinition] = useState('');
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          '/science/methods',
          'POST',
          { name, kind, definition: nul(definition) },
          { refresh: false },
        );
        if (r) router.push(`/app/science/methods/${r.id}`);
      }}
    >
      <Field label="Nombre" htmlFor="m-name" error={a.fieldError('name')}>
        <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Tipo" htmlFor="m-kind">
        <Select
          id="m-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={opts(LABELS.methodKind)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Definición" htmlFor="m-def">
          <Textarea
            id="m-def"
            rows={2}
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <FormError error={a.error} />
        <Button disabled={a.pending}>Crear método</Button>
      </div>
    </form>
  );
}

type ClaimOption = { id: string; key: string; statement: string; level: string };

export function MethodEditor({
  method,
  claims,
  populations,
}: {
  method: MethodDetail;
  claims: ClaimOption[];
  populations: { id: string; name: string }[];
}) {
  const a = useApiAction();
  const [definition, setDefinition] = useState(method.definition ?? '');
  const [trainer, setTrainer] = useState(method.summaryForTrainer ?? '');
  const [client, setClient] = useState(method.summaryForClient ?? '');
  const [notes, setNotes] = useState(
    method.notes.map((n) => ({ kind: n.kind as string, text: n.text, claimId: n.claimId ?? '' })),
  );
  const [vars, setVars] = useState(
    method.variables.map((v) => ({
      variableKey: v.variableKey,
      populationId: v.populationId ?? '',
      minValue: v.minValue ?? '',
      maxValue: v.maxValue ?? '',
      typicalValue: v.typicalValue ?? '',
      unit: v.unit ?? '',
      claimId: v.claimId ?? '',
      notes: v.notes ?? '',
    })),
  );
  const claimOpts = claims.map((c) => ({ value: c.id, label: `[${c.level}] ${c.key}` }));
  const popOpts = populations.map((p) => ({ value: p.id, label: p.name }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(`/science/methods/${method.id}`, 'PATCH', {
          expectedVersion: method.version,
          definition: nul(definition),
          summaryForTrainer: nul(trainer),
          summaryForClient: nul(client),
          notes: notes
            .filter((n) => n.text.trim())
            .map((n) => ({ ...n, claimId: n.claimId || null })),
          variables: vars
            .filter((v) => v.variableKey.trim())
            .map((v) => ({
              variableKey: v.variableKey.trim(),
              populationId: v.populationId || null,
              minValue: numOrNull(String(v.minValue)),
              maxValue: numOrNull(String(v.maxValue)),
              typicalValue: numOrNull(String(v.typicalValue)),
              unit: nul(v.unit),
              claimId: v.claimId || null,
              notes: nul(v.notes),
            })),
        });
      }}
    >
      <Field label="Definición" htmlFor="me-def">
        <Textarea
          id="me-def"
          rows={3}
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Resumen para el entrenador" htmlFor="me-tr">
          <Textarea
            id="me-tr"
            rows={3}
            value={trainer}
            onChange={(e) => setTrainer(e.target.value)}
          />
        </Field>
        <Field
          label="Resumen para el cliente"
          htmlFor="me-cl"
          hint="Lenguaje sencillo, sin cifras ni promesas."
        >
          <Textarea
            id="me-cl"
            rows={3}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">
          Notas (mecanismo, indicaciones, precauciones…)
        </legend>
        {notes.map((n, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_14rem_auto]">
            <Select
              aria-label="Tipo de nota"
              value={n.kind}
              onChange={(e) =>
                setNotes(notes.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))
              }
              options={opts(LABELS.methodNoteKind)}
            />
            <Input
              aria-label="Texto de la nota"
              value={n.text}
              onChange={(e) =>
                setNotes(notes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
            <Select
              aria-label="Afirmación que la respalda"
              value={n.claimId}
              placeholder="Sin afirmación (F/G)"
              onChange={(e) =>
                setNotes(notes.map((x, j) => (j === i ? { ...x, claimId: e.target.value } : x)))
              }
              options={claimOpts}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNotes(notes.filter((_, j) => j !== i))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setNotes([...notes, { kind: 'indication', text: '', claimId: '' }])}
        >
          Añadir nota
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Variables de dosis</legend>
        <p className="text-xs text-muted">
          Para publicar, cada variable debe estar justificada por una afirmación.
        </p>
        {vars.map((v, i) => {
          const set = (patch: Partial<typeof v>) =>
            setVars(vars.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-4">
              <Input
                aria-label="Variable"
                placeholder="Variable (p. ej. rest_seconds)"
                value={v.variableKey}
                onChange={(e) => set({ variableKey: e.target.value })}
              />
              <Input
                aria-label="Mínimo"
                placeholder="Mín."
                inputMode="decimal"
                value={String(v.minValue)}
                onChange={(e) => set({ minValue: e.target.value })}
              />
              <Input
                aria-label="Máximo"
                placeholder="Máx."
                inputMode="decimal"
                value={String(v.maxValue)}
                onChange={(e) => set({ maxValue: e.target.value })}
              />
              <Input
                aria-label="Unidad"
                placeholder="Unidad"
                value={v.unit}
                onChange={(e) => set({ unit: e.target.value })}
              />
              <Select
                aria-label="Población"
                value={v.populationId}
                placeholder="Cualquier población"
                onChange={(e) => set({ populationId: e.target.value })}
                options={popOpts}
              />
              <div className="sm:col-span-2">
                <Select
                  aria-label="Afirmación que la justifica"
                  value={v.claimId}
                  placeholder="Sin justificar"
                  onChange={(e) => set({ claimId: e.target.value })}
                  options={claimOpts}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVars(vars.filter((_, j) => j !== i))}
              >
                Quitar
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            setVars([
              ...vars,
              {
                variableKey: '',
                populationId: '',
                minValue: '',
                maxValue: '',
                typicalValue: '',
                unit: '',
                claimId: '',
                notes: '',
              },
            ])
          }
        >
          Añadir variable
        </Button>
      </fieldset>
      <FormError error={a.error} />
      {a.done ? (
        <p className="text-sm text-ok">Guardado. Si estaba publicado, vuelve a borrador.</p>
      ) : null}
      <Button disabled={a.pending} className="self-start">
        Guardar método
      </Button>
    </form>
  );
}

// ── Sources & findings ───────────────────────────────────────────────────────

export function SourceForm() {
  const router = useRouter();
  const a = useApiAction();
  const [f, setF] = useState({
    title: '',
    authors: '',
    year: '',
    journal: '',
    doi: '',
    pmid: '',
    url: '',
    studyDesign: 'rct',
    populationSummary: '',
    resultsSummary: '',
    limitations: '',
  });
  const bind = (k: keyof typeof f) => ({
    id: `s-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          '/science/sources',
          'POST',
          {
            ...f,
            authors: f.authors
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean),
            year: f.year ? Number(f.year) : null,
            journal: nul(f.journal),
            doi: nul(f.doi),
            pmid: nul(f.pmid),
            url: nul(f.url),
            populationSummary: nul(f.populationSummary),
            resultsSummary: nul(f.resultsSummary),
            limitations: nul(f.limitations),
          },
          { refresh: false },
        );
        if (r) router.push(`/app/science/sources/${r.id}`);
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Título" htmlFor="s-title" error={a.fieldError('title')}>
          <Input {...bind('title')} required />
        </Field>
      </div>
      <Field label="Autores (separados por ;)" htmlFor="s-authors">
        <Input {...bind('authors')} placeholder="Apellido AB; Apellido CD" />
      </Field>
      <Field label="Año" htmlFor="s-year" error={a.fieldError('year')}>
        <Input {...bind('year')} inputMode="numeric" />
      </Field>
      <Field label="Revista" htmlFor="s-journal">
        <Input {...bind('journal')} />
      </Field>
      <Field label="Diseño" htmlFor="s-studyDesign">
        <Select {...bind('studyDesign')} options={opts(LABELS.studyDesign)} />
      </Field>
      <Field
        label="DOI"
        htmlFor="s-doi"
        error={a.fieldError('doi')}
        hint="Cópialo de la fuente; nunca lo escribas de memoria."
      >
        <Input {...bind('doi')} placeholder="10.xxxx/…" />
      </Field>
      <Field label="PMID" htmlFor="s-pmid" error={a.fieldError('pmid')}>
        <Input {...bind('pmid')} inputMode="numeric" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="URL" htmlFor="s-url" error={a.fieldError('url')}>
          <Input {...bind('url')} type="url" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Población estudiada" htmlFor="s-populationSummary">
          <Textarea {...bind('populationSummary')} rows={2} />
        </Field>
      </div>
      <Field label="Resumen de resultados" htmlFor="s-resultsSummary">
        <Textarea {...bind('resultsSummary')} rows={3} />
      </Field>
      <Field label="Limitaciones" htmlFor="s-limitations">
        <Textarea {...bind('limitations')} rows={3} />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs text-muted">
          La fuente se crea sin verificar (nivel H) hasta que la administración la verifique.
        </p>
        <FormError error={a.error} />
        <Button disabled={a.pending}>Crear fuente</Button>
      </div>
    </form>
  );
}

export function VerifySourceForm({ sourceId, status }: { sourceId: string; status: string }) {
  const a = useApiAction();
  const [s, setS] = useState(status === 'unverified' ? 'verified' : status);
  const [access, setAccess] = useState('abstract_only');
  const [method, setMethod] = useState('');
  const [corrections, setCorrections] = useState('');
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run(`/science/sources/${sourceId}/verify`, 'POST', {
          status: s,
          access,
          verificationMethod: method,
          corrections: nul(corrections),
        });
      }}
    >
      <Field label="Resultado" htmlFor="v-status">
        <Select
          id="v-status"
          value={s}
          onChange={(e) => setS(e.target.value)}
          options={opts(LABELS.verification)}
        />
      </Field>
      <Field label="Acceso" htmlFor="v-access">
        <Select
          id="v-access"
          value={access}
          onChange={(e) => setAccess(e.target.value)}
          options={opts(LABELS.sourceAccess)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Cómo se ha verificado"
          htmlFor="v-method"
          error={a.fieldError('verificationMethod')}
        >
          <Input
            id="v-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            required
            placeholder="PubMed: metadatos y resumen leídos"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Correcciones" htmlFor="v-corr">
          <Textarea
            id="v-corr"
            rows={2}
            value={corrections}
            onChange={(e) => setCorrections(e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <FormError error={a.error} />
        <Button disabled={a.pending}>Registrar verificación</Button>
      </div>
    </form>
  );
}

const CONCERNS: [string, string][] = [
  ['riskOfBias', 'Riesgo de sesgo'],
  ['inconsistency', 'Inconsistencia'],
  ['indirectness', 'Evidencia indirecta'],
  ['imprecision', 'Imprecisión'],
  ['publicationBias', 'Sesgo de publicación'],
];

export function AddFindingForm({ sourceId, tax }: { sourceId: string; tax: ScienceTaxonomies }) {
  const a = useApiAction();
  const empty = {
    outcomeId: '',
    populationId: '',
    intervention: '',
    comparator: '',
    effectMetric: '',
    effectValue: '',
    ciLow: '',
    ciHigh: '',
    quote: '',
    epistemicType: 'fact',
  };
  const [f, setF] = useState(empty);
  const [g, setG] = useState<Record<string, string>>({
    riskOfBias: 'no',
    inconsistency: 'no',
    indirectness: 'no',
    imprecision: 'no',
    publicationBias: 'no',
  });
  const [sr, setSr] = useState(false);
  const bind = (k: keyof typeof f) => ({
    id: `f-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run(`/science/sources/${sourceId}/findings`, 'POST', {
          ...f,
          intervention: nul(f.intervention),
          comparator: nul(f.comparator),
          effectMetric: nul(f.effectMetric),
          effectValue: numOrNull(f.effectValue),
          ciLow: numOrNull(f.ciLow),
          ciHigh: numOrNull(f.ciHigh),
          grading: { ...g, basedOnSystematicReview: sr },
        });
        if (r) setF(empty);
      }}
    >
      <Field label="Resultado medido" htmlFor="f-outcomeId" error={a.fieldError('outcomeId')}>
        <Select
          {...bind('outcomeId')}
          placeholder="Elegir…"
          options={tax.outcomes.map((o) => ({ value: o.id, label: o.name }))}
          required
        />
      </Field>
      <Field label="Población" htmlFor="f-populationId" error={a.fieldError('populationId')}>
        <Select
          {...bind('populationId')}
          placeholder="Elegir…"
          options={tax.populations.map((o) => ({ value: o.id, label: o.name }))}
          required
        />
      </Field>
      <Field label="Intervención" htmlFor="f-intervention">
        <Input {...bind('intervention')} />
      </Field>
      <Field label="Comparador" htmlFor="f-comparator">
        <Input {...bind('comparator')} />
      </Field>
      <div className="grid grid-cols-4 gap-2 sm:col-span-2">
        <Field label="Métrica" htmlFor="f-effectMetric">
          <Input {...bind('effectMetric')} placeholder="SMD, %…" />
        </Field>
        <Field label="Valor" htmlFor="f-effectValue">
          <Input {...bind('effectValue')} inputMode="decimal" />
        </Field>
        <Field label="IC inferior" htmlFor="f-ciLow">
          <Input {...bind('ciLow')} inputMode="decimal" />
        </Field>
        <Field label="IC superior" htmlFor="f-ciHigh">
          <Input {...bind('ciHigh')} inputMode="decimal" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field
          label="Cita literal de la fuente"
          htmlFor="f-quote"
          error={a.fieldError('quote')}
          hint="Copia exacta del resumen o del texto. Las cifras deben aparecer en la cita."
        >
          <Textarea {...bind('quote')} rows={3} required />
        </Field>
      </div>
      <fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold">
          Gradación (motivos para bajar el nivel)
        </legend>
        {CONCERNS.map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`g-${k}`}>
            <Select
              id={`g-${k}`}
              value={g[k]}
              onChange={(e) => setG({ ...g, [k]: e.target.value })}
              options={[
                { value: 'no', label: 'No' },
                { value: 'serious', label: 'Serio' },
                ...(k === 'inconsistency'
                  ? [{ value: 'contradictory', label: 'Resultados contradictorios' }]
                  : []),
              ]}
            />
          </Field>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sr} onChange={(e) => setSr(e.target.checked)} />
          Guía/consenso basado en revisión sistemática
        </label>
      </fieldset>
      <div className="sm:col-span-2">
        <FormError error={a.error} />
        <Button disabled={a.pending}>Añadir hallazgo</Button>
      </div>
    </form>
  );
}

export function DeleteFindingButton({ findingId }: { findingId: string }) {
  const a = useApiAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={a.pending}
      onClick={() => {
        if (confirm('¿Eliminar este hallazgo? Las afirmaciones que lo usan se recalcularán.'))
          void a.run(`/science/findings/${findingId}`, 'DELETE');
      }}
    >
      Eliminar
    </Button>
  );
}

// ── Claims ───────────────────────────────────────────────────────────────────

export function ClaimForm({
  claim,
  findings,
  populations,
  initialFindingIds = [],
}: {
  claim?: ClaimDetail;
  findings: FindingOption[];
  populations: { slug: string; name: string }[];
  initialFindingIds?: string[];
}) {
  const router = useRouter();
  const a = useApiAction();
  const app = (claim?.applicability as { appliesTo?: string[]; notFor?: string[] } | null) ?? {};
  const [f, setF] = useState({
    key: claim?.key ?? '',
    statement: claim?.statement ?? '',
    scope: claim?.scope ?? '',
    epistemicType: claim?.epistemicType ?? 'inference',
    confidence: claim?.confidence ?? 'moderate',
    limitations: claim?.limitations ?? '',
    evidenceKind: claim?.evidenceKind ?? '',
    origin: claim?.origin ?? 'external_literature',
  });
  const [links, setLinks] = useState<{ findingId: string; role: string }[]>(
    claim
      ? claim.evidence.map((e) => ({ findingId: e.findingId, role: e.role }))
      : initialFindingIds.map((findingId) => ({ findingId, role: 'supports' })),
  );
  const [appliesTo, setAppliesTo] = useState<string[]>(app.appliesTo ?? []);
  const [filter, setFilter] = useState('');
  const bind = (k: keyof typeof f) => ({
    id: `c-${k}`,
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  const shown = findings.filter(
    (x) =>
      !links.some((l) => l.findingId === x.id) &&
      (!filter ||
        `${x.sourceTitle} ${x.outcome} ${x.quote}`.toLowerCase().includes(filter.toLowerCase())),
  );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = {
          ...f,
          scope: nul(f.scope),
          limitations: nul(f.limitations),
          evidenceKind: f.evidenceKind || null,
          appliesTo,
          findings: links,
        };
        if (claim) {
          await a.run(`/science/claims/${claim.id}`, 'PATCH', {
            ...body,
            key: undefined,
            expectedVersion: claim.version,
          });
        } else {
          const r = await a.run<{ id: string }>('/science/claims', 'POST', body, {
            refresh: false,
          });
          if (r) router.push(`/app/science/claims/${r.id}`);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Clave"
          htmlFor="c-key"
          error={a.fieldError('key')}
          hint="Identificador estable, p. ej. hypertrophy.volume.dose_response"
        >
          <Input {...bind('key')} disabled={!!claim} required />
        </Field>
        <Field label="Ámbito" htmlFor="c-scope">
          <Input {...bind('scope')} placeholder="Hipertrofia, fuerza, salud…" />
        </Field>
      </div>
      <Field
        label="Afirmación"
        htmlFor="c-statement"
        error={a.fieldError('statement')}
        hint="Sin lenguaje causal ni absoluto («previene», «garantiza»). Respeta la población estudiada."
      >
        <Textarea {...bind('statement')} rows={3} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo epistémico" htmlFor="c-epistemicType">
          <Select {...bind('epistemicType')} options={opts(LABELS.epistemic)} />
        </Field>
        <Field label="Confianza" htmlFor="c-confidence">
          <Select {...bind('confidence')} options={opts(LABELS.confidence)} />
        </Field>
        <Field
          label="Tipo de evidencia"
          htmlFor="c-evidenceKind"
          error={a.fieldError('evidenceKind')}
          hint="Solo «Reducción de la incidencia» permite decir que algo reduce lesiones."
        >
          <Select
            {...bind('evidenceKind')}
            options={opts(LABELS.evidenceKind)}
            placeholder="Sin clasificar"
          />
        </Field>
        <Field label="Origen" htmlFor="c-origin">
          <Select {...bind('origin')} options={opts(LABELS.origin)} />
        </Field>
      </div>
      <Field label="Limitaciones" htmlFor="c-limitations">
        <Textarea {...bind('limitations')} rows={2} />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Se aplica a</legend>
        <div className="flex flex-wrap gap-3">
          {populations.map((p) => (
            <label key={p.slug} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={appliesTo.includes(p.slug)}
                onChange={(e) =>
                  setAppliesTo(
                    e.target.checked
                      ? [...appliesTo, p.slug]
                      : appliesTo.filter((x) => x !== p.slug),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Hallazgos</legend>
        {links.map((l, i) => {
          const x = findings.find((y) => y.id === l.findingId);
          return (
            <div key={l.findingId} className="flex flex-wrap items-center gap-2 text-sm">
              <Select
                aria-label="Papel del hallazgo"
                value={l.role}
                onChange={(e) =>
                  setLinks(links.map((y, j) => (j === i ? { ...y, role: e.target.value } : y)))
                }
                options={opts(LABELS.evidenceRole)}
                className="max-w-36"
              />
              <span className="min-w-0 flex-1">
                [{x?.level ?? '?'}]{' '}
                {x ? `${x.sourceTitle} — ${x.outcome}, ${x.population}` : l.findingId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
              >
                Quitar
              </Button>
            </div>
          );
        })}
        <Input
          aria-label="Buscar hallazgos"
          placeholder="Buscar hallazgos por fuente, resultado o cita"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="max-h-56 overflow-y-auto rounded-md border border-border text-sm">
          {shown.slice(0, 40).map((x) => (
            <li
              key={x.id}
              className="flex items-start justify-between gap-2 border-b border-border p-2 last:border-0"
            >
              <span>
                [{x.level}] {x.sourceTitle} ({x.year ?? 's. f.'}) — {x.outcome}, {x.population}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLinks([...links, { findingId: x.id, role: 'supports' }])}
              >
                Añadir
              </Button>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="p-2 text-muted">Sin hallazgos disponibles.</li>
          ) : null}
        </ul>
      </fieldset>
      <FormError error={a.error} />
      {a.done && claim ? (
        <p className="text-sm text-ok">Guardado. Si estaba publicada, vuelve a borrador.</p>
      ) : null}
      <Button disabled={a.pending} className="self-start">
        {claim ? 'Guardar afirmación' : 'Crear afirmación'}
      </Button>
    </form>
  );
}

export function ReviewForm({ target, targetId }: { target: 'source' | 'claim'; targetId: string }) {
  const a = useApiAction();
  const keys = Object.keys(LABELS.reviewCheck) as (keyof typeof LABELS.reviewCheck)[];
  const [check, setCheck] = useState<Record<string, boolean>>(
    Object.fromEntries(keys.map((k) => [k, false])),
  );
  const [outcome, setOutcome] = useState('approved');
  const [notes, setNotes] = useState('');
  const allOk = keys.every((k) => check[k]);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void a.run('/science/reviews', 'POST', {
          target,
          targetId,
          outcome,
          checklist: check,
          notes: nul(notes),
        });
      }}
    >
      {keys.map((k) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={check[k]}
            onChange={(e) => setCheck({ ...check, [k]: e.target.checked })}
          />
          {LABELS.reviewCheck[k]}
        </label>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          aria-label="Resultado de la revisión"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          options={opts(LABELS.reviewOutcome)}
        />
        <Input
          aria-label="Notas"
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {outcome === 'approved' && !allOk ? (
        <p className="text-xs text-muted">Para aprobar hay que cumplir toda la lista.</p>
      ) : null}
      <FormError error={a.error} />
      <Button disabled={a.pending || (outcome === 'approved' && !allOk)} className="self-start">
        Registrar revisión
      </Button>
    </form>
  );
}
