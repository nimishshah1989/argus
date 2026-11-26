import type { ScreenEntry } from '../data.js';
import type { OemModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    oem: { params: Record<string, never>; model: OemModel };
  }
}

export const screen: ScreenEntry<'oem'> = {
  key: 'oem',
  provider: async (_, { client }) => {
    const [{ liveReply, catalogue }, { oemModel }, { requireComputed }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/computed.js'),
    ]);
    const reply = await liveReply(client);
    requireComputed(reply, 'oem-analytics');
    // Ticket 815 wires the role; until then nobody may decide.
    return oemModel(reply, catalogue, { mayDecide: false });
  },
};
