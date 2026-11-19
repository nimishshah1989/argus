import { useEffect, useLayoutEffect, useState } from 'react';
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

/** Puts the direction's tokens and the theme on <html> (the sheet and the chart tooltips are portals), and puts them back on leaving. The shared elements read the kit's dark tokens (the ramp, each tone's ink) from `data-theme`. */
export function useRootTokens(props: Record<string, string>, theme: Theme): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const style = root.style;
    for (const [name, value] of Object.entries(props)) style.setProperty(name, value);
    style.colorScheme = theme;
    const before = root.dataset.theme;
    if (theme === 'dark') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    return () => {
      Object.keys(props).forEach((name) => style.removeProperty(name));
      style.removeProperty('color-scheme');
      if (before === undefined) delete root.dataset.theme;
      else root.dataset.theme = before;
    };
  }, [props, theme]);
}
