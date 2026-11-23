import type { ReactElement } from 'react';
import type { LiveEntry } from '../live-frame.js';

/** Where Compare lives in the v2 shell: the Machines group, at v1's address `/analytics/machines?screen=compare`. */
export const COMPARE_ENTRY: LiveEntry = {
  group: 'machines',
  section: 'machines',
  screen: 'compare',
};

/** Where "Open Team Focus" takes the reader (ADR 0021 §5). */
export const TEAM_FOCUS_PATH = '/analytics/today?screen=team-focus';

/**
 * The live Compare (ticket 588, ADR 0021): the pair is the URL's `?a=&b=` (both empty: the engine's own pair);
 * `useScreenModel('compare', { a, b })`, `useRefreshOnFigures(loaded.retry)` and `useKept(loaded)` as the Breakdown
 * Log does; picking a machine sets `a` and `b` in the URL (keeping `screen=compare`, replacing history); "Open Team
 * Focus" navigates to `TEAM_FOCUS_PATH`. Drawn in `LiveFrame` with `COMPARE_ENTRY`: the model's `CompareView`, or
 * `ScreenStates` inside `EntityShell` until one has loaded, with the saved-copy notice after a failed refresh.
 */
export function ComparePage(): ReactElement {
  throw new Error('not built');
}
