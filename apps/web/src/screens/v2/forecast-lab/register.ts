import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    'forecast-lab': { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'forecast-lab'> = {
  key: 'forecast-lab',
  provider: async (_, { client }) => {
    const [{ liveReply }, { forecastLabFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return forecastLabFromReply(await liveReply(client));
  },
};
