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
    const [{ liveReply, liveRole, liveCodes, catalogue }, { cellLogModel }, { NotComputed }] =
      await Promise.all([
        import('../figures/live.js'),
        import('./adapter.js'),
        import('../figures/live-error.js'),
      ]);
    const [reply, role, codeOf] = await Promise.all([
      liveReply(client),
      liveRole(client),
      liveCodes(client),
    ]);
    // The engine has not computed the log yet: the screen says so, which is not the same as an empty log.
    const model = cellLogModel(reply, catalogue, { codeOf, role, today: reply.asOf });
    if (model === null) throw new NotComputed();
    return model;
  },
};
