import type { ScreenEntry } from '../data.js';
import type { LogModel, LogQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    'breakdown-log': { params: LogQuery; model: LogModel };
  }
}

export const screen: ScreenEntry<'breakdown-log'> = {
  key: 'breakdown-log',
  provider: (query) => import('./source.js').then((m) => m.logFromWorkbook(query)),
};
