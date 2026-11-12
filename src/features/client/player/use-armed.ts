'use client';

import { useEffect, useState } from 'react';

/** Lo que tarda en aceptar toques una pantalla recién aparecida (el formulario o el descanso). */
export const ARM_DELAY_MS = 400;

/**
 * Protección frente al doble toque (V1_SPEC E2E-2). React redibuja entre dos clics, así que el
 * segundo toque de un doble toque en «Serie hecha» cae en lo que aparece después: el formulario
 * de la serie siguiente o el descanso. Esas pantallas no aceptan toques durante sus primeros
 * 400 ms (se marcan con `aria-disabled`); después, todo responde con normalidad.
 */
export function useArmed(delayMs = ARM_DELAY_MS): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return armed;
}
