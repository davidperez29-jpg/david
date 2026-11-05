import { CircleCheck, CircleDashed, CirclePlay, CircleX, Clock } from 'lucide-react';
import { SESSION_STATUS_LABELS, type SessionStatus } from '@/domain/training/session';
import { Badge, type BadgeTone } from '@/ui/badge';

const STYLE: Record<SessionStatus, { tone: BadgeTone; icon: React.ReactNode }> = {
  completed: { tone: 'leaf', icon: <CircleCheck /> },
  in_progress: { tone: 'sky', icon: <CirclePlay /> },
  partial: { tone: 'sun', icon: <CircleDashed /> },
  pending: { tone: 'outline', icon: <Clock /> },
  missed: { tone: 'coral', icon: <CircleX /> },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { tone, icon } = STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {SESSION_STATUS_LABELS[status]}
    </Badge>
  );
}
