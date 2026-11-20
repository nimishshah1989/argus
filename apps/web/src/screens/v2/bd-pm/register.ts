import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    'bd-pm': { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'bd-pm'> = {
  key: 'bd-pm',
  provider: async (_, { client }) => {
    const [{ liveReply }, { bdPmFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return bdPmFromReply(await liveReply(client));
  },
  frozen: () => import('./source.js').then((m) => m.bdPmModelFromKey()),
};
