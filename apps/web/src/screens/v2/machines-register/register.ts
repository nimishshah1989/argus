import type { ScreenEntry } from '../data.js';
import type { RegistersModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'machines-register': { params: Record<string, never>; model: RegistersModel };
  }
}

export const screen: ScreenEntry<'machines-register'> = {
  key: 'machines-register',
  provider: async (_, { client }) => {
    const [{ liveReply, catalogue }, { registersModel }, { requireComputed }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/computed.js'),
    ]);
    const reply = await liveReply(client);
    requireComputed(reply, 'registers');
    return registersModel(reply, catalogue);
  },
};
