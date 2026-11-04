import { type MovementPattern } from '@/domain/exercises';
import { cn } from '@/ui/cn';

/**
 * Pictogramas propios por patrón de movimiento (estilo silueta, trazo redondeado).
 * Sirven de imagen por defecto mientras un ejercicio no tenga foto o vídeo propio.
 */
const INK = '#2B2116';
const SUN = '#F5B800';

type Figure = { head: [number, number]; lines: string[]; gear?: React.ReactNode };

const FIGURES: Record<MovementPattern, Figure> = {
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
  push: {
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
  pull: {
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
  core: {
    head: [11, 31],
    lines: ['M17 34 L36 38 L55 43', 'M17 34 L17 45 L28 45'],
    gear: <rect x="6" y="48" width="52" height="3" rx="1.5" fill={SUN} opacity="0.7" />,
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
  accessory: {
    head: [30, 10],
    lines: [
      'M30 17 L30 37',
      'M30 37 L28 51 L33 56',
      'M30 37 L33 51 L38 56',
      'M30 20 L40 30 L46 25',
    ],
    gear: <rect x="26" y="56" width="28" height="5" rx="2" fill={SUN} />,
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

export function PatternPictogram({
  pattern,
  className,
  title,
}: {
  pattern: MovementPattern;
  className?: string;
  title?: string;
}) {
  const figure = FIGURES[pattern];
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
