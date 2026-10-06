import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Node has no IndexedDB: the queue runs in its in-memory mode, with the same owner rules.
type Q = typeof import('../src/lib/offline-queue');
let q: Q;
const sent: unknown[][] = [];

beforeEach(async () => {
  vi.resetModules();
  sent.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const { mutations } = JSON.parse(init.body) as { mutations: { clientMutationId: string }[] };
      sent.push(mutations.map((m) => m.clientMutationId));
      return new Response(
        JSON.stringify({
          results: mutations.map((m) => ({
            clientMutationId: m.clientMutationId,
            type: 'set',
            status: 'applied',
          })),
        }),
        { status: 200 },
      );
    }),
  );
  q = await import('../src/lib/offline-queue');
});
afterEach(() => vi.unstubAllGlobals());

const set = (id: string) => ({ type: 'set', clientMutationId: id, sessionId: 's' }) as const;

describe('offline queue ownership (PENTEST P-10)', () => {
  it('sends nothing until the owner is known, then sends the owner’s entries', async () => {
    await q.enqueue(set('a1'));
    await q.flush();
    expect(sent).toEqual([]);
    await q.setQueueOwner('user-a');
    await q.flush();
    expect(sent.flat()).toEqual(['a1']);
    expect(await q.pending()).toEqual([]);
  });

  it('another account signing in deletes the entries left by the previous one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await q.setQueueOwner('user-a');
    await q.enqueue(set('a1'));
    await q.flush();
    expect(await q.pending()).toHaveLength(1);
    await q.setQueueOwner('user-b');
    expect(await q.pending()).toEqual([]);
    await q.setQueueOwner('user-a');
    expect(await q.pending()).toEqual([]);
  });

  it('sign-out empties the queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await q.setQueueOwner('user-a');
    await q.enqueue(set('a1'));
    await q.clearQueue();
    expect(await q.pending()).toEqual([]);
  });
});
