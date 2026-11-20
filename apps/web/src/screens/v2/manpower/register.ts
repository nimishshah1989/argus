import type { ScreenEntry } from '../data.js';
import type { ManpowerModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    manpower: { params: Record<string, never>; model: ManpowerModel };
  }
}

export const screen: ScreenEntry<'manpower'> = {
  key: 'manpower',
  provider: async (_, { client }) => {
    const [{ liveReply }, { manpowerFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return manpowerFromReply(await liveReply(client));
  },
};
