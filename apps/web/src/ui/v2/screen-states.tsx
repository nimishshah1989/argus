/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';
import { Button } from './button.js';

/**
 * Where a screen's model stands: still coming, here, failed, here with nothing in it, not reachable because the
 * connection is lost (`offline`), refused to this login (`refused`), or not computed by the engine yet (`notComputed`,
 * which is not the same as having nothing in it).
 */
export type LoadState =
  'loading' | 'ready' | 'error' | 'empty' | 'offline' | 'refused' | 'notComputed';
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
      <p>{t('v2m.refused')}</p>
    </div>
  );
}

/** The engine has not computed this figure yet: say so, so it is not read as "nothing happened". */
export function NotComputedState() {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="not-computed" role="status">
      <span className="v2-sub">
        <Icon name="clock" size={24} />
      </span>
      <p>{t('analytics.notComputed')}</p>
    </div>
  );
}

/** The figures on screen are a saved copy because the connection is lost: one quiet line, worded by the screen. */
export function SavedCopyNotice({ text }: { text: string }) {
  return (
    <p className="v2-source" role="status" data-state="saved-copy">
      <Icon name="clock" size={14} />
      {text}
    </p>
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
    ) : loaded.state === 'notComputed' ? (
      <NotComputedState />
    ) : loaded.state === 'empty' ? (
      <EmptyState text={emptyText} />
    ) : (
      <Skeleton />
    );
  return body;
}
