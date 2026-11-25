import i18n from 'i18next';
import { getBoardToday, getConfig, getState } from '../../../api.js';
import type { ScreenEntry } from '../data.js';
import { boardModel } from './adapter.js';
import { REFETCH_MS, type BoardModel, type BoardQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    board: { params: BoardQuery; model: BoardModel };
  }
}

export const screen: ScreenEntry<'board'> = {
  key: 'board',
  // Live: `/state`, `/config` and `/board/today` through the query client (v1's keys), then `boardModel`.
  provider: async ({ tv }, { client }) => {
    if (!client) throw new Error('board: no query client');
    const live = { staleTime: REFETCH_MS };
    const [state, config, today] = await Promise.all([
      client.fetchQuery({ queryKey: ['state'], queryFn: getState, ...live }),
      client.fetchQuery({ queryKey: ['config'], queryFn: getConfig, ...live }),
      // A refused day score (403) leaves the tiles on a dash; the board stays up.
      client.fetchQuery({ queryKey: ['board-today'], queryFn: getBoardToday, ...live }).catch(() => undefined),
    ]);
    return boardModel({ state, config, today, tv }, i18n.t.bind(i18n));
  },
  frozen: (query) => import('./fixture.js').then((m) => m.boardFixture(query.tv)),
};
