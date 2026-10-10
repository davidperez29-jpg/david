'use client';

import { useEffect, useState } from 'react';

const EVENT = 'tp:announce';

/**
 * One polite live region for the whole shell (restructure phase 18). A message survives the element
 * that caused it being removed: a decided proposal, a deleted row. Rendered once per layout.
 */
export function Announcer() {
  const [text, setText] = useState('');
  useEffect(() => {
    let frame = 0;
    const on = (e: Event) => {
      // Cleared first, so the same message twice is read twice.
      setText('');
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setText((e as CustomEvent<string>).detail));
    };
    window.addEventListener(EVENT, on);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  return (
    // aria-live without role="status": the page's own status lines keep being the only ones.
    <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="announcer">
      {text}
    </div>
  );
}

/**
 * Says `text` to screen readers and, when the control that was used is about to disappear, moves
 * focus to a stable element (`focusId`: a heading with tabIndex -1), so keyboard users keep their
 * place instead of starting again from the top of the page.
 */
export function announce(text: string, focusId?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
  if (focusId) document.getElementById(focusId)?.focus();
}
