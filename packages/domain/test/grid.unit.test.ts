import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  exerciseNameMatcher,
  formatCell,
  matchExerciseName,
  nameSimilarity,
  parseCell,
  parseLoad,
  parseReps,
  parseRest,
  parseRir,
  parseRpe,
  parseSessionTsv,
  parseSets,
  toSessionTsv,
  validatePrescription,
  type GridColumn,
  type Prescription,
} from '../src';

const patch = (r: ReturnType<typeof parseSets>) => {
  if (!r.ok) throw new Error(r.error);
  return r.patch;
};

describe('session table cells', () => {
  it('SERIES: whole numbers; empty clears', () => {
    expect(patch(parseSets('4'))).toEqual({ sets: 4 });
    expect(patch(parseSets(' '))).toEqual({ sets: null });
    expect(parseSets('4,5').ok).toBe(false);
    expect(parseSets('cuatro').ok).toBe(false);
  });

  it('REPS: repetitions, ranges, time, distance or contacts, each replacing the others', () => {
    const cleared = {
      repsMin: null,
      repsMax: null,
      durationS: null,
      distanceM: null,
      contacts: null,
    };
    expect(patch(parseReps('8'))).toEqual({ ...cleared, repsMin: 8, repsMax: 8 });
    for (const t of ['6-8', '6–8', '6 a 8', '6/8'])
      expect(patch(parseReps(t))).toEqual({ ...cleared, repsMin: 6, repsMax: 8 });
    expect(patch(parseReps('30 s'))).toEqual({ ...cleared, durationS: 30 });
    expect(patch(parseReps('30"'))).toEqual({ ...cleared, durationS: 30 });
    expect(patch(parseReps('1:30'))).toEqual({ ...cleared, durationS: 90 });
    expect(patch(parseReps('2 min'))).toEqual({ ...cleared, durationS: 120 });
    expect(patch(parseReps('20 m'))).toEqual({ ...cleared, distanceM: 20 });
    expect(patch(parseReps('10 contactos'))).toEqual({ ...cleared, contacts: 10 });
    expect(patch(parseReps(''))).toEqual(cleared);
    expect(parseReps('6,5').ok).toBe(false);
    expect(parseReps('muchas').ok).toBe(false);
  });

  it('CARGA: kg, % of 1RM, RPE, band or bodyweight; one replaces the others', () => {
    for (const t of ['80', '80 kg', '80kg', '80 kilos'])
      expect(patch(parseLoad(t))).toEqual({ loadKg: 80, loadPct1rm: null });
    expect(patch(parseLoad('82,5 kg'))).toEqual({ loadKg: 82.5, loadPct1rm: null });
    for (const t of ['75 %', '75%', '75%1RM', '75 % de 1RM'])
      expect(patch(parseLoad(t))).toEqual({ loadKg: null, loadPct1rm: 75 });
    expect(patch(parseLoad('RPE 8'))).toEqual({
      loadKg: null,
      loadPct1rm: null,
      rpeTarget: 8,
      rirMin: null,
      rirMax: null,
    });
    expect(patch(parseLoad('@8,5'))).toMatchObject({ rpeTarget: 8.5 });
    expect(patch(parseLoad('banda roja'))).toEqual({
      loadKg: null,
      loadPct1rm: null,
      intensityNote: 'Banda roja',
    });
    expect(patch(parseLoad('Goma verde'))).toMatchObject({ intensityNote: 'Banda verde' });
    for (const t of ['PC', 'peso corporal', 'bodyweight'])
      expect(patch(parseLoad(t))).toMatchObject({ intensityNote: 'Peso corporal' });
    expect(parseLoad('mucho').ok).toBe(false);
  });

  it('CARGA only clears the notes it owns', () => {
    expect(patch(parseLoad('80', { intensityNote: 'Banda roja' }))).toEqual({
      loadKg: 80,
      loadPct1rm: null,
      intensityNote: null,
    });
    expect(patch(parseLoad('80', { intensityNote: 'Zona 2 de FC' }))).toEqual({
      loadKg: 80,
      loadPct1rm: null,
    });
    expect(patch(parseLoad('', { intensityNote: 'Peso corporal' }))).toEqual({
      loadKg: null,
      loadPct1rm: null,
      intensityNote: null,
    });
  });

  it('RIR and RPE exclude each other', () => {
    expect(patch(parseRir('2'))).toEqual({ rirMin: 2, rirMax: 2, rpeTarget: null });
    expect(patch(parseRir('1-2'))).toEqual({ rirMin: 1, rirMax: 2, rpeTarget: null });
    expect(patch(parseRir(''))).toEqual({ rirMin: null, rirMax: null });
    expect(parseRir('1,5').ok).toBe(false);
    expect(patch(parseRpe('8,5'))).toEqual({ rpeTarget: 8.5, rirMin: null, rirMax: null });
    expect(patch(parseRpe('RPE 8'))).toEqual({ rpeTarget: 8, rirMin: null, rirMax: null });
    expect(patch(parseRpe(''))).toEqual({ rpeTarget: null });
    expect(parseRpe('alto').ok).toBe(false);
  });

  it('DESC.: seconds or minutes in the usual notations', () => {
    for (const [t, s] of [
      ['90', 90],
      ['90 s', 90],
      ['90"', 90],
      ['2:30', 150],
      ['2 min', 120],
      ["2'", 120],
      ["2'30", 150],
      ['1,5 min', 90],
    ] as const)
      expect(patch(parseRest(t))).toEqual({ restS: s });
    expect(patch(parseRest(''))).toEqual({ restS: null });
    expect(parseRest('un rato').ok).toBe(false);
  });

  it('formatting a cell and typing it back gives the same prescription (property)', () => {
    const cases: [GridColumn, fc.Arbitrary<Prescription>][] = [
      ['sets', fc.integer({ min: 1, max: 20 }).map((sets) => ({ sets }))],
      [
        'reps',
        fc
          .tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 20 }))
          .map(([a, d]) => ({ repsMin: a, repsMax: a + d })),
      ],
      ['reps', fc.integer({ min: 1, max: 3600 }).map((durationS) => ({ durationS }))],
      ['reps', fc.integer({ min: 1, max: 5000 }).map((distanceM) => ({ distanceM }))],
      ['load', fc.integer({ min: 0, max: 2000 }).map((n) => ({ loadKg: n / 2 }))],
      ['load', fc.integer({ min: 1, max: 110 }).map((loadPct1rm) => ({ loadPct1rm }))],
      [
        'rir',
        fc
          .tuple(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 3 }))
          .map(([a, d]) => ({ rirMin: a, rirMax: Math.min(10, a + d) })),
      ],
      ['rpe', fc.integer({ min: 2, max: 20 }).map((n) => ({ rpeTarget: n / 2 }))],
      ['rest', fc.integer({ min: 0, max: 900 }).map((restS) => ({ restS }))],
    ];
    for (const [col, arb] of cases)
      fc.assert(
        fc.property(arb, (p) => {
          const r = parseCell(col, formatCell(col, p), p);
          expect(r.ok).toBe(true);
          if (r.ok)
            for (const [k, v] of Object.entries(p))
              expect(r.patch[k as keyof Prescription]).toBe(v);
        }),
      );
  });

  it('every parsed cell passes or fails validation with a message, never throws', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<GridColumn>('sets', 'reps', 'load', 'rir', 'rpe', 'rest'),
        fc.string({ maxLength: 12 }),
        (col, text) => {
          const r = parseCell(col, text);
          if (r.ok) validatePrescription(r.patch, { supportsVbt: false });
          else expect(r.error.length).toBeGreaterThan(5);
        },
      ),
    );
  });
});

describe('pasting from Excel', () => {
  it('maps columns by their headers and reads every cell', () => {
    const rows = parseSessionTsv(
      [
        'EJERCICIO\tSERIES\tREPS\tCarga (kg)\tDescanso\tObservaciones',
        'Sentadilla trasera\t4\t6-8\t80\t2:30\tsubir si sale fácil',
        '',
        'Plancha frontal\t3\t30 s\tPC\t60\t',
      ].join('\r\n'),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      exercise: 'Sentadilla trasera',
      notes: 'subir si sale fácil',
      prescription: { sets: 4, repsMin: 6, repsMax: 8, loadKg: 80, restS: 150 },
      errors: {},
    });
    expect(rows[1]!.prescription).toMatchObject({ durationS: 30, intensityNote: 'Peso corporal' });
  });

  it('without headers: the order of the table, with or without the category column', () => {
    // Whichever layout reads more cells wins (here the second column is clearly a number or not).
    const short = parseSessionTsv('Press banca\t4\t8\t60 kg\t2\t\t2 min');
    expect(short[0]!.prescription).toMatchObject({
      sets: 4,
      repsMin: 8,
      loadKg: 60,
      rirMin: 2,
      restS: 120,
    });
    const full = parseSessionTsv('Press banca\tFuerza\t4\t8\t75 %\t\t8\t90\tcontrolado');
    expect(full[0]).toMatchObject({
      exercise: 'Press banca',
      notes: 'controlado',
      prescription: { sets: 4, repsMin: 8, loadPct1rm: 75, rpeTarget: 8, restS: 90 },
    });
  });

  it('keeps the row and reports the cells it could not read', () => {
    const [row] = parseSessionTsv('EJERCICIO\tSERIES\tREPS\tCARGA\nRemo\tmuchas\t8\tpesado');
    expect(row!.exercise).toBe('Remo');
    expect(Object.keys(row!.errors).sort()).toEqual(['load', 'sets']);
    expect(row!.prescription).toMatchObject({ repsMin: 8 });
  });

  it('what the table copies, the table pastes back', () => {
    const src = [
      {
        exercise: 'Sentadilla trasera',
        category: 'Fuerza',
        prescription: {
          sets: 4,
          repsMin: 6,
          repsMax: 8,
          loadKg: 82.5,
          rirMin: 1,
          rirMax: 2,
          restS: 150,
        },
        notes: 'tempo 3-1-X-0',
      },
      {
        exercise: 'Copenhagen',
        category: 'Reducción de factores de riesgo',
        prescription: { sets: 2, durationS: 20, intensityNote: 'Peso corporal' },
        notes: null,
      },
    ];
    const back = parseSessionTsv(toSessionTsv(src));
    expect(back.map((r) => r.exercise)).toEqual(['Sentadilla trasera', 'Copenhagen']);
    expect(back[0]!.prescription).toMatchObject(src[0]!.prescription);
    expect(back[1]!.prescription).toMatchObject(src[1]!.prescription);
    expect(back[0]!.notes).toBe('tempo 3-1-X-0');
  });

  it('caps the number of rows', () => {
    const text = Array.from({ length: 300 }, (_, i) => `Ejercicio ${i}\t3\t10`).join('\n');
    expect(parseSessionTsv(text)).toHaveLength(200);
  });
});

describe('recognizing exercises by name', () => {
  const lib = [
    { id: 'sq', name: 'Sentadilla trasera con barra', altNames: ['Back squat'] },
    { id: 'fsq', name: 'Sentadilla frontal con barra' },
    { id: 'bp', name: 'Press de banca' },
    { id: 'nh', name: 'Curl nórdico' },
    { id: 'nh-draft', name: 'Curl nórdico', published: false },
    { id: 'row1', name: 'Remo con mancuerna' },
    { id: 'row2', name: 'Remo con mancuernas' },
  ];

  it('exact names and aliases, ignoring case, accents and punctuation', () => {
    expect(matchExerciseName('PRESS DE BANCA', lib).match?.id).toBe('bp');
    expect(matchExerciseName('back-squat', lib).match?.id).toBe('sq');
    // An exact published exercise wins over a draft with the same name.
    expect(matchExerciseName('curl nordico', lib).match?.id).toBe('nh');
  });

  it('tolerates typos when one exercise is clearly the closest', () => {
    expect(matchExerciseName('sentadila trasera con barra', lib).match?.id).toBe('sq');
    expect(matchExerciseName('pres de vanca', lib).match?.id).toBe('bp');
  });

  it('never guesses between close candidates; offers them instead', () => {
    const r = matchExerciseName('Remo con mancuern', lib);
    expect(r.match).toBeNull();
    expect(
      r.candidates
        .slice(0, 2)
        .map((c) => c.id)
        .sort(),
    ).toEqual(['row1', 'row2']);
    expect(matchExerciseName('Sentadilla', lib).match).toBeNull();
    expect(matchExerciseName('', lib)).toEqual({ match: null, candidates: [] });
    expect(matchExerciseName('Lanzamiento de jabalina', lib).match).toBeNull();
  });

  it('similarity is symmetric, between 0 and 1, and 1 only for the same normalized name', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), (a, b) => {
        const s = nameSimilarity(a, b);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        expect(nameSimilarity(b, a)).toBeCloseTo(s, 10);
      }),
    );
    const m = exerciseNameMatcher(lib);
    expect(m('Press de banca').candidates[0]).toMatchObject({ id: 'bp', score: 1 });
  });
});
