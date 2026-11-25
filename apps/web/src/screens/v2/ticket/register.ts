import i18n from 'i18next';
import type { ScreenEntry } from '../data.js';
import type { TicketModel, TicketQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    ticket: { params: TicketQuery; model: TicketModel };
  }
}

/** The ticket page. `frozen` is `ticketModel` over `fixture.ts` (the gallery's and the insight-coverage test's answer). */
export const screen: ScreenEntry<'ticket'> = {
  key: 'ticket',
  // Live: `/tickets/:id`, `/config`, `/auth/me` and `/brand` through the query client, then `ticketModel`.
  provider: () => Promise.reject(new Error('not implemented')),
  frozen: () =>
    Promise.all([import('./fixture.js'), import('./adapter.js')]).then(([f, m]) =>
      m.ticketModel(f.fixtureInput(), i18n.t.bind(i18n)),
    ),
};
