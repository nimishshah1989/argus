import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { FailedJobsReply } from '@uptimo/shared/replies';
import { getMe } from '../../../api.js';
import { ApiError, http } from '../../../data/index.js';
import { canSeeJobs } from '../../settings/jobs-access.js';

type FailedJob = FailedJobsReply['items'][number];
type Me = Awaited<ReturnType<typeof getMe>>['user'];
export { canSeeJobs };

const LIST = '/api/v1/jobs/failed';
const FAILED_KEY = ['jobs', 'failed'] as const;
/** Same beat as the app's other live lists: a new failure shows within 30 s, far inside the 60 s goal. */
const POLL_MS = 30_000;
/** The server lists at most 100 and sends no total, so a full list reads "100+". */
const SHOWN = 100;
export const countLabel = (count: number): string => (count >= SHOWN ? `${SHOWN}+` : String(count));

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
export function kindWords(queue: string, translate: (key: MessageKey) => string): string {
  const known = (KINDS as Record<string, MessageKey>)[queue];
  if (known) return translate(known);
  const words = queue
    .split(/[._-]+/)
    .filter(Boolean)
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How many jobs failed, for the Settings entry; 0 for anyone who cannot see them. */
export function useFailedCount(user: Me | undefined): number {
  const jobs = useFailedJobs(canSeeJobs(user));
  return jobs.data?.items.length ?? 0;
}

/** Retry runs the job once. The row stays (and says Running) until the server answers; an error leaves it as it was. */
export function useRetryJob(job: FailedJob, kind: string, onRetried: (kind: string) => void) {
  const client = useQueryClient();
  return useMutation({
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
}
