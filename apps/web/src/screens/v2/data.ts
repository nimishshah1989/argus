import { useEffect, useRef, useState } from 'react';
import type { EntityRef } from '../../ui/v2/entity-chip.js';
import type { LoadState, Loaded } from '../../ui/v2/screen-states.js';
import type { DashboardModel } from './dashboard/model.js';
import type { EntityModel } from './entity/model.js';
import type { TeamFocusModel } from './team-focus/model.js';

/**
 * The one seam between v2 screens and their data. Every screen is a key here, with the params it is asked for and
 * the model its View draws. Today each provider returns the screen's fixture; the API adapter replaces a key's
 * provider and no View changes.
 */
export type Screens = {
  dashboard: { params: Record<string, never>; model: DashboardModel };
  /** One machine, cell, person or decision, for the drawer on any screen; nothing when it is not found. */
  entity: { params: EntityRef; model: EntityModel };
  'team-focus': { params: Record<string, never>; model: TeamFocusModel };
};
export type ScreenKey = keyof Screens;
export type ScreenParams<K extends ScreenKey> = Screens[K]['params'];
export type ScreenModel<K extends ScreenKey> = Screens[K]['model'];

/** Fetches a screen's model: null when there is nothing to show; a rejected promise is an error. */
export type Provider<K extends ScreenKey> = (
  params: ScreenParams<K>,
) => Promise<ScreenModel<K> | null>;

const PROVIDERS: { [K in ScreenKey]: Provider<K> } = {
  dashboard: () => import('./dashboard/fixture.js').then((m) => m.dashboardFixture),
  entity: (ref) => import('./entity/fixture.js').then((m) => m.entityFixture(ref)),
  'team-focus': () => import('./team-focus/fixture.js').then((m) => m.teamFocusFixture),
};

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
