import { useSyncExternalStore } from 'react';

/** Tailwind's `lg` breakpoint, in rem like the CSS, so JS and CSS agree at any font size. */
const QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True from 1024 px: the desktop layouts. One render path, so the two layouts are never both in the page. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
