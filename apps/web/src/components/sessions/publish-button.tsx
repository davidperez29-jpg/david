'use client';

import { FormError, useApiAction } from '@/components/use-form';
import { Button } from '@/components/ui/button';

/** Publish/unpublish sessions to the client (session, week or whole plan). */
export function PublishButton({
  scope,
  id,
  published,
  disabled,
  label,
}: {
  scope: 'session' | 'week' | 'plan';
  id: string;
  published: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={published ? 'secondary' : 'primary'}
        disabled={pending || disabled}
        title={disabled ? 'Activa el plan para publicar sesiones.' : undefined}
        onClick={() => void run('/sessions/publish', 'POST', { scope, id, published: !published })}
      >
        {label ?? (published ? 'Retirar' : 'Publicar')}
      </Button>
      <FormError error={error} />
    </span>
  );
}
