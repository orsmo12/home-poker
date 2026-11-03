/* Explanations are shown only the first few times; after that the screen stays clean. */
import { useState } from 'react';

export function useHint(key, times = 3) {
  const [show] = useState(() => {
    try {
      const k = `hpm-hint-${key}`;
      const n = Number(window.localStorage.getItem(k)) || 0;
      window.localStorage.setItem(k, String(n + 1));
      return n < times;
    } catch { return true; }
  });
  return show;
}
