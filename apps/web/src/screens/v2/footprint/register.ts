import type { ScreenEntry } from '../data.js';
import type { FootprintModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    footprint: { params: Record<string, never>; model: FootprintModel };
  }
}

export const screen: ScreenEntry<'footprint'> = {
  key: 'footprint',
  provider: async (_, { client }) => {
    const [{ liveReply, catalogue }, { footprintModel }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
    ]);
    return footprintModel(await liveReply(client), catalogue);
  },
};
