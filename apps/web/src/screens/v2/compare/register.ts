import i18n from 'i18next';
import type { ScreenEntry } from '../data.js';
import type { CompareModel, CompareParams } from './model.js';

declare module '../data.js' {
  interface Screens {
    compare: { params: CompareParams; model: CompareModel };
  }
}

/** The app reads the pair from the server (ticket 588, ADR 0021); the gallery keeps the approved fixture as its frozen answer. */
export const screen: ScreenEntry<'compare'> = {
  key: 'compare',
  provider: async (pair, { client }) => {
    const [{ read }, { compareQuery, liveCompare }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return liveCompare(await read(client, compareQuery(pair)), i18n.t.bind(i18n));
  },
  frozen: (pair) => import('./fixture.js').then((m) => m.compareFixture(pair)),
};
