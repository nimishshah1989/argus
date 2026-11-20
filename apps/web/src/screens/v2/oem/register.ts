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
    const [{ liveReply, liveRole, catalogue }, { mayReadMoney }, { oemModel }] = await Promise.all([
      import('../figures/live.js'),
      import('../figures/read.js'),
      import('./adapter.js'),
    ]);
    const [reply, role] = await Promise.all([liveReply(client), liveRole(client)]);
    return oemModel(reply, catalogue, { money: mayReadMoney(role) });
  },
};
