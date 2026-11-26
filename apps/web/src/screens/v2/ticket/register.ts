import i18n from 'i18next';
import { getBrand, getConfig, getMe, getTicket } from '../../../api.js';
import type { ScreenEntry } from '../data.js';
import { ticketModel } from './adapter.js';
import type { TicketModel, TicketQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    ticket: { params: TicketQuery; model: TicketModel };
  }
}

/** The ticket page. `frozen` is `ticketModel` over `fixture.ts` (the gallery's and the insight-coverage test's answer). */
export const screen: ScreenEntry<'ticket'> = {
  key: 'ticket',
  provider: async ({ id }, { client }) => {
    if (!client) throw new Error('ticket: no query client');
    const [detail, config, me, brand] = await Promise.all([
      client.fetchQuery({ queryKey: ['ticket', id], queryFn: () => getTicket(id) }),
      client.fetchQuery({ queryKey: ['config'], queryFn: getConfig }),
      client.fetchQuery({ queryKey: ['me'], queryFn: getMe }),
      client.fetchQuery({
        queryKey: ['brand'],
        queryFn: getBrand,
        staleTime: Infinity,
        retry: false,
      }),
    ]);
    return ticketModel(
      { detail, config, me: me.user, now: new Date().toISOString(), brand: brand.company },
      i18n.t.bind(i18n),
    );
  },
  frozen: () =>
    import('./fixture.js').then((f) => ticketModel(f.fixtureInput(), i18n.t.bind(i18n))),
};
