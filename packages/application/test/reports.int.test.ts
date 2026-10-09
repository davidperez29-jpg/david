import { schema } from '@tp/db';
import { addDays, localDate, parseCsv } from '@tp/domain';
import ExcelJS from 'exceljs';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  cancelImportJob,
  confirmImportJob,
  createAssessment,
  createClient,
  createImportJob,
  downloadClientReport,
  downloadClientReportView,
  exportData,
  generateClientReport,
  getClientReport,
  getClientReportView,
  getImportJob,
  grantConsent,
  importTemplate,
  deleteReferenceValue,
  getAssessmentTest,
  listAssessmentTests,
  listCatalog,
  listClientReports,
  listSharedReports,
  recordAssessmentResult,
  recordScreening,
  setAssessmentStatus,
  setClientGoals,
  shareClientReport,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
const today = localDate(new Date());
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
const csvFile = (lines: string[]) => b64(lines.join('\n'));

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  const catalog = await listCatalog(o.admin);
  await setClientGoals(o.admin, o.clientA, {
    goals: [
      {
        goalId: catalog.goals.find((g) => g.slug === 'hypertrophy')!.id,
        isPrimary: true,
        priorityWeight: 1,
      },
    ],
  });
  const tests = await listAssessmentTests(o.admin);
  const cmj = tests.find((t) => t.slug === 'cmj_height')!.id;
  for (const [i, v] of [30.1, 33.4].entries()) {
    const { id } = await createAssessment(o.admin, o.clientA, {
      assessedOn: addDays(today, -60 + i * 40),
      testIds: [cmj],
      context: i ? 'Reevaluación' : 'Inicial',
    });
    await recordAssessmentResult(o.admin, id, { testId: cmj, attempts: [v] });
    await setAssessmentStatus(o.admin, id, { status: 'completed' });
  }
});

describe('client report (§34): 11 sections, frozen snapshot, reproducible formats', () => {
  let reportId: string;

  it('generates the report with the 11 sections; health data only with consent', async () => {
    const r = await generateClientReport(o.admin, o.clientA, {
      from: addDays(today, -90),
      to: today,
      trainerNotes: 'Seguir con 3 días; reevaluar el CMJ en 6 semanas.',
    });
    reportId = r.id;
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    const v = await getClientReport(o.admin, r.id);
    expect(v.intact).toBe(true);
    expect(v.report.sections.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const all = JSON.stringify(v.report);
    expect(all).toMatch(/Hipertrofia/);
    expect(all).toMatch(/CMJ|salto con contramovimiento/i);
    expect(all).toMatch(/Seguir con 3 días/);
    expect(all).toMatch(/Datos de salud no incluidos \(sin consentimiento\)/);
    expect(all).not.toMatch(/molestias/i);
    // With consent the screening appears (never a diagnosis).
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    await recordScreening(o.admin, o.clientA, {
      questionnaire: 'PAR-Q+',
      questionnaireVersion: '2023',
      result: 'clear',
      completedOn: addDays(today, -30),
    });
    const r2 = await generateClientReport(o.admin, o.clientA, {
      from: addDays(today, -90),
      to: today,
    });
    expect(JSON.stringify((await getClientReport(o.admin, r2.id)).report)).toMatch(
      /sin limitaciones declaradas/,
    );
    expect((await listClientReports(o.admin, o.clientA)).map((x) => x.id)).toEqual([r2.id, r.id]);
  });

  it('the snapshot is frozen: later data do not change an existing report', async () => {
    const before = await getClientReport(o.admin, reportId);
    const tests = await listAssessmentTests(o.admin);
    const { id } = await createAssessment(o.admin, o.clientA, {
      assessedOn: today,
      testIds: [tests.find((t) => t.slug === 'cmj_height')!.id],
    });
    await recordAssessmentResult(o.admin, id, {
      testId: tests.find((t) => t.slug === 'cmj_height')!.id,
      attempts: [36],
    });
    const after = await getClientReport(o.admin, reportId);
    expect(after.report).toEqual(before.report);
    expect(after.hash).toBe(before.hash);
  });

  it('PDF is reproducible byte for byte; XLSX and CSV carry the same sections; downloads are audited', async () => {
    const a = await downloadClientReport(o.admin, reportId, 'pdf');
    const b = await downloadClientReport(o.admin, reportId, 'pdf');
    expect(a.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(a.contentType).toBe('application/pdf');
    expect(Buffer.compare(a.body, b.body)).toBe(0);
    const csv = await downloadClientReport(o.admin, reportId, 'csv');
    const rows = parseCsv(csv.body.toString('utf8'));
    expect(rows.map((r) => r[0])).toEqual(
      expect.arrayContaining(['1. Datos', '6. Interpretación', '11. Próxima reevaluación']),
    );
    const x = await downloadClientReport(o.admin, reportId, 'xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.body as unknown as ArrayBuffer);
    const firstCol = wb.worksheets[0]!.getColumn(1).values.map(String);
    expect(firstCol).toContain('10. Recomendaciones');
    const audits = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, reportId), eq(schema.auditLogs.action, 'export')));
    expect(audits).toHaveLength(4);
    await expect(downloadClientReport(o.admin, reportId, 'docx')).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('only staff of the client (or ADMIN) can generate or read reports', async () => {
    await expect(
      generateClientReport(o.clientUser, o.clientA, { from: today, to: today }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(forbidden|not_found)$/),
    });
    await expect(getClientReport(o.trainer2, reportId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(getClientReport(other.admin, reportId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      generateClientReport(o.admin, o.clientA, { from: today, to: addDays(today, -1) }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('reports shared with the client (plain-language version in their app)', () => {
  it('the client sees nothing until the trainer shares; then a plain view and its PDF; unsharing hides it again', async () => {
    const { id } = await generateClientReport(o.admin, o.clientA, {
      from: addDays(today, -90),
      to: today,
      trainerNotes: 'Sigue así: tres días por semana.',
    });
    expect(await listSharedReports(o.clientUser, o.clientA)).toEqual([]);
    await expect(getClientReportView(o.clientUser, id)).rejects.toMatchObject({
      code: 'not_found',
    });
    // The trainer previews the client's version before sharing.
    const preview = await getClientReportView(o.admin, id);
    expect(preview.sharedAt).toBeNull();

    // Only staff of the client can share.
    await expect(shareClientReport(o.clientUser, id, { shared: true })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(shareClientReport(o.trainer2, id, { shared: true })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(shareClientReport(other.admin, id, { shared: true })).rejects.toMatchObject({
      code: 'not_found',
    });

    const shared = await shareClientReport(o.admin, id, { shared: true });
    expect(shared.sharedAt).toBeInstanceOf(Date);
    expect((await listSharedReports(o.clientUser, o.clientA)).map((r) => r.id)).toEqual([id]);
    expect(
      (await listClientReports(o.admin, o.clientA)).find((r) => r.id === id)!.sharedAt,
    ).not.toBeNull();

    const v = await getClientReportView(o.clientUser, id);
    const text = JSON.stringify(v.report);
    expect(v.report.title).toBe('Tu informe, Ana');
    expect(v.report.sections.map((x) => x.title)).toEqual([
      'Tu periodo',
      'Tus objetivos',
      'Lo que has entrenado',
      'Cómo vas',
      'Tu plan',
      'Mensaje de tu entrenador',
      'Próxima evaluación',
    ]);
    expect(text).toMatch(/Sigue así: tres días por semana/);
    expect(text).toMatch(/de 30,1 cm \(.*?\) a [\d,]+ cm \(.*?\)\. Has mejorado/);
    // No technical jargon in the client's version.
    expect(text).not.toMatch(/MDC|UA\b|Carga interna|z-score|Cribado/);
    expect(text).toMatch(/no es un diagnóstico/);

    // The full technical report stays with the staff.
    await expect(getClientReport(o.clientUser, id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(downloadClientReport(o.clientUser, id, 'pdf')).rejects.toMatchObject({
      code: 'not_found',
    });

    const pdf = await downloadClientReportView(o.clientUser, id);
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    const [audit] = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, id), eq(schema.auditLogs.action, 'export')));
    expect(audit!.changes).toMatchObject({ version: 'client' });

    await shareClientReport(o.admin, id, { shared: false });
    expect(await listSharedReports(o.clientUser, o.clientA)).toEqual([]);
    await expect(getClientReportView(o.clientUser, id)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('exports (§53) with RLS and formula-injection guard', () => {
  it('clients: ADMIN sees the organization, a trainer only assigned clients; formulas are neutralized', async () => {
    await createClient(o.trainer2, {
      basics: {
        firstName: '=HYPERLINK("x")',
        lastName: 'Prueba',
        birthDate: '1990-01-01',
        sex: 'other',
      },
    });
    const admin = parseCsv(
      (await exportData(o.admin, { entity: 'clients', format: 'csv' })).body.toString('utf8'),
    );
    expect(admin[0]![0]).toBe('Nombre');
    expect(admin.length - 1).toBe(3);
    expect(admin.some((r) => r[0] === `'=HYPERLINK("x")`)).toBe(true);
    const t2 = parseCsv(
      (await exportData(o.trainer2, { entity: 'clients', format: 'csv' })).body.toString('utf8'),
    );
    expect(t2.slice(1).map((r) => r[0])).not.toContain('Ana');
    await expect(
      exportData(o.clientUser, { entity: 'clients', format: 'csv' }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('assessments, evolution and XLSX; planning needs a plan', async () => {
    const a = parseCsv(
      (
        await exportData(o.admin, { entity: 'assessments', format: 'csv', clientId: o.clientA })
      ).body.toString('utf8'),
    );
    expect(a.length - 1).toBeGreaterThanOrEqual(3);
    const p = parseCsv(
      (
        await exportData(o.admin, { entity: 'progress', format: 'csv', clientId: o.clientA })
      ).body.toString('utf8'),
    );
    expect(p[0]).toContain('Valoración del cambio (frente al error de medida)');
    const x = await exportData(o.admin, {
      entity: 'assessments',
      format: 'xlsx',
      clientId: o.clientA,
    });
    expect(x.fileName).toMatch(/^evaluaciones-\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(
      exportData(o.admin, { entity: 'plan', format: 'csv', clientId: o.clientA }),
    ).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(
      exportData(o.trainer2, { entity: 'assessments', format: 'csv', clientId: o.clientA }),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('validated imports (§52): preview with per-row errors before anything is written', () => {
  it('clients from CSV: invalid rows reported by field; only valid rows are imported on confirm', async () => {
    const job = await createImportJob(o.trainer2, {
      entity: 'clients',
      fileName: 'clientes.csv',
      contentBase64: csvFile([
        'Nombre;Apellidos;Fecha nacimiento;Sexo;Email;Objetivo',
        'Lola;Martín;14/03/1995;mujer;lola.import@example.com;Hipertrofia',
        'Pep;Ruiz;31/02/1990;quizá;pep.import@example.com;',
        'Lola2;Martín;01/01/1990;;lola.import@example.com;',
        'Rai;Gil;01/01/1980;hombre;;Objetivo inventado',
      ]),
    });
    expect(job).toMatchObject({ total: 4, valid: 1, invalid: 3 });
    const v = await getImportJob(o.trainer2, job.id);
    const byRow = Object.fromEntries(v.rows.map((r) => [r.rowNumber, r]));
    expect(Object.keys(byRow[3]!.errors).sort()).toEqual(['fecha_nacimiento', 'sexo']);
    expect(byRow[4]!.errors.email).toEqual(['Repetido en la fila 2.']);
    expect(byRow[5]!.errors.objetivo).toEqual(['Objetivo desconocido en el catálogo.']);
    // Nothing written yet.
    const none = await testDb()
      .db.select()
      .from(schema.clients)
      .where(eq(schema.clients.email, 'lola.import@example.com'));
    expect(none).toHaveLength(0);

    const r = await confirmImportJob(o.trainer2, job.id);
    expect(r).toMatchObject({ imported: 1, failed: [] });
    const [created] = await testDb()
      .db.select()
      .from(schema.clients)
      .where(eq(schema.clients.email, 'lola.import@example.com'));
    expect(created).toMatchObject({ firstName: 'Lola', birthDate: '1995-03-14', sex: 'female' });
    await expect(confirmImportJob(o.trainer2, job.id)).rejects.toMatchObject({ code: 'conflict' });
    // Importing the same email again is caught in the preview.
    const again = await createImportJob(o.trainer2, {
      entity: 'clients',
      fileName: 'otra.csv',
      contentBase64: csvFile([
        'Nombre;Apellidos;Fecha nacimiento;Email',
        'Lola;M;1995-03-14;lola.import@example.com',
      ]),
    });
    expect(again.valid).toBe(0);
    await cancelImportJob(o.trainer2, again.id);
    expect((await getImportJob(o.trainer2, again.id)).status).toBe('cancelled');
  });

  it('assessments: only for assigned clients, grouped per client and date; sided tests need a side', async () => {
    const lines = [
      'Email cliente,Fecha,Test,Valor,Lado',
      `ana-${o.tag}@example.com,2026-09-01,cmj_height,30.1|31.2,`,
      `ana-${o.tag}@example.com,2026-09-01,Masa corporal,64.5,`,
      `ana-${o.tag}@example.com,2026-09-01,test_505,2.6,`,
    ];
    const t2 = await createImportJob(o.trainer2, {
      entity: 'assessments',
      fileName: 'ev.csv',
      contentBase64: csvFile(lines),
    });
    expect(t2.valid).toBe(0);
    const job = await createImportJob(o.admin, {
      entity: 'assessments',
      fileName: 'ev.csv',
      contentBase64: csvFile(lines),
    });
    const v = await getImportJob(o.admin, job.id);
    expect(v.rows.find((r) => r.rowNumber === 4)!.errors.lado).toBeDefined();
    const r = await confirmImportJob(o.admin, job.id);
    expect(r.imported).toBe(2);
    const imported = (await getImportJob(o.admin, job.id)).rows.filter(
      (x) => x.status === 'imported',
    );
    expect(new Set(imported.map((x) => x.createdEntityId)).size).toBe(1);
  });

  it('references from XLSX and exercises: duplicates, unknown catalog values, drafts to review', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hoja');
    ws.addRow(['Título', 'Autores', 'Año', 'DOI', 'Diseño']);
    ws.addRow([
      'Importado: efectos del entrenamiento',
      'Pérez L|Ruiz A',
      2020,
      `10.9999/import.${o.tag}`,
      'revisión sistemática',
    ]);
    ws.addRow(['Otro con el mismo DOI', '', 2021, `10.9999/import.${o.tag}`, '']);
    ws.addRow(['Mal', '', 1800, 'doi:x', 'horóscopo']);
    const job = await createImportJob(o.admin, {
      entity: 'references',
      fileName: 'refs.xlsx',
      contentBase64: b64(Buffer.from(await wb.xlsx.writeBuffer())),
    });
    expect(job).toMatchObject({ total: 3, valid: 1 });
    expect((await confirmImportJob(o.admin, job.id)).imported).toBe(1);
    const [src] = await testDb()
      .db.select()
      .from(schema.evidenceSources)
      .where(eq(schema.evidenceSources.doi, `10.9999/import.${o.tag}`));
    expect(src).toMatchObject({
      verificationStatus: 'unverified',
      studyDesign: 'systematic_review',
    });

    const ex = await createImportJob(o.trainer2, {
      entity: 'exercises',
      fileName: 'ejercicios.csv',
      contentBase64: csvFile([
        'Nombre;Patrón;Nivel;Material',
        `Sentadilla importada ${o.tag};Dominante de rodilla;principiante;`,
        `Otro ${o.tag};Patrón que no existe;;Nave espacial`,
      ]),
    });
    expect(ex).toMatchObject({ total: 2, valid: 1 });
    const errs = (await getImportJob(o.trainer2, ex.id)).rows.find(
      (r) => r.rowNumber === 3,
    )!.errors;
    expect(Object.keys(errs).sort()).toEqual(['material', 'patron']);
    await confirmImportJob(o.trainer2, ex.id);
    const [e] = await testDb()
      .db.select()
      .from(schema.exercises)
      .where(eq(schema.exercises.name, `Sentadilla importada ${o.tag}`));
    expect(e).toMatchObject({ status: 'draft', needsReview: true, source: 'import' });
  });

  it('normative reference values of the centre (phase 16): validated, owned, descriptive cut-offs', async () => {
    const doi = `10.9999/import.${o.tag}`; // registered by the previous test
    const head =
      'Test;Variable;Unidad;Población;Edad mín.;Edad máx.;Sexo;Estadístico;Media;DE;Mediana;Percentiles;Corte;Dirección;Significado;Fuente DOI';
    const lines = [
      head,
      `handgrip_strength;Prensión mano dominante;kg;adults_general;30;39;mujer;media y DE;29,4;5,1;;;;;;${doi}`,
      `handgrip_strength;Prensión mano dominante;kg;adults_general;30;39;mujer;media y DE;29,4;5,1;;;;;;${doi}`,
      `handgrip_strength;Otra;kg;poblacion_inventada;40;30;;mediana;;;;;;;;10.9999/no-registrada`,
      `five_times_sit_to_stand;Tiempo 5 levantamientos;s;older_adults;60;69;mixto;punto de corte;;;;;12;por encima;Peor que la media del centro;${doi}`,
      `handgrip_strength;Prensión (percentiles);kg;adults_general;;;hombre;percentiles;;;;P10=30|P50=40|P90=50;;;;${doi}`,
    ];
    // Centre norms change every client's comparison: importing them is ADMIN's (phase 18).
    for (const by of [o.clientUser, o.trainer2])
      await expect(
        createImportJob(by, {
          entity: 'reference_values',
          fileName: 'normas.csv',
          contentBase64: csvFile(lines),
        }),
      ).rejects.toMatchObject({ code: 'forbidden' });
    const job = await createImportJob(o.admin, {
      entity: 'reference_values',
      fileName: 'normas.csv',
      contentBase64: csvFile(lines),
    });
    expect(job).toMatchObject({ total: 5, valid: 3 });
    const rows = (await getImportJob(o.admin, job.id)).rows;
    expect(rows.find((r) => r.rowNumber === 3)!.errors.variable![0]).toMatch(/Repetido/);
    expect(Object.keys(rows.find((r) => r.rowNumber === 4)!.errors).sort()).toEqual([
      'edad_max',
      'mediana',
    ]);
    expect((await confirmImportJob(o.admin, job.id)).imported).toBe(3);

    const mine = await testDb()
      .db.select()
      .from(schema.referenceValues)
      .where(eq(schema.referenceValues.organizationId, o.org.organizationId));
    expect(mine).toHaveLength(3);
    const cut = mine.find((r) => r.statisticType === 'cutoff')!;
    // A centre's cut-off is descriptive: it never raises the health-professional referral.
    expect(cut.values).toMatchObject({ cutoff: 12, direction: 'above', referral: false });
    expect(mine.find((r) => r.statisticType === 'percentiles')!.values).toEqual({
      p10: 30,
      p50: 40,
      p90: 50,
    });
    expect(mine.find((r) => r.statisticType === 'mean_sd')).toMatchObject({
      sex: 'female',
      ageMin: 30,
      ageMax: 39,
      values: { mean: 29.4, sd: 5.1 },
    });

    // Visible to the centre only; the same file again is caught in the preview.
    const testId = mine.find((r) => r.statisticType === 'mean_sd')!.testId;
    const own = (await getAssessmentTest(o.trainer2, testId)).references.filter(
      (r) => r.organizationId,
    );
    expect(own).toHaveLength(2);
    expect(
      (await getAssessmentTest(other.admin, testId)).references.some((r) => r.organizationId),
    ).toBe(false);
    const again = await createImportJob(o.admin, {
      entity: 'reference_values',
      fileName: 'normas.csv',
      contentBase64: csvFile(lines),
    });
    expect(again.valid).toBe(0);
    await cancelImportJob(o.admin, again.id);

    // Only the centre's own rows can be removed; the platform's are read-only.
    const global = (await getAssessmentTest(o.admin, testId)).references.find(
      (r) => !r.organizationId,
    );
    if (global)
      await expect(deleteReferenceValue(o.admin, global.id)).rejects.toMatchObject({
        code: 'not_found',
      });
    await expect(deleteReferenceValue(other.admin, cut.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    for (const by of [o.clientUser, o.trainer2])
      await expect(deleteReferenceValue(by, cut.id)).rejects.toMatchObject({
        code: expect.stringMatching(/^(forbidden|not_found)$/),
      });
    await deleteReferenceValue(o.admin, cut.id);
    expect(
      await testDb()
        .db.select()
        .from(schema.referenceValues)
        .where(eq(schema.referenceValues.id, cut.id)),
    ).toHaveLength(0);
  });

  it('rejects files without required columns or in other formats; templates', async () => {
    await expect(
      createImportJob(o.admin, {
        entity: 'clients',
        fileName: 'x.csv',
        contentBase64: csvFile(['Nombre', 'Ana']),
      }),
    ).rejects.toMatchObject({ code: 'validation', message: expect.stringMatching(/Apellidos/) });
    await expect(
      createImportJob(o.admin, {
        entity: 'clients',
        fileName: 'x.pdf',
        contentBase64: b64('%PDF'),
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    // Oversized cells are refused before any parsing, naming the row and the column.
    await expect(
      createImportJob(o.admin, {
        entity: 'clients',
        fileName: 'x.csv',
        contentBase64: csvFile([
          'Nombre;Apellidos;Fecha de nacimiento',
          `Ana;${'x'.repeat(6000)};01/01/1990`,
        ]),
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      message: expect.stringMatching(/fila 2, columna «Apellidos»/),
      details: { file: ['cell_too_long'] },
    });
    await expect(
      createImportJob(o.clientUser, {
        entity: 'clients',
        fileName: 'x.csv',
        contentBase64: csvFile(['a']),
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const t = await importTemplate('assessments', 'csv');
    expect(parseCsv(t.body.toString('utf8'))[0]).toEqual([
      'Email cliente',
      'Fecha',
      'Test',
      'Valor',
      'Lado',
      'Contexto',
    ]);
    await expect(
      getImportJob(
        other.admin,
        (
          await createImportJob(o.admin, {
            entity: 'references',
            fileName: 'r.csv',
            contentBase64: csvFile(['Título', 'Un título válido']),
          })
        ).id,
      ),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
