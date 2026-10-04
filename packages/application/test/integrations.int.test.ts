import { describe, expect, it } from 'vitest';
import {
  eraseClient,
  exportSubjectData,
  getClient,
  grantConsent,
  importExternalMeasurements,
  listExternalMeasurements,
} from '../src';
import { buildOrg } from './fixtures';

const CSV = [
  'tipo;valor;unidad;fecha;dispositivo',
  'steps;8432;pasos;2026-10-01T20:00:00Z;Reloj',
  'body_mass;72,4;kg;2026-10-02T07:30:00Z;Báscula',
  'resting_heart_rate;54;bpm;2026-10-02T07:00:00Z;Reloj',
  'steps;-5;pasos;2026-10-03T20:00:00Z;Reloj',
  'body_mass;72;lb;2026-10-03T07:30:00Z;Báscula',
].join('\n');

describe('external data (Phase 15)', () => {
  it('CSV with decimal comma: valid rows in, errors per row, health data only with consent', async () => {
    const o = await buildOrg();
    const r = await importExternalMeasurements(o.admin, o.clientA, {
      provider: 'csv',
      content: CSV,
    });
    expect(r.imported).toBe(2);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.errors[0]!.errors.type).toMatch(/consentimiento/);
    expect(r.errors[1]!.errors.value).toMatch(/límites/);
    expect(r.errors[2]!.errors.unit).toMatch(/kg/);
    // With consent, the heart rate enters; the rest were already there (no duplicates).
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    const again = await importExternalMeasurements(o.admin, o.clientA, {
      provider: 'csv',
      content: CSV,
    });
    expect(again).toMatchObject({ imported: 1, duplicates: 2 });
    const list = await listExternalMeasurements(o.admin, o.clientA, {});
    expect(list.map((x) => x.type).sort()).toEqual(['body_mass', 'resting_heart_rate', 'steps']);
    expect(list.find((x) => x.type === 'body_mass')!.value).toBe(72.4);
  });

  it('JSON with device ids; the client sees their data; others get not found', async () => {
    const o = await buildOrg();
    const content = JSON.stringify([
      {
        id: 'a1',
        type: 'jump_height',
        value: 34.5,
        unit: 'cm',
        measuredAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'a1',
        type: 'jump_height',
        value: 34.5,
        unit: 'cm',
        measuredAt: '2026-10-01T10:00:00Z',
      },
    ]);
    const r = await importExternalMeasurements(o.admin, o.clientA, {
      provider: 'json',
      content,
      device: 'Plataforma',
    });
    expect(r).toMatchObject({ imported: 1, duplicates: 1 });
    expect((await listExternalMeasurements(o.clientUser, o.clientA, {}))[0]).toMatchObject({
      type: 'jump_height',
      device: 'Plataforma',
    });
    await expect(listExternalMeasurements(o.trainer2, o.clientA, {})).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      importExternalMeasurements(o.trainer2, o.clientA, { provider: 'json', content }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      importExternalMeasurements(o.admin, o.clientA, { provider: 'json', content: '{"x":1}' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('device data is in the subject export and goes away with erasure', async () => {
    const o = await buildOrg();
    await importExternalMeasurements(o.admin, o.clientA, {
      provider: 'json',
      content: JSON.stringify([
        { type: 'steps', value: 9000, unit: 'pasos', measuredAt: '2026-10-01T20:00:00Z' },
      ]),
    });
    const doc = JSON.parse(
      (await exportSubjectData(o.clientUser, o.clientA)).body.toString('utf8'),
    );
    expect(doc.mediciones_de_dispositivos).toHaveLength(1);
    const c = await getClient(o.admin, o.clientA);
    await eraseClient(o.admin, o.clientA, {
      confirmation: `${c.firstName} ${c.lastName}`,
      reason: 'Solicitud del interesado',
    });
    expect(await listExternalMeasurements(o.admin, o.clientA, {})).toHaveLength(0);
  });
});
