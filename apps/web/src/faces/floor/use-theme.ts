import { useEffect } from 'react';

/**
 * The floor follows the phone's light or dark setting (design lock A4) and gives it back when it closes, the way the
 * desk does (screens/desk/Shell.tsx): a person signs in once and the phone's setting decides.
 */
export function useFloorTheme(): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      if (query.matches) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
    };
    apply();
    query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
      delete document.documentElement.dataset.theme;
    };
  }, []);
}
