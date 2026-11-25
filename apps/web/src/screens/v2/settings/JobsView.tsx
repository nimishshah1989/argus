/* eslint-disable i18next/no-literal-string -- ids, icon names and tones only; every visible word goes through t() */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { FailedJobsReply } from '@uptimo/shared/replies';
import { getConfig, getMe } from '../../../api.js';
import { elapsedLabel, formatDateTime } from '../../../components/format.js';
import { useOnline } from '../../../data/index.js';
import { viewState } from '../../../patterns/view-state.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { ScreenStates } from '../../../ui/v2/screen-states.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import {
  canSeeJobs,
  countLabel,
  kindWords,
  useFailedJobs,
  useRetryJob,
} from '../../settings/Jobs.js';
import { jobsTakeaway } from './model.js';

type FailedJob = FailedJobsReply['items'][number];

/** One failed job: its kind, tag, reason, attempts and when, and Retry; the row says Running until the server answers. */
function JobRow({
  job,
  timeZone,
  onRetried,
}: {
  job: FailedJob;
  timeZone?: string;
  onRetried: (kind: string) => void;
}) {
  const { t } = useTranslation();
  const kind = kindWords(job.queue, (key) => t(key));
  const retry = useRetryJob(job, kind, onRetried);
  const tag = retry.isPending
    ? { text: t('jobs.tag.running'), tone: 'neutral' as const }
    : retry.isError
      ? { text: t('jobs.tag.retryFailed'), tone: 'risk' as const }
      : { text: t('jobs.tag.failed'), tone: 'loss' as const };
  return (
    <li className="v2-card v2-stack v2-gap-6">
      <div className="v2-row v2-gap-6">
        <strong>{kind}</strong>
        <KeyPill text={tag.text} tone={tag.tone} icon="alert" />
      </div>
      <p>{job.error || t('jobs.noError')}</p>
      <p className="v2-sub">
        {job.failedAt ? t('jobs.failedAt', { when: formatDateTime(job.failedAt, timeZone) }) : null}
        {job.failedAt ? ' · ' : null}
        {t('jobs.attempts', { count: job.attempts })}
      </p>
      {retry.isError ? <p role="alert">{t('jobs.retryError', { kind })}</p> : null}
      <button
        type="button"
        className="v2-btn v2-btn-ghost"
        disabled={retry.isPending}
        aria-label={t('jobs.retryJob', { kind })}
        onClick={() => retry.mutate()}
      >
        {retry.isPending ? t('jobs.retrying') : t('jobs.retry')}
      </button>
    </li>
  );
}

/** The takeaway above the rows: how many failed and the oldest one named; nothing when none failed. */
function Lead({ items, timeZone }: { items: FailedJob[]; timeZone?: string }) {
  const { t } = useTranslation();
  const lead = jobsTakeaway(items);
  if (!lead) return null;
  return (
    <Takeaway
      data={{
        text: t('jobs.takeaway', {
          count: lead.failed,
          kind: kindWords(lead.kind, (key) => t(key)),
          attempts: t('jobs.attempts', { count: lead.attempts }),
          ago: elapsedLabel(lead.failedAt),
          when: formatDateTime(lead.failedAt, timeZone),
        }),
        tone: 'loss',
        tag: t('jobs.count', { n: countLabel(lead.failed) }),
      }}
    />
  );
}

/** Background jobs: the takeaway on the oldest failure, then a kit row per failed job with Retry. Admin and head, as the API is. */
export function JobsView() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const allowed = canSeeJobs(me.data?.user);
  const jobs = useFailedJobs(allowed);
  const online = useOnline();
  const [done, setDone] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // The Retry button left the page with its row: keyboard focus moves to the result, not to the top.
  useEffect(() => {
    if (done) statusRef.current?.focus();
  }, [done]);
  if (me.data && !allowed)
    return (
      <>
        <h2>{t('jobs.noAccess')}</h2>
        <p>{t('jobs.noAccess.body')}</p>
      </>
    );
  const items = jobs.data?.items ?? [];
  const state = viewState({
    online,
    hasData: jobs.data !== undefined,
    isEmpty: items.length === 0,
    error: jobs.error,
  });
  return (
    <>
      <h2>{t('jobs.title')}</h2>
      <p>{t('jobs.intro')}</p>
      <Lead items={items} timeZone={config.data?.timeZone} />
      {done ? (
        <p ref={statusRef} tabIndex={-1} role="status">
          {t('jobs.retried', { kind: done })}
        </p>
      ) : null}
      <ScreenStates
        loaded={{ state, model: items, retry: () => void jobs.refetch() }}
        emptyText={t('jobs.empty')}
      >
        {(rows) => (
          <ul className="v2-stack v2-gap-6">
            {rows.map((job) => (
              <JobRow key={job.id} job={job} timeZone={config.data?.timeZone} onRetried={setDone} />
            ))}
          </ul>
        )}
      </ScreenStates>
    </>
  );
}
