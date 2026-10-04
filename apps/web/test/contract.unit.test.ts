import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { contractJsonSchemas } from '@tp/contracts/json-schema';
import { describe, expect, it } from 'vitest';
import { apiHandlers } from './api-routes';
import { diffContracts, diffSchema, type Contract, type ContractChange } from './contract/diff';

/**
 * API contract check (MASTER_SPECIFICATION §15.1, "Contrato: sin cambios rompientes sin versión").
 *
 * docs/api/contract.json is the committed contract of /api/v1. Any difference fails this test:
 * - a non-breaking one (new route, new optional field…) is accepted with `pnpm contract:update`;
 * - a breaking one (route or field removed, new required field, stricter limit…) needs a new API
 *   version, or an explicit `pnpm contract:update --breaking` recorded in the CHANGELOG.
 */
const FILE = path.resolve(__dirname, '../../../docs/api/contract.json');
const MODE = process.env.CONTRACT_UPDATE; // '1' | 'breaking'

function current(): Contract {
  return {
    routes: apiHandlers().map(
      (h) => `${h.path} ${h.method} ${h.wrapper === 'publicRoute' ? 'public' : 'authenticated'}`,
    ),
    schemas: contractJsonSchemas(),
  };
}

const show = (cs: ContractChange[]) => cs.map((c) => `  - ${c.where}: ${c.what}`).join('\n');

describe('API contract', () => {
  it('matches docs/api/contract.json without unversioned breaking changes', () => {
    const now = current();
    const before: Contract | null = existsSync(FILE)
      ? (JSON.parse(readFileSync(FILE, 'utf8')) as Contract)
      : null;
    const changes = before ? diffContracts(before, now) : [];
    const breaking = changes.filter((c) => c.breaking);
    if (MODE && (MODE === 'breaking' || breaking.length === 0)) {
      writeFileSync(FILE, JSON.stringify(now, null, 2) + '\n');
      return;
    }
    expect(before, 'Falta docs/api/contract.json: ejecuta pnpm contract:update').not.toBeNull();
    expect(
      breaking,
      `Cambios rompientes en la API v1 (necesitan versión nueva):\n${show(breaking)}`,
    ).toEqual([]);
    expect(
      changes,
      `La API cambió sin romper nada; acepta el contrato con pnpm contract:update:\n${show(changes)}`,
    ).toEqual([]);
  });
});

describe('breaking-change rules', () => {
  const diff = (a: unknown, b: unknown) => {
    const out: ContractChange[] = [];
    diffSchema(a, b, 's', out);
    return out.map((c) => [c.breaking, c.what]);
  };
  const obj = (props: Record<string, unknown>, required: string[] = []) => ({
    type: 'object',
    properties: props,
    required,
  });

  it('new optional field: compatible; new required field or optional → required: breaking', () => {
    expect(
      diff(obj({ a: { type: 'string' } }), obj({ a: { type: 'string' }, b: { type: 'string' } })),
    ).toEqual([[false, 'nuevo campo opcional: b']]);
    expect(diff(obj({}), obj({ b: { type: 'string' } }, ['b']))).toEqual([
      [true, 'nuevo campo obligatorio: b'],
    ]);
    expect(diff(obj({ a: { type: 'string' } }), obj({ a: { type: 'string' } }, ['a']))).toEqual([
      [true, 'campo ahora obligatorio: a'],
    ]);
  });

  it('removed field, changed type or removed enum value: breaking; added enum value: compatible', () => {
    expect(diff(obj({ a: { type: 'string' } }), obj({}))[0]).toEqual([true, 'campo eliminado: a']);
    expect(diff({ type: 'string' }, { type: 'number' })[0]![0]).toBe(true);
    expect(diff({ enum: ['a', 'b'] }, { enum: ['a'] })[0]![0]).toBe(true);
    expect(diff({ enum: ['a'] }, { enum: ['a', 'b'] })).toEqual([[false, 'valores añadidos']]);
  });

  it('stricter limits are breaking; looser limits are compatible', () => {
    expect(diff({ maxLength: 100 }, { maxLength: 50 })[0]![0]).toBe(true);
    expect(diff({ maxLength: 50 }, { maxLength: 100 })[0]![0]).toBe(false);
    expect(diff({}, { minimum: 1 })[0]![0]).toBe(true);
    expect(diff({ minimum: 1 }, {})[0]![0]).toBe(false);
  });

  it('nullable fields: limits inside a variant are compared, not the whole union', () => {
    const v = (max: number) => ({ anyOf: [{ type: 'integer', maximum: max }, { type: 'null' }] });
    expect(diff(v(240), v(120))[0]![0]).toBe(true);
    expect(diff(v(120), v(240))[0]![0]).toBe(false);
    expect(diff(v(120), { type: 'integer', maximum: 120 }).some(([b]) => b)).toBe(true);
  });

  it('routes: removed or made stricter is breaking; new or opened is compatible', () => {
    const c = (routes: string[]): Contract => ({ routes, schemas: {} });
    expect(diffContracts(c(['a GET authenticated']), c([]))[0]!.breaking).toBe(true);
    expect(diffContracts(c([]), c(['a GET authenticated']))[0]!.breaking).toBe(false);
    expect(diffContracts(c(['a GET public']), c(['a GET authenticated']))[0]!.breaking).toBe(true);
  });
});
