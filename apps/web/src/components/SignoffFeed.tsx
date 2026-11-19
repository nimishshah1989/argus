import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSignoffFeed } from '../api.js';
import { useOnline } from '../data/index.js';
import { StateNotice } from '../patterns/frame.js';
import { viewState } from '../patterns/view-state.js';
import { SectionTitle } from '../ui/detail-kit.js';
import { feedRows, type FeedWords } from './signoff-feed.js';

const REFETCH_MS = 30_000;

/**
 * The desk's waiting feed (slice 6): the closed tickets production still has to answer, the longest wait at the top
 * (the server sends them oldest first). Read permissions are the server's: a refusal shows the board's own neutral
 * state, never a second check here.
 */
export function SignoffFeed({ now }: { now?: string }) {
  const { t } = useTranslation();
  const online = useOnline();
  const feed = useQuery({
    queryKey: ['signoff-feed'],
    queryFn: getSignoffFeed,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
  const items = feed.data?.items ?? [];
  const state = viewState({
    online,
    hasData: feed.data !== undefined,
    isEmpty: items.length === 0,
    error: feed.error,
  });
  const names: FeedWords = {
    heading: t('signoff.deskWaiting'),
    headingCount: t('signoff.deskWaitingCount'),
    workRequest: t('signoff.workRequest'),
    waiting: t('signoff.waitingFor'),
  };
  const { heading, rows } = feedRows(items, now ?? new Date().toISOString(), names);
  return (
    <section data-testid="signoff-feed" className="flex flex-col gap-2">
      <SectionTitle>{heading}</SectionTitle>
      {state === 'ready' ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.ticketId}>
              <Link
                to={`/desk/${row.ticketId}`}
                className="flex min-h-target items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
              >
                <span className="min-w-0">
                  <span className="block text-body font-semibold">{row.ref}</span>
                  <span className="block truncate text-footnote text-neutral-600">
                    {[row.machine, row.cell].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right text-caption font-semibold text-warning-ink">
                  {row.waited}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <StateNotice
          state={state}
          empty={t('signoff.deskWaitingEmpty')}
          onRetry={() => void feed.refetch()}
        />
      )}
    </section>
  );
}
