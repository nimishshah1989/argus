import { canSeeFailedJobs, type ActorContext } from '@uptimo/domain';
import type { User } from '@uptimo/shared/auth';

/**
 * Who sees failed jobs: the domain rule the server uses (`canSeeFailedJobs`), plus one check the domain rule
 * does not hold: our own support staff under a grant (`supportGrantId`) never do. The Settings entry, the count
 * and the screen all read this one answer.
 */
export const canSeeJobs = (user: User | undefined): boolean =>
  user !== undefined &&
  !user.supportGrantId &&
  canSeeFailedJobs({
    role: user.role as ActorContext['role'],
    loginId: user.id,
    personId: user.actingPersonId || null,
    shared: user.shared,
  });
