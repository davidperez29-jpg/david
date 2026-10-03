import { Badge } from '@/components/ui/card';

/** Status colours are reserved for alerts and always carry an icon and a label. */
export function SeverityBadge({ severity }: { severity: string }) {
  const s = {
    red: ['danger', '🔴 Roja'],
    yellow: ['warn', '🟡 Amarilla'],
    green: ['ok', '🟢 Propuesta'],
  }[severity] ?? ['neutral', severity];
  return <Badge tone={s[0] as 'danger' | 'warn' | 'ok' | 'neutral'}>{s[1]}</Badge>;
}
