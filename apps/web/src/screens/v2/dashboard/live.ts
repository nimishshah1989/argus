import type { QueryClient } from '@tanstack/react-query';
import { actionCenterBoardQuery, analyticsFiguresAtQuery, getState } from '../../../api.js';
import { priorDate } from '../../analytics/today-change.js';
import { liveConfig, liveReply, read } from '../figures/live.js';
import type { DashboardFacts } from './model.js';

/** A read the page can do without: when it fails, its own part of the screen says so and the rest still shows. */
const optional = <T>(pending: Promise<T>): Promise<T | null> =>
  pending.then(
    (value) => value,
    () => null,
  );

/**
 * What the Dashboard reads, each from the v1 screens' own query (same key, same cache): the engine's figures (the one
 * read the page cannot do without), the same figures 30 days earlier for each change, the desk's open tickets for what
 * needs a person, the Action Center board for its banner, and the plant's machine list for codes.
 */
export async function dashboardFacts(client: QueryClient | undefined): Promise<DashboardFacts> {
  const reply = await liveReply(client);
  const [prior, state, board, config] = await Promise.all([
    optional(read(client, analyticsFiguresAtQuery(priorDate(reply.asOf)))),
    optional(read(client, { queryKey: ['state'], queryFn: getState })),
    optional(read(client, actionCenterBoardQuery)),
    optional(liveConfig(client)),
  ]);
  return {
    reply,
    ...(prior ? { prior } : {}),
    open: state ? { tickets: state.open, now: state.now } : null,
    board,
    machines: (config?.machines ?? []).map((m) => ({
      id: m.id,
      code: m.code,
      category: m.category ?? null,
    })),
  };
}
