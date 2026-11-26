import { QueryClientContext, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { yearsFrom } from '../../analytics-figures.js';
import { ApiError } from '../../data/index.js';
import type { LoadState, Loaded } from '../../ui/v2/screen-states.js';
import { LiveOffline, NotComputed } from './figures/live-error.js';

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

/** What a provider may reach: the app's query client, so a live provider fills and reads the cache the v1 screens use. */
export type ProviderContext = { client?: QueryClient };

/** Fetches a screen's model: null when there is nothing to show; a rejected promise is an error. */
export type Provider<K extends ScreenKey> = (
  params: ScreenParams<K>,
  ctx: ProviderContext,
) => Promise<ScreenModel<K> | null>;

/**
 * What a screen's `register.ts` exports as `screen`: its key, the provider the app runs, and, for a screen that is
 * fed from the server, the `frozen` provider the gallery and the tests run in its place (the frozen answer key).
 */
export interface ScreenEntry<K extends ScreenKey> {
  key: K;
  provider: Provider<K>;
  frozen?: Provider<K>;
}

type Registered = Record<string, { screen: { key: string; provider: unknown; frozen?: unknown } }>;

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

/** The frozen providers by key: only the screens that have one. */
export function frozenOf(modules: Registered): Record<string, unknown> {
  return Object.fromEntries(
    Object.values(modules).flatMap(({ screen }) =>
      screen.frozen === undefined ? [] : [[screen.key, screen.frozen]],
    ),
  );
}

const MODULES = import.meta.glob<Registered[string]>('./*/register.ts', { eager: true });
export const PROVIDERS = providersOf(MODULES);
export const FROZEN = frozenOf(MODULES);

/** Where a screen's data comes from: the server (the app) or the frozen answer key (the gallery's root says so). */
export type Source = 'live' | 'frozen';
export const SourceContext = createContext<Source>('live');

/** The state a failed load shows: a refusal, a lost connection, a figure not computed yet, a missing thing (v1's "empty"), or a plain error. */
export function stateOfError(error: unknown): LoadState {
  if (error instanceof LiveOffline) return 'offline';
  if (error instanceof NotComputed) return 'notComputed';
  if (error instanceof ApiError) {
    if (error.status === 403 || error.code === 'forbidden') return 'refused';
    return error.code === 'not_found' ? 'empty' : 'error';
  }
  return 'error';
}

/** One load, as the state a screen shows: ready with its model, empty, offline, refused or error. */
export async function load<K extends ScreenKey>(
  provider: Provider<K>,
  params: ScreenParams<K>,
  ctx: ProviderContext = {},
): Promise<{ state: LoadState; model?: ScreenModel<K> }> {
  try {
    const model = await provider(params, ctx);
    return model === null ? { state: 'empty' } : { state: 'ready', model };
  } catch (error) {
    return { state: stateOfError(error) };
  }
}

/**
 * A screen's model and where it stands. `provider` defaults to the registry's (the frozen one inside the gallery, when
 * the screen has one); a preview or a test may pass its own, inline or not: the latest one is used, and only the key,
 * the params or `retry` start a new load.
 */
export function useScreenModel<K extends ScreenKey>(
  key: K,
  params: ScreenParams<K>,
  given?: Provider<K>,
): Loaded<ScreenModel<K>> {
  const source = useContext(SourceContext);
  const client = useContext(QueryClientContext);
  const provider =
    given ??
    ((source === 'frozen' ? FROZEN[key] : undefined) as Provider<K> | undefined) ??
    (PROVIDERS[key] as Provider<K>);
  const [result, setResult] = useState<{ state: LoadState; model?: ScreenModel<K> }>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  // A new year choice in the address (ADR 0063) loads again: the live reads take the years from it.
  const years = yearsFrom(useLocation().search);
  const asked = JSON.stringify(params);
  const latest = useRef(provider);
  latest.current = provider;
  useEffect(() => {
    let live = true;
    setResult({ state: 'loading' });
    void load(latest.current, JSON.parse(asked) as ScreenParams<K>, { client }).then(
      (r) => live && setResult(r),
    );
    return () => {
      live = false;
    };
  }, [key, asked, attempt, client, years]);
  return { ...result, retry: () => setAttempt((a) => a + 1) };
}
