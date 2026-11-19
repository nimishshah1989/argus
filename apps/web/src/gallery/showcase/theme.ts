import { useEffect, useState } from 'react';
import type { Theme } from '../directions/direction-props.js';

const DARK = '(prefers-color-scheme: dark)';

/** `?theme=dark` or `?theme=light` wins (the gallery's own switch); otherwise the system's choice. */
function pick(): Theme {
  const asked = new URLSearchParams(window.location.search).get('theme');
  if (asked === 'dark' || asked === 'light') return asked;
  return window.matchMedia(DARK).matches ? 'dark' : 'light';
}

/** The theme the showcase is drawn in; it follows the system when the person changes it. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(pick);
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const on = () => setTheme(pick());
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return theme;
}
