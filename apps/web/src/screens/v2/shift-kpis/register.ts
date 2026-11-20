import type { ScreenEntry } from '../data.js';
import type { ShiftModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'shift-kpis': { params: Record<string, never>; model: ShiftModel };
  }
}

export const screen: ScreenEntry<'shift-kpis'> = {
  key: 'shift-kpis',
  provider: async (_, { client }) => {
    const [{ liveReply }, { shiftKpisFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return shiftKpisFromReply(await liveReply(client));
  },
};
