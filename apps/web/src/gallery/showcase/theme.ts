import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Theme } from '../directions/direction-props.js';

const DARK = '(prefers-color-scheme: dark)';

/** The system's theme, followed live. */
export function useSystemTheme(): Theme {
  const [system, setSystem] = useState<Theme>(() =>
    window.matchMedia(DARK).matches ? 'dark' : 'light',
  );
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const on = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return system;
}

/** The theme the showcase is drawn in: `?theme=dark` or `?theme=light` (the gallery's own switch) wins, else the system's, followed live. */
export function useTheme(): Theme {
  const [params] = useSearchParams();
  const system = useSystemTheme();
  const asked = params.get('theme');
  return asked === 'dark' || asked === 'light' ? asked : system;
}

/**
 * The theme the gallery puts on <html data-theme> (the one owner of that attribute): the showcase follows the system
 * when no theme is asked for, so the shared elements read their dark tokens; every other view is light unless dark is asked for.
 */
export function rootTheme(view: string | null, asked: string | null, system: Theme): Theme {
  if (view === 'showcase') return asked === 'dark' || asked === 'light' ? asked : system;
  return asked === 'dark' ? 'dark' : 'light';
}
