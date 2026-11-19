import { useEffect } from 'react';

/**
 * The desk and the floor follow the phone's light or dark setting (design lock B6) and give it back when it closes.
 * `alwaysDark` is the wall TV, which is dark whatever the device says.
 */
export function useSystemTheme(alwaysDark = false): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (alwaysDark || query.matches) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
    };
    apply();
    query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
      delete document.documentElement.dataset.theme;
    };
  }, [alwaysDark]);
}
