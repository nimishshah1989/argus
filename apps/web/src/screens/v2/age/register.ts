import type { ScreenEntry } from '../data.js';
import type { AgeModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    age: { params: Record<string, never>; model: AgeModel };
  }
}

export const screen: ScreenEntry<'age'> = {
  key: 'age',
  provider: async (_, { client }) => {
    const [{ liveReply, catalogue }, { ageModel }, { requireComputed }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/computed.js'),
    ]);
    const reply = await liveReply(client);
    requireComputed(reply, 'a8-age');
    return ageModel(reply, catalogue);
  },
};
