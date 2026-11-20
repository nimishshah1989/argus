/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';
import { Button } from './button.js';

/** Where a screen's model stands: still coming, here, failed, or here with nothing in it. */
export type LoadState = 'loading' | 'ready' | 'error' | 'empty';
export type Loaded<M> = { state: LoadState; model?: M; retry: () => void };

/** Grey blocks in the rough shape of a screen while its figures load; said once as "Loading…". */
export function Skeleton({ blocks = 3 }: { blocks?: number }) {
  const { t } = useTranslation();
  return (
    <div className="v2-states" data-state="loading">
      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} className="v2-skeleton" aria-hidden="true" />
      ))}
      <p role="status" className="v2-sub">
        {t('common.loading')}
      </p>
    </div>
  );
}

/** The figures could not load: say so at once, with one button to try again. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="error" role="alert">
      <span className="v2-seg-risk">
        <Icon name="alert" size={24} />
      </span>
      <p>{t('kit.pattern.error')}</p>
      <Button onClick={onRetry}>{t('kit.pattern.retry')}</Button>
    </div>
  );
}

/** Loaded, but nothing to show. */
export function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="empty">
      <span className="v2-sub">
        <Icon name="inbox" size={24} />
      </span>
      <p>{t('analytics.state.empty')}</p>
    </div>
  );
}

/** The one place a screen's load state turns into what the reader sees; `children` draws the ready model. */
export function ScreenStates<M>({
  loaded,
  children,
}: {
  loaded: Loaded<M>;
  children: (model: M) => ReactNode;
}) {
  if (loaded.state === 'ready' && loaded.model !== undefined) return children(loaded.model);
  const body =
    loaded.state === 'error' ? (
      <ErrorState onRetry={loaded.retry} />
    ) : loaded.state === 'empty' ? (
      <EmptyState />
    ) : (
      <Skeleton />
    );
  return body;
}
