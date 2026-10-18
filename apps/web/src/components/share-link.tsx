'use client';

import { useEffect, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { announce } from '@/components/ui/announcer';

/**
 * A one-time link to send by hand, as there is no email provider (invitations, new-password
 * links): copy it, or open WhatsApp with a short message and the link.
 */
export function ShareLink({
  link,
  intro,
  message,
}: {
  link: string;
  intro: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);
  // The link appears below the button that created it: screen readers hear that it is there.
  useEffect(() => announce(intro), [link, intro]);
  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      <p>{intro}</p>
      <code className="block break-all rounded bg-surface p-2 text-xs">{link}</code>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              announce('Enlace copiado.');
            } catch {
              announce('No se pudo copiar: selecciona el enlace y cópialo.');
            }
          }}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </Button>
        <a
          className={buttonClass('secondary', 'sm')}
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}
