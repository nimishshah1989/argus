import { useTranslation } from 'react-i18next';
import { useOnline } from '../../data/index.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Template } from './shell/patterns/template.js';

/** The part of a query a screen's state reads. */
interface Loaded {
  data: unknown;
  error: unknown;
}

/** What a key screen shows: its page, or the state line in its place. */
export type ScreenState = ViewState;

export const OVERVIEW = 'overview' as const;
export const LOADING = 'loading' as const;

/**
 * The frame of an analytics screen with the state line in place of its content: loading, offline, the error with
 * Retry, or the screen's own words for "nothing here" (`empty`; absent, the shared "Nothing to show here yet").
 * A screen that is `ready` has nothing to show yet, so it reads as loading.
 */
export function NotReady({
  title,
  state,
  onRetry,
  empty,
}: {
  title: string;
  state: ScreenState;
  onRetry: () => void;
  empty?: string;
}) {
  const { t } = useTranslation();
  if (state === 'error')
    return <Template title={title} kind={OVERVIEW} state={state} onRetry={onRetry} main={null} />;
  if (state === 'empty')
    return (
      <Template
        title={title}
        kind={OVERVIEW}
        state={state}
        empty={empty ?? t('analytics.state.empty')}
        main={null}
      />
    );
  return (
    <Template
      title={title}
      kind={OVERVIEW}
      state={state === 'offline' ? state : LOADING}
      main={null}
    />
  );
}

/**
 * A query as a screen sees it: ready, or the state to show in its place. `isEmpty` is true when the query answered
 * with nothing to draw, and that stays `empty` and is never read as still loading.
 */
export function useFiguresState(figures: Loaded, isEmpty = false): ScreenState {
  const online = useOnline();
  return viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty,
    error: figures.error,
  });
}
