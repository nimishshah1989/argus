import type { ScreenEntry } from '../data.js';
import type { MonthlyReportModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'monthly-report': { params: Record<string, never>; model: MonthlyReportModel };
  }
}

export const screen: ScreenEntry<'monthly-report'> = {
  key: 'monthly-report',
  provider: async (_, { client }) => {
    const [{ liveReply }, { monthlyReportFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return monthlyReportFromReply(await liveReply(client));
  },
};
