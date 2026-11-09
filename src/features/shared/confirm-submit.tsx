'use client';

import { type ComponentProps } from 'react';
import { Button } from '@/ui/button';

/** Botón de envío que pide confirmación antes (por ejemplo, para eliminar un borrador). */
export function ConfirmSubmit({
  message,
  ...props
}: Omit<ComponentProps<typeof Button>, 'type' | 'onClick'> & { message: string }) {
  return (
    <Button
      {...props}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    />
  );
}
