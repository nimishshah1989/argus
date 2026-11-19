import type { User } from '@uptimo/shared/auth';

/**
 * Who sees failed jobs: the same rule as the server's `canSeeFailedJobs` (packages/domain), the admin and the
 * head on a personal login. The Settings entry, the count and the screen all read this one answer.
 */
export const canSeeJobs = (user: User | undefined): boolean =>
  (user?.role === 'admin' || user?.role === 'head') && !user.shared && !user.supportGrantId;
