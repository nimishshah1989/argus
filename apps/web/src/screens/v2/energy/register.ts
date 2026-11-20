import type { ScreenEntry } from '../data.js';
import type { EnergyModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    energy: { params: Record<string, never>; model: EnergyModel };
  }
}

export const screen: ScreenEntry<'energy'> = {
  key: 'energy',
  provider: async (_, { client }) => {
    const [{ liveReply }, { energyFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return energyFromReply(await liveReply(client));
  },
};
