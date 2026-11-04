import { cn } from '@/ui/cn';

const INK = '#2B2116';

/** Ilustración principal: una persona saltando delante de un sol. */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 280" className={cn('w-full', className)} aria-hidden focusable="false">
      <circle cx="170" cy="130" r="112" fill="#FFE9A0" />
      <circle cx="170" cy="130" r="80" fill="#FFD23F" />
      <g stroke="#F5B800" strokeWidth="6" strokeLinecap="round">
        <path d="M170 6 v14" />
        <path d="M282 130 h14" />
        <path d="M44 130 h14" />
        <path d="M249 51 l10 -10" />
        <path d="M81 41 l10 10" />
      </g>
      <path
        d="M70 262 Q170 236 270 262"
        fill="none"
        stroke="#F6E1B5"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M96 250 q-14 -40 4 -82"
        fill="none"
        stroke="#EF7356"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />
      <path
        d="M244 250 q14 -40 -4 -82"
        fill="none"
        stroke="#4A86D8"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />
      <g fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        <path d="M170 92 L170 152" />
        <path d="M170 102 L140 62" />
        <path d="M170 102 L200 62" />
        <path d="M170 152 L144 182 L156 214" />
        <path d="M170 152 L197 180 L186 212" />
      </g>
      <circle cx="170" cy="70" r="16" fill={INK} />
      <g fill="#3AA872">
        <circle cx="64" cy="86" r="7" />
        <rect x="262" y="196" width="14" height="14" rx="4" transform="rotate(20 269 203)" />
      </g>
      <circle cx="280" cy="78" r="6" fill="#EF7356" />
      <circle cx="54" cy="196" r="5" fill="#4A86D8" />
    </svg>
  );
}

/** Pesa rusa sonriente para estados vacíos y días de descanso. */
export function KettlebellIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('size-28', className)} aria-hidden focusable="false">
      <circle cx="60" cy="64" r="52" fill="#FFF3C4" />
      <path
        d="M40 46 a20 20 0 0 1 40 0"
        fill="none"
        stroke={INK}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M30 74 a30 30 0 0 1 60 0 v8 a10 10 0 0 1 -10 10 h-40 a10 10 0 0 1 -10 -10 z"
        fill="#FFD23F"
        stroke={INK}
        strokeWidth="5"
      />
      <circle cx="50" cy="72" r="3.5" fill={INK} />
      <circle cx="70" cy="72" r="3.5" fill={INK} />
      <path d="M52 81 q8 6 16 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Taza y luna: día de descanso. */
export function RestIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('size-28', className)} aria-hidden focusable="false">
      <circle cx="60" cy="62" r="52" fill="#E2ECFA" />
      <path d="M78 22 a16 16 0 1 0 14 24 a13 13 0 1 1 -14 -24 z" fill="#FFD23F" />
      <path
        d="M34 60 h40 v18 a16 16 0 0 1 -16 16 h-8 a16 16 0 0 1 -16 -16 z"
        fill="#fff"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M74 66 h4 a8 8 0 0 1 0 16 h-5" fill="none" stroke={INK} strokeWidth="5" />
      <path
        d="M46 50 q-4 -6 0 -12 M58 50 q-4 -6 0 -12"
        fill="none"
        stroke="#4A86D8"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
