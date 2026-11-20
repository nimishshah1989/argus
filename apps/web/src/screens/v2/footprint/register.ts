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
    const [{ liveReply, catalogue }, { footprintModel }, { requireComputed }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/computed.js'),
    ]);
    const reply = await liveReply(client);
    requireComputed(reply, 'a7-footprint');
    return footprintModel(reply, catalogue);
  },
};
