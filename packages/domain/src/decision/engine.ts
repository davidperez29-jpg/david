/**
 * Decision engine pipeline (MASTER_SPECIFICATION §13.3): pure, deterministic stages.
 *   1 context → facts · 2 screening gate · 3 profiler · 4 needs · 5 prioritization ·
 *   6 method selection · 7 exercise selection · 8 dosing · 9 plan assembly · 10 explain.
 * It proposes; the trainer decides. It never diagnoses and never modifies a plan.
 */
import { evaluate, getPath, pendingParams, type Facts } from './dsl';
import {
  GOAL_QUALITY,
  GOAL_TEMPLATE,
  METHOD_ELIGIBILITY,
  METHOD_SLOTS,
  PATTERN_LABELS,
  QUALITIES,
  QUALITY_METHODS,
  QUALITY_ORDER,
  TRAITS,
} from './knowledge';
import { applyVariant, pickVariant, populationLabel, whoOf } from './population';
import type {
  ClaimFact,
  ClientContext,
  Confidence,
  DecisionResult,
  DecisionRule,
  Dose,
  ExerciseCandidate,
  Explanation,
  KnowledgeSnapshot,
  MethodChoice,
  Need,
  Priority,
  Quality,
} from './types';

const CONF_RANK: Record<Confidence, number> = { high: 3, moderate: 2, low: 1, very_low: 0 };
const minConfidence = (xs: Confidence[], fallback: Confidence = 'low'): Confidence =>
  xs.length ? xs.reduce((a, b) => (CONF_RANK[b] < CONF_RANK[a] ? b : a)) : fallback;
const capConfidence = (c: Confidence, cap: Confidence): Confidence =>
  CONF_RANK[c] > CONF_RANK[cap] ? cap : c;
const r2 = (x: number) => Math.round(x * 100) / 100;
const fmt = (x: number) => x.toLocaleString('es-ES', { maximumFractionDigits: 2 });

export const POPULATION_LABELS: Record<string, string> = {
  adults_untrained: 'adultos no entrenados',
  adults_recreational: 'adultos activos',
  adults_resistance_trained: 'adultos entrenados en fuerza',
  older_adults: 'adultos mayores',
  youth: 'jóvenes',
  team_sport_athletes: 'deportistas de equipo',
  football_players: 'futbolistas',
  handball_players: 'jugadores de balonmano',
  endurance_athletes: 'deportistas de resistencia',
  sprinters: 'velocistas',
  athletes_mixed: 'deportistas',
  collegiate_athletes: 'deportistas universitarios',
  powerlifters: 'powerlifters',
};
const popList = (xs: string[]) => xs.map((x) => POPULATION_LABELS[x] ?? x).join(', ');

/** FNV-1a over a stable JSON representation. */
export function stableHash(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
          )
        : v;
  const s = JSON.stringify(stable(value));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Stage 1: normalized facts the DSL reads. */
export function buildFacts(ctx: ClientContext): Facts {
  const days = ctx.availability.daysPerWeek;
  const mins = ctx.availability.minutesPerSession;
  return {
    today: ctx.today,
    screening: ctx.screening,
    person: ctx.person,
    goal: ctx.goals.primary
      ? {
          slug: ctx.goals.primary.slug,
          family: ctx.goals.primary.family,
          sport: ctx.goals.primary.sport,
          sportType: ctx.goals.primary.sportType,
        }
      : {},
    populations: ctx.populations,
    availability: {
      daysPerWeek: days,
      minutesPerSession: mins,
      minutesPerWeek: days != null && mins != null ? days * mins : null,
    },
    response: ctx.response,
    metrics: Object.fromEntries(Object.entries(ctx.metrics).map(([k, m]) => [k, m.value])),
    derived: Object.fromEntries(Object.entries(ctx.derived).map(([k, d]) => [k, d.value])),
    flags: { anyDecline: Object.values(ctx.metrics).some((m) => m.change === 'probable_decline') },
    traits: {},
    needs: {},
  };
}

interface Applied {
  rule: DecisionRule;
  params: Record<string, unknown>;
  used: Record<string, unknown>;
}

function paramsOf(r: DecisionRule): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r.parameters).map(([k, p]) => [k, p.value]));
}

export function runDecisionEngine(ctx: ClientContext, k: KnowledgeSnapshot): DecisionResult {
  const facts = buildFacts(ctx);
  const warnings: string[] = [...ctx.missing];
  const pendingRules: DecisionResult['pendingRules'] = [];
  const active = (r: DecisionRule) => r.enabled && !k.disabledRules.includes(r.key);
  // The centre's values for the client's population replace the defaults (restructure phase 17).
  const who = whoOf(ctx);
  const populationValues: DecisionResult['populationValues'] = [];
  const populationOf = new Map<string, string>();
  const rules = k.rules.filter(active).map((r) => {
    const hit = pickVariant(r.variants ?? [], who);
    if (!hit) return r;
    const population = populationLabel(hit.variant.when, k.sportNames);
    populationOf.set(r.key, population);
    populationValues.push({
      ruleKey: r.key,
      population,
      values: hit.variant.values,
      summary: Object.entries(hit.variant.values)
        .filter(([key]) => Object.hasOwn(r.parameters, key))
        .map(([key, x]) => {
          const p = r.parameters[key]!;
          return `${p.label}: ${fmt(x)}${p.unit ? ` ${p.unit}` : ''}`;
        })
        .join(' · '),
      note: hit.variant.note ?? null,
    });
    return applyVariant(r, hit.variant);
  });
  const ruleByKey = (key: string) => rules.find((r) => r.key === key);
  for (const r of rules) {
    const p = pendingParams(r.parameters);
    if (p.length) pendingRules.push({ key: r.key, params: p });
  }
  /** Runs the rules of a domain whose parameters are complete; returns those that fired. */
  const fire = (
    domain: DecisionRule['domain'],
    filter: (r: DecisionRule) => boolean = () => true,
  ): Applied[] =>
    rules
      .filter((r) => r.domain === domain && filter(r) && pendingParams(r.parameters).length === 0)
      .flatMap((r) => {
        const params = paramsOf(r);
        const res = evaluate(r.condition, facts, params);
        return res.value ? [{ rule: r, params, used: res.used }] : [];
      });

  const claim = (key: string): ClaimFact | undefined => k.claims[key];
  const evidenceOf = (keys: string[]) =>
    [...new Set(keys)]
      .map(claim)
      .filter((c): c is ClaimFact => !!c)
      .map((c) => ({
        claimKey: c.key,
        statement: c.statement,
        confidence: c.confidence,
        sources: c.sources,
        ...(c.evidenceKind !== undefined ? { evidenceKind: c.evidenceKind } : {}),
        ...(c.limitations !== undefined ? { limitations: c.limitations } : {}),
      }));
  const applicabilityOf = (keys: string[]) =>
    [...new Set(keys)]
      .map(claim)
      .filter((c): c is ClaimFact => !!c)
      .map((c) => {
        const match = c.appliesTo.filter((p) => ctx.populations.includes(p));
        const not = c.notFor.filter((p) => ctx.populations.includes(p));
        if (not.length) return `${c.key}: no aplicable a ${popList(not)}`;
        if (match.length) return `${c.key}: coincide (${popList(match)})`;
        return `${c.key}: extrapolación — estudios en ${popList(c.appliesTo) || 'población no especificada'}`;
      });

  // ── 2. Screening gate ───────────────────────────────────────────────────────
  const scr = fire('screening');
  const screeningStatus = scr.some(
    (a) => a.rule.action.type === 'set_screening' && a.rule.action.status === 'refer',
  )
    ? ('refer' as const)
    : scr.length
      ? ('caution' as const)
      : ('clear' as const);
  const screening = {
    status: screeningStatus,
    reasons: scr.map((a) =>
      a.rule.action.type === 'set_screening' ? a.rule.action.text : a.rule.description,
    ),
  };

  // ── 3. Profiler ─────────────────────────────────────────────────────────────
  const traits: DecisionResult['traits'] = [];
  const traitValues: Record<string, boolean | null> = {};
  const traitBasis: Record<string, string> = {};
  for (const t of TRAITS) {
    const value = getPath(facts, t.metric) as number | undefined;
    const r = rules.find((x) => x.key === t.ruleKey);
    const testSlug = t.metric.split('.')[1]!;
    const adjective =
      t.trait === 'sprint_slow' ? 'lento' : t.trait === 'relative_strength_low' ? 'baja' : 'bajo';
    let v: boolean | null = null;
    let basis: DecisionResult['traits'][number]['basis'] = 'unknown';
    let detail: string;
    if (ctx.manualTraits[t.trait] !== undefined) {
      v = ctx.manualTraits[t.trait]!;
      basis = 'manual';
      detail = `Valoración del entrenador: ${v ? 'sí' : 'no'}.`;
    } else if (value == null) {
      detail = `Sin dato de ${t.testName}.`;
    } else if (!r) {
      detail = 'Regla desactivada.';
    } else if (pendingParams(r.parameters).length) {
      const ref = ctx.metrics[testSlug]?.reference ?? null;
      if (ref) {
        v = ref === 'low';
        basis = 'reference';
        detail = `Referencia aplicable verificada: ${ref === 'low' ? 'por debajo' : ref === 'average' ? 'en la media' : 'por encima'}.`;
      } else {
        detail = `No hay referencia aplicable para valorar ${t.testName} como ${adjective}; se usa la valoración del entrenador.`;
        warnings.push(detail);
      }
    } else {
      const res = evaluate(r.condition, facts, paramsOf(r));
      if (res.value) v = true;
      else if (!res.missing.length) v = false;
      basis = v == null ? 'unknown' : 'threshold';
      const thr = r.parameters.threshold;
      detail =
        v == null
          ? `No evaluable (${res.missing.join(', ')}).`
          : `${fmt(value)} ${thr?.unit ?? ''} frente al umbral del centro${populationOf.has(r.key) ? ` para ${populationOf.get(r.key)}` : ''} ${fmt(Number(thr?.value))} ${thr?.unit ?? ''}.`;
    }
    traitValues[t.trait] = v;
    traitBasis[t.trait] = basis;
    traits.push({ key: t.trait, label: t.label, value: v, basis, detail });
  }
  for (const m of Object.values(ctx.metrics))
    if (m.change === 'probable_decline')
      traits.push({
        key: `${m.testSlug}_declined`,
        label: `${m.name}: empeoramiento probable`,
        value: true,
        basis: 'change',
        detail: `Cambio mayor que el error de medida (${m.date}).`,
      });
  facts.traits = Object.fromEntries(Object.entries(traitValues).filter(([, v]) => v !== null));

  // ── 4. Needs ────────────────────────────────────────────────────────────────
  const score: Record<string, number> = {};
  const why: Record<string, { data: string[]; interp: string[]; rules: DecisionRule[] }> = {};
  const touch = (q: Quality) => (why[q] ??= { data: [], interp: [], rules: [] });
  const primary = ctx.goals.primary;
  if (!primary)
    warnings.push(
      'Sin objetivo principal: las necesidades se calculan solo con los datos disponibles.',
    );
  for (const q of QUALITY_ORDER) {
    let best = 0;
    if (primary) {
      const v = GOAL_QUALITY[primary.slug]?.[q] ?? 0;
      if (v > 0) {
        best = v;
        touch(q).data.push(`Objetivo principal «${primary.slug}»: necesidad de partida ${fmt(v)}.`);
      }
    }
    for (const g of ctx.goals.secondary) {
      const v = (GOAL_QUALITY[g.slug]?.[q] ?? 0) * g.weight;
      if (v > best) {
        best = v;
        touch(q).data.push(`Objetivo secundario «${g.slug}» (peso ${fmt(g.weight)}): ${fmt(v)}.`);
      }
    }
    score[q] = best;
  }
  const directionOverride: Partial<Record<Quality, 'mantener'>> = {};
  for (const a of fire('needs', (r) => !r.key.startsWith('profile.'))) {
    const act = a.rule.action;
    if (act.type === 'raise_need') {
      const delta = Number(a.params.delta ?? act.delta);
      score[act.quality] = Math.min(1, (score[act.quality] ?? 0) + delta);
      const w = touch(act.quality);
      w.interp.push(`${a.rule.description} (+${fmt(delta)}).`);
      w.rules.push(a.rule);
    } else if (act.type === 'set_direction') {
      directionOverride[act.quality] = act.direction;
      const w = touch(act.quality);
      w.interp.push(a.rule.description);
      w.rules.push(a.rule);
    } else if (act.type === 'warn') warnings.push(act.text);
  }
  // Data lines about the traits that drove each rule.
  for (const t of traits) {
    const qs: Quality[] =
      t.key === 'relative_strength_low'
        ? ['max_strength']
        : t.key === 'cmj_low'
          ? ['power']
          : t.key === 'sprint_slow'
            ? ['speed']
            : [];
    for (const q of qs)
      touch(q).data.push(
        `${t.label}: ${t.value == null ? 'sin valorar' : t.value ? 'sí' : 'no'} — ${t.detail}`,
      );
  }
  for (const m of Object.values(ctx.metrics))
    for (const q of QUALITY_ORDER)
      if (
        (q === 'power' && m.testSlug === 'cmj_height') ||
        (q === 'speed' && m.testSlug.startsWith('sprint_')) ||
        (q === 'max_strength' && m.testSlug.startsWith('one_rm_'))
      )
        touch(q).data.push(
          `${m.name}: ${fmt(m.value)} ${m.unit} (${m.date})${m.change ? ` · ${m.change}` : ''}.`,
        );
  if (ctx.response.adherence28 != null)
    for (const q of QUALITY_ORDER)
      if (why[q]) why[q]!.data.push(`Adherencia 4 semanas: ${fmt(ctx.response.adherence28)} %.`);

  const DEVELOP = 0.5;
  const MAINTAIN = 0.25;
  const needsList: Need[] = QUALITY_ORDER.filter((q) => (score[q] ?? 0) > 0 || directionOverride[q])
    .map((q) => {
      const s = r2(score[q] ?? 0);
      const direction: Need['direction'] = directionOverride[q]
        ? 'mantener'
        : s >= DEVELOP
          ? 'desarrollar'
          : s >= MAINTAIN
            ? 'mantener'
            : 'no prioritario';
      const w = why[q] ?? { data: [], interp: [], rules: [] };
      const claimKeys = w.rules.flatMap((r) => r.evidenceClaimKeys);
      const usesManual =
        q === 'power'
          ? traitBasis.cmj_low === 'manual'
          : q === 'max_strength'
            ? traitBasis.relative_strength_low === 'manual'
            : false;
      const conf = capConfidence(
        minConfidence(
          evidenceOf(claimKeys).map((e) => e.confidence),
          'low',
        ),
        usesManual || ctx.missing.length ? 'low' : 'high',
      );
      const explanation: Explanation = {
        proposal: `${QUALITIES[q]}: necesidad ${fmt(s)} → ${direction}`,
        data: w.data,
        interpretation: w.interp.length
          ? w.interp
          : ['Necesidad derivada del objetivo (matriz objetivo → cualidades, F).'],
        rules: w.rules.map((r) => ({ key: r.key, version: r.version })),
        evidence: evidenceOf(claimKeys),
        applicability: applicabilityOf(claimKeys),
        limitations: [
          ...new Set(w.rules.map((r) => r.limitations)),
          ...(usesManual ? ['Rasgo marcado manualmente por el entrenador.'] : []),
        ],
        confidence: conf,
      };
      return { quality: q, label: QUALITIES[q], score: s, direction, explanation };
    })
    .sort(
      (a, b) =>
        b.score - a.score || QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality),
    );

  // ── 5. Prioritization ───────────────────────────────────────────────────────
  facts.needs = Object.fromEntries(needsList.map((n) => [n.quality, n.score]));
  let maxPriorities = Number.POSITIVE_INFINITY;
  const prioRules: DecisionRule[] = [];
  for (const a of fire('prioritization')) {
    if (a.rule.action.type === 'limit_priorities') {
      // The strictest limit among the rules that fired wins.
      maxPriorities = Math.min(maxPriorities, Number(a.params.max ?? a.rule.action.max));
      prioRules.push(a.rule);
    } else if (a.rule.action.type === 'warn') warnings.push(a.rule.action.text);
  }
  if (!Number.isFinite(maxPriorities)) maxPriorities = 3;
  const develop = needsList.filter((n) => n.direction === 'desarrollar');
  for (const n of develop.slice(maxPriorities)) {
    n.direction = 'mantener';
    n.explanation.interpretation.push(
      `Límite de ${maxPriorities} prioridades de desarrollo: pasa a mantenimiento.`,
    );
    n.explanation.rules.push(...prioRules.map((r) => ({ key: r.key, version: r.version })));
  }
  const dev = needsList.filter((n) => n.direction === 'desarrollar');
  const maint = needsList.filter((n) => n.direction === 'mantener');
  const days = ctx.availability.daysPerWeek ?? 3;
  const weekly = days * (ctx.availability.minutesPerSession ?? 60);
  const maintMinutes = maint.length ? Math.max(10, Math.round(weekly * 0.1)) : 0;
  const devPool = Math.max(0, weekly - maintMinutes * maint.length);
  const devSum = dev.reduce((a, n) => a + n.score, 0) || 1;
  const priorities: Priority[] = dev.map((n, i) => ({
    rank: i + 1,
    quality: n.quality,
    label: n.label,
    minutesPerWeek: Math.round((devPool * n.score) / devSum),
    // Sessions with a stimulus of the quality: round(days × need × 0.75), at least 1 (F).
    sessionsPerWeek: Math.min(days, Math.max(1, Math.round(days * n.score * 0.75))),
  }));

  // ── 6. Method selection ─────────────────────────────────────────────────────
  const excludedMethods: DecisionResult['excludedMethods'] = [];
  const excludeReason = new Map<string, { reason: string; ruleKey: string }>();
  const preferred = new Map<string, DecisionRule>();
  for (const a of fire('method_selection')) {
    const act = a.rule.action;
    if (act.type === 'exclude_methods')
      for (const m of act.methods)
        if (!excludeReason.has(m))
          excludeReason.set(m, { reason: act.reason, ruleKey: a.rule.key });
    if (act.type === 'prefer_method') preferred.set(act.method, a.rule);
  }
  const methodChoices: MethodChoice[] = [];
  const pickFor = (n: Need, max: number) => {
    const list = [
      ...QUALITY_METHODS[n.quality],
      ...(n.quality === 'max_strength' || n.quality === 'hypertrophy' ? ['dosis-minima'] : []),
    ];
    const ordered = [...list].sort((a, b) => Number(preferred.has(b)) - Number(preferred.has(a)));
    let picked = 0;
    for (const slug of ordered) {
      if (picked >= max) break;
      if (methodChoices.some((m) => m.method === slug)) continue;
      const m = k.methods.find((x) => x.slug === slug);
      if (!m) continue;
      const ex = excludeReason.get(slug);
      if (ex) {
        if (!excludedMethods.some((e) => e.method === slug))
          excludedMethods.push({ method: slug, reason: ex.reason, ruleKey: ex.ruleKey });
        continue;
      }
      const eligible =
        preferred.has(slug) ||
        (METHOD_ELIGIBILITY[slug]?.({ age: ctx.person.age, populations: ctx.populations }) ?? true);
      if (!eligible) continue;
      const notFor = m.claimKeys
        .map(claim)
        .filter((c): c is ClaimFact => !!c)
        .flatMap((c) => c.notFor.filter((p) => ctx.populations.includes(p)));
      if (notFor.length && !preferred.has(slug)) {
        excludedMethods.push({
          method: slug,
          reason: `Evidencia no aplicable a ${popList([...new Set(notFor)])}.`,
          ruleKey: 'applicability',
        });
        continue;
      }
      const pref = preferred.get(slug);
      const claimKeys = [...m.claimKeys, ...(pref?.evidenceClaimKeys ?? [])];
      methodChoices.push({
        method: slug,
        name: m.name,
        quality: n.quality,
        rationale: pref
          ? `${pref.description}`
          : `Método para ${n.label.toLowerCase()} (${n.direction}).`,
        excluded: false,
        explanation: {
          proposal: `${m.name} para ${n.label.toLowerCase()}`,
          data: [
            `Necesidad de ${n.label.toLowerCase()}: ${fmt(n.score)} (${n.direction}).`,
            `Poblaciones del cliente: ${popList(ctx.populations) || 'sin definir'}.`,
          ],
          interpretation: [
            pref
              ? pref.description
              : 'Método candidato para la cualidad, no excluido por las reglas ni por la aplicabilidad de su evidencia.',
          ],
          rules: pref ? [{ key: pref.key, version: pref.version }] : [],
          evidence: evidenceOf(claimKeys),
          applicability: applicabilityOf(claimKeys),
          limitations: pref ? [pref.limitations] : [],
          confidence: minConfidence(
            evidenceOf(claimKeys).map((e) => e.confidence),
            'low',
          ),
        },
      });
      picked++;
    }
  };
  for (const n of dev) pickFor(n, 2);
  for (const n of maint) pickFor(n, 1);
  // Every rule exclusion that affects the candidates of the client's needs is reported.
  const candidates = new Set([...dev, ...maint].flatMap((n) => QUALITY_METHODS[n.quality]));
  for (const [m, ex] of excludeReason)
    if (
      candidates.has(m) &&
      !excludedMethods.some((e) => e.method === m) &&
      k.methods.some((x) => x.slug === m)
    )
      excludedMethods.push({ method: m, reason: ex.reason, ruleKey: ex.ruleKey });

  // ── 7. Exercise selection ───────────────────────────────────────────────────
  const levelRank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
  const lvl = ctx.person.experience ? levelRank[ctx.person.experience] : 1;
  const exercises: ExerciseCandidate[] = [];
  for (const mc of methodChoices) {
    for (const slot of METHOD_SLOTS[mc.method] ?? []) {
      const excluded: ExerciseCandidate['excluded'] = [];
      const scored = k.exercises
        .filter((e) => e.pattern === slot)
        .flatMap((e) => {
          if (ctx.tolerances.notToleratedExerciseIds.includes(e.id)) {
            excluded.push({
              exerciseId: e.id,
              name: e.name,
              reason: 'No tolerado por el cliente.',
            });
            return [];
          }
          if (ctx.tolerances.restrictedPatterns.includes(e.pattern)) {
            excluded.push({ exerciseId: e.id, name: e.name, reason: 'Patrón con restricción.' });
            return [];
          }
          if (ctx.equipment && e.requiredEquipment.some((x) => !ctx.equipment!.includes(x))) {
            excluded.push({
              exerciseId: e.id,
              name: e.name,
              reason: 'Falta material obligatorio.',
            });
            return [];
          }
          if (screening.status === 'refer' && e.impact === 'high') {
            excluded.push({
              exerciseId: e.id,
              name: e.name,
              reason: 'Alto impacto con cribado positivo.',
            });
            return [];
          }
          const reasons: string[] = [`Patrón ${PATTERN_LABELS[slot] ?? slot}.`];
          let sc = 1;
          if (e.methodSlugs.includes(mc.method)) {
            sc += 2;
            reasons.push('Ejemplo del método en la biblioteca.');
          }
          if (e.level) {
            const d = levelRank[e.level] - lvl;
            if (d === 0) {
              sc += 1;
              reasons.push('Nivel adecuado.');
            } else if (d > 0) {
              sc -= 2 * d;
              reasons.push('Nivel por encima del cliente.');
            } else reasons.push('Nivel por debajo (opción conservadora).');
          }
          if (lvl === 0 && (e.complexity ?? 0) > 3) {
            sc -= 1;
            reasons.push('Técnica compleja para un principiante.');
          }
          if (lvl === 0 && e.impact === 'high') {
            sc -= 1;
            reasons.push('Alto impacto para un principiante.');
          }
          return [{ exerciseId: e.id, name: e.name, score: sc, reasons }];
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      exercises.push({
        slot,
        method: mc.method,
        candidates: scored.slice(0, 2),
        excluded: excluded.slice(0, 5),
      });
    }
  }

  // ── 8. Dosing ───────────────────────────────────────────────────────────────
  const doseNotes = fire('dosing').flatMap((a) =>
    a.rule.action.type === 'dose_note' ? [a.rule.action.text] : [],
  );
  const doses: Dose[] = methodChoices.flatMap((mc) => {
    const m = k.methods.find((x) => x.slug === mc.method)!;
    return m.variables
      .filter((v) => !v.population || ctx.populations.includes(v.population))
      .map((v) => {
        const mid =
          v.min != null && v.max != null ? Math.round((v.min + v.max) / 2) : (v.min ?? v.max);
        const suggested =
          v.typical ??
          (ctx.person.experience === 'beginner'
            ? v.min
            : ctx.person.experience === 'advanced'
              ? v.max
              : mid);
        return {
          method: mc.method,
          variable: v.key,
          min: v.min,
          max: v.max,
          suggested,
          unit: v.unit,
          note: doseNotes.join(' ') || null,
          claimKey: v.claimKey,
        };
      });
  });

  // ── Intro phase (§13.5): a score, never a default for everyone ───────────────
  const introRule = ruleByKey('progression.intro_phase');
  const introReasons: string[] = [];
  let intro = 0;
  if (ctx.person.experience === 'beginner') {
    intro += 0.4;
    introReasons.push('Sin experiencia con cargas de fuerza (+0,4).');
  }
  if ((ctx.person.age ?? 0) >= 65) {
    intro += 0.2;
    introReasons.push('Edad ≥ 65 años (+0,2).');
  }
  if (
    ctx.response.painFlag ||
    ctx.tolerances.notToleratedExerciseIds.length ||
    ctx.tolerances.restrictedPatterns.length
  ) {
    intro += 0.2;
    introReasons.push('Dolor o tolerancias declaradas (+0,2).');
  }
  if (
    methodChoices.some((m) => m.method === 'pliometria' || m.method === 'sprint-aceleracion') &&
    ctx.person.experience !== 'advanced'
  ) {
    intro += 0.2;
    introReasons.push('Métodos de alto impacto nuevos en el plan (+0,2).');
  }
  intro = r2(Math.min(1, intro));
  const brief = Number(introRule?.parameters.brief?.value ?? 0.3);
  const phase = Number(introRule?.parameters.phase?.value ?? 0.6);
  const introLevel =
    intro >= phase
      ? ('fase de adaptación' as const)
      : intro >= brief
        ? ('introducción breve' as const)
        : ('ninguna' as const);
  const introClaims = introRule?.evidenceClaimKeys ?? [];
  const introPhase = {
    level: introLevel,
    score: intro,
    weeks:
      introLevel === 'fase de adaptación'
        ? '3–6 semanas'
        : introLevel === 'introducción breve'
          ? '1–2 semanas, solo para los métodos nuevos'
          : '—',
    reasons: introReasons.length ? introReasons : ['Sin factores que la justifiquen.'],
    explanation: {
      proposal: `Fase introductoria: ${introLevel}${introLevel !== 'ninguna' ? ` (${introLevel === 'fase de adaptación' ? '3–6 semanas' : '1–2 semanas'})` : ''}`,
      data: introReasons,
      interpretation: [
        introLevel === 'ninguna'
          ? 'No se propone fase introductoria: no todo el mundo la necesita.'
          : 'Métodos candidatos (ninguno obligatorio): altas repeticiones con RIR alto, isométricos, excéntricos controlados, pliometría de baja intensidad, control motor y movilidad.',
      ],
      rules: introRule ? [{ key: introRule.key, version: introRule.version }] : [],
      evidence: evidenceOf(introClaims),
      applicability: applicabilityOf(introClaims),
      limitations: introRule ? [introRule.limitations] : [],
      confidence: 'low' as Confidence,
    },
  };

  // ── 9. Plan assembly ────────────────────────────────────────────────────────
  const reassessRule = ruleByKey('progression.reassessment');
  const reassessWeeks = Number(reassessRule?.parameters.weeks?.value ?? 6);
  let planSkeleton: DecisionResult['planSkeleton'] = null;
  const base = primary ? GOAL_TEMPLATE[primary.slug] : undefined;
  if (base) {
    const options = k.templates.filter((t) => t.slug.startsWith(`${base}-`));
    const best = [...options].sort(
      (a, b) =>
        Math.abs(a.sessionsPerWeek - days) - Math.abs(b.sessionsPerWeek - days) ||
        a.sessionsPerWeek - b.sessionsPerWeek,
    )[0];
    planSkeleton = {
      templateSlug: best?.slug ?? null,
      templateName: best?.name ?? null,
      sessionsPerWeek: best?.sessionsPerWeek ?? days,
      reassessmentEveryWeeks: reassessWeeks,
      explanation: {
        proposal: best
          ? `Plantilla «${best.name}» como punto de partida`
          : 'Sin plantilla disponible para el objetivo',
        data: [`Objetivo principal: ${primary!.slug}.`, `Disponibilidad: ${days} días/semana.`],
        interpretation: [
          best
            ? `Plantilla de la familia «${base}» con la frecuencia más cercana (${best.sessionsPerWeek} días). Reevaluación cada ${reassessWeeks} semanas.`
            : 'No hay plantillas de esa familia.',
          ...(introLevel !== 'ninguna'
            ? [`Añadir ${introPhase.weeks} de introducción antes del primer mesociclo.`]
            : []),
        ],
        rules: reassessRule ? [{ key: reassessRule.key, version: reassessRule.version }] : [],
        evidence: [],
        applicability: [],
        limitations: [
          'La plantilla es un punto de partida; el entrenador la adapta. Ningún plan activo se modifica.',
        ],
        confidence: 'low',
      },
    };
  }

  // Screening gate wording on every element when referral applies.
  if (screening.status === 'refer') warnings.unshift(screening.reasons[0]!);

  return {
    ruleSetVersion: k.ruleSetVersion,
    screening,
    traits,
    needs: needsList,
    priorities,
    methods: methodChoices,
    excludedMethods,
    exercises,
    doses,
    introPhase,
    planSkeleton,
    warnings: [...new Set(warnings)],
    pendingRules,
    populationValues,
    inputHash: stableHash({
      ctx,
      version: k.ruleSetVersion,
      disabled: [...k.disabledRules].sort(),
    }),
  };
}
