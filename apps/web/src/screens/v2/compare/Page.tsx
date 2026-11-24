import { useMemo, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SavedCopyNotice, ScreenStates, type Loaded } from '../../../ui/v2/screen-states.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useKept } from '../kept.js';
import { LiveFrame, type LiveEntry } from '../live-frame.js';
import { useRefreshOnFigures } from '../refresh.js';
import type { CompareModel, CompareParams } from './model.js';
import { CompareView } from './View.js';

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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const pair = useMemo<CompareParams>(() => ({ a, b }), [a, b]);
  const loaded = useScreenModel('compare', pair);
  useRefreshOnFigures(loaded.retry);
  const model = useKept(loaded);
  const onPick = (next: CompareParams): void =>
    setParams({ screen: 'compare', a: next.a, b: next.b }, { replace: true });
  return (
    <CompareFrame
      loaded={loaded}
      model={model}
      onPick={onPick}
      onAddFocus={() => navigate(TEAM_FOCUS_PATH)}
    />
  );
}

/** What the page draws for where its load stands: the comparison, or the state in the shell under the screen's title. */
function CompareFrame({
  loaded,
  model,
  onPick,
  onAddFocus,
}: {
  loaded: Loaded<CompareModel>;
  model: CompareModel | undefined;
  onPick: (pair: CompareParams) => void;
  onAddFocus: () => void;
}): ReactElement {
  const { t } = useTranslation();
  // A refresh that failed after a good load leaves the last answer on screen, and says so.
  const stale = loaded.state === 'error' || loaded.state === 'offline';
  const title = t('analytics.screen.compare');
  return (
    <LiveFrame
      notice={model && stale ? <SavedCopyNotice text={t('v2a.saved')} /> : null}
      entry={COMPARE_ENTRY}
    >
      {(nav) =>
        model ? (
          <CompareView
            model={model}
            nav={nav}
            title={title}
            onPick={onPick}
            onAddFocus={onAddFocus}
          />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}
