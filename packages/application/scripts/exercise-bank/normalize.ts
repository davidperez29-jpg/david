/**
 * Normalizes the exercise banks of the user's methodology workbooks into a reviewable JSON
 * (seed-data/exercise-bank/bank.json). Usage:
 *   pnpm --filter @tp/application exercise-bank:normalize <file1.xlsx> [file2.xlsx ...]
 *
 * Sources: sheet "Banco de ejercicios" (name, block, video, source), "Batería preventiva"
 * (contraction mode, execution text, common error, reference dose) and the classification
 * columns of the "Meso N" sheets (pattern, primary/secondary muscle group, quality).
 * Nothing is invented: unknown fields stay empty and every derived value is listed in
 * `review` so a trainer can confirm it.
 */
import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeName, parseVideoUrl } from '@tp/domain';
import {
  BATTERY_MODES,
  blockHint,
  equipmentFromName,
  MESO_GROUPS,
  MESO_PATTERNS,
  MESO_QUALITIES,
  profileFor,
  regionForPattern,
} from './mapping';

export interface BankEntry {
  key: string;
  name: string;
  workbooks: string[];
  blocks: string[];
  sources: string[];
  videos: string[];
  invalidVideos: string[];
  pattern: string | null;
  patternFrom: 'meso' | 'block' | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  categories: string[];
  contraction: string[];
  equipment: string[];
  bodyRegion: string | null;
  profile: string;
  battery: {
    number: number;
    type: string;
    mode: string | null;
    targetZone: string | null;
    dose: string | null;
    execution: string | null;
    error: string | null;
  } | null;
  review: string[];
}

const text = (v: ExcelJS.CellValue): string | null => {
  if (v == null) return null;
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.trim() || null;
    if ('hyperlink' in v && typeof (v as { hyperlink?: string }).hyperlink === 'string')
      return (v as { hyperlink: string }).hyperlink;
    if ('result' in v) return text((v as { result: ExcelJS.CellValue }).result);
    if ('richText' in v)
      return (
        (v as { richText: { text: string }[] }).richText
          .map((r) => r.text)
          .join('')
          .trim() || null
      );
    return null;
  }
  const s = String(v).trim();
  return s && s !== '—' ? s : null;
};

function headerMap(row: ExcelJS.Row): Map<string, number> {
  const m = new Map<string, number>();
  row.eachCell((cell, col) => {
    const t = text(cell.value);
    if (t) m.set(t, col);
  });
  return m;
}

function findCol(h: Map<string, number>, starts: string): number | undefined {
  for (const [k, v] of h) if (k.startsWith(starts)) return v;
  return undefined;
}

export async function normalizeBanks(files: string[]): Promise<BankEntry[]> {
  const byKey = new Map<string, BankEntry>();
  const get = (name: string): BankEntry => {
    const key = normalizeName(name);
    let e = byKey.get(key);
    if (!e) {
      e = {
        key,
        name: name.trim(),
        workbooks: [],
        blocks: [],
        sources: [],
        videos: [],
        invalidVideos: [],
        pattern: null,
        patternFrom: null,
        primaryMuscles: [],
        secondaryMuscles: [],
        categories: [],
        contraction: [],
        equipment: [],
        bodyRegion: null,
        profile: 'loaded_dynamic',
        battery: null,
        review: [],
      };
      byKey.set(key, e);
    }
    return e;
  };
  const add = <T>(arr: T[], v: T | null | undefined) => {
    if (v != null && !arr.includes(v)) arr.push(v);
  };
  const mesoPattern = new Map<string, Map<string, number>>();
  const mesoMuscles = new Map<string, { p: Map<string, number>; s: Map<string, number> }>();

  for (const file of files) {
    const wbName = path
      .basename(file)
      .replace(/^[0-9a-f]+-/, '')
      .replace(/\.xlsx$/, '');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);

    const bank = wb.getWorksheet('Banco de ejercicios');
    if (bank) {
      const h = headerMap(bank.getRow(1));
      const cBlock = findCol(h, 'Bloque'),
        cName = findCol(h, 'Ejercicio'),
        cVideo = findCol(h, 'Vídeo'),
        cSource = findCol(h, 'Fuente');
      bank.eachRow((row, n) => {
        if (n === 1 || !cName) return;
        const name = text(row.getCell(cName).value);
        if (!name) return;
        const e = get(name);
        add(e.workbooks, wbName);
        if (cBlock) add(e.blocks, text(row.getCell(cBlock).value));
        if (cSource) add(e.sources, text(row.getCell(cSource).value));
        const v = cVideo ? text(row.getCell(cVideo).value) : null;
        if (v) {
          const parsed = parseVideoUrl(v);
          if (parsed) add(e.videos, parsed.canonicalUrl);
          else add(e.invalidVideos, v);
        }
      });
    }

    const battery = wb.getWorksheet('Batería preventiva');
    if (battery) {
      let h: Map<string, number> | null = null;
      battery.eachRow((row) => {
        if (!h) {
          const m = headerMap(row);
          if (m.has('Nº')) h = m;
          return;
        }
        const col = (s: string) => findCol(h!, s);
        const name = text(row.getCell(col('Ejercicio')!).value);
        const num = Number(text(row.getCell(col('Nº')!).value));
        if (!name || !Number.isFinite(num)) return;
        const e = get(name);
        add(e.workbooks, wbName);
        const type = text(row.getCell(col('Tipo')!).value) ?? '';
        add(e.blocks, `Batería preventiva · ${type.split('·')[0]!.trim()}`);
        const mode = text(row.getCell(col('Modo')!).value);
        for (const c of (mode && BATTERY_MODES[mode]) || []) add(e.contraction, c);
        e.battery ??= {
          number: num,
          type,
          mode,
          targetZone: text(row.getCell(col('Zona')!).value),
          dose: text(row.getCell(col('Dosis')!).value),
          execution: text(row.getCell(col('Ejecución')!).value),
          error: text(row.getCell(col('Error')!).value),
        };
        const v = text(row.getCell(col('Vídeo')!).value);
        if (v) {
          const parsed = parseVideoUrl(v);
          if (parsed) add(e.videos, parsed.canonicalUrl);
        }
      });
    }

    for (const ws of wb.worksheets.filter((w) => w.name.startsWith('Meso'))) {
      let h: Map<string, number> | null = null;
      ws.eachRow((row) => {
        if (!h) {
          const m = headerMap(row);
          if (findCol(m, 'Patrón de movimiento')) h = m;
          return;
        }
        const cName = findCol(h, 'EJERCICIO');
        const name = cName ? text(row.getCell(cName).value) : null;
        if (!name || name === 'EJERCICIO' || /^EJERCICIO/.test(name)) return;
        const key = normalizeName(name);
        const pat = text(row.getCell(findCol(h, 'Patrón de movimiento')!).value);
        const g1 = text(row.getCell(findCol(h, 'Grupo 1º')!).value);
        const g2 = text(row.getCell(findCol(h, 'Grupo 2º')!).value);
        const q = text(row.getCell(findCol(h, 'Cualidad')!).value);
        if (pat && MESO_PATTERNS[pat]) {
          const m = mesoPattern.get(key) ?? new Map();
          m.set(MESO_PATTERNS[pat]!, (m.get(MESO_PATTERNS[pat]!) ?? 0) + 1);
          mesoPattern.set(key, m);
        }
        const mm = mesoMuscles.get(key) ?? { p: new Map(), s: new Map() };
        if (g1 && MESO_GROUPS[g1])
          mm.p.set(MESO_GROUPS[g1]!, (mm.p.get(MESO_GROUPS[g1]!) ?? 0) + 1);
        if (g2 && MESO_GROUPS[g2])
          mm.s.set(MESO_GROUPS[g2]!, (mm.s.get(MESO_GROUPS[g2]!) ?? 0) + 1);
        mesoMuscles.set(key, mm);
        if (q && MESO_QUALITIES[q] && byKey.has(key))
          for (const c of MESO_QUALITIES[q]!) add(byKey.get(key)!.categories, c);
      });
    }
  }

  const top = (m: Map<string, number> | undefined) =>
    m && m.size ? [...m].sort((a, b) => b[1] - a[1])[0]![0] : null;
  for (const e of byKey.values()) {
    const fromMeso = top(mesoPattern.get(e.key));
    if (fromMeso) {
      e.pattern = fromMeso;
      e.patternFrom = 'meso';
      if ((mesoPattern.get(e.key)?.size ?? 0) > 1)
        e.review.push('El patrón varía entre hojas Meso; se tomó el más frecuente.');
    }
    for (const b of e.blocks) {
      const hint = blockHint(b);
      if (!hint) {
        e.review.push(`Bloque sin correspondencia: «${b}».`);
        continue;
      }
      for (const c of hint.categories) add(e.categories, c);
      if (!e.pattern && hint.pattern) {
        e.pattern = hint.pattern;
        e.patternFrom = 'block';
      }
      if (hint.primaryMuscles && !mesoMuscles.has(e.key))
        for (const m of hint.primaryMuscles) add(e.primaryMuscles, m);
    }
    const mm = mesoMuscles.get(e.key);
    if (mm) {
      for (const m of mm.p.keys()) add(e.primaryMuscles, m);
      for (const m of mm.s.keys()) if (!e.primaryMuscles.includes(m)) add(e.secondaryMuscles, m);
    }
    e.equipment = equipmentFromName(e.name);
    e.bodyRegion = regionForPattern(e.pattern);
    e.profile = profileFor(e.pattern, e.categories, e.contraction);
    if (e.patternFrom === 'block') e.review.push('Patrón deducido del bloque de sesión.');
    if (!e.pattern) e.review.push('Sin patrón de movimiento: asignar.');
    if (!mm && e.primaryMuscles.length) e.review.push('Músculos deducidos del bloque de sesión.');
    if (!e.primaryMuscles.length) e.review.push('Sin músculos asignados.');
    if (e.equipment.length) e.review.push('Material deducido del nombre del ejercicio.');
    else e.review.push('Material sin clasificar.');
    if (e.invalidVideos.length)
      e.review.push(`${e.invalidVideos.length} enlace(s) de vídeo no válidos descartados.`);
    if (e.videos.length) e.review.push('Vídeo(s) pendiente(s) de verificación.');
    e.review.push('Nivel, complejidad, carga axial e impacto sin definir.');
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: normalize.ts <workbook.xlsx>...');
    process.exit(1);
  }
  const entries = await normalizeBanks(files);
  const out = path.resolve(import.meta.dirname, '../../../../seed-data/exercise-bank');
  mkdirSync(out, { recursive: true });
  writeFileSync(
    path.join(out, 'bank.json'),
    JSON.stringify(
      {
        generatedFrom: files.map((f) => path.basename(f).replace(/^[0-9a-f]+-/, '')),
        count: entries.length,
        entries,
      },
      null,
      1,
    ) + '\n',
  );
  const stat = (f: (e: BankEntry) => boolean) => entries.filter(f).length;
  console.log(
    JSON.stringify(
      {
        exercises: entries.length,
        withVideo: stat((e) => e.videos.length > 0),
        patternFromMeso: stat((e) => e.patternFrom === 'meso'),
        patternFromBlock: stat((e) => e.patternFrom === 'block'),
        withoutPattern: stat((e) => !e.pattern),
        withMuscles: stat((e) => e.primaryMuscles.length > 0),
        withEquipment: stat((e) => e.equipment.length > 0),
        batteryCards: stat((e) => !!e.battery),
        invalidVideos: entries.reduce((n, e) => n + e.invalidVideos.length, 0),
      },
      null,
      2,
    ),
  );
}
