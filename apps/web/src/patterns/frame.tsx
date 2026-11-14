import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { ChevronLeft } from '../ui/icon.js';
import { Inline, Stack } from '../ui/layout.js';
import { SyncStatus } from './sync-status.js';
import type { ViewState } from './view-state.js';

export interface FrameBack {
  label: string;
  onClick: () => void;
}

/**
 * A section, not a `<main>`: the face wraps patterns in `Page`. With `back` the header shows a back
 * link in the title's place (the title stays for screen readers); `aside` sits beside the sync pill.
 */
export function PatternFrame({
  title,
  back,
  aside,
  children,
}: {
  title: string;
  back?: FrameBack;
  aside?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Stack gap={3}>
        <div className="flex items-center justify-between gap-2">
          {back ? (
            <button
              type="button"
              onClick={back.onClick}
              className="-ml-2 flex min-h-target-min items-center gap-1 rounded-xl px-2 text-body font-semibold text-neutral-900"
            >
              <ChevronLeft aria-hidden size={20} />
              {back.label}
            </button>
          ) : null}
          <h2 id={headingId} className={back ? 'sr-only' : 'text-title3 font-semibold'}>
            {title}
          </h2>
          <Inline gap={2}>
            {aside ? <span className="text-footnote text-neutral-600">{aside}</span> : null}
            <SyncStatus />
          </Inline>
        </div>
        {children}
      </Stack>
    </section>
  );
}

export function StateNotice({
  state,
  empty,
  onRetry,
}: {
  state: Exclude<ViewState, 'ready'>;
  empty: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (state === 'loading')
    return (
      <p role="status" className="text-body text-neutral-600">
        {t('common.loading')}
      </p>
    );
  if (state === 'empty') return <p className="text-body text-neutral-600">{empty}</p>;
  if (state === 'offline')
    return (
      <p role="status" className="text-body text-neutral-600">
        {t('kit.pattern.offline')}
      </p>
    );
  return (
    <Stack gap={2}>
      <p role="alert" className="text-body font-medium text-neutral-900">
        {t('kit.pattern.error')}
      </p>
      {/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}
      <Button variant="secondary" onClick={onRetry}>
        {t('kit.pattern.retry')}
      </Button>
    </Stack>
  );
}
