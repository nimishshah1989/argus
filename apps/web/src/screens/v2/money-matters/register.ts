import type { ScreenEntry } from '../data.js';
import type { MoneyMattersModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'money-matters': { params: Record<string, never>; model: MoneyMattersModel };
  }
}

/** S22 on the live figures and the signed-in login: its role decides money or the refusal, as v1's `mayReadMoney` did. */
export const screen: ScreenEntry<'money-matters'> = {
  key: 'money-matters',
  provider: async (_, { client }) => {
    const [{ default: i18n }, { liveReply, liveRole }, { mayReadMoney }, { moneyMattersModel }] =
      await Promise.all([
        import('i18next'),
        import('../figures/live.js'),
        import('../figures/read.js'),
        import('./adapter.js'),
      ]);
    const [reply, role] = await Promise.all([liveReply(client), liveRole(client)]);
    return moneyMattersModel(reply, i18n.t.bind(i18n), { money: mayReadMoney(role) });
  },
};
