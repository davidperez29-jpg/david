import { type Silhouette } from '@/domain/library/exercise';
import { cn } from '@/ui/cn';

/**
 * Siluetas propias (trazo redondeado). Se muestran mientras un ejercicio no tenga imagen o
 * vídeo propio. La silueta es un dato visual de cada variante, independiente de su clasificación.
 */
const INK = '#2B2116';
const SUN = '#F5B800';

type Figure = { head: [number, number]; lines: string[]; gear?: React.ReactNode };

const FIGURES: Record<Silhouette, Figure> = {
  squat: {
    head: [35, 13],
    lines: ['M33 20 L25 34', 'M25 34 L40 37 L37 52 L44 52', 'M32 22 L40 25'],
    gear: <circle cx="43.5" cy="25" r="4.5" fill={SUN} />,
  },
  hinge: {
    head: [47, 20],
    lines: ['M42 23 L23 27', 'M23 27 L26 40 L25 53 L31 53', 'M40 24 L39 39'],
    gear: (
      <>
        <rect x="27" y="40" width="24" height="3.5" rx="1.75" fill={INK} />
        <rect x="27" y="35.5" width="5" height="12.5" rx="2" fill={SUN} />
        <rect x="46" y="35.5" width="5" height="12.5" rx="2" fill={SUN} />
      </>
    ),
  },
  lunge: {
    head: [32, 11],
    lines: ['M32 18 L32 32', 'M32 32 L44 39 L44 53', 'M32 32 L25 48 L14 46', 'M32 20 L37 33'],
    gear: <rect x="34" y="33" width="7" height="5" rx="2" fill={SUN} />,
  },
  'press-overhead': {
    head: [32, 17],
    lines: [
      'M32 24 L32 40',
      'M32 40 L26 55',
      'M32 40 L38 55',
      'M32 25 L23 19 L23 9',
      'M32 25 L41 19 L41 9',
    ],
    gear: (
      <>
        <rect x="16" y="5" width="14" height="5" rx="2.5" fill={SUN} />
        <rect x="34" y="5" width="14" height="5" rx="2.5" fill={SUN} />
      </>
    ),
  },
  'press-bench': {
    head: [13, 36],
    lines: ['M19 39 L40 39', 'M40 39 L47 47 L47 55', 'M23 39 L23 22'],
    gear: (
      <>
        <rect x="14" y="42" width="30" height="5" rx="2.5" fill={SUN} />
        <rect x="9" y="17" width="28" height="3.5" rx="1.75" fill={INK} />
        <rect x="9" y="12" width="5" height="13" rx="2" fill={SUN} />
        <rect x="32" y="12" width="5" height="13" rx="2" fill={SUN} />
      </>
    ),
  },
  'pull-up': {
    head: [32, 19],
    lines: [
      'M32 26 L32 43',
      'M32 43 L29 56',
      'M32 43 L35 56',
      'M28 26 L21 19 L22 8',
      'M36 26 L43 19 L42 8',
    ],
    gear: <rect x="10" y="4" width="44" height="4.5" rx="2.25" fill={SUN} />,
  },
  row: {
    head: [24, 12],
    lines: ['M24 19 L24 38', 'M24 38 L18 55', 'M24 38 L30 55', 'M24 22 L16 29 L28 29'],
    gear: <path d="M30 29 H60" stroke={SUN} strokeWidth="4" strokeLinecap="round" />,
  },
  pallof: {
    head: [32, 11],
    lines: ['M32 18 L32 38', 'M32 38 L26 55', 'M32 38 L38 55', 'M26 22 L32 29', 'M38 22 L32 29'],
    gear: (
      <>
        <path d="M4 29 H28" stroke={SUN} strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="29" r="4" fill={SUN} />
      </>
    ),
  },
  carry: {
    head: [32, 10],
    lines: ['M32 17 L32 36', 'M32 36 L25 54', 'M32 36 L40 54', 'M32 19 L23 36', 'M32 19 L41 36'],
    gear: (
      <>
        <circle cx="22" cy="41" r="5" fill={SUN} />
        <circle cx="42" cy="41" r="5" fill={SUN} />
      </>
    ),
  },
  plank: {
    head: [11, 31],
    lines: ['M17 34 L36 38 L55 43', 'M17 34 L17 45 L28 45'],
    gear: <rect x="6" y="48" width="52" height="3" rx="1.5" fill={SUN} opacity="0.7" />,
  },
  'dead-bug': {
    head: [10, 40],
    lines: ['M16 42 L37 42', 'M21 42 L21 25', 'M37 42 L37 29 L50 29', 'M19 42 L8 30'],
    gear: <rect x="4" y="47" width="54" height="3" rx="1.5" fill={SUN} opacity="0.7" />,
  },
  jump: {
    head: [32, 10],
    lines: [
      'M32 17 L32 33',
      'M32 19 L24 7',
      'M32 19 L40 7',
      'M32 33 L25 42 L29 50',
      'M32 33 L39 42 L35 50',
    ],
    gear: (
      <path
        d="M18 58 Q32 52 46 58"
        fill="none"
        stroke={SUN}
        strokeWidth="4"
        strokeLinecap="round"
      />
    ),
  },
  sprint: {
    head: [41, 11],
    lines: [
      'M39 18 L31 34',
      'M31 34 L43 40 L41 53',
      'M31 34 L23 44 L13 45',
      'M38 20 L46 27 L51 21',
      'M38 20 L29 24 L25 31',
    ],
    gear: (
      <>
        <path d="M4 22 H13" stroke={SUN} strokeWidth="4" strokeLinecap="round" />
        <path d="M2 31 H11" stroke={SUN} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  'calf-raise': {
    head: [30, 10],
    lines: [
      'M30 17 L30 37',
      'M30 37 L28 51 L33 56',
      'M30 37 L33 51 L38 56',
      'M30 20 L40 30 L46 25',
    ],
    gear: <rect x="26" y="56" width="28" height="5" rx="2" fill={SUN} />,
  },
  shuffle: {
    head: [32, 14],
    lines: [
      'M32 21 L32 35',
      'M32 35 L22 45 L18 55',
      'M32 35 L42 45 L46 55',
      'M32 23 L23 31',
      'M32 23 L41 31',
    ],
    gear: (
      <g fill="none" stroke={SUN} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 38 L4 43 L9 48" />
        <path d="M55 38 L60 43 L55 48" />
      </g>
    ),
  },
  'med-ball': {
    head: [28, 12],
    lines: ['M28 19 L31 37', 'M31 37 L23 56', 'M31 37 L39 56', 'M29 22 L42 25', 'M29 25 L42 30'],
    gear: (
      <>
        <circle cx="48" cy="28" r="6" fill={SUN} />
        <path
          d="M14 20 Q8 30 14 40"
          fill="none"
          stroke={SUN}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  mobility: {
    head: [32, 11],
    lines: ['M32 18 L32 36', 'M32 21 L18 13', 'M32 21 L46 13', 'M32 36 L21 54', 'M32 36 L43 54'],
    gear: (
      <path
        d="M12 40 A20 20 0 0 1 16 26"
        fill="none"
        stroke={SUN}
        strokeWidth="4"
        strokeLinecap="round"
      />
    ),
  },
};

export function ExercisePictogram({
  silhouette,
  className,
  title,
}: {
  silhouette: Silhouette;
  className?: string;
  title?: string;
}) {
  const figure = FIGURES[silhouette];
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-14', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {figure.gear}
      <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {figure.lines.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx={figure.head[0]} cy={figure.head[1]} r="5.5" fill={INK} />
    </svg>
  );
}
