import { useEffect, useRef, useState } from 'react';
import type { LoadState, Loaded } from '../../ui/v2/screen-states.js';

/**
 * The one seam between v2 screens and their data. Every screen is a key here, with the params it is asked for and
 * the model its View draws. A screen adds its key from its own folder, `screens/v2/<name>/register.ts` (declaration
 * merging plus one `screen` entry), so a new screen edits no shared file. Today each provider returns the screen's
 * fixture; the API adapter replaces a key's provider and no View changes.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by each screen's register.ts
export interface Screens {}
export type ScreenKey = keyof Screens;
export type ScreenParams<K extends ScreenKey> = Screens[K]['params'];
export type ScreenModel<K extends ScreenKey> = Screens[K]['model'];

/** Fetches a screen's model: null when there is nothing to show; a rejected promise is an error. */
export type Provider<K extends ScreenKey> = (
  params: ScreenParams<K>,
) => Promise<ScreenModel<K> | null>;

/** What a screen's `register.ts` exports as `screen`: its key and the provider the registry serves for it. */
export interface ScreenEntry<K extends ScreenKey> {
  key: K;
  provider: Provider<K>;
}

type Registered = Record<string, { screen: { key: string; provider: unknown } }>;

/** The providers by key, from the register modules found; two screens claiming one key is a mistake worth a crash. */
export function providersOf(modules: Registered): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  for (const [path, { screen }] of Object.entries(modules)) {
    if (Object.hasOwn(found, screen.key))
      throw new Error(`${path}: screen key ${screen.key} is taken`);
    found[screen.key] = screen.provider;
  }
  return found;
}

export const PROVIDERS = providersOf(
  import.meta.glob<Registered[string]>('./*/register.ts', { eager: true }),
);

/** One load, as the state a screen shows: ready with its model, empty, or error. */
export async function load<K extends ScreenKey>(
  provider: Provider<K>,
  params: ScreenParams<K>,
): Promise<{ state: LoadState; model?: ScreenModel<K> }> {
  try {
    const model = await provider(params);
    return model === null ? { state: 'empty' } : { state: 'ready', model };
  } catch {
    return { state: 'error' };
  }
}

/**
 * A screen's model and where it stands. `provider` defaults to the registry's; a preview or a test may pass its own,
 * inline or not: the latest one is used, and only the key, the params or `retry` start a new load.
 */
export function useScreenModel<K extends ScreenKey>(
  key: K,
  params: ScreenParams<K>,
  provider: Provider<K> = PROVIDERS[key] as Provider<K>,
): Loaded<ScreenModel<K>> {
  const [result, setResult] = useState<{ state: LoadState; model?: ScreenModel<K> }>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  const asked = JSON.stringify(params);
  const latest = useRef(provider);
  latest.current = provider;
  useEffect(() => {
    let live = true;
    setResult({ state: 'loading' });
    void load(latest.current, JSON.parse(asked) as ScreenParams<K>).then(
      (r) => live && setResult(r),
    );
    return () => {
      live = false;
    };
  }, [key, asked, attempt]);
  return { ...result, retry: () => setAttempt((a) => a + 1) };
}
