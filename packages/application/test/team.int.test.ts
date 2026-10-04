import { describe, expect, it } from 'vitest';
import { listClients, transferClients, trainerWorkload } from '../src';
import { buildOrg } from './fixtures';

describe('team at scale (Phase 15)', () => {
  it('workload per trainer and transfer of every client, audited, keeping the primary role', async () => {
    const o = await buildOrg();
    const before = await trainerWorkload(o.admin);
    const t2 = o.trainer2.actor.trainerId!;
    const adminTrainer = o.admin.actor.trainerId!;
    expect(before.find((t) => t.trainerId === t2)).toMatchObject({ clients: 1, primary: 1 });
    const r = await transferClients(o.admin, { fromTrainerId: t2, toTrainerId: adminTrainer });
    expect(r).toEqual({ moved: 1, alreadyAssigned: 0 });
    const after = await trainerWorkload(o.admin);
    expect(after.find((t) => t.trainerId === t2)!.clients).toBe(0);
    expect(after.find((t) => t.trainerId === adminTrainer)).toMatchObject({
      clients: 2,
      primary: 2,
    });
    // Trainer 2 no longer sees the client.
    expect((await listClients(o.trainer2, {})).total).toBe(0);
  });

  it('only ADMIN; never between organizations; a selected client must belong to the source trainer', async () => {
    const [o, other] = await Promise.all([buildOrg(), buildOrg()]);
    const t2 = o.trainer2.actor.trainerId!;
    const adminTrainer = o.admin.actor.trainerId!;
    await expect(
      transferClients(o.trainer2, { fromTrainerId: t2, toTrainerId: adminTrainer }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(trainerWorkload(o.trainer2)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      transferClients(o.admin, { fromTrainerId: t2, toTrainerId: other.admin.actor.trainerId! }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      transferClients(o.admin, {
        fromTrainerId: t2,
        toTrainerId: adminTrainer,
        clientIds: [o.clientA],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      transferClients(o.admin, { fromTrainerId: t2, toTrainerId: t2 }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});
