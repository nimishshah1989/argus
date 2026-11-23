import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    'category-cell': { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'category-cell'> = {
  key: 'category-cell',
  provider: async (_, { client }) => {
    const [{ liveReply }, { categoryCellFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return categoryCellFromReply(await liveReply(client));
  },
  frozen: () => import('./source.js').then((m) => m.categoryCellModelFromKey()),
};
