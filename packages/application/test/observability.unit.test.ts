import { afterEach, describe, expect, it } from 'vitest';
import {
  log,
  redact,
  reportError,
  routePattern,
  scrubText,
  setLogSink,
} from '../src/observability';

const lines: string[] = [];
setLogSink({ write: (l) => lines.push(l) });
afterEach(() => {
  lines.length = 0;
  delete process.env.LOG_LEVEL;
});

describe('observability: logs without personal or health data', () => {
  it('scrubs e-mails, phone-like numbers and tokens from free text', () => {
    const s = scrubText(
      'Key (email)=(ana.gil@example.com) exists; tel +34 600 123 456; token abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(s).not.toMatch(/ana\.gil|600 123|abcdefghij/);
    expect(s).toContain('[email]');
  });

  it('redacts sensitive keys at any depth and keeps operational fields', () => {
    const r = redact({
      route: '/api/v1/clients/:id',
      status: 200,
      body: { password: 'x' },
      client: { firstName: 'Ana', healthNotes: 'rodilla', id: 'c1' },
      comment: 'me duele',
    }) as Record<string, unknown>;
    expect(r.route).toBe('/api/v1/clients/:id');
    expect(r.body).toBe('[redactado]');
    expect(r.comment).toBe('[redactado]');
    expect(r.client).toEqual({ firstName: '[redactado]', healthNotes: '[redactado]', id: 'c1' });
  });

  it('routes aggregate without ids', () => {
    expect(routePattern('/api/v1/clients/01a10705-20a4-7bd8-9e1f-ba9a18b543eb/reports/12')).toBe(
      '/api/v1/clients/:id/reports/:n',
    );
  });

  it('one JSON line per event, filtered by LOG_LEVEL', () => {
    log('info', 'http_request', { status: 200, ms: 12 });
    log('debug', 'noise');
    expect(lines).toHaveLength(1);
    const e = JSON.parse(lines[0]!);
    expect(e).toMatchObject({ level: 'info', event: 'http_request', status: 200, ms: 12 });
    process.env.LOG_LEVEL = 'warn';
    log('info', 'hidden');
    expect(lines).toHaveLength(1);
  });

  it('unexpected errors are reported with class and scrubbed message, never the data', () => {
    const e = new Error('insert failed for ana.gil@example.com', {
      cause: { code: '23505', message: 'duplicate' },
    });
    reportError(e, { requestId: 'r1' });
    const out = JSON.parse(lines[0]!);
    expect(out).toMatchObject({
      level: 'error',
      event: 'unexpected_error',
      error: 'Error',
      pgCode: '23505',
      requestId: 'r1',
    });
    expect(lines[0]).not.toContain('ana.gil');
  });
});
