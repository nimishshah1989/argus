import type { FailedJobsReply } from '@uptimo/shared/replies';

type FailedJob = FailedJobsReply['items'][number];

/** Who may open Settings: admin or head; `waiting` while the role is still loading. */
export type SettingsAccess = 'allowed' | 'refused' | 'waiting';

/** The jobs takeaway: how many failed, and the oldest failure (`failedAt ?? createdAt`) named by its queue. */
export type JobsTakeaway = { failed: number; kind: string; attempts: number; failedAt: string };

export function settingsAccess(role: string | undefined): SettingsAccess {
  if (role === undefined) return 'waiting';
  return role === 'admin' || role === 'head' ? 'allowed' : 'refused';
}

/** Null when nothing failed. */
export function jobsTakeaway(items: readonly FailedJob[]): JobsTakeaway | null {
  const when = (job: FailedJob) => job.failedAt ?? job.createdAt;
  const oldest = items.reduce<FailedJob | undefined>(
    (best, job) =>
      best === undefined || Date.parse(when(job)) < Date.parse(when(best)) ? job : best,
    undefined,
  );
  if (!oldest) return null;
  return {
    failed: items.length,
    kind: oldest.queue,
    attempts: oldest.attempts,
    failedAt: when(oldest),
  };
}
