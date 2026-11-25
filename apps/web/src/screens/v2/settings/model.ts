import type { FailedJobsReply } from '@uptimo/shared/replies';

type FailedJob = FailedJobsReply['items'][number];

/** Who may open Settings: admin or head; `waiting` while the role is still loading. */
export type SettingsAccess = 'allowed' | 'refused' | 'waiting';

/** The jobs takeaway: how many failed, and the oldest failure (`failedAt ?? createdAt`) named by its queue. */
export type JobsTakeaway = { failed: number; kind: string; attempts: number; failedAt: string };

export function settingsAccess(role: string | undefined): SettingsAccess {
  void role;
  throw new Error('not implemented');
}

/** Null when nothing failed. */
export function jobsTakeaway(items: readonly FailedJob[]): JobsTakeaway | null {
  void items;
  throw new Error('not implemented');
}
