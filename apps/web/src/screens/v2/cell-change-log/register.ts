import type { ScreenEntry } from '../data.js';
import type { CellLogModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'cell-change-log': { params: Record<string, never>; model: CellLogModel };
  }
}

export const screen: ScreenEntry<'cell-change-log'> = {
  key: 'cell-change-log',
  provider: async (_, { client }) => {
    const [{ liveReply, liveRole, liveCodes, catalogue }, { cellLogModel }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
    ]);
    const [reply, role, codeOf] = await Promise.all([
      liveReply(client),
      liveRole(client),
      liveCodes(client),
    ]);
    return cellLogModel(reply, catalogue, { codeOf, role, today: reply.asOf });
  },
};
