import type { ScreenEntry } from '../data.js';
import type { DashboardModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** The plant's Dashboard, from the engine's figures. */
    dashboard: { params: Record<string, never>; model: DashboardModel };
  }
}

export const screen: ScreenEntry<'dashboard'> = {
  key: 'dashboard',
  provider: async (_, { client }) => {
    const [live, { dashboardModel }, { priorDate }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('./change.js'),
    ]);
    const [reply, config] = await Promise.all([live.liveReply(client), live.liveConfig(client)]);
    // The strip, the banner and the change are extras: a read that fails leaves its part out, never the page.
    const [state, board, before] = await Promise.all([
      live.liveState(client).catch(() => null),
      live.liveBoard(client).catch(() => null),
      live.liveReplyAt(client, priorDate(reply.asOf)),
    ]);
    return dashboardModel(
      reply,
      { machines: config.machines, state, board, before },
      live.catalogue,
    );
  },
};
