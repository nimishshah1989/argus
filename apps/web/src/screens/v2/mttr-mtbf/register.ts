import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    'mttr-mtbf': { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'mttr-mtbf'> = {
  key: 'mttr-mtbf',
  provider: async (_, { client }) => {
    const [{ liveReply }, { mttrMtbfFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return mttrMtbfFromReply(await liveReply(client));
  },
  frozen: () => import('./source.js').then((m) => m.mttrMtbfModelFromKey()),
};
