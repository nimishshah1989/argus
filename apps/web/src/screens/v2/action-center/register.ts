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
    const { liveActionCenter } = await import('./live.js');
    return liveActionCenter(client);
  },
  frozen: () => import('./frozen.js').then((m) => m.frozenActionCenter()),
};
