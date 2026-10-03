'use client';

import { useState } from 'react';
import { AvailabilityEditor } from '@/components/clients/availability-editor';
import { toSlotPayload, type SlotDraft } from '@/components/clients/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { FormError, useApiAction } from '@/components/use-form';

interface Props {
  client: {
    id: string;
    version: number;
    email: string;
    phone: string;
    preferences: string;
    availability: { weekday: number; startTime: string | null; endTime: string | null }[];
  };
}

export function ClientProfileForm({ client }: Props) {
  const contact = useApiAction();
  const avail = useApiAction();
  const [form, setForm] = useState({
    email: client.email,
    phone: client.phone,
    preferences: client.preferences,
  });
  const [slots, setSlots] = useState<SlotDraft[]>(
    client.availability.map((a) => ({
      weekday: a.weekday,
      startTime: a.startTime ?? '',
      endTime: a.endTime ?? '',
    })),
  );
  return (
    <>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await contact.run(`/clients/${client.id}`, 'PATCH', {
            ...form,
            expectedVersion: client.version,
          });
        }}
      >
        <Field label="Email de contacto" htmlFor="email" error={contact.fieldError('email')}>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={contact.fieldError('phone')}>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field
          label="Preferencias"
          htmlFor="pref"
          hint="Horarios, ejercicios que te gustan, lo que quieras que tu entrenador/a sepa."
        >
          <Textarea
            id="pref"
            value={form.preferences}
            onChange={(e) => setForm({ ...form, preferences: e.target.value })}
          />
        </Field>
        <FormError error={contact.error} />
        <Button type="submit" size="lg" disabled={contact.pending}>
          {contact.done ? 'Guardado ✓' : 'Guardar'}
        </Button>
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Días disponibles</h2>
        <AvailabilityEditor value={slots} onChange={setSlots} />
        <FormError error={avail.error} />
        <Button
          size="lg"
          disabled={avail.pending}
          onClick={() =>
            avail.run(`/clients/${client.id}/availability`, 'PUT', { slots: toSlotPayload(slots) })
          }
        >
          {avail.done ? 'Guardado ✓' : 'Guardar disponibilidad'}
        </Button>
      </section>
    </>
  );
}
