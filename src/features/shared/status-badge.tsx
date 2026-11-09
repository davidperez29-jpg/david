import { CircleCheck, CircleDashed, CirclePause, CirclePlay, CircleX, Clock } from 'lucide-react';
import { EXECUTION_STATUS_LABELS, type ExecutionStatusV2 } from '@/domain/training/execution';
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

const EXECUTION_STYLE: Record<ExecutionStatusV2, { tone: BadgeTone; icon: React.ReactNode }> = {
  planned: { tone: 'outline', icon: <Clock /> },
  overdue: { tone: 'coral', icon: <CircleX /> },
  in_progress: { tone: 'sky', icon: <CirclePlay /> },
  interrupted: { tone: 'sun', icon: <CirclePause /> },
  completed: { tone: 'leaf', icon: <CircleCheck /> },
  partial: { tone: 'sun', icon: <CircleDashed /> },
};

/** Estado de ejecución de una sesión v2 (V1_SPEC §5.8). */
export function ExecutionStatusBadge({ status }: { status: ExecutionStatusV2 }) {
  const { tone, icon } = EXECUTION_STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {EXECUTION_STATUS_LABELS[status]}
    </Badge>
  );
}
