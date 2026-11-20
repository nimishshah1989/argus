import type { ScreenEntry } from '../data.js';
import type { PmCalendarModel, PmCalendarQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    'pm-calendar': { params: PmCalendarQuery; model: PmCalendarModel };
  }
}

export const screen: ScreenEntry<'pm-calendar'> = {
  key: 'pm-calendar',
  provider: (query) => import('./source.js').then((m) => m.pmCalendarFromStandIn(query)),
};
