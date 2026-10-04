import { PRIVACY_RIGHTS, type PrivacyRight } from '@tp/domain';
import { Badge } from '@/components/ui/card';

export interface PrivacyRequestRow {
  id: string;
  type: string;
  status: string;
  details: string | null;
  response: string | null;
  dueOn: string;
  createdAt: string | Date;
  resolvedAt: string | Date | null;
}

const STATUS: Record<string, { text: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' }> = {
  pending: { text: 'En curso', tone: 'warn' },
  completed: { text: 'Atendida', tone: 'ok' },
  rejected: { text: 'Denegada', tone: 'danger' },
  cancelled: { text: 'Cancelada', tone: 'neutral' },
};

export const rightName = (t: string) => PRIVACY_RIGHTS[t as PrivacyRight]?.name ?? t;

export function PrivacyStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { text: status, tone: 'neutral' as const };
  return <Badge tone={s.tone}>{s.text}</Badge>;
}
