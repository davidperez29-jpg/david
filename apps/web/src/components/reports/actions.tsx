'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';

/** Generates a report (frozen snapshot) and opens it. */
export function GenerateReportForm({
  clientId,
  defaultFrom,
  defaultTo,
}: {
  clientId: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const a = useApiAction();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [notes, setNotes] = useState('');
  const field = 'h-10 rounded-md border border-border bg-bg px-2';
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await a.run<{ id: string }>(
          `/clients/${clientId}/reports`,
          'POST',
          { from, to, trainerNotes: notes.trim() || null },
          { refresh: false },
        );
        if (r) router.push(`/app/clients/${clientId}/informes/${r.id}`);
      }}
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Tus recomendaciones (sección 10)
        <textarea
          value={notes}
          maxLength={3000}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lo que quieres que el cliente se lleve del informe. El informe no inventa recomendaciones: añade las tuyas y las propuestas que hayas aceptado."
          className="rounded-md border border-border bg-bg p-2"
        />
      </label>
      <div>
        <Button disabled={a.pending}>{a.pending ? 'Generando…' : 'Generar informe'}</Button>
      </div>
      <FormError error={a.error} />
    </form>
  );
}

/** Shows the report in the client's app (plain-language version) or hides it again. */
export function ShareReportToggle({ reportId, shared }: { reportId: string; shared: boolean }) {
  const a = useApiAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={shared ? 'secondary' : 'primary'}
        disabled={a.pending}
        onClick={() => a.run(`/reports/${reportId}/share`, 'PUT', { shared: !shared })}
      >
        {shared ? 'Dejar de compartir' : 'Compartir con el cliente'}
      </Button>
      <FormError error={a.error} />
    </div>
  );
}

const ENTITIES = [
  ['clients', 'Clientes'],
  ['assessments', 'Evaluaciones'],
  ['plan', 'Planificación'],
  ['sessions', 'Sesiones registradas'],
  ['progress', 'Evolución'],
] as const;

/** Builds a download link; the file is generated (and audited) on the server. */
export function ExportForm({
  clients,
  clientId: fixed,
}: {
  clients: { id: string; name: string }[];
  clientId?: string;
}) {
  const [entity, setEntity] = useState<string>(fixed ? 'assessments' : 'clients');
  const [format, setFormat] = useState('xlsx');
  const [clientId, setClientId] = useState(fixed ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const needsClient = entity === 'plan' || entity === 'progress';
  const qs = new URLSearchParams({ entity, format });
  if (clientId) qs.set('clientId', clientId);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const field = 'h-10 rounded-md border border-border bg-bg px-2';
  const ready = !needsClient || !!clientId;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Qué exportar
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className={field}>
            {ENTITIES.filter(([k]) => !fixed || k !== 'clients').map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {!fixed ? (
          <label className="flex flex-col gap-1 text-sm">
            Cliente {needsClient ? '(obligatorio)' : '(opcional)'}
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={field}
            >
              <option value="">
                {needsClient ? 'Elige un cliente' : 'Todos los que puedo ver'}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <fieldset className="flex items-center gap-3 text-sm">
          <legend className="sr-only">Formato</legend>
          {['xlsx', 'csv'].map((f) => (
            <label key={f} className="flex items-center gap-1">
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
              />
              {f.toUpperCase()}
            </label>
          ))}
        </fieldset>
        {ready ? (
          <a
            href={`/api/v1/exports?${qs}`}
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast hover:bg-accent-hover"
          >
            Descargar
          </a>
        ) : (
          <span className="text-sm text-muted">Elige un cliente para exportar.</span>
        )}
      </div>
      <p className="text-xs text-muted">
        Solo se exporta lo que puedes ver. Las celdas que empiezan por = + - @ se protegen para que
        la hoja de cálculo no las ejecute. Cada exportación queda registrada.
      </p>
    </div>
  );
}

const IMPORT_ENTITIES = [
  ['clients', 'Clientes'],
  ['exercises', 'Ejercicios'],
  ['assessments', 'Evaluaciones'],
  ['references', 'Referencias bibliográficas'],
] as const;

/** Upload → validation preview (nothing is written until confirmed). */
export function ImportUploadForm() {
  const router = useRouter();
  const a = useApiAction();
  const [entity, setEntity] = useState('clients');
  const [file, setFile] = useState<File | null>(null);
  const field = 'h-10 rounded-md border border-border bg-bg px-2';
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        if (file.size > 2_000_000) {
          a.setError({ code: 'validation', message: 'El archivo supera 2 MB.' });
          return;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const r = await a.run<{ id: string }>(
          '/imports',
          'POST',
          { entity, fileName: file.name, contentBase64: btoa(bin) },
          { refresh: false },
        );
        if (r) router.push(`/app/informes/importar/${r.id}`);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Qué importar
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className={field}>
            {IMPORT_ENTITIES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className="flex gap-2 text-sm">
          Plantilla:
          <a
            className="text-accent underline"
            href={`/api/v1/imports/templates/${entity}?format=xlsx`}
          >
            XLSX
          </a>
          <a
            className="text-accent underline"
            href={`/api/v1/imports/templates/${entity}?format=csv`}
          >
            CSV
          </a>
        </span>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Archivo (CSV o XLSX, hasta 1 000 filas)
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </label>
      <div>
        <Button disabled={a.pending || !file}>
          {a.pending ? 'Validando…' : 'Validar archivo'}
        </Button>
      </div>
      <FormError error={a.error} />
    </form>
  );
}

export function ImportDecision({ jobId, valid }: { jobId: string; valid: number }) {
  const router = useRouter();
  const a = useApiAction();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={a.pending || valid === 0}
          onClick={async () => {
            const r = await a.run<{
              imported: number;
              failed: { rowNumber: number; message: string }[];
            }>(`/imports/${jobId}/confirm`, 'POST', {});
            if (r)
              setResult(
                `${r.imported} filas importadas${r.failed.length ? ` · ${r.failed.length} con error al importar (ver tabla)` : ''}.`,
              );
          }}
        >
          {valid === 1 ? 'Importar 1 fila válida' : `Importar ${valid} filas válidas`}
        </Button>
        <Button
          variant="ghost"
          disabled={a.pending}
          onClick={async () => {
            const r = await a.run(`/imports/${jobId}/cancel`, 'POST', {}, { refresh: false });
            if (r) router.push('/app/informes');
          }}
        >
          Cancelar
        </Button>
      </div>
      {result ? (
        <p role="status" className="text-sm text-ok">
          {result}
        </p>
      ) : null}
      <FormError error={a.error} />
    </div>
  );
}
