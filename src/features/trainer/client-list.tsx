'use client';

import { CalendarClock, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { type ClientSummaryVM } from '@/contracts/trainer';
import { formatRelativeDay } from '@/domain/format';
import { CLIENT_STATUS_LABELS } from '@/domain/people';
import { matchesSearch } from '@/domain/text';
import { Avatar } from '@/ui/avatar';
import { Badge } from '@/ui/badge';

export function ClientList({ clients, today }: { clients: ClientSummaryVM[]; today: string }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () =>
      clients.filter((c) =>
        matchesSearch([c.name, c.goal, c.sport ?? '', c.populationLabel], query),
      ),
    [clients, query],
  );

  return (
    <div>
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Buscar clientes</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, objetivo o deporte"
          className="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-ink-900 placeholder:text-ink-500 focus:border-ink-300"
        />
      </label>
      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'cliente' : 'clientes'}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-3xl bg-cream-50 p-6 text-center text-ink-500 ring-1 ring-line">
          Ningún cliente coincide con «{query}».
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((client) => (
            <li key={client.id}>
              <Link
                href={`/entrenador/clientes/${client.id}`}
                className="flex h-full flex-col rounded-3xl border border-line/70 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-3">
                  <Avatar initials={client.initials} seed={client.id} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-ink-900">{client.name}</h2>
                    <p className="truncate text-sm text-ink-500">
                      {client.populationLabel}
                      {client.sport ? ` · ${client.sport}` : ''}
                    </p>
                  </div>
                  <Badge tone={client.status === 'active' ? 'leaf' : 'neutral'}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-700">{client.goal}</p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-500">
                    <CalendarClock aria-hidden className="size-4 shrink-0 text-sun-700" />
                    <span className="truncate">
                      {client.nextSession
                        ? `${formatRelativeDay(client.nextSession.date, today)}: ${client.nextSession.title}`
                        : 'Sin sesiones programadas'}
                    </span>
                  </span>
                  <span
                    className="shrink-0 font-semibold text-ink-700 tabular-nums"
                    title="Sesiones completadas en los últimos 7 días"
                  >
                    {client.last7Days.completed}/{client.last7Days.planned} · 7 d
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
