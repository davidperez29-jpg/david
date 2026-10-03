'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'tp-theme';

/** Light / dark / system (§9.7: dark mode is useful in the gym). Stored on this device only. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {
      /* storage unavailable: keep the system setting */
    }
  }, []);
  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
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

/** Inline script that applies the saved theme before the first paint (no flash). */
export const THEME_BOOT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
