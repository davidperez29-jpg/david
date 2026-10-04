import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { createDb } from '@tp/db';

/**
 * Accessibility (MASTER_SPECIFICATION §2.3 and §15.1: WCAG 2.2 AA, axe-core in E2E, 0 serious
 * violations). Every page of both experiences, in light and dark themes: the trainer on desktop and
 * the client on a phone (Pixel 7, see playwright.config.ts). Serious and critical violations fail.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const ENV = (k: string) =>
  process.env[k] ??
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${k}=`))
    ?.slice(k.length + 1);

export async function a11yIds() {
  const { rawQuery, close } = createDb(ENV('DATABASE_URL')!, { max: 1 });
  const one = async (q: string) => String((await rawQuery(q))[0]?.id ?? '');
  try {
    const client = await one(`SELECT id FROM clients WHERE first_name = 'Iker'`);
    return {
      client,
      assessment: await one(`SELECT id FROM assessments WHERE client_id = '${client}' LIMIT 1`),
      report: await one(`SELECT id FROM reports WHERE client_id = '${client}' LIMIT 1`),
      session: await one(
        `SELECT id FROM sessions WHERE client_id = '${client}' AND scheduled_date IS NOT NULL ORDER BY scheduled_date LIMIT 1`,
      ),
      plan: await one(
        `SELECT id FROM training_plans WHERE client_id = '${client}' AND status = 'active'`,
      ),
      template: await one(`SELECT id FROM plan_templates ORDER BY id LIMIT 1`),
      exercise: await one(
        `SELECT id FROM exercises WHERE organization_id IS NULL AND status = 'published' ORDER BY id LIMIT 1`,
      ),
      test: await one(`SELECT id FROM assessment_tests ORDER BY id LIMIT 1`),
      claim: await one(`SELECT id FROM knowledge_claims ORDER BY id LIMIT 1`),
      method: await one(`SELECT id FROM methods ORDER BY id LIMIT 1`),
      source: await one(`SELECT id FROM evidence_sources ORDER BY id LIMIT 1`),
      importJob: await one(`SELECT id FROM import_jobs ORDER BY created_at DESC LIMIT 1`),
      clientSession: await one(
        `SELECT s.id FROM sessions s JOIN clients c ON c.id = s.client_id
         WHERE c.first_name = 'Marcos' AND s.published_at IS NOT NULL ORDER BY s.scheduled_date DESC LIMIT 1`,
      ),
    };
  } finally {
    await close();
  }
}

export const CLIENT_TABS = [
  'resumen',
  'perfil',
  'objetivos',
  'evaluaciones',
  'necesidades',
  'informes',
  'planificacion',
  'sesiones',
  'seguimiento',
  'salud',
  'privacidad',
  'equipo',
  'historial',
];

export async function scan(page: Page, url: string, found: string[]) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (scheme === 'light' && (await page.getByRole('heading', { name: 'No encontrado' }).count()))
      found.push(`${url}: la página no existe (revisa el id)`);
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical'))
      found.push(
        `${url} [${scheme}] ${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
      );
  }
}
