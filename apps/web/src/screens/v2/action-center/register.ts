import type { ScreenEntry } from '../data.js';
import type { ActionCenterModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'action-center': { params: Record<string, never>; model: ActionCenterModel };
  }
}

export const screen: ScreenEntry<'action-center'> = {
  key: 'action-center',
  provider: async (_, { client }) => {
    const [
      { catalogue, liveBoard, liveConfig, liveRole },
      { actionCenterModel },
      { refuseUnlessAnalytics },
    ] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/refuse.js'),
    ]);
    const [role, config, board] = await Promise.all([
      liveRole(client),
      liveConfig(client),
      liveBoard(client),
    ]);
    refuseUnlessAnalytics(role);
    return actionCenterModel(
      board,
      { machines: config.machines, people: config.people, timeZone: config.timeZone },
      catalogue,
    );
  },
};
