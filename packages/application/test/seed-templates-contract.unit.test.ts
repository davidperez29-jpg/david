import { templateDefinitionSchema } from '@tp/contracts';
import { generateProfileTemplates, loadTemplateFiles } from '@tp/db';
import { SEED_DIR } from '@tp/db/testing';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform templates', () => {
  it('can be saved from the template table once duplicated (edit contract)', () => {
    const handWritten = loadTemplateFiles(join(SEED_DIR, 'templates'));
    for (const t of [...handWritten, ...generateProfileTemplates(handWritten)]) {
      const r = templateDefinitionSchema.safeParse(t.definition);
      expect(r.success ? [] : r.error.issues.slice(0, 3), t.slug).toEqual([]);
    }
  });
});
