/**
 * Schematic body silhouette (front and back) that highlights the muscle groups an exercise works:
 * primary in full colour, secondary in light colour. Muscle groups are the catalogue's
 * `muscles.group_slug`. It is a guide for the trainer and the client, not an anatomical drawing.
 */
type Role = 'primary' | 'secondary';
type Shape =
  | { e: [number, number, number, number] } // ellipse cx, cy, rx, ry
  | { r: [number, number, number, number, number] }; // rect x, y, w, h, radius

const FRONT: Record<string, Shape[]> = {
  deltoids: [{ e: [33, 52, 10, 9] }, { e: [87, 52, 10, 9] }],
  chest: [{ e: [49, 63, 12, 9] }, { e: [71, 63, 12, 9] }],
  scapular: [{ e: [39, 80, 4, 8] }, { e: [81, 80, 4, 8] }],
  core: [{ r: [47, 74, 26, 40, 7] }],
  biceps: [{ e: [27, 78, 6, 13] }, { e: [93, 78, 6, 13] }],
  forearm: [{ e: [23, 107, 5, 14] }, { e: [97, 107, 5, 14] }],
  hip_flexors: [{ e: [52, 121, 6, 5] }, { e: [68, 121, 6, 5] }],
  quadriceps: [{ e: [49, 154, 9, 25] }, { e: [71, 154, 9, 25] }],
  adductors: [{ e: [56.5, 147, 3, 15] }, { e: [63.5, 147, 3, 15] }],
  lower_leg: [{ e: [49, 204, 5, 19] }, { e: [71, 204, 5, 19] }],
  foot: [{ e: [48, 236, 8, 4] }, { e: [72, 236, 8, 4] }],
};

const BACK: Record<string, Shape[]> = {
  back: [{ r: [46, 42, 28, 18, 8] }, { e: [48, 84, 10, 17] }, { e: [72, 84, 10, 17] }],
  deltoids: [{ e: [33, 52, 10, 9] }, { e: [87, 52, 10, 9] }],
  rotator_cuff: [{ e: [43, 64, 5, 5] }, { e: [77, 64, 5, 5] }],
  triceps: [{ e: [27, 78, 6, 13] }, { e: [93, 78, 6, 13] }],
  forearm: [{ e: [23, 107, 5, 14] }, { e: [97, 107, 5, 14] }],
  lower_back: [{ r: [51, 100, 18, 17, 5] }],
  glutes: [{ e: [50, 128, 10, 10] }, { e: [70, 128, 10, 10] }],
  hamstrings: [{ e: [49, 160, 8, 22] }, { e: [71, 160, 8, 22] }],
  calves: [{ e: [49, 203, 6, 16] }, { e: [71, 203, 6, 16] }],
  foot: [{ e: [48, 236, 8, 4] }, { e: [72, 236, 8, 4] }],
};

function Body() {
  // Neutral silhouette under the muscle regions.
  return (
    <g className="fill-surface stroke-border" strokeWidth={1}>
      <circle cx={60} cy={20} r={13} />
      <rect x={54} y={32} width={12} height={10} rx={3} />
      <rect x={36} y={42} width={48} height={80} rx={14} />
      <rect x={18} y={48} width={14} height={80} rx={7} />
      <rect x={88} y={48} width={14} height={80} rx={7} />
      <rect x={39} y={118} width={20} height={112} rx={9} />
      <rect x={61} y={118} width={20} height={112} rx={9} />
    </g>
  );
}

function Regions({ map, roles }: { map: Record<string, Shape[]>; roles: Map<string, Role> }) {
  return (
    <g>
      {Object.entries(map).flatMap(([group, shapes]) => {
        const role = roles.get(group);
        const cls =
          role === 'primary'
            ? 'fill-accent'
            : role === 'secondary'
              ? 'fill-accent/35'
              : 'fill-border/60';
        return shapes.map((s, i) =>
          'e' in s ? (
            <ellipse
              key={`${group}-${i}`}
              data-group={group}
              className={cls}
              cx={s.e[0]}
              cy={s.e[1]}
              rx={s.e[2]}
              ry={s.e[3]}
            />
          ) : (
            <rect
              key={`${group}-${i}`}
              data-group={group}
              className={cls}
              x={s.r[0]}
              y={s.r[1]}
              width={s.r[2]}
              height={s.r[3]}
              rx={s.r[4]}
            />
          ),
        );
      })}
    </g>
  );
}

export function BodyMap({
  muscles,
  size = 'md',
}: {
  muscles: { name: string; groupSlug: string; role: string }[];
  size?: 'sm' | 'md';
}) {
  const roles = new Map<string, Role>();
  for (const m of muscles)
    if (m.role === 'primary') roles.set(m.groupSlug, 'primary');
    else if (!roles.has(m.groupSlug)) roles.set(m.groupSlug, 'secondary');
  const primary = muscles.filter((m) => m.role === 'primary').map((m) => m.name);
  const secondary = muscles.filter((m) => m.role !== 'primary').map((m) => m.name);
  const description = muscles.length
    ? `Músculos principales: ${primary.join(', ') || 'ninguno'}. Secundarios: ${secondary.join(', ') || 'ninguno'}.`
    : 'Sin músculos asignados.';
  const h = size === 'sm' ? 'h-40' : 'h-56';
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 250 250" role="img" aria-label={description} className={`${h} w-auto`}>
        <g transform="translate(0 2)">
          <Body />
          <Regions map={FRONT} roles={roles} />
        </g>
        <g transform="translate(130 2)">
          <Body />
          <Regions map={BACK} roles={roles} />
        </g>
        <text x={60} y={249} textAnchor="middle" className="fill-muted text-[9px]">
          Delante
        </text>
        <text x={190} y={249} textAnchor="middle" className="fill-muted text-[9px]">
          Detrás
        </text>
      </svg>
      <figcaption className="text-center text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          principal
        </span>{' '}
        <span className="ml-2 inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-accent/35" />
          secundario
        </span>
      </figcaption>
    </figure>
  );
}
