import type { Provider, ScreenKey } from '../screens/v2/data.js';

/** Providers that show each load state in the gallery: `&state=loading`, `empty` or `error`; the screen's own otherwise. */
export function previewProvider<K extends ScreenKey>(
  state: string | null,
): Provider<K> | undefined {
  if (state === 'loading') return () => new Promise(() => {});
  if (state === 'empty') return () => Promise.resolve(null);
  if (state === 'error') return () => Promise.reject(new Error('preview'));
  return undefined;
}

/** The ids taken so far in a gallery view, standing in for the server: `set(id, true)` takes, `false` takes it back. */
export function toggled(was: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  const next = new Set(was);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}
