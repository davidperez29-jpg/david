'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme';

type Theme = 'system' | 'light' | 'dark';

/** Light / dark / system (§9.7: dark mode is useful in the gym). Stored on this device only. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {
      /* storage unavailable: keep the system setting */
    }
  }, []);
  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Apariencia</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tema">
        {(
          [
            ['system', 'Como el sistema'],
            ['light', 'Claro'],
            ['dark', 'Oscuro'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={theme === k}
            onClick={() => choose(k)}
            className={`min-h-11 rounded-md border px-4 text-sm ${theme === k ? 'border-accent bg-accent text-accent-contrast' : 'border-border'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
