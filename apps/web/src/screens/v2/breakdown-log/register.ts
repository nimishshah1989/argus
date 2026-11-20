import i18n from 'i18next';
import type { ScreenEntry } from '../data.js';
import type { LogModel, LogQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    'breakdown-log': { params: LogQuery; model: LogModel };
  }
}

export const screen: ScreenEntry<'breakdown-log'> = {
  key: 'breakdown-log',
  provider: async (query, { client }) => {
    const [{ liveReply }, { logFromFigures }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return logFromFigures(await liveReply(client), query, i18n.t.bind(i18n));
  },
  frozen: (query) => import('./source.js').then((m) => m.logFromWorkbook(query)),
};
