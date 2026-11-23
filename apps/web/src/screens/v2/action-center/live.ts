import type { QueryClient } from '@tanstack/react-query';
import { canAnalytics, type ActorContext, type Role } from '@uptimo/domain';
import { actionCenterBoardQuery, getMe } from '../../../api.js';
import { ApiError } from '../../../data/index.js';
import { catalogue, liveConfig, read } from '../figures/live.js';
import { actionCenterModel } from './adapter.js';

/**
 * The Action Center from the server: the same board v1 read (same query, same cache), the plant's own lists for codes and
 * people, and v1's own refusal first, so a login that may not open the screen is told so before anything is asked.
 */
export async function liveActionCenter(client: QueryClient | undefined) {
  const { user } = await read(client, { queryKey: ['me'], queryFn: getMe });
  const actor: ActorContext = {
    role: user.role as Role,
    loginId: user.id,
    personId: user.actingPersonId || null,
    shared: user.shared,
    cell: user.cell ?? null,
  };
  if (!canAnalytics(actor)) throw new ApiError('forbidden', 'Not allowed', undefined, 403);
  const [board, config] = await Promise.all([
    read(client, actionCenterBoardQuery),
    liveConfig(client),
  ]);
  return actionCenterModel(
    { board, machines: config.machines, people: config.people, timeZone: config.timeZone },
    catalogue,
  );
}
