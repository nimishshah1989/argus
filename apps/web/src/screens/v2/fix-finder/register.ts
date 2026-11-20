import type { ScreenEntry } from '../data.js';
import type { FixFinderModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'fix-finder': { params: Record<string, never>; model: FixFinderModel };
  }
}

export const screen: ScreenEntry<'fix-finder'> = {
  key: 'fix-finder',
  provider: async (_, { client }) => {
    const [{ liveReply }, { fixFinderFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return fixFinderFromReply(await liveReply(client));
  },
  frozen: () => import('./source.js').then((m) => m.fixFinderFromKey()),
};
