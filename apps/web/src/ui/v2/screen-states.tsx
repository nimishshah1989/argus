/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';
import { Button } from './button.js';

/**
 * Where a screen's model stands: still coming, here, failed, here with nothing in it, not reachable because the
 * connection is lost (`offline`), or refused to this login (`refused`).
 */
export type LoadState = 'loading' | 'ready' | 'error' | 'empty' | 'offline' | 'refused';
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

/** The connection is lost and nothing saved stands in: say so, and offer to try again. */
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="offline" role="status">
      <span className="v2-sub">
        <Icon name="pause" size={24} />
      </span>
      <p>{t('kit.pattern.offline')}</p>
      <Button onClick={onRetry}>{t('kit.pattern.retry')}</Button>
    </div>
  );
}

/** The server refused this login the page: there is nothing to retry, so say whose it is. */
export function RefusedState() {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="refused" role="alert">
      <span className="v2-seg-risk">
        <Icon name="alert" size={24} />
      </span>
      <p>{t('kit.pattern.refused')}</p>
    </div>
  );
}

/** Loaded, but nothing to show; `text` says what is missing when "nothing to show" is too vague (a thing not found). */
export function EmptyState({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="empty">
      <span className="v2-sub">
        <Icon name="inbox" size={24} />
      </span>
      <p>{text ?? t('analytics.state.empty')}</p>
    </div>
  );
}

/** The one place a screen's load state turns into what the reader sees; `children` draws the ready model. */
export function ScreenStates<M>({
  loaded,
  emptyText,
  children,
}: {
  loaded: Loaded<M>;
  emptyText?: string;
  children: (model: M) => ReactNode;
}) {
  if (loaded.state === 'ready' && loaded.model !== undefined) return children(loaded.model);
  const body =
    loaded.state === 'error' ? (
      <ErrorState onRetry={loaded.retry} />
    ) : loaded.state === 'offline' ? (
      <OfflineState onRetry={loaded.retry} />
    ) : loaded.state === 'refused' ? (
      <RefusedState />
    ) : loaded.state === 'empty' ? (
      <EmptyState text={emptyText} />
    ) : (
      <Skeleton />
    );
  return body;
}
