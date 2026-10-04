'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

/** Upload of a device/app export (CSV or JSON); duplicates are ignored, errors listed by row. */
export function ExternalImportForm({ clientId }: { clientId: string }) {
  const { run, pending, error } = useApiAction();
  const [provider, setProvider] = useState<'csv' | 'json'>('csv');
  const [result, setResult] = useState<{
    imported: number;
    duplicates: number;
    errors: { row: number; errors: Record<string, string> }[];
  } | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('file') as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const r = await run<NonNullable<typeof result>>(
          `/clients/${clientId}/external-measurements`,
          'POST',
          { provider, content: await file.text() },
        );
        if (r) setResult(r);
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="Formato" htmlFor="ext-format">
          <Select
            id="ext-format"
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'csv' | 'json')}
            options={[
              { value: 'csv', label: 'CSV' },
              { value: 'json', label: 'JSON' },
            ]}
          />
        </Field>
        <Field label="Archivo exportado" htmlFor="ext-file">
          <input
            id="ext-file"
            name="file"
            type="file"
            required
            accept={provider === 'csv' ? '.csv,text/csv' : '.json,application/json'}
            className="text-sm"
          />
        </Field>
        <Button type="submit" disabled={pending}>
          Importar
        </Button>
      </div>
      <FormError error={error} />
      {result ? (
        <div role="status" className="text-sm">
          {result.imported} importadas · {result.duplicates} ya estaban · {result.errors.length} con
          errores
          {result.errors.length ? (
            <ul className="mt-1 list-disc pl-5 text-xs text-danger">
              {result.errors.slice(0, 10).map((e) => (
                <li key={e.row}>
                  Fila {e.row}: {Object.values(e.errors).join(' ')}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
