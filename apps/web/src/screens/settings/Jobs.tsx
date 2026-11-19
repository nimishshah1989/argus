/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { FailedJobsReply } from '@uptimo/shared/replies';
import { getConfig, getMe } from '../../api.js';
import { formatDateTime } from '../../components/format.js';
import { ApiError, http, useOnline } from '../../data/index.js';
import { PatternFrame, StateNotice } from '../../patterns/frame.js';
import { viewState } from '../../patterns/view-state.js';
import { Button } from '../../ui/button.js';
import { CircleCheck, CircleX, Cog, RefreshCw, TriangleAlert } from '../../ui/icon.js';
import { TONE_FILL, type ChipTone } from '../../ui/meaning.js';

type FailedJob = FailedJobsReply['items'][number];
type Me = Awaited<ReturnType<typeof getMe>>['user'];

/** The nav entry; the screen reads its own access, as the audit screen does. */
export const JOBS_PAGE = {
  page: 'jobs',
  icon: Cog,
  key: 'jobs.menu',
  screen: JobsScreen,
  adminOnly: true,
} as const;

const LIST = '/api/v1/jobs/failed';
const FAILED_KEY = ['jobs', 'failed'] as const;
/** Same beat as the app's other live lists: a new failure shows within 30 s, far inside the 60 s goal. */
const POLL_MS = 30_000;
/** The server lists at most 100 and sends no total, so a full list reads "100+". */
const SHOWN = 100;
export const countLabel = (count: number): string => (count >= SHOWN ? `${SHOWN}+` : String(count));

/** The server's own rule (DATA-MAP section 4): the admin on a personal login. */
export const canSeeJobs = (user: Me | undefined): boolean =>
  user?.role === 'admin' && !user.shared && !user.supportGrantId;

/** The failed jobs, polled; `enabled` is false for anyone the server would refuse. */
export function useFailedJobs(enabled = true) {
  return useQuery({
    queryKey: FAILED_KEY,
    queryFn: () => http<FailedJobsReply>(LIST),
    enabled,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  });
}

const KINDS = {
  'ai.suggest': 'jobs.kind.ai.suggest',
  'ops.watch': 'jobs.kind.ops.watch',
  'sla.timer': 'jobs.kind.sla.timer',
  'sla.escalate': 'jobs.kind.sla.escalate',
  'register.due': 'jobs.kind.register.due',
  'notify.send': 'jobs.kind.notify.send',
  'notify.sweep': 'jobs.kind.notify.sweep',
  'pm.generate': 'jobs.kind.pm.generate',
  'engine.run': 'jobs.kind.engine.run',
  'engine.freeze': 'jobs.kind.engine.freeze',
} as const satisfies Record<string, MessageKey>;

/** A kind the plant does not know yet reads as its own name in words ("some.new_job" becomes "Some new job"). */
function kindWords(queue: string, translate: (key: MessageKey) => string): string {
  const known = (KINDS as Record<string, MessageKey>)[queue];
  if (known) return translate(known);
  const words = queue
    .split(/[._-]+/)
    .filter(Boolean)
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Look = 'failed' | 'running' | 'retryFailed';
const LOOK = {
  failed: { tone: 'danger', icon: CircleX, label: 'jobs.tag.failed' },
  running: { tone: 'info', icon: RefreshCw, label: 'jobs.tag.running' },
  retryFailed: { tone: 'warning', icon: TriangleAlert, label: 'jobs.tag.retryFailed' },
} as const satisfies Record<Look, { tone: ChipTone; icon: unknown; label: MessageKey }>;

/** Colour never carries meaning alone: an icon and a word on every tag. */
function Tag({ look }: { look: Look }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, label } = LOOK[look];
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold ${TONE_FILL[tone]}`}
    >
      <Icon aria-hidden size={16} />
      {t(label)}
    </span>
  );
}

/** The count on the Settings entry: icon and word, so the red is never the only signal. */
export function FailedCount({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold ${TONE_FILL.danger}`}
    >
      <TriangleAlert aria-hidden size={16} />
      {t('jobs.count', { n: countLabel(count) })}
    </span>
  );
}

/** How many jobs failed, for the Settings entry; 0 for anyone who cannot see them. */
export function useFailedCount(user: Me | undefined): number {
  const jobs = useFailedJobs(canSeeJobs(user));
  return jobs.data?.items.length ?? 0;
}

/** Retry runs the job once. The row stays (and says Running) until the server answers; an error leaves it as it was. */
function RetryRow({
  job,
  kind,
  timeZone,
  onRetried,
}: {
  job: FailedJob;
  kind: string;
  timeZone?: string;
  onRetried: (kind: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const retry = useMutation({
    mutationFn: () =>
      http(`${LIST}/${encodeURIComponent(job.id)}/retry`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      onRetried(kind);
      await client.invalidateQueries({ queryKey: FAILED_KEY });
    },
    onError: (error) => {
      // A job another admin already retried is gone from the server's list: refresh rather than offer it again.
      if (error instanceof ApiError && error.code === 'not_found')
        void client.invalidateQueries({ queryKey: FAILED_KEY });
    },
  });
  const look: Look = retry.isPending ? 'running' : retry.isError ? 'retryFailed' : 'failed';
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-body font-semibold">{kind}</p>
        <Tag look={look} />
      </div>
      <p className="break-words text-body text-neutral-900">{job.error || t('jobs.noError')}</p>
      <p className="text-footnote text-neutral-600">
        {job.failedAt ? t('jobs.failedAt', { when: formatDateTime(job.failedAt, timeZone) }) : null}
        {job.failedAt ? ' · ' : null}
        {t('jobs.attempts', { count: job.attempts })}
      </p>
      {retry.isError ? (
        <p role="alert" className="text-footnote font-medium text-danger-ink">
          {t('jobs.retryError', { kind })}
        </p>
      ) : null}
      <Button
        variant="secondary"
        disabled={retry.isPending}
        aria-label={t('jobs.retryJob', { kind })}
        onClick={() => retry.mutate()}
      >
        {retry.isPending ? t('jobs.retrying') : t('jobs.retry')}
      </Button>
    </li>
  );
}

function NoAccess() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-8 text-center">
      <h2 className="text-title2 font-extrabold">{t('jobs.noAccess')}</h2>
      <p className="text-body text-neutral-600">{t('jobs.noAccess.body')}</p>
    </div>
  );
}

function FailedList({
  items,
  onRetried,
}: {
  items: FailedJob[];
  onRetried: (kind: string) => void;
}) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  return (
    <ul className="flex flex-col gap-2">
      {items.map((job) => (
        <RetryRow
          key={job.id}
          job={job}
          kind={kindWords(job.queue, (key) => t(key))}
          timeZone={config.data?.timeZone}
          onRetried={onRetried}
        />
      ))}
    </ul>
  );
}

/** Background jobs (ticket 78b): the failed ones with their error, and a Retry for each. Admin only, as the API is. */
export function JobsScreen() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const allowed = canSeeJobs(me.data?.user);
  const jobs = useFailedJobs(allowed);
  const online = useOnline();
  const [done, setDone] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // The Retry button left the page with its row: keyboard focus moves to the result, not to the top.
  useEffect(() => {
    if (done) statusRef.current?.focus();
  }, [done]);
  if (me.data && !allowed) return <NoAccess />;
  const items = jobs.data?.items ?? [];
  const state = viewState({
    online,
    hasData: jobs.data !== undefined,
    isEmpty: items.length === 0,
    error: jobs.error,
  });
  return (
    <PatternFrame title={t('jobs.title')}>
      <p className="text-footnote text-neutral-600">{t('jobs.intro')}</p>
      {items.length > 0 ? (
        <div>
          <FailedCount count={items.length} />
        </div>
      ) : null}
      {done ? (
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="flex items-center gap-2 text-body font-medium text-ok-ink"
        >
          <CircleCheck aria-hidden size={18} />
          {t('jobs.retried', { kind: done })}
        </p>
      ) : null}
      {state === 'ready' ? (
        <FailedList items={items} onRetried={setDone} />
      ) : (
        <StateNotice state={state} empty={t('jobs.empty')} onRetry={() => void jobs.refetch()} />
      )}
    </PatternFrame>
  );
}
