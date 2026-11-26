import type { ScreenEntry } from '../data.js';
import type { AnnualReportModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'annual-report': { params: Record<string, never>; model: AnnualReportModel };
  }
}

export const screen: ScreenEntry<'annual-report'> = {
  key: 'annual-report',
  provider: async (_, { client }) => {
    const [{ liveReply }, { annualReportFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return annualReportFromReply(await liveReply(client));
  },
};
