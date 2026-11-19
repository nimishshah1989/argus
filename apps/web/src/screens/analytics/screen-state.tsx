/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { Template } from './shell/patterns/template.js';

type Figures = ReturnType<typeof useAnalyticsFigures>;

/**
 * The frame of an analytics screen with the state line in place of its content: loading, offline, or the error
 * with Retry. Every key screen asks `useFiguresState` first and draws this when the figures are not there.
 */
export function NotReady({
  title,
  state,
  onRetry,
}: {
  title: string;
  state: 'loading' | 'offline' | 'error';
  onRetry: () => void;
}) {
  if (state === 'error')
    return <Template title={title} kind="overview" state="error" onRetry={onRetry} main={null} />;
  return <Template title={title} kind="overview" state={state} main={null} />;
}

/** The figures reply as a screen sees it: either ready, or the state to show in its place. */
export function useFiguresState(figures: Figures): 'ready' | 'loading' | 'offline' | 'error' {
  const online = useOnline();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  return state === 'ready' || state === 'error' || state === 'offline' ? state : 'loading';
}
