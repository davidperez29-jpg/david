'use client';

import { useId, useState } from 'react';
import { formatNumber } from '@/domain/format';

/**
 * Gráficos del análisis (B3.2). Cada uno responde a una pregunta y tiene su tabla equivalente en
 * la página (la tabla es la fuente; el gráfico, una ayuda). Colores validados con el
 * comprobador de paletas sobre la superficie blanca: ámbar `#b38600` (lo ejecutado) y
 * azul `#24548f` (lo prescrito); los dos pasan el contraste 3:1. TrainPro no tiene modo oscuro.
 *
 * - Marcas finas: columnas de 24 px como mucho, con el extremo redondeado y la base recta.
 * - Retícula de un trazo, discreta; una sola escala.
 * - Cada marca se puede enfocar con el teclado y muestra su detalle al pasar o al enfocar.
 */
const EXECUTED = '#b38600';
const PLANNED = '#24548f';
const GRID = '#ecdfc6';
const TEXT = '#6b5c48';

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((c) => c * power >= value) ?? 10;
  return step * power;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 30, left: 48 };

/** Columna con el extremo redondeado (4 px) y la base recta. */
function columnPath(x: number, y: number, width: number, base: number): string {
  const h = base - y;
  if (h <= 0) return '';
  const r = Math.min(4, width / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
}

export interface WeeklyPoint {
  key: string;
  /** Texto corto del eje («S53»). */
  axisLabel: string;
  label: string;
  executed: number;
  planned: { min: number; max: number } | null;
  detail: string;
}

/** ¿Cómo evoluciona lo ejecutado frente a lo prescrito, semana a semana? */
export function WeeklyColumns({
  points,
  unit,
  title,
}: {
  points: WeeklyPoint[];
  unit: string;
  title: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = niceCeil(
    Math.max(0, ...points.map((p) => Math.max(p.executed, p.planned?.max ?? 0))),
  );
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(24, slot * 0.55));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const base = PAD.top + plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(points.length / 8);
  const current = active === null ? null : points[active];
  return (
    <figure className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="text-sm font-semibold text-ink-900">
        {title}
      </figcaption>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-sm"
            style={{ background: EXECUTED }}
          />
          Registrado (según fecha de ejecución)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: PLANNED }} />
          Prescrito (según fecha prevista; un rango, como trazo vertical)
        </li>
      </ul>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="group"
          aria-label={`${title}. Los mismos datos están en la tabla «Semana a semana».`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={TEXT}>
                {formatNumber(t, 1)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const x = cx - barW / 2;
            return (
              <g
                key={p.key}
                tabIndex={0}
                role="img"
                aria-label={`${p.label}: ${p.detail}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* Zona de interacción mayor que la marca. */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                />
                <path
                  d={columnPath(x, y(p.executed), barW, base)}
                  fill={EXECUTED}
                  opacity={active === null || active === i ? 1 : 0.55}
                />
                {p.planned ? (
                  p.planned.min === p.planned.max ? (
                    <line
                      x1={cx - barW / 2 - 4}
                      x2={cx + barW / 2 + 4}
                      y1={y(p.planned.max)}
                      y2={y(p.planned.max)}
                      stroke={PLANNED}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  ) : (
                    <g stroke={PLANNED} strokeWidth={2} strokeLinecap="round">
                      <line x1={cx} x2={cx} y1={y(p.planned.min)} y2={y(p.planned.max)} />
                      <line x1={cx - 5} x2={cx + 5} y1={y(p.planned.min)} y2={y(p.planned.min)} />
                      <line x1={cx - 5} x2={cx + 5} y1={y(p.planned.max)} y2={y(p.planned.max)} />
                    </g>
                  )
                ) : null}
                {active === i ? (
                  <rect
                    x={PAD.left + slot * i + 1}
                    y={PAD.top}
                    width={slot - 2}
                    height={plotH}
                    fill="none"
                    stroke={TEXT}
                    strokeWidth={1}
                  />
                ) : null}
                {i % labelEvery === 0 ? (
                  <text x={cx} y={H - 10} textAnchor="middle" fontSize={11} fill={TEXT}>
                    {p.axisLabel}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={base}
            y2={base}
            stroke={TEXT}
            strokeWidth={1}
          />
        </svg>
        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 right-0 max-w-[16rem] rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink-700 shadow-soft"
          >
            <p className="font-semibold text-ink-900">{current.label}</p>
            <p>{current.detail}</p>
            <p className="text-ink-500">Unidad: {unit}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

export interface DotSession {
  key: string;
  label: string;
  sets: { setNumber: number; kg: number; detail: string }[];
}

/** ¿Cómo evolucionan los kg registrados de este ejercicio, serie a serie? */
export function SetLoadDots({ sessions, title }: { sessions: DotSession[]; title: string }) {
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const all = sessions.flatMap((s) => s.sets.map((x) => x.kg));
  const lo = Math.max(0, Math.floor(Math.min(...all) * 0.9));
  const hi = niceCeil(Math.max(...all) * 1.05);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(sessions.length, 1);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / Math.max(hi - lo, 1)) * plotH;
  const ticks = [lo, (lo + hi) / 2, hi];
  const labelEvery = Math.ceil(sessions.length / 8);
  const current = sessions
    .flatMap((s) => s.sets.map((x) => ({ s, x })))
    .find(({ s, x }) => `${s.key}#${x.setNumber}` === active);
  return (
    <figure className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="text-sm font-semibold text-ink-900">
        {title}
      </figcaption>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="group"
          aria-label={`${title}. Los mismos datos están en la tabla de este tramo.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={TEXT}>
                {formatNumber(t, 1)}
              </text>
            </g>
          ))}
          {sessions.map((s, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const spread = Math.min(slot * 0.6, 8 * s.sets.length);
            return (
              <g key={s.key}>
                {s.sets.map((x, j) => {
                  const dx =
                    s.sets.length > 1 ? -spread / 2 + (spread * j) / (s.sets.length - 1) : 0;
                  const k = `${s.key}#${x.setNumber}`;
                  return (
                    <g
                      key={k}
                      tabIndex={0}
                      role="img"
                      aria-label={`${s.label}, serie ${x.setNumber}: ${x.detail}`}
                      onPointerEnter={() => setActive(k)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(k)}
                      onBlur={() => setActive(null)}
                      className="outline-none"
                    >
                      <circle cx={cx + dx} cy={y(x.kg)} r={12} fill="transparent" />
                      <circle
                        cx={cx + dx}
                        cy={y(x.kg)}
                        r={active === k ? 6 : 4}
                        fill={EXECUTED}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
                {i % labelEvery === 0 ? (
                  <text x={cx} y={H - 10} textAnchor="middle" fontSize={11} fill={TEXT}>
                    {s.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke={TEXT}
            strokeWidth={1}
          />
        </svg>
        {current ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 right-0 max-w-[16rem] rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink-700 shadow-soft"
          >
            <p className="font-semibold text-ink-900">
              {current.s.label} · serie {current.x.setNumber}
            </p>
            <p>{current.x.detail}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
