/**
 * Progression graph (§30). Edges `from → to` with relation progression | regression | variant.
 * A regression A→B is equivalent to a progression B→A, so both are normalised to "harder"
 * edges and the resulting directed graph must be acyclic (A harder than B harder than A is
 * contradictory). Variants are undirected and never create cycles.
 */
export type ProgressionRelation = 'progression' | 'regression' | 'variant';

export interface ProgressionEdge {
  from: string;
  to: string;
  relation: ProgressionRelation;
}

/** Edge pointing from easier to harder exercise, or null for variants. */
function harderEdge(e: ProgressionEdge): [string, string] | null {
  if (e.relation === 'progression') return [e.from, e.to];
  if (e.relation === 'regression') return [e.to, e.from];
  return null;
}

/** Returns a cycle (list of exercise ids) if adding `candidate` makes the graph contradictory. */
export function findProgressionCycle(
  edges: ProgressionEdge[],
  candidate: ProgressionEdge,
): string[] | null {
  if (candidate.from === candidate.to) return [candidate.from];
  const next = new Map<string, string[]>();
  for (const e of [...edges, candidate]) {
    const h = harderEdge(e);
    if (!h) continue;
    next.set(h[0], [...(next.get(h[0]) ?? []), h[1]]);
  }
  const start = harderEdge(candidate);
  if (!start) return null;
  // DFS from the harder end looking for the easier end.
  const [easy, hard] = start;
  const stack: [string, string[]][] = [[hard, [easy, hard]]];
  const seen = new Set<string>();
  while (stack.length) {
    const [node, path] = stack.pop()!;
    if (node === easy) return path;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const n of next.get(node) ?? []) stack.push([n, [...path, n]]);
  }
  return null;
}

/** Progression axes (§30). */
export const PROGRESSION_AXES = [
  'load',
  'reps',
  'volume',
  'effort',
  'rom',
  'complexity',
  'stability',
  'unilaterality',
  'velocity',
  'impact',
] as const;
export type ProgressionAxis = (typeof PROGRESSION_AXES)[number];
