import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Theme } from '../directions/direction-props.js';

const DARK = '(prefers-color-scheme: dark)';

/** The theme the showcase is drawn in: `?theme=dark` or `?theme=light` (the gallery's own switch) wins, else the system's, followed live. */
export function useTheme(): Theme {
  const [params] = useSearchParams();
  const asked = params.get('theme');
  const [system, setSystem] = useState<Theme>(() =>
    window.matchMedia(DARK).matches ? 'dark' : 'light',
  );
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const on = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return asked === 'dark' || asked === 'light' ? asked : system;
}
