import type { Provider, ScreenKey } from '../screens/v2/data.js';

/** Providers that show each load state in the gallery: `&state=loading`, `empty` or `error`. */
export function previewProvider<K extends ScreenKey>(
  state: string | null,
): Provider<K> | undefined {
  if (state === 'loading') return () => new Promise(() => {});
  if (state === 'empty') return () => Promise.resolve(null);
  if (state === 'error') return () => Promise.reject(new Error('preview'));
  return undefined;
}
