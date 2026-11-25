import type { ScreenEntry } from '../data.js';
import type { BottleneckModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    bottleneck: { params: Record<string, never>; model: BottleneckModel };
  }
}

export const screen: ScreenEntry<'bottleneck'> = {
  key: 'bottleneck',
  provider: async (_, { client }) => {
    const [{ liveCodes, liveReply }, { bottleneckFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    const [reply, codeOf] = await Promise.all([liveReply(client), liveCodes(client)]);
    return bottleneckFromReply(reply, codeOf);
  },
};
