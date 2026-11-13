import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { Inline, Stack } from '../ui/layout.js';
import { SyncStatus } from './sync-status.js';
import type { ViewState } from './view-state.js';

/** A section, not a `<main>`: the face wraps patterns in `Page`. */
export function PatternFrame({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Stack gap={3}>
        <Inline gap={2}>
          <h2 id={headingId} className="text-title3 font-semibold">
            {title}
          </h2>
          <SyncStatus />
        </Inline>
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
