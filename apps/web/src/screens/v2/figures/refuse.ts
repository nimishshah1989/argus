import { canAnalytics, type Role } from '@uptimo/domain';
import { ApiError } from '../../../data/index.js';

/** The screens of the analytics face are for a supervisor, head, plant head or admin: any other login is refused, as the server would. */
export function refuseUnlessAnalytics(role: string | undefined): void {
  const allowed =
    role !== undefined &&
    canAnalytics({ role: role as Role, loginId: '', personId: null, shared: false, cell: null });
  if (!allowed) throw new ApiError('forbidden', 'forbidden', undefined, 403);
}
