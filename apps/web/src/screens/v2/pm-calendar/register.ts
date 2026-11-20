import i18n from 'i18next';
import type { ScreenEntry } from '../data.js';
import type { PmCalendarModel, PmCalendarQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    'pm-calendar': { params: PmCalendarQuery; model: PmCalendarModel };
  }
}

export const screen: ScreenEntry<'pm-calendar'> = {
  key: 'pm-calendar',
  provider: (query, { client }) =>
    import('./live.js').then((m) => m.livePmCalendar(client, query, i18n.t.bind(i18n))),
  // The gallery and the tests run on the engine over the 11 November workbook, never on the server.
  frozen: (query) => import('./source.js').then((m) => m.pmCalendarFromStandIn(query)),
};
