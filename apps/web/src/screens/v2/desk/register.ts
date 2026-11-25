import i18n from 'i18next';
import { getConfig, getMe, getState } from '../../../api.js';
import type { ScreenEntry } from '../data.js';
import { deskFixture } from './fixture.js';
import { openModel } from './adapter.js';
import type { OpenInput, OpenModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    desk: { params: Pick<OpenInput, 'filter' | 'segment'>; model: OpenModel };
  }
}

/**
 * The desk's Open screen. `frozen` is `openModel` over `fixture.ts` (the gallery's and the insight-coverage test's
 * answer); `provider` builds the same model from the query client's `/state`, `/config` and `/auth/me`.
 */
export const screen: ScreenEntry<'desk'> = {
  key: 'desk',
  provider: async ({ filter, segment }, { client }) => {
    if (!client) throw new Error('desk: no query client');
    const [state, config, me] = await Promise.all([
      client.fetchQuery({ queryKey: ['state'], queryFn: getState }),
      client.fetchQuery({ queryKey: ['config'], queryFn: getConfig }),
      client.fetchQuery({ queryKey: ['me'], queryFn: getMe }),
    ]);
    return openModel({ state, config, me: me.user, filter, segment }, i18n.t.bind(i18n));
  },
  frozen: async () => openModel(deskFixture, i18n.t.bind(i18n)),
};
