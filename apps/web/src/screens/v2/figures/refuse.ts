import { ApiError } from '../../../data/index.js';
import { readsAnalytics } from '../../../roles.js';

/** The screens of the analytics face are for a supervisor, head, plant head or admin: any other login is refused, as the server would. */
export function refuseUnlessAnalytics(role: string | undefined): void {
  if (role === undefined || !readsAnalytics(role))
    throw new ApiError('forbidden', 'forbidden', undefined, 403);
}
