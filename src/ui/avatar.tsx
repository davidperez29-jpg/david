import { cn } from './cn';

const PALETTE = [
  'bg-sun-300 text-ink-900',
  'bg-leaf-100 text-leaf-700',
  'bg-sky-100 text-sky-700',
  'bg-coral-100 text-coral-700',
  'bg-plum-100 text-plum-700',
];

function pick(seed: string) {
  let total = 0;
  for (const char of seed) total = (total + char.charCodeAt(0)) % 997;
  return PALETTE[total % PALETTE.length];
}

const SIZES = { sm: 'size-9 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-xl' };

export function Avatar({
  initials,
  seed,
  size = 'md',
}: {
  initials: string;
  seed: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-2xl font-bold',
        SIZES[size],
        pick(seed),
      )}
    >
      {initials}
    </span>
  );
}
