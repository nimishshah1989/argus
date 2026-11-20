import type { ScreenEntry } from '../data.js';
import type { WhyWhyModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'why-why': { params: Record<string, never>; model: WhyWhyModel };
  }
}

export const screen: ScreenEntry<'why-why'> = {
  key: 'why-why',
  provider: async (_, { client }) => {
    const [{ liveReply }, { whyWhyFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return whyWhyFromReply(await liveReply(client));
  },
};
