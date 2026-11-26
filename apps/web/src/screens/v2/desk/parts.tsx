/* eslint-disable i18next/no-literal-string -- prop values, ids, tones and routes only; every visible string goes through t() */
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getConfig, getSignoffFeed } from '../../../api.js';
import { peopleNames } from '../../../components/format.js';
import {
  feedRows,
  outcomeRows,
  type FeedWords,
  type OutcomeRow,
} from '../../../components/signoff-feed.js';
import { useOnline } from '../../../data/index.js';
import { queueByOwner } from '../../../offline/outbox.js';
import { viewState } from '../../../patterns/view-state.js';
import { Button } from '../../../ui/v2/button.js';
import { Notice } from '../../../ui/v2/notice.js';
import { useFrom } from './ticket-rows.js';
export { type FromList, chipFor, TicketRow, PlainRow } from './ticket-rows.js';

const POLL_MS = 3_000;

export { SyncStatus } from '../../../ui/v2/sync-status.js';

/**
 * The offline and queued state (v1 `OfflineBanner`): offline, or "N queued, reconnecting…" while the outbox holds
 * commands, and one notice per earlier login whose queued work waits on this phone.
 */
export function OfflineNotice() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [heldBy, setHeldBy] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    function refresh() {
      setOnline(navigator.onLine);
      queueByOwner()
        .then((split) => {
          if (!active) return;
          setQueued(split.mine);
          setHeldBy(split.heldBy);
        })
        .catch(() => {
          if (active) setQueued(0);
        });
    }
    const onOnline = () => {
      setOnline(true);
      refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
  }, []);
  const message = online ? t('offline.queued', { count: queued }) : t('offline.banner');
  return (
    <>
      {online && queued === 0 ? null : (
        <div data-testid="offline-banner">
          <Notice tone={online ? 'plan' : 'neutral'} title={message} />
        </div>
      )}
      {heldBy.map((who) => {
        const name = who || t('signin.heldEarlier');
        return (
          <Notice key={who} tone="risk" title={t('signin.held', { name })}>
            {t('signin.heldDetail', { name })}
          </Notice>
        );
      })}
    </>
  );
}

const SIGNOFF_REFETCH_MS = 30_000;

/** The waiting rows, or the feed's loading, empty, offline or error line. */
function SignoffBody({
  state,
  rows,
  outcomes,
  onRetry,
}: {
  state: ReturnType<typeof viewState>;
  rows: ReturnType<typeof feedRows>['rows'];
  outcomes: OutcomeRow[];
  onRetry: () => void;
}): ReactNode {
  const { t } = useTranslation();
  if (state === 'loading') return <p className="v2-sub">{t('common.loading')}</p>;
  if (state === 'empty') return <p className="v2-sub">{t('signoff.deskWaitingEmpty')}</p>;
  if (state === 'offline')
    return (
      <p role="status" className="v2-sub">
        {t('kit.pattern.offline')}
      </p>
    );
  if (state !== 'ready')
    return (
      <Notice
        tone="loss"
        title={t('kit.pattern.error')}
        action={<Button onClick={onRetry}>{t('kit.pattern.retry')}</Button>}
      />
    );
  return (
    <>
      {rows.length === 0 ? (
        <p className="v2-sub">{t('signoff.deskWaitingEmpty')}</p>
      ) : (
        <ul className="v2-desk-rows">
          {rows.map((row) => (
            <SignoffRow
              key={row.ticketId}
              id={row.ticketId}
              title={row.ref}
              line={[row.machine, row.cell].filter(Boolean).join(' · ')}
              pill={row.waited}
              tone="risk"
            />
          ))}
        </ul>
      )}
      <Outcomes outcomes={outcomes} />
    </>
  );
}

/** One sign-off row: it opens its ticket, beside the list on a wide screen. */
function SignoffRow(p: { id: string; title: string; line: string; pill: string; tone: string }) {
  const from = useFrom();
  return (
    <li>
      <Link to={`/desk/${p.id}`} state={from} className="v2-desk-link">
        <span className="v2-desk-main">
          <span className="v2-h3">{p.title}</span>
          <span className="v2-sub">{p.line}</span>
        </span>
        <span className={`v2-pill v2-pill-${p.tone}`}>{p.pill}</span>
      </Link>
    </li>
  );
}

/** The outcomes of the last day, newest first; nothing when there were none. */
function Outcomes({ outcomes }: { outcomes: OutcomeRow[] }): ReactNode {
  const { t } = useTranslation();
  if (outcomes.length === 0) return null;
  return (
    <>
      <h3 className="v2-h3">{t('signoff.deskOutcomes')}</h3>
      <ul className="v2-desk-rows" data-testid="signoff-outcomes">
        {outcomes.map((row) => (
          <SignoffRow
            key={row.ticketId}
            id={row.ticketId}
            title={[row.machine, row.ref].filter(Boolean).join(' · ')}
            line={row.detail}
            pill={row.title}
            tone={row.tone}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * Production sign-off on the desk (v1 `SignoffFeed`, S28): the closed tickets production still has to
 * answer, the longest wait first, then the outcomes of the last day, newest first; each row opens its ticket. The
 * server decides who may read it.
 */
export function SignoffCard({ now }: { now?: string }) {
  const { t } = useTranslation();
  const online = useOnline();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const feed = useQuery({
    queryKey: ['signoff-feed'],
    queryFn: getSignoffFeed,
    staleTime: SIGNOFF_REFETCH_MS,
    refetchInterval: SIGNOFF_REFETCH_MS,
  });
  const items = feed.data?.items ?? [];
  const outcomes = outcomeRows(feed.data?.outcomes ?? [], {
    say: (key, values) => t(key, values ?? {}),
    names: peopleNames(config.data?.people),
    timeZone: config.data?.timeZone,
  });
  const state = viewState({
    online,
    hasData: feed.data !== undefined,
    isEmpty: items.length === 0 && outcomes.length === 0,
    error: feed.error,
  });
  const words: FeedWords = {
    heading: t('signoff.deskWaiting'),
    headingCount: t('signoff.deskWaitingCount'),
    workRequest: t('signoff.workRequest'),
    waiting: t('signoff.waitingFor'),
  };
  const { heading, rows } = feedRows(items, now ?? new Date().toISOString(), words);
  const disputed = outcomes.filter((row) => row.status === 'disputed').length;
  const body = (
    <SignoffBody
      state={state}
      rows={rows}
      outcomes={outcomes}
      onRetry={() => void feed.refetch()}
    />
  );
  return (
    <section data-testid="signoff-feed" aria-label={heading} className="v2-card v2-pad v2-stack">
      <h2 className="v2-h2">{heading}</h2>
      {disputed > 0 && (
        <p className="v2-sub">{t('signoff.deskDisputedCount', { count: disputed })}</p>
      )}
      {body}
    </section>
  );
}

/** A titled kit card around a desk list; `region` names it for a screen reader (the v1 section names). */
export function ListCard({
  title,
  sub,
  aside,
  children,
}: {
  title: string;
  sub?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="v2-card v2-pad v2-stack">
      <div className="v2-card-head">
        <div>
          <h2 className="v2-h2">{title}</h2>
          {sub ? <p className="v2-sub">{sub}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
